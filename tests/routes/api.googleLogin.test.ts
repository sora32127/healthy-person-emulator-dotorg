// @vitest-environment node

import { createHash } from 'node:crypto';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ findUserByEmail: vi.fn(), createGoogleUser: vi.fn() }));
vi.mock('~/modules/db.server', () => db);

function request(path: string, cookie?: string, method = 'GET') {
  return new Request(`https://example.test${path}`, {
    method,
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

function routeArgs(request: Request, pattern: string) {
  return {
    request,
    url: new URL(request.url),
    pattern,
    params: {},
    context: new RouterContextProvider(),
  };
}

async function getRedirect(result: Promise<unknown>) {
  try {
    await result;
  } catch (response) {
    if (!(response instanceof Response)) throw response;
    expect(response.status).toBe(302);
    return response;
  }
  throw new Error('Expected an OAuth redirect');
}

async function startLogin(cookie?: string) {
  const { action } = await import('~/routes/api.googleLogin');
  const response = await getRedirect(
    action(routeArgs(request('/api/googleLogin', cookie, 'POST'), '/api/googleLogin')),
  );
  const location = response.headers.get('Location');
  const setCookie = response.headers.get('Set-Cookie');
  expect(location).not.toBeNull();
  expect(setCookie).not.toBeNull();
  return { response, url: new URL(location!), cookie: setCookie!.split(';')[0] };
}

async function expectNoIdentity(cookie: string) {
  const { getAuthenticatedUser } = await import('~/modules/auth.google.server');
  await expect(getAuthenticatedUser(request('/', cookie))).resolves.toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  expect(db.findUserByEmail).not.toHaveBeenCalled();
  expect(db.createGoogleUser).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('__cloudflareEnv', {
    GOOGLE_CLIENT_ID: 'account-selection-test-client-id',
    GOOGLE_CLIENT_SECRET: 'account-selection-test-client-secret',
    CLIENT_URL: 'https://example.test',
    HPE_SESSION_SECRET: 'account-selection-test-session-secret',
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => vi.unstubAllGlobals());

describe('Google login initiation', () => {
  it('asks Google to select an account while preserving callback, state and PKCE', async () => {
    const { response, url, cookie } = await startLogin();
    const state = url.searchParams.get('state');
    const cookieData = new URLSearchParams(cookie.slice(cookie.indexOf('=') + 1));
    const verifier = cookieData.get(state!);

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('account-selection-test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.test/auth/google/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual(['openid', 'email', 'profile']);
    expect(state).toBeTruthy();
    expect(cookieData.get('state')).toBe(state);
    expect(verifier).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(verifier!).digest('base64url'),
    );
    expect(response.headers.get('Set-Cookie')).not.toContain('__healthy_person_emulator=');
    await expectNoIdentity(cookie);
    expect(url.searchParams.getAll('prompt')).toEqual(['select_account']);
  });

  it('starts another account selection after logout with a fresh OAuth state', async () => {
    const first = await startLogin();
    const auth = await import('~/modules/auth.google.server');
    const headers = await auth.setAuthenticatedUser(request('/'), {
      userUuid: 'account-selection-test-user',
      email: 'account-selection-test@example.test',
      userAuthType: 'Google',
    });
    const signedCookie = headers.get('Set-Cookie')!.split(';')[0];
    await expect(auth.getAuthenticatedUser(request('/', signedCookie))).resolves.not.toBeNull();
    const { loader } = await import('~/routes/logout');
    const response = await getRedirect(
      loader(routeArgs(request('/logout', `${signedCookie}; ${first.cookie}`), '/logout')),
    );
    const expiredCookie = response.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith('__healthy_person_emulator='));

    expect(response.headers.get('Location')).toBe('/');
    expect(expiredCookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
    // The browser removes the expired app cookie; a remaining OAuth state cookie
    // must not bypass a new authorization request or preserve an app identity.
    await expectNoIdentity(first.cookie);
    const second = await startLogin(first.cookie);
    expect(second.url.searchParams.get('state')).toBeTruthy();
    expect(second.url.searchParams.get('state')).not.toBe(first.url.searchParams.get('state'));
    expect(second.url.searchParams.getAll('prompt')).toEqual(['select_account']);
  });

  it('rejects a callback whose state does not match the issued cookie', async () => {
    const { cookie } = await startLogin();
    const { loader } = await import('~/routes/auth.google.callback');
    const callback = request('/auth/google/callback?state=wrong-state&code=synthetic-code', cookie);

    await expect(loader(routeArgs(callback, '/auth/google/callback'))).rejects.toThrow(
      "State in URL doesn't match state in cookie.",
    );
    await expectNoIdentity(cookie);
  });

  it('does not create an app session when Google denies a callback with matching state', async () => {
    const { url, cookie } = await startLogin();
    const state = url.searchParams.get('state')!;
    const { loader } = await import('~/routes/auth.google.callback');
    const params = new URLSearchParams({ state, error: 'access_denied' });
    const callback = request(`/auth/google/callback?${params}`, cookie);

    await expect(loader(routeArgs(callback, '/auth/google/callback'))).rejects.toMatchObject({
      code: 'access_denied',
    });
    await expectNoIdentity(cookie);
  });
});
