/**
 * POST /api/stripe/support-checkout
 * サポートページで支持を表明する Checkout Session を生成し、クライアントにクライアントシークレットを返す。
 */
import type { ActionFunctionArgs } from 'react-router';
import { isUserValid } from '~/modules/session.server';
import { createSupportCheckoutSession, SUPPORT_MIN_YEN, SUPPORT_MAX_NAME_LENGTH, SUPPORT_MAX_MESSAGE_LENGTH } from '~/modules/stripe.server';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const amountYen = Number(formData.get('amountYen'));
  const supporterName = String(formData.get('supporterName') ?? '').trim();
  const supportMessage = String(formData.get('supportMessage') ?? '').trim();

  if (!Number.isInteger(amountYen) || amountYen < SUPPORT_MIN_YEN || amountYen > 1000000) {
    return new Response(
      JSON.stringify({ success: false, message: `金額は${SUPPORT_MIN_YEN}円以上、1000000円以下で指定してください` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (supporterName.length === 0 || supporterName.length > SUPPORT_MAX_NAME_LENGTH) {
    return new Response(
      JSON.stringify({ success: false, message: `お名前は1〜${SUPPORT_MAX_NAME_LENGTH}文字で入力してください` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (supportMessage.length > SUPPORT_MAX_MESSAGE_LENGTH) {
    return new Response(
      JSON.stringify({ success: false, message: `メッセージは${SUPPORT_MAX_MESSAGE_LENGTH}文字以内で入力してください` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // コメント投稿と同様、Turnstile 検証済みのユーザーのみ（bot 抑制）
  if (!(await isUserValid(request))) {
    return new Response(
      JSON.stringify({ success: false, message: 'ユーザー認証が必要です' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const origin = new URL(request.url).origin;
    const session = await createSupportCheckoutSession({
      origin,
      amountYen,
      supporterName,
      supportMessage,
    });
    return new Response(
      JSON.stringify({
        success: true,
        clientSecret: session.clientSecret,
        publishableKey: session.publishableKey,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, message: '決済セッションを生成できませんでした' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}