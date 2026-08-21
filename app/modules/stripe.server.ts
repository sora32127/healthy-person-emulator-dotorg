/**
 * Stripe連携（1回限りの支払い）モジュール。
 * - Stripe Server SDK は使わず、Workers ランタイム標準の fetch / Web Crypto で実装。
 * - サポートページの Checkout Session（埋め込み型 embedded）生成と、Webhook の署名検証（HMAC-SHA256）を提供。
 */

// サポートページ（支持）の金額・文字数制限
// 金額は自由入力にできるが、Stripe が取扱通貨単位の上限を持つため 1,000,000円 を上限とする
export const SUPPORT_MIN_YEN = 100;
export const SUPPORT_MAX_NAME_LENGTH = 30;
export const SUPPORT_MAX_MESSAGE_LENGTH = 200;

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function getEnv() {
  const env = (globalThis as any).__cloudflareEnv;
  if (!env) throw new Error('Cloudflare env not available');
  return env;
}

/** application/x-www-form-urlencoded のボディを構築する。括弧付きキー（配列/ハッシュ）も正しくエンコードする。 */
function encodeForm(entries: [string, string | number | undefined][]) {
  return entries
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');
}

export interface SupportCheckoutInput {
  origin: string;
  amountYen: number;
  supporterName: string;
  supportMessage: string;
}

export type StripeSession = {
  id: string;
  url: string | null;
  clientSecret?: string;
  publishableKey?: string;
};

/**
 * サポートページの Checkout Session を生成する（1回払い・埋め込み型）。
 * 金額・名前・メッセージを metadata に乗せ、Webhook で保存する。
 */
export async function createSupportCheckoutSession({
  origin,
  amountYen,
  supporterName,
  supportMessage,
}: SupportCheckoutInput): Promise<StripeSession> {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }

  const body = encodeForm([
    ['mode', 'payment'],
    ['ui_mode', 'embedded'],
    ['return_url', `${origin}/support?paid=success`],
    ['line_items[0][price_data][currency]', 'jpy'],
    ['line_items[0][price_data][unit_amount]', amountYen],
    ['line_items[0][price_data][product_data][name]', '健常者エミュレータ事例集へのサポート'],
    ['line_items[0][quantity]', '1'],
    ['metadata[kind]', 'support'],
    ['metadata[supporterName]', supporterName],
    ['metadata[supportMessage]', supportMessage],
  ]);

  const res = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe checkout creation failed (${res.status}): ${text}`);
  }

  const raw = (await res.json()) as {
    id: string;
    url: string | null;
    client_secret?: string | null;
  };

  return {
    id: raw.id,
    url: raw.url,
    clientSecret: raw.client_secret ?? undefined,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  };
}

/**
 * Stripe Webhook の署名を検証する。
 *
 * Stripe-Signature ヘッダー形式:
 *   t=<unix>, v1=<hmac-hex>
 * 検証: signed_payload = `${timestamp}.${payload}`
 *       期待値 = lower_hex(HMAC-SHA256(webhook_secret, signed_payload))
 * さらに tolerated 秒(既定300s)より古いタイムスタンプは replay として却下する。
 */
export async function verifyWebhookSignature(
  payload: string,
  stripeSignatureHeader: string | null,
  toleratedSeconds = 300,
): Promise<boolean> {
  const env = getEnv();
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSignatureHeader || !secret) return false;

  const params = new Map<string, string>();
  for (const term of stripeSignatureHeader.split(',')) {
    const eqIdx = term.indexOf('=');
    if (eqIdx === -1) continue;
    params.set(term.slice(0, eqIdx), term.slice(eqIdx + 1));
  }

  const timestamp = Number(params.get('t'));
  const signature = params.get('v1');
  if (!Number.isFinite(timestamp) || !signature) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleratedSeconds) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' }, key, encoder.encode(signedPayload)),
  );
  const expectedHex = [...signatureBytes].map((b) => b.toString(16).padStart(2, '0')).join('');

  return signature === expectedHex;
}