import type { ActionFunctionArgs } from 'react-router';
import { getSession, commitSession } from '~/modules/session.server';
import { validateRequest, getHashedUserIPAddress } from '~/modules/security.server';

/**
 * POST /api/turnstile-verify
 * Turnstile トークンを検証し、成功したら `isValidUser` をセッションに立てる（bot 対策）。
 * 検証済みセッションはその後の決済チェックアウト等で `isUserValid()` が置き換える。
 */
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const token = String(formData.get('token') ?? '').trim();
  const ipAddress = await getHashedUserIPAddress(request);

  if (!token) {
    return new Response(JSON.stringify({ success: false, message: 'トークンがありません' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isValidRequest = await validateRequest(token, ipAddress);
  if (!isValidRequest) {
    return new Response(JSON.stringify({ success: false, message: 'ユーザー検証に失敗しました' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await getSession(request.headers.get('Cookie'));
  session.set('isValidUser', true);
  return new Response(JSON.stringify({ success: true, message: '検証が完了しました' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': await commitSession(session),
    },
  });
}
