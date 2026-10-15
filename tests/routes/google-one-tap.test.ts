// @vitest-environment node

import { RouterContextProvider } from 'react-router';
import { generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGoogleUser, findUserByEmail } from '~/modules/db.server';
import { getGoogleIdentityConfig } from '~/modules/google-identity.server';
import { commitSession, getSession, initSessionStorage } from '~/modules/session.server';
import { initVisitorSession } from '~/modules/visitor.server';
import { authenticator } from '~/modules/auth.google.server';
import { action, loader as renew } from '~/routes/api.googleOneTap';
import { loader as logout } from '~/routes/logout';
import { loader as oauthCallback } from '~/routes/auth.google.callback';

const { keyResolver, authenticate } = vi.hoisted(() => ({
  keyResolver: vi.fn(),
  authenticate: vi.fn(),
}));

vi.mock('jose', async (importOriginal) => ({
  ...(await importOriginal<typeof import('jose')>()),
  createRemoteJWKSet: () => keyResolver,
}));

vi.mock('~/modules/db.server', () => ({
  findUserByEmail: vi.fn(),
  createGoogleUser: vi.fn(),
}));

vi.mock('~/modules/auth.google.server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/modules/auth.google.server')>()),
  authenticator: { authenticate },
}));

const origin = 'https://example.com';
const existingUser = {
  userId: 1,
  userUuid: 'existing-user',
  email: 'member@gmail.com',
  userAuthType: 'Email',
};
let signingKey: CryptoKey;

function args(request: Request) {
  return {
    request,
    url: new URL(request.url),
    pattern: '/api/googleOneTap',
    params: {},
    context: new RouterContextProvider(),
  };
}

function cookieHeaders(headers: Headers) {
  return headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}

async function browser() {
  const { config, headers } = await getGoogleIdentityConfig(new Request(origin));
  return { config: config!, cookie: cookieHeaders(headers), headers };
}

async function token(nonce: string, claims: Record<string, unknown> = {}, key = signingKey) {
  return new SignJWT({
    sub: 'google-user-123',
    nonce,
    email: existingUser.email,
    email_verified: true,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'google-key' })
    .setIssuer(typeof claims.iss === 'string' ? claims.iss : 'https://accounts.google.com')
    .setAudience(typeof claims.aud === 'string' ? claims.aud : 'google-client-id')
    .setIssuedAt()
    .setExpirationTime(typeof claims.exp === 'number' ? claims.exp : '5m')
    .sign(key);
}

function login(credential: unknown, cookie?: string, extraHeaders?: Record<string, string>) {
  return action(args(new Request(`${origin}/api/googleOneTap`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify({ credential }),
  })));
}

