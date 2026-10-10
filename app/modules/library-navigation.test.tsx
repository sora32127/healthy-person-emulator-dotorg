import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Layout, { headers, loader } from '~/routes/_layout';
import { getNavItems } from '~/utils/itemMenu';

const auth = vi.hoisted(() => ({ user: null as null | { email: string; userUuid: string } }));
vi.mock('~/modules/auth.google.server', () => ({
  getAuthenticatedUser: vi.fn(async () => auth.user),
}));

beforeEach(() => {
  auth.user = null;
  vi.stubGlobal('__cloudflareEnv', { ADMIN_EMAILS: 'admin@example.test' });
});
afterEach(() => vi.unstubAllGlobals());

describe('履歴のメニュー表示', () => {
  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, false],
    [true, true, true],
  ])('ログイン状態 %s・機能フラグ %s のとき表示 %s', (signedIn, enabled, visible) => {
    const history = getNavItems(signedIn, enabled).filter((item) => item.to === '/history');
    expect(history).toHaveLength(visible ? 1 : 0);
    if (visible) expect(history[0].text).toBe('履歴');
  });

  it('未指定の機能フラグでは既存メニューだけを表示する', () => {
    expect(getNavItems(true).map((item) => item.to)).not.toContain('/history');
  });

  it.each([
    [null, false],
    [{ email: 'reader@example.test', userUuid: 'reader' }, false],
    [{ email: 'admin@example.test', userUuid: 'admin' }, true],
  ])('サーバーの認証結果からのみ機能フラグを返す', async (user, enabled) => {
    auth.user = user;
    const result = await loader({
      request: new Request('https://example.test/?libraryEnabled=true'),
    } as LoaderFunctionArgs);
    expect(result.data).toEqual({ userObject: user, libraryEnabled: enabled });
    const responseHeaders = new Headers(result.init?.headers);
    expect(responseHeaders.get('Cache-Control')).toBe(enabled ? 'private, no-store' : null);
    const documentHeaders = headers({
      loaderHeaders: responseHeaders,
      parentHeaders: new Headers({ 'X-Parent': 'kept' }),
    } as Parameters<HeadersFunction>[0]);
    expect(new Headers(documentHeaders).get('Cache-Control')).toBe(enabled ? 'private, no-store' : null);
    expect(new Headers(documentHeaders).get('X-Parent')).toBe('kept');

    const handler = createStaticHandler([{ path: '/', Component: Layout, loader }]);
    const context = await handler.query(new Request('https://example.test/'));
    if (context instanceof Response) throw new Error('レイアウトの読み込みに失敗');
    const router = createStaticRouter(handler.dataRoutes, context);
    const markup = renderToString(<StaticRouterProvider router={router} context={context} />);
    // ログインatomのuseEffect前から、desktop/mobileの両方に同じフラグを適用する。
    expect(markup.match(/href="\/history"/g) ?? []).toHaveLength(enabled ? 2 : 0);
  });
});
