import { describe, test, expect } from 'vitest';
import { z } from 'zod';

// Test the query parameter validation schemas used by api.v1.$.tsx
const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const FeedSortSchema = z
  .enum(['timeDesc', 'timeAsc', 'likes', 'unboundedLikes'])
  .default('timeDesc');
const SearchSortSchema = z.enum(['timeDesc', 'timeAsc', 'like']).default('timeDesc');

// Test the path routing logic
function routePath(path: string): string {
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'posts' && segments.length === 1) return 'posts:list';
  if (segments[0] === 'posts' && segments.length === 2) {
    const postId = Number(segments[1]);
    if (!Number.isInteger(postId) || postId <= 0) return 'error:400';
    return `posts:detail:${postId}`;
  }
  if (segments[0] === 'search' && segments.length === 1) return 'search';
  if (segments[0] === 'tags' && segments.length === 1) return 'tags:list';
  if (segments[0] === 'tags' && segments.length === 3 && segments[2] === 'posts') {
    return `tags:posts:${decodeURIComponent(segments[1])}`;
  }
  return 'error:404';
}

describe('API v1 path routing', () => {
  test('posts → 投稿一覧', () => {
    expect(routePath('posts')).toBe('posts:list');
  });

  test('posts/123 → 投稿詳細', () => {
    expect(routePath('posts/123')).toBe('posts:detail:123');
  });

  test('posts/abc → 400エラー', () => {
    expect(routePath('posts/abc')).toBe('error:400');
  });

  test('posts/0 → 400エラー', () => {
    expect(routePath('posts/0')).toBe('error:400');
  });

  test('posts/-1 → 400エラー', () => {
    expect(routePath('posts/-1')).toBe('error:400');
  });

  test('search → 検索', () => {
    expect(routePath('search')).toBe('search');
  });

  test('tags → タグ一覧', () => {
    expect(routePath('tags')).toBe('tags:list');
  });

  test('tags/職場/posts → タグ別投稿', () => {
    expect(routePath('tags/職場/posts')).toBe('tags:posts:職場');
  });

  test('tags/%E8%81%B7%E5%A0%B4/posts → URLエンコードされたタグ', () => {
    expect(routePath('tags/%E8%81%B7%E5%A0%B4/posts')).toBe('tags:posts:職場');
  });

  test('unknown → 404エラー', () => {
    expect(routePath('unknown')).toBe('error:404');
  });

  test('空パス → 404エラー', () => {
    expect(routePath('')).toBe('error:404');
  });
});

describe('API v1 query parameter validation', () => {
  describe('Pagination', () => {
    test('デフォルト値が設定される', () => {
      const result = PaginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
      }
    });

    test('有効な値が受け入れられる', () => {
      const result = PaginationSchema.safeParse({ page: '3', pageSize: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.pageSize).toBe(50);
      }
    });

    test('pageSize > 100 は拒否される', () => {
      const result = PaginationSchema.safeParse({ pageSize: '101' });
      expect(result.success).toBe(false);
    });

    test('page = 0 は拒否される', () => {
      const result = PaginationSchema.safeParse({ page: '0' });
      expect(result.success).toBe(false);
    });

    test('負のpage は拒否される', () => {
      const result = PaginationSchema.safeParse({ page: '-1' });
      expect(result.success).toBe(false);
    });
  });

  describe('FeedSort', () => {
    test('デフォルトはtimeDesc', () => {
      const result = FeedSortSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('timeDesc');
    });

    test('有効なソートが受け入れられる', () => {
      for (const sort of ['timeDesc', 'timeAsc', 'likes', 'unboundedLikes']) {
        expect(FeedSortSchema.safeParse(sort).success).toBe(true);
      }
    });

    test('無効なソートは拒否される', () => {
      expect(FeedSortSchema.safeParse('invalid').success).toBe(false);
    });
  });

  describe('SearchSort', () => {
    test('デフォルトはtimeDesc', () => {
      const result = SearchSortSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('timeDesc');
    });

    test('likeが受け入れられる', () => {
      expect(SearchSortSchema.safeParse('like').success).toBe(true);
    });
  });
});

describe('Bearer token parsing', () => {
  function parseBearer(header: string | null): string | null {
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice(7);
    return token || null;
  }

  test('正しいBearerトークンが解析される', () => {
    expect(parseBearer('Bearer hpe_abc123')).toBe('hpe_abc123');
  });

  test('Bearerプレフィクスがない場合はnull', () => {
    expect(parseBearer('Basic abc123')).toBeNull();
  });

  test('ヘッダーがない場合はnull', () => {
    expect(parseBearer(null)).toBeNull();
  });

  test('Bearerの後にトークンがない場合はnull', () => {
    expect(parseBearer('Bearer ')).toBeNull();
  });
});