describe('Google One Tap authentication', () => {
  beforeAll(async () => {
    const keys = await generateKeyPair('RS256');
    signingKey = keys.privateKey;
    keyResolver.mockResolvedValue(keys.publicKey);
    initSessionStorage('google-one-tap-test-secret');
    initVisitorSession();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('__cloudflareEnv', {
      GOOGLE_CLIENT_ID: 'google-client-id',
      HPE_SESSION_SECRET: 'google-one-tap-test-secret',
    });
    vi.mocked(findUserByEmail).mockResolvedValue(existingUser);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses a signed, HttpOnly nonce cookie without overwriting the activity session', async () => {
    const session = await getSession(null);
    session.set('likedPages', [42]);
    const activityCookie = (await commitSession(session)).split(';')[0];
    const first = await browser();
    const cookie = first.headers.get('Set-Cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('Max-Age=600');
    expect(cookie).not.toContain('__healthy_person_emulator=');
    expect(first.config.autoPrompt).toBe(true);
    expect(first.config.autoSelect).toBe(true);
    expect(first.config.expiresAt).toBeGreaterThan(Date.now() + 590000);
    expect(first.config.expiresAt).toBeLessThanOrEqual(Date.now() + 600000);
    const second = await getGoogleIdentityConfig(new Request(origin, {
      headers: { Cookie: `${activityCookie}; ${first.cookie}` },
    }));
    expect(second.config?.nonce).toBe(first.config.nonce);
    expect(second.config?.expiresAt).toBe(first.config.expiresAt);
    expect(second.headers.has('Set-Cookie')).toBe(false);

    const response = await login(await token(first.config.nonce), `${activityCookie}; ${first.cookie}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const loggedIn = await getSession(cookieHeaders(response.headers));
    expect(loggedIn.get('likedPages')).toEqual([42]);
    expect(loggedIn.get('user')).toMatchObject({
      userUuid: existingUser.userUuid,
      userAuthType: 'Email',
    });
    expect(createGoogleUser).not.toHaveBeenCalled();
    expect(response.headers.getSetCookie()).toEqual(expect.arrayContaining([
      expect.stringContaining('__Host-hpe_google_nonce=; Max-Age=0'),
    ]));
  });

  it('creates a Google account after validating a Workspace token', async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(null);
    vi.mocked(createGoogleUser).mockResolvedValue({ ...existingUser, userAuthType: 'Google' });
    const { config, cookie } = await browser();
    const response = await login(await token(config.nonce, {
      email: 'member@workspace.example',
      hd: 'workspace.example',
    }), cookie);
    expect(response.status).toBe(200);
    expect(createGoogleUser).toHaveBeenCalledWith('member@workspace.example');
  });

  it('can renew an active nonce without changing the app session', async () => {
    const { config, cookie } = await browser();
    const refreshed = await getGoogleIdentityConfig(new Request(origin, {
      headers: { Cookie: cookie },
    }), { renew: true });
    expect(refreshed.config?.nonce).not.toBe(config.nonce);
    expect(refreshed.headers.get('Set-Cookie')).toContain('__Host-hpe_google_nonce=');
    expect(refreshed.headers.get('Set-Cookie')).not.toContain('__healthy_person_emulator=');
    expect((await login(await token(config.nonce), cookieHeaders(refreshed.headers))).status).toBe(401);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it('renews an expired nonce via an uncached same-origin GET without requiring Origin', async () => {
    const { config, cookie } = await browser();
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 11 * 60 * 1000);
    const response = await renew(args(new Request(`${origin}/api/googleOneTap`, {
      headers: { Cookie: cookie, 'Sec-Fetch-Site': 'same-origin' },
    })));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    const refreshed = await response.json() as { config: typeof config };
    expect(refreshed.config.nonce).not.toBe(config.nonce);
    expect(refreshed.config.expiresAt).toBeGreaterThan(Date.now());
    expect(findUserByEmail).not.toHaveBeenCalled();
    expect((await login(
      await token(refreshed.config.nonce),
      cookieHeaders(response.headers),
    )).status).toBe(200);
  });

  it('does not issue another nonce for an authenticated renewal request', async () => {
    const session = await getSession(null);
    session.set('user', { userUuid: 'other-user', email: 'other@gmail.com', userAuthType: 'Google' });
    const response = await renew(args(new Request(`${origin}/api/googleOneTap`, {
      headers: { Cookie: (await commitSession(session)).split(';')[0] },
    })));
    expect(await response.json()).toEqual({ config: null });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.has('Set-Cookie')).toBe(false);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it.each([
    ['Sec-Fetch-Site', 'cross-site'],
    ['Origin', 'https://attacker.example'],
  ])('rejects cross-origin renewal requests before issuing a nonce (%s)', async (name, value) => {
    const response = await renew(args(new Request(`${origin}/api/googleOneTap`, {
      headers: { [name]: value },
    })));
    expect(response.status).toBe(403);
    expect(response.headers.has('Set-Cookie')).toBe(false);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong audience', { aud: 'other-client' }],
    ['wrong issuer', { iss: 'https://attacker.example' }],
    ['expired token', { exp: 1 }],
    ['wrong nonce', { nonce: 'not-this-browser' }],
    ['missing nonce', { nonce: undefined }],
    ['unverified email', { email_verified: false }],
    ['string verification flag', { email_verified: 'true' }],
    ['missing subject', { sub: undefined }],
    ['third-party email', { email: 'member@other.example' }],
  ])('rejects %s before a database lookup', async (_label, claims) => {
    const { config, cookie } = await browser();
    const response = await login(await token(config.nonce, claims), cookie);
    expect(response.status).toBe(401);
    expect(findUserByEmail).not.toHaveBeenCalled();
    expect(createGoogleUser).not.toHaveBeenCalled();
    expect(response.headers.has('Set-Cookie')).toBe(false);
  });

  it('rejects a forged signature before a database lookup', async () => {
    const { config, cookie } = await browser();
    const other = await generateKeyPair('RS256');
    const response = await login(await token(config.nonce, {}, other.privateKey), cookie);
    expect(response.status).toBe(401);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it('requires an explicit token expiration', async () => {
    const { config, cookie } = await browser();
    const credential = await new SignJWT({
      sub: 'google-user-123',
      nonce: config.nonce,
      email: existingUser.email,
      email_verified: true,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'google-key' })
      .setIssuer('https://accounts.google.com')
      .setAudience('google-client-id')
      .setIssuedAt()
      .sign(signingKey);
    expect((await login(credential, cookie)).status).toBe(401);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects a missing, tampered or expired browser nonce before a database lookup', async () => {
    const { config, cookie } = await browser();
    const credential = await token(config.nonce);
    expect((await login(credential)).status).toBe(401);
    expect((await login(credential, `${cookie}tampered`)).status).toBe(401);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 11 * 60 * 1000);
    expect((await login(credential, cookie)).status).toBe(401);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it.each([undefined, 'https://attacker.example', 'null'])('requires same-origin Origin (%s)', async (value) => {
    const { config, cookie } = await browser();
    const headers = new Headers({ 'Content-Type': 'application/json', Cookie: cookie });
    if (value) headers.set('Origin', value);
    const response = await action(args(new Request(`${origin}/api/googleOneTap`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ credential: await token(config.nonce) }),
    })));
    expect(response.status).toBe(403);
    expect(keyResolver).not.toHaveBeenCalled();
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects malformed credentials without accessing Google or the database', async () => {
    for (const credential of [undefined, 123, '', 'a'.repeat(16385)]) {
      expect((await login(credential)).status).toBe(400);
    }
    expect((await login('credential', undefined, { 'Content-Type': 'text/plain' })).status).toBe(400);
    expect(keyResolver).not.toHaveBeenCalled();
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it.each([null, [], 123, 'credential'])('rejects a non-object JSON body (%s)', async (body) => {
    const response = await action(args(new Request(`${origin}/api/googleOneTap`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })));
    expect(response.status).toBe(400);
    expect(keyResolver).not.toHaveBeenCalled();
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it('preserves an existing authenticated account when a delayed callback arrives', async () => {
    const session = await getSession(null);
    session.set('user', { userUuid: 'other-user', email: 'other@gmail.com', userAuthType: 'Google' });
    const response = await login('delayed-credential', (await commitSession(session)).split(';')[0]);
    expect(response.status).toBe(200);
    expect(response.headers.has('Set-Cookie')).toBe(false);
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it('returns an uncached safe error without a session if user storage fails', async () => {
    vi.mocked(findUserByEmail).mockRejectedValue(new Error('private database detail'));
    const { config, cookie } = await browser();
    const response = await login(await token(config.nonce), cookie);
    expect(response.status).toBe(500);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.has('Set-Cookie')).toBe(false);
    expect(await response.text()).not.toContain('private database detail');
  });

  it('keeps the account chooser after logout while suppressing automatic selection until explicit OAuth login', async () => {
    let logoutResponse: Response | undefined;
    try {
      await logout(args(new Request(`${origin}/logout`)));
    } catch (response) {
      logoutResponse = response as Response;
    }
    expect(logoutResponse?.status).toBe(302);
    const suppressedCookies = cookieHeaders(logoutResponse!.headers);
    const suppressed = await getGoogleIdentityConfig(new Request(origin, {
      headers: { Cookie: suppressedCookies },
    }));
    expect(suppressed.config?.autoPrompt).toBe(true);
    expect(suppressed.config?.autoSelect).toBe(false);
    expect(logoutResponse!.headers.getSetCookie()).toEqual(expect.arrayContaining([
      expect.stringContaining('__Host-hpe_google_auto_prompt='),
      expect.stringContaining('__healthy_person_emulator='),
    ]));
    const suppressionCookie = logoutResponse!.headers.getSetCookie().find((cookie) =>
      cookie.startsWith('__Host-hpe_google_auto_prompt='),
    )!;
    expect(suppressionCookie).toContain('Max-Age=2592000');
    const refreshed = await renew(args(new Request(`${origin}/api/googleOneTap`, {
      headers: { Cookie: `${suppressionCookie.split(';')[0]}; ${cookieHeaders(suppressed.headers)}` },
    })));
    expect(refreshed.status).toBe(200);
    const refreshedConfig = (await refreshed.json()).config;
    expect(refreshedConfig.nonce).not.toBe(suppressed.config?.nonce);
    expect(refreshedConfig).toMatchObject({
      autoPrompt: true,
      autoSelect: false,
    });
    vi.mocked(authenticator.authenticate).mockResolvedValue({
      userUuid: existingUser.userUuid,
      email: existingUser.email,
      userAuthType: 'Google',
    });
    let callbackResponse: Response | undefined;
    try {
      await oauthCallback(args(new Request(`${origin}/auth/google/callback`, {
        headers: { Cookie: suppressedCookies },
      })));
    } catch (response) {
      callbackResponse = response as Response;
    }
    expect(callbackResponse?.status).toBe(302);
    expect(callbackResponse!.headers.getSetCookie()).toEqual(expect.arrayContaining([
      expect.stringContaining('__Host-hpe_google_auto_prompt=; Max-Age=0'),
    ]));
    const afterExplicitLogin = await getGoogleIdentityConfig(new Request(origin, {
      headers: { Cookie: cookieHeaders(callbackResponse!.headers) },
    }));
    expect(afterExplicitLogin.config?.autoSelect).toBe(true);
  });

  it('disables Google Identity Services for demo credentials', async () => {
    vi.stubGlobal('__cloudflareEnv', { GOOGLE_CLIENT_ID: 'google-client-demo-id' });
    const value = await getGoogleIdentityConfig(new Request(origin));
    expect(value.config).toBeNull();
    expect(value.headers.has('Set-Cookie')).toBe(false);
  });
});
