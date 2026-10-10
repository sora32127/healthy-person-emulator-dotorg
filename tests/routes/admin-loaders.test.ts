// @vitest-environment node

import { RouterContextProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { commitSession, getSession, initSessionStorage } from '~/modules/session.server';
import { loader as postsLoader } from '~/routes/admin._index';
import { loader as commentsLoader } from '~/routes/admin.comments';
import { loader as deletedPostsLoader } from '~/routes/admin.deleted-posts';

const adminEmail = 'admin@example.com';

async function createRequest(path: string, email?: string) {
  const headers = new Headers();
  if (email) {
    const session = await getSession(null);
    session.set('user', { userUuid: 'test-user', email, userAuthType: 'Google' });
    headers.set('Cookie', (await commitSession(session)).split(';')[0]);
  }
  return new Request(`https://example.com${path}`, { headers });
}

const routes = [
  {
    path: '/admin',
    loader: postsLoader,
    row: [42, 'Test post', 3, '2026-10-10 00:00:00', 1],
    expected: { posts: [{ postId: 42, postTitle: 'Test post', isWelcomed: true }] },
  },
  {
    path: '/admin/comments',
    loader: commentsLoader,
    row: [7, 42, 'Test post', 'Test author', 'Test comment', '2026-10-10 09:00:00'],
    expected: { comments: [{ commentId: 7, postId: 42, commentContent: 'Test comment' }] },
  },
  {
    path: '/admin/deleted-posts',
    loader: deletedPostsLoader,
    row: [
      1,
      42,
      'Deleted post',
      '2026-10-09 00:00:00',
      '2026-10-10 00:00:00',
      adminEmail,
      'Test reason',
      null,
      null,
      null,
    ],
    expected: {
      posts: [{ originalPostId: 42, deletedByEmail: adminEmail, deletionReason: 'Test reason' }],
    },
  },
];

describe.each(routes)('$path loader authorization', ({ path, loader, row, expected }) => {
  const prepare = vi.fn();

  beforeAll(() => initSessionStorage('admin-loader-test-secret'));

  beforeEach(() => {
    prepare.mockReset();
    vi.stubGlobal('__cloudflareEnv', {
      ADMIN_EMAILS: adminEmail,
      DB: { prepare },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['未ログイン', undefined],
    ['管理者以外', 'member@example.com'],
  ])('%sの直接取得をDBアクセス前に拒否する', async (_name, email) => {
    const request = await createRequest(path, email);
    const result = loader({
      request,
      url: new URL(request.url),
      pattern: path,
      params: {},
      context: new RouterContextProvider(),
    });

    await expect(result).rejects.toMatchObject({ status: 302 });
    expect(prepare).not.toHaveBeenCalled();
  });

  it('管理者のセッションでは一覧とページ情報を取得できる', async () => {
    const raw = vi
      .fn()
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([[51]]);
    const bind = vi.fn().mockReturnValue({ raw });
    prepare.mockReturnValue({ bind });
    const request = await createRequest(`${path}?page=2`, adminEmail);

    await expect(
      loader({
        request,
        url: new URL(request.url),
        pattern: path,
        params: {},
        context: new RouterContextProvider(),
      }),
    ).resolves.toMatchObject({ ...expected, page: 2, totalPages: 2, total: 51 });
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(bind).toHaveBeenCalledWith(50, 50);
  });
});
