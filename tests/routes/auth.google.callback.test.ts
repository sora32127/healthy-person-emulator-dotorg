// @vitest-environment node

import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/modules/db.server', () => ({
  findUserByEmail: vi.fn(),
  createGoogleUser: vi.fn(),
}));

const user = {
  userUuid: 'callback-test-user',
  email: 'callback-test@example.test',
  userAuthType: 'Google' as const,
};

type CallbackLoader = typeof import('~/routes/auth.google.callback').loader;

function createRequest(cookie?: string) {
  return new Request('https://example.test/auth/google/callback', {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

function cookieHeader(headers: Headers) {
  const cookie = headers.get('Set-Cookie');
  expect(cookie).not.toBeNull();
  return cookie!.split(';')[0];
}

async function loadCallback() {
  const { Authenticator } = await import('remix-auth');
  // Replace only Google's verification result; application cookie helpers stay real.
  const authenticate = vi.spyOn(Authenticator.prototype, 'authenticate').mockResolvedValue(user);
  const auth = await import('~/modules/auth.google.server');
  const { loader } = await import('~/routes/auth.google.callback');
  return { authenticate, auth, loader };
}

function callLoader(loader: CallbackLoader, request: Request) {
  return loader({
    request,
    url: new URL(request.url),
    pattern: '/auth/google/callback',
    params: {},
    context: new RouterContextProvider(),
  });
}

async function getRedirect(loader: CallbackLoader, request: Request) {
  try {
    await callLoader(loader, request);
  } catch (response) {
    if (!(response instanceof Response)) throw response;
    return response;
  }
  throw new Error('Expected the callback to throw a redirect response');
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('__cloudflareEnv', {
    GOOGLE_CLIENT_ID: 'callback-test-client-id',
    GOOGLE_CLIENT_SECRET: 'callback-test-client-secret',
    CLIENT_URL: 'https://example.test',
    HPE_SESSION_SECRET: 'callback-test-session-secret',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Google OAuth callback', () => {
  it('creates a signed session on a cold callback without a visitor cookie', async () => {
    const { authenticate, auth, loader } = await loadCallback();
    const request = createRequest();
    const response = await getRedirect(loader, request);

    expect(authenticate).toHaveBeenCalledWith('google', request);
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/?loginSuccess=true');
    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toContain('__healthy_person_emulator=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    await expect(
      auth.getAuthenticatedUser(createRequest(cookieHeader(response.headers))),
    ).resolves.toEqual(user);
  });

  it('restores the visitor return path on a fresh callback module instance', async () => {
    const visitor = await import('~/modules/visitor.server');
    visitor.initVisitorSession();
    const headers = await visitor.setVisitorCookieData(createRequest(), '/archives/42');
    const cookie = cookieHeader(headers);
    // A different Worker instance can handle the callback. Keep its storage cold.
    vi.resetModules();
    const { auth, loader } = await loadCallback();
    const response = await getRedirect(loader, createRequest(cookie));

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/archives/42?loginSuccess=true');
    await expect(
      auth.getAuthenticatedUser(createRequest(cookieHeader(response.headers))),
    ).resolves.toEqual(user);
  });

  it('does not authenticate a request without a session cookie', async () => {
    const { auth } = await loadCallback();

    await expect(auth.getAuthenticatedUser(createRequest())).resolves.toBeNull();
  });

  it('rejects a session cookie whose signature has been changed', async () => {
    const { auth } = await loadCallback();
    const headers = await auth.setAuthenticatedUser(createRequest(), user);
    const cookie = cookieHeader(headers);
    const separator = cookie.indexOf('=');
    const value = decodeURIComponent(cookie.slice(separator + 1));
    const signatureStart = value.lastIndexOf('.') + 1;
    expect(signatureStart).toBeGreaterThan(0);
    const changedCharacter = value[signatureStart] === 'a' ? 'b' : 'a';
    const changedValue =
      value.slice(0, signatureStart) + changedCharacter + value.slice(signatureStart + 1);
    const tamperedCookie = cookie.slice(0, separator + 1) + encodeURIComponent(changedValue);

    await expect(auth.getAuthenticatedUser(createRequest(tamperedCookie))).resolves.toBeNull();
  });

  it.each([
    ['verification error', () => new Error('Synthetic OAuth verification failure')],
    ['unauthorized response', () => new Response(null, { status: 401 })],
  ] as const)('does not create a session after an OAuth %s', async (_name, makeFailure) => {
    const { authenticate, auth, loader } = await loadCallback();
    const failure = makeFailure();
    authenticate.mockRejectedValue(failure);
    const setUser = vi.spyOn(auth, 'setAuthenticatedUser');
    const request = createRequest();

    await expect(callLoader(loader, request)).rejects.toBe(failure);
    expect(setUser).not.toHaveBeenCalled();
    if (failure instanceof Response) expect(failure.headers.get('Set-Cookie')).toBeNull();
    await expect(auth.getAuthenticatedUser(request)).resolves.toBeNull();
  });

  it('is logged out when the browser stops sending the expired session cookie', async () => {
    const { auth } = await loadCallback();
    const headers = await auth.setAuthenticatedUser(createRequest(), user);
    expect(headers.get('Set-Cookie')).toContain('Max-Age=2592000');
    await expect(auth.getAuthenticatedUser(createRequest(cookieHeader(headers)))).resolves.toEqual(
      user,
    );

    // Max-Age is enforced by the browser. Model its next request omitting the cookie;
    // this does not claim the server rejects an old cookie that is still replayed.
    await expect(auth.getAuthenticatedUser(createRequest())).resolves.toBeNull();
  });
});
