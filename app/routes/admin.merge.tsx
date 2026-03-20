import { useLoaderData, Form, useActionData, useNavigation, Link } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray, sql } from 'drizzle-orm';
import * as schema from '~/drizzle/schema';
import { nowUTC, nowJST } from '~/drizzle/utils';
import { getAuthenticatedUser } from '~/modules/auth.google.server';
import { deleteVectors, getEmbedding, upsertVectors } from '~/modules/cloudflare.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const targetPostId = Number(url.searchParams.get('targetPostId'));
  const sourcePostIdsParam = url.searchParams.get('sourcePostIds') || '';
  const sourcePostIds = sourcePostIdsParam
    .split(',')
    .map(Number)
    .filter((n) => n > 0 && n !== targetPostId);

  if (!targetPostId || sourcePostIds.length === 0) {
    return {
      error: 'targetPostId と sourcePostIds を指定してください',
      target: null,
      sources: [],
      mergedTags: [],
      totalLikes: 0,
      totalDislikes: 0,
    };
  }

  const env = (globalThis as any).__cloudflareEnv;
  const db = drizzle(env.DB);

  const allPostIds = [targetPostId, ...sourcePostIds];
  const posts = await db
    .select({
      postId: schema.dimPosts.postId,
      postTitle: schema.dimPosts.postTitle,
      postContent: schema.dimPosts.postContent,
      countLikes: schema.dimPosts.countLikes,
      countDislikes: schema.dimPosts.countDislikes,
      commentStatus: schema.dimPosts.commentStatus,
    })
    .from(schema.dimPosts)
    .where(inArray(schema.dimPosts.postId, allPostIds));

  const tags = await db
    .select({
      postId: schema.relPostTags.postId,
      tagId: schema.dimTags.tagId,
      tagName: schema.dimTags.tagName,
    })
    .from(schema.relPostTags)
    .innerJoin(schema.dimTags, eq(schema.relPostTags.tagId, schema.dimTags.tagId))
    .where(inArray(schema.relPostTags.postId, allPostIds));

  // 既にソース記事として統合済みかチェック
  const existingMerges = await db
    .select({ sourcePostId: schema.postMerges.sourcePostId })
    .from(schema.postMerges)
    .where(inArray(schema.postMerges.sourcePostId, sourcePostIds));
  const alreadyMergedIds = new Set(existingMerges.map((m) => m.sourcePostId));

  const targetPost = posts.find((p) => p.postId === targetPostId);
  const sourcePosts = sourcePostIds
    .map((id) => posts.find((p) => p.postId === id))
    .filter((p): p is NonNullable<typeof p> => p != null);

  if (!targetPost) {
    return {
      error: `統合先記事 #${targetPostId} が見つかりません`,
      target: null,
      sources: [],
      mergedTags: [],
      totalLikes: 0,
      totalDislikes: 0,
    };
  }

  // タグ和集合
  const tagMap = new Map<number, string>();
  for (const t of tags) {
    tagMap.set(t.tagId, t.tagName);
  }
  const mergedTags = Array.from(tagMap.entries()).map(([tagId, tagName]) => ({ tagId, tagName }));

  // いいね合算
  const totalLikes = posts.reduce((sum, p) => sum + p.countLikes, 0);
  const totalDislikes = posts.reduce((sum, p) => sum + p.countDislikes, 0);

  // 各記事にタグ情報を付与
  const tagsByPostId = (postId: number) => tags.filter((t) => t.postId === postId);

  const toPreview = (p: (typeof posts)[0]) => ({
    postId: p.postId,
    postTitle: p.postTitle,
    postContentPreview: p.postContent.slice(0, 200),
    countLikes: p.countLikes,
    countDislikes: p.countDislikes,
    tags: tagsByPostId(p.postId).map((t) => t.tagName),
    alreadyMerged: alreadyMergedIds.has(p.postId),
  });

  return {
    error: null,
    target: toPreview(targetPost),
    sources: sourcePosts.map(toPreview),
    mergedTags,
    totalLikes,
    totalDislikes,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getAuthenticatedUser(request);
  if (!user) return { success: false, error: '認証エラー' };

  const body = await request.formData();
  const targetPostId = Number(body.get('targetPostId'));
  const sourcePostIds = String(body.get('sourcePostIds'))
    .split(',')
    .map(Number)
    .filter((n) => n > 0);

  if (!targetPostId || sourcePostIds.length === 0) {
    return { success: false, error: 'パラメータが不正です' };
  }

  const env = (globalThis as any).__cloudflareEnv;
  const db = drizzle(env.DB);

  // 1. post_merges にレコード挿入
  for (const sourcePostId of sourcePostIds) {
    await db
      .insert(schema.postMerges)
      .values({
        sourcePostId,
        targetPostId,
        mergedAtUtc: nowUTC(),
        mergedAtJst: nowJST(),
        mergedByUserUuid: user.userUuid,
      })
      .onConflictDoNothing();
  }

  // 2. ソース記事のコメントステータスを closed に
  for (const sourcePostId of sourcePostIds) {
    await db
      .update(schema.dimPosts)
      .set({ commentStatus: 'closed' })
      .where(eq(schema.dimPosts.postId, sourcePostId));
  }

  // 3. いいね数合算: ソース記事の count_likes/count_dislikes を統合先に加算
  const sourcePosts = await db
    .select({
      countLikes: schema.dimPosts.countLikes,
      countDislikes: schema.dimPosts.countDislikes,
    })
    .from(schema.dimPosts)
    .where(inArray(schema.dimPosts.postId, sourcePostIds));

  const addLikes = sourcePosts.reduce((sum, p) => sum + p.countLikes, 0);
  const addDislikes = sourcePosts.reduce((sum, p) => sum + p.countDislikes, 0);

  if (addLikes > 0 || addDislikes > 0) {
    await db
      .update(schema.dimPosts)
      .set({
        countLikes: sql`${schema.dimPosts.countLikes} + ${addLikes}`,
        countDislikes: sql`${schema.dimPosts.countDislikes} + ${addDislikes}`,
      })
      .where(eq(schema.dimPosts.postId, targetPostId));
  }

  // 4. タグ和集合: ソース記事のタグをすべて統合先にも紐付け
  const sourceTags = await db
    .select({ tagId: schema.relPostTags.tagId })
    .from(schema.relPostTags)
    .where(inArray(schema.relPostTags.postId, sourcePostIds));

  const uniqueTagIds = [...new Set(sourceTags.map((t) => t.tagId))];
  for (const tagId of uniqueTagIds) {
    await db
      .insert(schema.relPostTags)
      .values({ postId: targetPostId, tagId })
      .onConflictDoNothing();
  }

  // 5. ソース記事のベクトル削除
  try {
    await deleteVectors(sourcePostIds.map(String));
  } catch (e) {
    console.warn('ベクトル削除に失敗:', (e as Error).message);
  }

  // 6. 統合先記事のベクトル再生成
  try {
    const targetPost = await db
      .select({
        postTitle: schema.dimPosts.postTitle,
        postContent: schema.dimPosts.postContent,
      })
      .from(schema.dimPosts)
      .where(eq(schema.dimPosts.postId, targetPostId))
      .limit(1);

    if (targetPost.length > 0) {
      const text = `${targetPost[0].postTitle}\n${targetPost[0].postContent}`.slice(0, 2000);
      const embedding = await getEmbedding(text);
      await upsertVectors([
        {
          id: String(targetPostId),
          values: embedding,
          metadata: { postId: targetPostId, postTitle: targetPost[0].postTitle },
        },
      ]);
    }
  } catch (e) {
    console.warn('ベクトル再生成に失敗:', (e as Error).message);
  }

  return { success: true, error: null };
}

