/**
 * 検索API（外部公開）
 * AIエージェント・スクレイパー等の外部利用向けに、検索結果をプレーンJSONで返す。
 *
 * GET /api/search?q=<keyword>&tags=<tag1>+<tag2>&orderby=<timeDesc|timeAsc|like>&page=<n>&pageSize=<n>
 */
import type { LoaderFunctionArgs } from 'react-router';
import { searchPosts } from '~/modules/db.server';
import type { SearchOrderBy } from '~/modules/db.server';

const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_MAX = 50;

const ORDER_BY_VALUES: SearchOrderBy[] = ['timeDesc', 'timeAsc', 'like'];

function parseOrderBy(value: string | null): SearchOrderBy {
  return ORDER_BY_VALUES.includes(value as SearchOrderBy) ? (value as SearchOrderBy) : 'timeDesc';
}

function clampPositiveInt(value: string | null, fallback: number, max?: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  const intN = Math.floor(n);
  return max !== undefined ? Math.min(intN, max) : intN;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';
  const orderby = parseOrderBy(url.searchParams.get('orderby'));
  const tags = url.searchParams.get('tags')?.split(/[\s+]/).filter(Boolean) ?? [];
  const page = clampPositiveInt(url.searchParams.get('page'), 1);
  const pageSize = clampPositiveInt(
    url.searchParams.get('pageSize'),
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
  );

  const result = await searchPosts(query, orderby, page, tags, pageSize);

  const baseUrl = `${url.origin}/archives`;
  const payload = {
    metadata: result.metadata,
    tagCounts: result.tagCounts,
    results: result.results.map((post) => ({
      postId: post.postId,
      postTitle: post.postTitle,
      postUrl: `${baseUrl}/${post.postId}`,
      postDateGmt: post.postDateGmt.toISOString(),
      countLikes: post.countLikes,
      countDislikes: post.countDislikes,
      countComments: post.countComments,
      tagNames: post.tagNames,
    })),
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
