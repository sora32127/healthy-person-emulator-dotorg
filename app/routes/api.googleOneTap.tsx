import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  getAuthenticatedUser,
  getOrCreateGoogleUser,
  setAuthenticatedUser,
} from '~/modules/auth.google.server';
import {
  clearGoogleIdentityCookies,
  getGoogleIdentityConfig,
  verifyGoogleIdentityCredential,
} from '~/modules/google-identity.server';

function result(body: object, status = 200, headers = new Headers()) {
  headers.set('Cache-Control', 'no-store');
  return Response.json(body, { status, headers });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const origin = request.headers.get('Origin');
  if (
    request.headers.get('Sec-Fetch-Site') === 'cross-site' ||
    (origin !== null && origin !== new URL(request.url).origin)
  ) {
    return result({ error: 'このリクエストは許可されていません。' }, 403);
  }
  if (await getAuthenticatedUser(request)) return result({ config: null });
  const { config, headers } = await getGoogleIdentityConfig(request, { renew: true });
  return result({ config }, 200, headers);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return result({ error: 'POSTを使用してください。' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return result({ error: 'このリクエストは許可されていません。' }, 403);
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    return result({ error: 'ログイン情報を確認できませんでした。' }, 400);
  }

  let credential: unknown;
  try {
    const body: unknown = await request.json();
    credential = body && typeof body === 'object' && 'credential' in body
      ? body.credential
      : undefined;
  } catch {
    return result({ error: 'ログイン情報を確認できませんでした。' }, 400);
  }
  if (typeof credential !== 'string' || !credential || credential.length > 16384) {
    return result({ error: 'ログイン情報を確認できませんでした。' }, 400);
  }

  // A delayed Google callback must never replace an already authenticated account.
  if (await getAuthenticatedUser(request)) return result({ ok: true });

  const profile = await verifyGoogleIdentityCredential(request, credential);
  if (!profile) {
    return result({ error: 'Googleでログインできませんでした。下のボタンからお試しください。' }, 401);
  }

  try {
    const user = await getOrCreateGoogleUser(profile.email, profile.picture);
    const headers = await setAuthenticatedUser(request, user);
    await clearGoogleIdentityCookies(headers);
    return result({ ok: true }, 200, headers);
  } catch {
    return result({ error: 'ログインできませんでした。時間をおいて再度お試しください。' }, 500);
  }
}