export default function AdminMerge() {
  const { error, target, sources, mergedTags, totalLikes, totalDislikes } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">記事統合</h1>
        <div className="alert alert-warning">{error}</div>
        <p className="mt-4 text-sm opacity-60">
          URLパラメータ例: /admin/merge?targetPostId=123&sourcePostIds=456,789
        </p>
      </div>
    );
  }

  if (actionData?.success) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">記事統合</h1>
        <div className="alert alert-success">統合が完了しました</div>
        <div className="mt-4 flex gap-2">
          <Link to="/admin" className="btn btn-primary">
            記事一覧に戻る
          </Link>
          {target && (
            <Link to={`/archives/${target.postId}`} target="_blank" className="btn btn-ghost">
              統合先記事を確認
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">記事統合</h1>

      {actionData?.error && <div className="alert alert-error mb-4">{actionData.error}</div>}

      {/* 統合先 */}
      {target && (
        <div className="card bg-base-100 shadow-sm mb-4">
          <div className="card-body">
            <h2 className="card-title text-primary">
              統合先: #{target.postId} {target.postTitle}
            </h2>
            <p className="text-sm opacity-70">{target.postContentPreview}...</p>
            <div className="flex gap-2 flex-wrap">
              {target.tags.map((t) => (
                <span key={t} className="badge badge-outline badge-sm">
                  {t}
                </span>
              ))}
            </div>
            <div className="text-sm">
              いいね: {target.countLikes} / よくないね: {target.countDislikes}
            </div>
          </div>
        </div>
      )}

      {/* ソース記事 */}
      <h3 className="text-lg font-bold mb-2">ソース記事 (統合元)</h3>
      {sources.map((s) => (
        <div
          key={s.postId}
          className={`card bg-base-100 shadow-sm mb-2 ${s.alreadyMerged ? 'border-2 border-warning' : ''}`}
        >
          <div className="card-body py-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold">
                  #{s.postId} {s.postTitle}
                </h4>
                <p className="text-sm opacity-70">{s.postContentPreview}...</p>
              </div>
              {s.alreadyMerged && <span className="badge badge-warning">統合済み</span>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {s.tags.map((t) => (
                <span key={t} className="badge badge-outline badge-sm">
                  {t}
                </span>
              ))}
            </div>
            <div className="text-sm">
              いいね: {s.countLikes} / よくないね: {s.countDislikes}
            </div>
          </div>
        </div>
      ))}

      {/* 統合後のプレビュー */}
      <div className="card bg-primary/10 shadow-sm mt-4 mb-4">
        <div className="card-body">
          <h3 className="card-title text-sm">統合後のプレビュー</h3>
          <div className="text-sm">
            <p>タグ和集合: {mergedTags.map((t) => t.tagName).join(', ')}</p>
            <p>
              いいね合算: {totalLikes} / よくないね合算: {totalDislikes}
            </p>
          </div>
        </div>
      </div>

      {/* 実行 */}
      {target && sources.length > 0 && !sources.every((s) => s.alreadyMerged) && (
        <Form method="post">
          <input type="hidden" name="targetPostId" value={target.postId} />
          <input
            type="hidden"
            name="sourcePostIds"
            value={sources
              .filter((s) => !s.alreadyMerged)
              .map((s) => s.postId)
              .join(',')}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="loading loading-spinner" />
            ) : (
              `統合を実行 (${sources.filter((s) => !s.alreadyMerged).length}件)`
            )}
          </button>
        </Form>
      )}
    </div>
  );
}
