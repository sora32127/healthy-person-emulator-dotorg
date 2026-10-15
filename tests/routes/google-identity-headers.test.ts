// @vitest-environment node

import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthenticatedUser } from '~/modules/auth.google.server';
import { loader, headers as layoutHeaders } from '~/routes/_layout';
import { headers as articleHeaders } from '~/routes/_layout.archives.$postId';

vi.mock('~/modules/auth.google.server', () => ({
  getAuthenticatedUser: vi.fn(),
}));

function loaderArgs() {
  const request = new Request('https://example.com/archives/42');
  return {
    request,
    url: new URL(request.url),
    pattern: '/archives/:postId',
    params: { postId: '42' },
    context: new RouterContextProvider(),
  };
}

describe('Google Identity headers on nested article pages', () => {
  beforeEach(() => {
    vi.stubGlobal('__cloudflareEnv', {
      GOOGLE_CLIENT_ID: 'google-client-id',
      HPE_SESSION_SECRET: 'google-identity-headers-test-secret',
    });
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns an anonymous Google config with its nonce cookie and no-store', async () => {
    const response = await loader(loaderArgs());
    const headers = new Headers(response.init?.headers);
    expect(response.data.userObject).toBeNull();
    expect(response.data.googleIdentity).toMatchObject({
      clientId: 'google-client-id',
      autoPrompt: true,
      autoSelect: true,
    });
    expect(response.data.googleIdentity?.nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(response.data.googleIdentity?.expiresAt).toBeGreaterThan(Date.now());
    expect(headers.get('Cache-Control')).toBe('private, no-store');
    expect(headers.getSetCookie()).toEqual([
      expect.stringContaining('__Host-hpe_google_nonce='),
    ]);
  });

  it('omits Google Identity config and nonce cookies for an authenticated user', async () => {
    const user = {
      userUuid: 'existing-user',
      email: 'member@gmail.com',
      userAuthType: 'Google' as const,
    };
    vi.mocked(getAuthenticatedUser).mockResolvedValue(user);
    const response = await loader(loaderArgs());
    expect(response.data.userObject).toEqual(user);
    expect(response.data.googleIdentity).toBeNull();
    expect(new Headers(response.init?.headers).has('Set-Cookie')).toBe(false);
  });

  it('preserves nonce cookies and no-store through the layout and article header chain', async () => {
    const response = await loader(loaderArgs());
    const nonceHeaders = new Headers(response.init?.headers);
    const parentHeaders = new Headers({ 'X-Parent-Header': 'preserved' });
    parentHeaders.append('Set-Cookie', 'parent-cookie=value; Path=/; HttpOnly');
    const composedLayout = new Headers(layoutHeaders({
      loaderHeaders: nonceHeaders,
      parentHeaders,
      actionHeaders: new Headers(),
      errorHeaders: undefined,
    }));
    const composedArticle = new Headers(articleHeaders({
      loaderHeaders: new Headers(),
      parentHeaders: composedLayout,
      actionHeaders: new Headers(),
      errorHeaders: undefined,
    }));

    for (const headers of [composedLayout, composedArticle]) {
      expect(headers.get('Cache-Control')).toBe('private, no-store');
      expect(headers.get('X-Parent-Header')).toBe('preserved');
      expect(headers.getSetCookie()).toEqual([
        'parent-cookie=value; Path=/; HttpOnly',
        ...nonceHeaders.getSetCookie(),
      ]);
    }
  });
});
