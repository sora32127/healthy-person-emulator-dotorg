// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { ArchiveDataEntry, initDb } from '~/modules/db.server';

vi.mock('~/repositories/d1.server', () => ({
  createD1Repository: () => ({
    getPostByPostId: async () => ({
      postId: 1,
      postTitle: '保存済みの記事',
      postContent: '<p onclick="unexpected()">保存済みの本文</p>',
      tags: [],
    }),
    getCommentsByPostId: async () => [],
    getPreviousPost: async () => null,
    getNextPost: async () => null,
    getCountBookmarks: async () => 0,
  }),
}));
vi.mock('~/modules/cloudflare.server', () => ({ getVectorsByIds: async () => [] }));

describe('existing article content', () => {
  it('sanitizes stored HTML before handing it to the article page and public API', async () => {
    initDb({} as D1Database);
    const article = await ArchiveDataEntry.getData(1);
    expect(article.postContent).toBe('<p>保存済みの本文</p>');
  });
});
