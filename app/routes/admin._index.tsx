import { useLoaderData, useFetcher, Link } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { useState } from 'react';
import { drizzle } from 'drizzle-orm/d1';
import { desc, count, eq, sql } from 'drizzle-orm';
import * as schema from '~/drizzle/schema';
import { querySimilar, getVectorsByIds } from '~/modules/cloudflare.server';

const PAGE_SIZE = 50;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  const env = (globalThis as any).__cloudflareEnv;
  const db = drizzle(env.DB);

  const offset = (page - 1) * PAGE_SIZE;

  const [posts, totalResult] = await Promise.all([
    db
      .select({
        postId: schema.dimPosts.postId,
        postTitle: schema.dimPosts.postTitle,
        countLikes: schema.dimPosts.countLikes,
        countDislikes: schema.dimPosts.countDislikes,
        postDateGmt: schema.dimPosts.postDateGmt,
        isMergedSource: sql<number>`CASE WHEN ${schema.dimPosts.postId} IN (SELECT ${schema.postMerges.sourcePostId} FROM ${schema.postMerges}) THEN 1 ELSE 0 END`,
        mergeTargetId: sql<
          number | null
        >`(SELECT ${schema.postMerges.targetPostId} FROM ${schema.postMerges} WHERE ${schema.postMerges.sourcePostId} = ${schema.dimPosts.postId})`,
      })
      .from(schema.dimPosts)
      .orderBy(desc(schema.dimPosts.postId))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(schema.dimPosts),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return { posts, page, totalPages, total };
}

export async function action({ request }: ActionFunctionArgs) {
  const body = await request.formData();
  const actionType = body.get('action');

  if (actionType === 'similar') {
    const postId = Number(body.get('postId'));
    try {
      const vectors = await getVectorsByIds([String(postId)]);
      if (vectors.length === 0 || !vectors[0].values) {
        return { similar: [], postId, error: 'ベクトルが見つかりません' };
      }
      const matches = await querySimilar(vectors[0].values, 16);
      const similar = matches
        .filter((m) => m.id !== String(postId))
        .slice(0, 15)
        .map((m) => ({
          postId: Number(m.metadata?.postId ?? m.id),
          postTitle: String(m.metadata?.postTitle ?? `記事 #${m.id}`),
          score: Math.round(m.score * 10000) / 10000,
        }));
      return { similar, postId, error: null };
    } catch (e) {
      return { similar: [], postId, error: (e as Error).message };
    }
  }
  return null;
}

type SimilarPost = { postId: number; postTitle: string; score: number };

export default function AdminIndex() {
  const { posts, page, totalPages, total } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ similar: SimilarPost[]; postId: number; error: string | null }>();
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const handleSimilar = (postId: number) => {
    setSelectedPostId(postId);
    fetcher.submit({ action: 'similar', postId: String(postId) }, { method: 'post' });
  };

  const similarData = fetcher.data;

  return (
    <div className="flex gap-4">
      {/* 記事一覧 */}
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-4">記事一覧 ({total}件)</h1>

        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>ID</th>
                <th>タイトル</th>
                <th>いいね</th>
                <th>状態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.postId} className={post.isMergedSource ? 'opacity-50' : ''}>
                  <td>{post.postId}</td>
                  <td className="max-w-md truncate">
                    <Link
                      to={`/archives/${post.postId}`}
                      target="_blank"
                      className="link link-hover"
                    >
                      {post.postTitle}
                    </Link>
                  </td>
                  <td>{post.countLikes}</td>
                  <td>
                    {post.isMergedSource ? (
                      <span className="badge badge-warning badge-sm">
                        統合済→#{post.mergeTargetId}
                      </span>
                    ) : (
                      <span className="badge badge-ghost badge-sm">通常</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`btn btn-xs ${selectedPostId === post.postId ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => handleSimilar(post.postId)}
                      disabled={fetcher.state === 'submitting'}
                    >
                      類似
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        <div className="join mt-4 flex justify-center">
          {page > 1 && (
            <Link to={`/admin?page=${page - 1}`} className="join-item btn btn-sm">
              «
            </Link>
          )}
          <span className="join-item btn btn-sm btn-disabled">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link to={`/admin?page=${page + 1}`} className="join-item btn btn-sm">
              »
            </Link>
          )}
        </div>
      </div>

      {/* 類似記事サイドパネル */}
      {selectedPostId && (
        <div className="w-96 bg-base-100 rounded-box p-4 shadow-sm max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold">類似記事 (#{selectedPostId})</h2>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setSelectedPostId(null)}
            >
              ✕
            </button>
          </div>

          {fetcher.state === 'submitting' && (
            <div className="flex justify-center p-8">
              <span className="loading loading-spinner" />
            </div>
          )}

          {similarData?.error && (
            <div className="alert alert-error text-sm">{similarData.error}</div>
          )}

          {similarData && !similarData.error && fetcher.state === 'idle' && (
            <ul className="space-y-2">
              {similarData.similar.length === 0 && (
                <li className="text-sm opacity-60">類似記事が見つかりません</li>
              )}
              {similarData.similar.map((s) => (
                <li key={s.postId} className="border-b border-base-200 pb-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/archives/${s.postId}`}
                        target="_blank"
                        className="link link-hover text-sm block truncate"
                      >
                        #{s.postId} {s.postTitle}
                      </Link>
                      <span className="text-xs opacity-60">類似度: {s.score}</span>
                    </div>
                    <Link
                      to={`/admin/merge?targetPostId=${selectedPostId}&sourcePostIds=${s.postId}`}
                      className="btn btn-xs btn-outline btn-primary whitespace-nowrap"
                    >
                      統合→
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
