import { useLoaderData, Link, useFetcher } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { drizzle } from 'drizzle-orm/d1';
import { desc, count, eq } from 'drizzle-orm';
import { dimPosts } from '~/drizzle/schema';
import { requireAdmin } from '~/modules/admin.server';
import { deletePost } from '~/modules/admin-delete.server';
import { useState, useRef, useEffect } from 'react';
import type { CloudflareEnv } from '~/types/env';

const PAGE_SIZE = 50;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  const env = (globalThis as any).__cloudflareEnv as CloudflareEnv;
  const db = drizzle(env.DB);

  const offset = (page - 1) * PAGE_SIZE;

  const [posts, totalResult] = await Promise.all([
    db
      .select({
        postId: dimPosts.postId,
        postTitle: dimPosts.postTitle,
        countLikes: dimPosts.countLikes,
        postDateGmt: dimPosts.postDateGmt,
        isWelcomed: dimPosts.isWelcomed,
      })
      .from(dimPosts)
      .orderBy(desc(dimPosts.postId))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(dimPosts),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return { posts, page, totalPages, total };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAdmin(request);
  const env = (globalThis as any).__cloudflareEnv as CloudflareEnv;

  const formData = await request.formData();
  const intent = formData.get('intent');
  const postId = Number(formData.get('postId'));

  if (!postId || Number.isNaN(postId)) {
    return { error: '記事IDが不正です' };
  }

  if (intent === 'updateWelcomed') {
    const rawIsWelcomed = formData.get('isWelcomed');
    if (rawIsWelcomed !== 'true' && rawIsWelcomed !== 'false') {
      return { error: '歓迎判定が不正です' };
    }

    try {
      const db = drizzle(env.DB);
      await db
        .update(dimPosts)
        .set({ isWelcomed: rawIsWelcomed === 'true' })
        .where(eq(dimPosts.postId, postId));

      return { success: true, updatedPostId: postId };
    } catch (err) {
      const message = err instanceof Error ? err.message : '歓迎判定の更新に失敗しました';
      return { error: message };
    }
  }

  if (intent !== 'deletePost') {
    return { error: '操作が不正です' };
  }

  const deletionReason = (formData.get('deletionReason') as string) || undefined;

  try {
    await deletePost(env, postId, user.email, deletionReason);
    return { success: true, deletedPostId: postId };
  } catch (err) {
    const message = err instanceof Error ? err.message : '削除に失敗しました';
    return { error: message };
  }
}

function DeleteModal({
  post,
  onClose,
}: {
  post: { postId: number; postTitle: string };
  onClose: () => void;
}) {
  const fetcher = useFetcher<typeof action>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isSubmitting = fetcher.state !== 'idle';

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (fetcher.data && 'success' in fetcher.data) {
      onClose();
    }
  }, [fetcher.data, onClose]);

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box">
        <h3 className="font-bold text-lg">記事を削除しますか？</h3>
        <p className="py-2 text-sm opacity-70">
          ID: {post.postId} — {post.postTitle}
        </p>
        <p className="text-sm text-warning">
          この操作はD1データ、ベクトル、OGP画像、SNS投稿を削除します。元に戻せません。
        </p>

        <fetcher.Form method="post" className="mt-4">
          <input type="hidden" name="intent" value="deletePost" />
          <input type="hidden" name="postId" value={post.postId} />
          <div className="form-control mb-4">
            <label className="label" htmlFor="deletionReason">
              <span className="label-text">削除理由（任意）</span>
            </label>
            <textarea
              id="deletionReason"
              name="deletionReason"
              className="textarea textarea-bordered"
              rows={2}
            />
          </div>

          {fetcher.data && 'error' in fetcher.data && (
            <div className="alert alert-error mb-4 text-sm">{fetcher.data.error}</div>
          )}

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-error" disabled={isSubmitting}>
              {isSubmitting ? '削除中...' : '削除する'}
            </button>
          </div>
        </fetcher.Form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}

function WelcomedForm({ postId, isWelcomed }: { postId: number; isWelcomed: boolean | null }) {
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state !== 'idle';

  return (
    <fetcher.Form method="post" className="flex items-center gap-1 whitespace-nowrap">
      <input type="hidden" name="intent" value="updateWelcomed" />
      <input type="hidden" name="postId" value={postId} />
      <select
        name="isWelcomed"
        aria-label={`記事${postId}の歓迎状態`}
        className="select select-bordered select-xs"
        defaultValue={isWelcomed === null ? '' : String(isWelcomed)}
        required
        disabled={isSubmitting}
      >
        {isWelcomed === null && (
          <option value="" disabled>
            未判定
          </option>
        )}
        <option value="true">歓迎</option>
        <option value="false">非歓迎</option>
      </select>
      <button type="submit" className="btn btn-outline btn-xs" disabled={isSubmitting}>
        {isSubmitting ? '更新中' : '更新'}
      </button>
      {fetcher.data && 'error' in fetcher.data && (
        <span className="text-error text-xs whitespace-normal" role="alert">
          {fetcher.data.error}
        </span>
      )}
    </fetcher.Form>
  );
}

export default function AdminIndex() {
  const { posts, page, totalPages, total } = useLoaderData<typeof loader>();
  const [deleteTarget, setDeleteTarget] = useState<{
    postId: number;
    postTitle: string;
  } | null>(null);
  const pvFetcher = useFetcher<Record<string, number>>();

  useEffect(() => {
    if (posts.length === 0) return;
    const ids = posts.map((p) => p.postId).join(',');
    pvFetcher.load(`/admin/pv?postIds=${ids}`);
  }, [posts]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">記事一覧 ({total}件)</h1>

      <div className="overflow-x-auto">
        <table className="table table-sm w-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>タイトル</th>
              <th>いいね</th>
              <th>PV</th>
              <th>投稿日</th>
              <th>歓迎状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.postId}>
                <td>{post.postId}</td>
                <td className="max-w-md truncate">
                  <Link to={`/archives/${post.postId}`} target="_blank" className="link link-hover">
                    {post.postTitle}
                  </Link>
                </td>
                <td>{post.countLikes}</td>
                <td>
                  {pvFetcher.state === 'idle' && pvFetcher.data ? (
                    (pvFetcher.data[post.postId] ?? 0).toLocaleString()
                  ) : (
                    <span className="loading loading-spinner loading-xs" />
                  )}
                </td>
                <td className="text-sm opacity-70">{post.postDateGmt}</td>
                <td>
                  <WelcomedForm postId={post.postId} isWelcomed={post.isWelcomed} />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-error btn-xs"
                    onClick={() =>
                      setDeleteTarget({ postId: post.postId, postTitle: post.postTitle })
                    }
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="join mt-4 flex justify-center">
        {page > 1 && (
          <Link to={`/admin?page=${page - 1}`} className="join-item btn btn-sm">
            &laquo;
          </Link>
        )}
        <span className="join-item btn btn-sm btn-disabled">
          {page} / {totalPages}
        </span>
        {page < totalPages && (
          <Link to={`/admin?page=${page + 1}`} className="join-item btn btn-sm">
            &raquo;
          </Link>
        )}
      </div>

      {deleteTarget && <DeleteModal post={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}
