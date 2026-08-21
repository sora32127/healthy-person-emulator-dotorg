/**
 * POST /api/stripe/webhook
 * Stripe から送られる決済完了イベントを受け取り、サポートメッセージを保存する。
 * - 署名検証を必ず行う（偽の Webhook による無料保存・不正を防ぐ）
 * - 冪等: stripe_session_id を unique キーにして二重処理を防ぐ
 */
import type { ActionFunctionArgs } from 'react-router';
import { verifyWebhookSignature } from '~/modules/stripe.server';
import { recordPaidSupportMessage } from '~/modules/db.server';

export async function action({ request }: ActionFunctionArgs) {
  const payload = await request.clone().text();
  const signature = request.headers.get('Stripe-Signature');

  const valid = await verifyWebhookSignature(payload, signature);
  if (!valid) {
    console.error('[stripe-webhook] signature verification failed');
    return new Response('signature mismatch', { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type?: string;
    data?: {
      object?: {
        metadata?: Record<string, string> | null;
        id?: string;
        amount_total?: number;
      };
    };
  };

  if (event.type === 'checkout.session.completed') {
    const stripeSessionId = event.data?.object?.id;
    const amountYen = Number(event.data?.object?.amount_total ?? 0);
    const name = String(event.data?.object?.metadata?.supporterName ?? '').trim() || '匿名';
    const message = String(event.data?.object?.metadata?.supportMessage ?? '').trim();

    if (stripeSessionId && amountYen > 0) {
      try {
        const result = await recordPaidSupportMessage(name, message, amountYen, stripeSessionId);
        if (!result.alreadyProcessed) {
          console.log(`[stripe-webhook] support message saved (+${amountYen}yen)`);
        }
      } catch (error) {
        console.error('[stripe-webhook] failed to save support message:', error);
        return new Response('internal error', { status: 500 });
      }
    }
  }

  return new Response('ok');
}