// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('visitor session on a cold request', () => {
  beforeEach(() => vi.resetModules());

  it('reads a missing visitor cookie before app initialization', async () => {
    const { getVisitorCookieURL } = await import('./visitor.server');

    await expect(
      getVisitorCookieURL(new Request('https://example.com/auth/google/callback')),
    ).resolves.toBeUndefined();
  });

  it('stores and reads the return URL before app initialization', async () => {
    const { getVisitorCookieURL, setVisitorCookieData } = await import('./visitor.server');
    const headers = await setVisitorCookieData(
      new Request('https://example.com/archives/123'),
      '/archives/123',
    );
    const cookie = headers.get('Set-Cookie')!;

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    await expect(
      getVisitorCookieURL(
        new Request('https://example.com/auth/google/callback', {
          headers: { Cookie: cookie.split(';')[0] },
        }),
      ),
    ).resolves.toBe('/archives/123');
  });

  it('clears the visitor cookie on a cold logout request', async () => {
    const { destroyVisitorCookie } = await import('./visitor.server');
    const headers = await destroyVisitorCookie(new Request('https://example.com/logout'));

    expect(headers.get('Set-Cookie')).toContain('visitor-cookie=');
    expect(headers.get('Set-Cookie')).toContain('Expires=Thu, 01 Jan 1970');
  });
});
