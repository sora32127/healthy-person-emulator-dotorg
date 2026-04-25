/**
 * 内部APIエンドポイント
 * 投稿自動化プログラム（AWS Lambda）からの呼び出し用。
 * Supabase PostgreSQL直接接続の代替として提供。
 *
 * 認証: X-API-Key ヘッダー (INTERNAL_API_KEY環境変数と照合)
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '~/drizzle/schema';

function getEnvAndDb(context: any) {
  const env = context.cloudflare?.env || (globalThis as any).__cloudflareEnv;
  if (!env?.DB) throw new Error('D1 not available');
  return { env, db: drizzle(env.DB) };
}

function authenticate(request: Request, env: any): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const expectedKey = env.INTERNAL_API_KEY;
  if (!expectedKey) {
    // API key not configured — reject all requests
    return false;
  }
  return apiKey === expectedKey;
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /api/internal/posts-for-pickup
async function handlePostsForPickup(db: ReturnType<typeof drizzle>) {
  const posts = await db
    .select({
      postId: schema.dimPosts.postId,
      postTitle: schema.dimPosts.postTitle,
      ogpImageUrl: schema.dimPosts.ogpImageUrl,
    })
    .from(schema.dimPosts)
    .where(and(eq(schema.dimPosts.isSnsPickuped, false), gte(schema.dimPosts.countLikes, 10)))
    .limit(1);

  return jsonResponse({ posts });
}

// POST /api/internal/mark-picked-up
async function handleMarkPickedUp(db: ReturnType<typeof drizzle>, body: any) {
  const { postId } = body;
  if (!postId) return jsonResponse({ error: 'postId required' }, 400);

  await db
    .update(schema.dimPosts)
    .set({ isSnsPickuped: true })
    .where(eq(schema.dimPosts.postId, postId));

  return jsonResponse({ success: true });
}

// POST /api/internal/update-social-ids
async function handleUpdateSocialIds(db: ReturnType<typeof drizzle>, body: any) {
  const { postId, tweetId, blueskyPostUri, misskeyNoteId } = body;
  if (!postId) return jsonResponse({ error: 'postId required' }, 400);

  const updateData: Record<string, any> = {};
  if (tweetId !== undefined) updateData.tweetIdOfFirstTweet = tweetId;
  if (blueskyPostUri !== undefined) updateData.blueskyPostUriOfFirstPost = blueskyPostUri;
  if (misskeyNoteId !== undefined) updateData.misskeyNoteIdOfFirstNote = misskeyNoteId;

  if (Object.keys(updateData).length === 0) {
    return jsonResponse({ error: 'No fields to update' }, 400);
  }

  await db.update(schema.dimPosts).set(updateData).where(eq(schema.dimPosts.postId, postId));

  return jsonResponse({ success: true });
}

// POST /api/internal/add-tag-to-post
async function handleAddTagToPost(db: ReturnType<typeof drizzle>, body: any) {
  const { postId, tagId } = body;
  if (!postId || !tagId) return jsonResponse({ error: 'postId and tagId required' }, 400);

  await db.insert(schema.relPostTags).values({ postId, tagId }).onConflictDoNothing();

  return jsonResponse({ success: true });
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const { env, db } = getEnvAndDb(context);
  if (!authenticate(request, env)) return unauthorized();

  const path = params['*'];

  switch (path) {
    case 'posts-for-pickup':
      return handlePostsForPickup(db);
    default:
      return jsonResponse({ error: 'Not found' }, 404);
  }
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  const { env, db } = getEnvAndDb(context);
  if (!authenticate(request, env)) return unauthorized();

  const path = params['*'];
  const body = await request.json();

  switch (path) {
    case 'mark-picked-up':
      return handleMarkPickedUp(db, body);
    case 'update-social-ids':
      return handleUpdateSocialIds(db, body);
    case 'add-tag-to-post':
      return handleAddTagToPost(db, body);
    default:
      return jsonResponse({ error: 'Not found' }, 404);
  }
}
