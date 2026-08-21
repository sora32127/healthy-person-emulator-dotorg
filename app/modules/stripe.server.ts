/**
 * Stripe連携（1回限りの支払い）モジュール。
 * - 公式 Stripe Server SDK（stripe-node）を使用。
 * - Workers ランタイムでは fetch を使うため `createFetchHttpClient()`、
 *   署名検証には Workers 互換の `SubtleCryptoProvider`（Web Crypto）を使う。
 * - サポートページの Checkout Session（埋め込み型 embedded）生成と、Webhook の署名検証（HMAC-SHA256）を提供。
 */
import Stripe from 'stripe';

// サポートページ（支持）の金額・文字数制限
// JPY は1円単位で指定できるが、Stripe の非ゼロ決済下限は50円
export const SUPPORT_MIN_YEN = 50;
export const SUPPORT_MAX_YEN = 1_000_000;
export const SUPPORT_MAX_NAME_LENGTH = 30;
export const SUPPORT_MAX_MESSAGE_LENGTH = 200;

export type StripeCheckoutEvent = {
  type?: string;
  data?: {
    object?: {
      metadata?: Record<string, string> | null;
      id?: string;
      mode?: string;
      payment_status?: string;
      currency?: string | null;
      amount_total?: number | null;
    };
  };
};

type PaidSupportMessage = {
  stripeSessionId: string;
  amountYen: number;
  name: string;
  message: string;
};

export function getPaidSupportMessage(event: StripeCheckoutEvent): PaidSupportMessage | null {
  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return null;
  }

  const session = event.data?.object;
  const metadata = session?.metadata;
  const amountYen = Number(session?.amount_total);
  const name = String(metadata?.supporterName ?? '').trim();
  const message = String(metadata?.supportMessage ?? '').trim();

  if (
    !session?.id ||
    session.mode !== 'payment' ||
    session.payment_status !== 'paid' ||
    session.currency !== 'jpy' ||
    metadata?.kind !== 'support' ||
    !Number.isInteger(amountYen) ||
    amountYen < SUPPORT_MIN_YEN ||
    amountYen > SUPPORT_MAX_YEN ||
    name.length === 0 ||
    name.length > SUPPORT_MAX_NAME_LENGTH ||
    message.length > SUPPORT_MAX_MESSAGE_LENGTH
  ) {
    return null;
  }

  return { stripeSessionId: session.id, amountYen, name, message };
}

function getEnv() {
  const env = (globalThis as any).__cloudflareEnv;
  if (!env) throw new Error('Cloudflare env not available');
  return env;
}

export interface SupportCheckoutInput {
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
  amountYen,
  supporterName,
  supportMessage,
}: SupportCheckoutInput): Promise<StripeSession> {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  if (!env.STRIPE_PUBLISHABLE_KEY) {
    throw new Error('STRIPE_PUBLISHABLE_KEY is not set');
  }
  if (!env.BASE_URL) {
    throw new Error('BASE_URL is not set');
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ui_mode: 'embedded_page',
    redirect_on_completion: 'if_required',
    integration_identifier: 'hpe_support_qmvzrxka',
    return_url: new URL('/support?paid=success', env.BASE_URL).toString(),
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
