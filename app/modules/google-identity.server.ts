import { createCookie } from 'react-router';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { resolveSessionSecret } from './session.server';

const NONCE_TTL = 10 * 60;
const AUTO_PROMPT_TTL = 30 * 24 * 60 * 60;
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

function getEnvironment() {
  return (globalThis as any).__cloudflareEnv as {
    GOOGLE_CLIENT_ID?: string;
    SESSION_SECRET?: string;
    HPE_SESSION_SECRET?: string;
  };
}

function identityCookie(name: string, maxAge: number) {
  return createCookie(name, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
    secrets: [resolveSessionSecret(getEnvironment())],
  });
}

function nonceCookie() {
  return identityCookie('__Host-hpe_google_nonce', NONCE_TTL);
}

function autoPromptCookie() {
  return identityCookie('__Host-hpe_google_auto_prompt', AUTO_PROMPT_TTL);
}

function isActiveNonce(value: unknown): value is { nonce: string; exp: number } {
  if (!value || typeof value !== 'object') return false;
  const { nonce, exp } = value as { nonce?: unknown; exp?: unknown };
  return (
    typeof nonce === 'string' &&
    /^[a-f0-9]{64}$/.test(nonce) &&
    typeof exp === 'number' &&
    exp > Date.now() / 1000 &&
    exp <= Date.now() / 1000 + NONCE_TTL
  );
}

export async function getGoogleIdentityConfig(
  request: Request,
  options?: { renew?: boolean },
): Promise<{
  config: { clientId: string; nonce: string; autoPrompt: boolean; expiresAt: number } | null;
  headers: Headers;
}> {
  const headers = new Headers();
  const clientId = getEnvironment()?.GOOGLE_CLIENT_ID;
  if (!clientId || clientId === 'google-client-demo-id') return { config: null, headers };

  const cookies = request.headers.get('Cookie');
  let nonce = await nonceCookie().parse(cookies);
  if (options?.renew || !isActiveNonce(nonce)) {
    nonce = {
      nonce: Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
      exp: Math.floor(Date.now() / 1000) + NONCE_TTL,
    };
    headers.append('Set-Cookie', await nonceCookie().serialize(nonce));
  }

  const suppressed = await autoPromptCookie().parse(cookies);
  return {
    config: {
      clientId,
      nonce: nonce.nonce,
      autoPrompt: suppressed !== true,
      expiresAt: nonce.exp * 1000,
    },
    headers,
  };
}

/** Verify the token before any user lookup. The nonce belongs to this browser, not the app session. */
export async function verifyGoogleIdentityCredential(request: Request, credential: string) {
  const clientId = getEnvironment()?.GOOGLE_CLIENT_ID;
  if (!clientId || clientId === 'google-client-demo-id') return null;
  const nonce = await nonceCookie().parse(request.headers.get('Cookie'));
  if (!isActiveNonce(nonce)) return null;

  try {
    const { payload } = await jwtVerify(credential, googleKeys, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      requiredClaims: ['sub', 'iat', 'exp', 'nonce', 'email', 'email_verified'],
    });
    if (
      payload.nonce !== nonce.nonce ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
      payload.email_verified !== true
    ) {
      return null;
    }

    // This app identifies existing accounts by email. Google is authoritative for Gmail and
    // Workspace addresses only; third-party addresses need an additional ownership check.
    // Keep those users on the existing explicit OAuth flow instead of silently linking accounts.
    if (
      !payload.email.toLowerCase().endsWith('@gmail.com') &&
      !(typeof payload.hd === 'string' && payload.hd.length > 0)
    ) {
      return null;
    }

    return {
      email: payload.email,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}

export async function clearGoogleIdentityCookies(headers: Headers) {
  headers.append('Set-Cookie', await nonceCookie().serialize('', { maxAge: 0 }));
  headers.append('Set-Cookie', await autoPromptCookie().serialize('', { maxAge: 0 }));
}

export async function suppressGoogleIdentityAutoPrompt(headers: Headers) {
  headers.append('Set-Cookie', await nonceCookie().serialize('', { maxAge: 0 }));
  headers.append('Set-Cookie', await autoPromptCookie().serialize(true));
}
