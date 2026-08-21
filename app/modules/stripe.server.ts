/**
 * Stripe連携（1回限りの支払い）モジュール。
 * - 公式 Stripe Server SDK（stripe-node）を使用。
 * - Workers ランタイムでは fetch を使うため `createFetchHttpClient()`、
 *   署名検証には Workers 互換の `SubtleCryptoProvider`（Web Crypto）を使う。
 * - サポートページの Checkout Session（埋め込み型 embedded）生成と、Webhook の署名検証（HMAC-SHA256）を提供。
 */
import Stripe from 'stripe';

// サポートページ（支持）の金額・文字数制限
// 金額は自由入力にできるが、Stripe が取扱通貨単位の上限を持つため 1,000,000円 を上限とする
export const SUPPORT_MIN_YEN = 100;
export const SUPPORT_MAX_NAME_LENGTH = 30;
export const SUPPORT_MAX_MESSAGE_LENGTH = 200;

function getEnv() {
  const env = (globalThis as any).__cloudflareEnv;
  if (!env) throw new Error('Cloudflare env not available');
  return env;
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

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ui_mode: 'embedded',
    return_url: `${origin}/support?paid=success`,
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          unit_amount: amountYen,
          product_data: {
            name: '健常者エミュレータ事例集へのサポート',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: 'support',
      supporterName,
      supportMessage,
    },
  });

  return {
    id: session.id,
    url: session.url ?? null,
    clientSecret: session.client_secret ?? undefined,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  };
}

/**
 * Stripe Webhook の署名を検証する。
 *
 * 公式 SDK の `webhooks.constructEvent`（署名検証付き）を、
 * Workers 対応の `SubtleCryptoProvider`（Web Crypto）で実行する。
 * さらに tolerated 秒(既定600s)より古いタイムスタンプは replay として却下する。
 */
export async function verifyWebhookSignature(
  payload: string,
  stripeSignatureHeader: string | null,
  toleratedSeconds = 600,
): Promise<boolean> {
  const env = getEnv();
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSignatureHeader || !secret) return false;

  try {
    const cryptoProvider = Stripe.createSubtleCryptoProvider();
    await Stripe.webhooks.constructEventAsync(
      payload,
      stripeSignatureHeader,
      secret,
      toleratedSeconds,
      cryptoProvider,
    );
    return true;
  } catch {
    return false;
  }
}