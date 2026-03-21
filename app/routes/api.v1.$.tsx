/**
 * 公開APIエンドポイント (v1)
 *
 * 認証: Authorization: Bearer <api-key> ヘッダー
 * レスポンス形式: JSON
 */
import type { LoaderFunctionArgs } from 'react-router';
import { z } from 'zod';
import { findUserByApiKey, getFeedPosts, searchPosts, getTagsCounts } from '~/modules/db.server';
import { ArchiveDataEntry } from '~/modules/db.server';

// --- Response helpers ---

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

function errorResponse(error: string, status: number, details?: unknown) {
  const body: Record<string, unknown> = { error };
  if (details !== undefined) body.details = details;
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

// --- Authentication ---

async function authenticateApiKey(
  request: Request,
): Promise<{ userId: number; isPremium: boolean } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const apiKey = authHeader.slice(7);
  if (!apiKey) return null;
  return findUserByApiKey(apiKey);
}

// --- Query parameter schemas ---

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const FeedSortSchema = z
  .enum(['timeDesc', 'timeAsc', 'likes', 'unboundedLikes'])
  .default('timeDesc');

const SearchSortSchema = z.enum(['timeDesc', 'timeAsc', 'like']).default('timeDesc');

// --- Date serialization helper ---

function serializeDates(obj: unknown): unknown {
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeDates);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDates(value);
    }
    return result;
  }
  return obj;
}

// --- Route handlers ---

async function handleGetPosts(url: URL) {
  const params = PaginationSchema.merge(z.object({ sort: FeedSortSchema })).safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
  });
  if (!params.success) {
    return errorResponse('Bad request', 400, params.error.flatten().fieldErrors);
  }
  const { page, pageSize, sort } = params.data;
  const data = await getFeedPosts(page, sort, pageSize);
  return jsonResponse({ data: serializeDates(data) });
}

async function handleGetPostById(postId: number) {
  try {
    const entry = await ArchiveDataEntry.getData(postId);
    return jsonResponse({ data: serializeDates(entry) });
  } catch (err) {
    if (err instanceof Response && err.status === 404) {
      return errorResponse('Post not found', 404);
    }
    throw err;
  }
}

async function handleSearch(url: URL) {
  const params = PaginationSchema.merge(
    z.object({
      q: z.string().default(''),
      sort: SearchSortSchema,
      tags: z.string().default(''),
    }),
  ).safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    tags: url.searchParams.get('tags') ?? undefined,
  });
  if (!params.success) {
    return errorResponse('Bad request', 400, params.error.flatten().fieldErrors);
  }
  const { q, sort, page, tags, pageSize } = params.data;
  const tagList = tags
    ? tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const data = await searchPosts(q, sort, page, tagList, pageSize);
  return jsonResponse({ data: serializeDates(data) });
}

async function handleGetTags() {
  const data = await getTagsCounts();
  return jsonResponse({ data });
}

async function handleGetTagPosts(tagName: string, url: URL) {
  const params = PaginationSchema.merge(z.object({ sort: SearchSortSchema })).safeParse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
  });
  if (!params.success) {
    return errorResponse('Bad request', 400, params.error.flatten().fieldErrors);
  }
  const { sort, page, pageSize } = params.data;
  const data = await searchPosts('', sort, page, [tagName], pageSize);
  return jsonResponse({ data: serializeDates(data) });
}

// --- Main loader ---

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Authenticate
  const user = await authenticateApiKey(request);
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  // Route
  const path = params['*'] || '';
  const segments = path.split('/').filter(Boolean);
  const url = new URL(request.url);

  // GET /api/v1/posts
  if (segments[0] === 'posts' && segments.length === 1) {
    return handleGetPosts(url);
  }

  // GET /api/v1/posts/:postId
  if (segments[0] === 'posts' && segments.length === 2) {
    const postId = Number(segments[1]);
    if (!Number.isInteger(postId) || postId <= 0) {
      return errorResponse('Bad request', 400, { postId: 'Must be a positive integer' });
    }
    return handleGetPostById(postId);
  }

  // GET /api/v1/search
  if (segments[0] === 'search' && segments.length === 1) {
    return handleSearch(url);
  }

  // GET /api/v1/tags
  if (segments[0] === 'tags' && segments.length === 1) {
    return handleGetTags();
  }

  // GET /api/v1/tags/:tagName/posts
  if (segments[0] === 'tags' && segments.length === 3 && segments[2] === 'posts') {
    const tagName = decodeURIComponent(segments[1]);
    return handleGetTagPosts(tagName, url);
  }

  return errorResponse('Not found', 404);
}
