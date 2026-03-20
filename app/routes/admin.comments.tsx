import { useLoaderData, Link, useFetcher } from 'react-router';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq, count } from 'drizzle-orm';
import { dimComments, dimPosts } from '~/drizzle/schema';
import { requireAdmin } from '~/modules/admin.server';
import { useState, useRef, useEffect } from 'react';

const PAGE_SIZE = 50;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  const env = (globalThis as any).__cloudflareEnv;
  const db = drizzle(env.DB);

  const offset = (page - 1) * PAGE_SIZE;

  const [comments, totalResult] = await Promise.all([
    db
      .select({
        commentId: dimComments.commentId,
        postId: dimComments.postId,
        postTitle: dimPosts.postTitle,
        commentAuthor: dimComments.commentAuthor,
        commentContent: dimComments.commentContent,
        commentDateJst: dimComments.commentDateJst,
      })
      .from(dimComments)
      .innerJoin(dimPosts, eq(dimComments.postId, dimPosts.postId))
      .orderBy(desc(dimComments.commentId))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(dimComments),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return { comments, page, totalPages, total };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdmin(request);

  const env = (globalThis as any).__cloudflareEnv;
  const db = drizzle(env.DB);

  const formData = await request.formData();
  const commentId = Number(formData.get('commentId'));

  if (!commentId || Number.isNaN(commentId)) {
    return { error: 'コメントIDが不正です' };
  }

  try {
    await db.delete(dimComments).where(eq(dimComments.commentId, commentId));
    return { success: true, deletedCommentId: commentId };
  } catch (err) {
    const message = err instanceof Error ? err.message : '削除に失敗しました';
    return { error: message };
  }
}

function DeleteModal({
  comment,
  onClose,
}: {
  comment: { commentId: number; commentAuthor: string; commentContent: string };
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
        <h3 className="font-bold text-lg">コメントを削除しますか？</h3>
        <p className="py-2 text-sm opacity-70">
          ID: {comment.commentId} — {comment.commentAuthor}
        </p>
        <p className="text-sm break-all opacity-60">
          {comment.commentContent.length > 100
            ? `${comment.commentContent.slice(0, 100)}…`
            : comment.commentContent}
        </p>
        <p className="text-sm text-warning mt-2">
          関連する投票履歴も削除されます。この操作は元に戻せません。
        </p>

        <fetcher.Form method="post" className="mt-4">
          <input type="hidden" name="commentId" value={comment.commentId} />

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

export default function AdminComments() {
  const { comments, page, totalPages, total } = useLoaderData<typeof loader>();
  const [deleteTarget, setDeleteTarget] = useState<{
    commentId: number;
    commentAuthor: string;
    commentContent: string;
  } | null>(null);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">コメント管理 ({total}件)</h1>

      <div className="overflow-x-auto">
        <table className="table table-sm w-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>記事</th>
              <th>投稿者</th>
              <th>コメント</th>
              <th>投稿日時</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {comments.map((comment) => (
              <tr key={comment.commentId}>
                <td>{comment.commentId}</td>
                <td className="max-w-xs truncate">
                  <Link
                    to={`/archives/${comment.postId}`}
                    target="_blank"
                    className="link link-hover"
                  >
                    {comment.postTitle}
                  </Link>
                </td>
                <td>{comment.commentAuthor}</td>
                <td className="max-w-xs truncate">{comment.commentContent}</td>
                <td className="text-sm opacity-70 whitespace-nowrap">{comment.commentDateJst}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-error btn-xs"
                    onClick={() =>
                      setDeleteTarget({
                        commentId: comment.commentId,
                        commentAuthor: comment.commentAuthor,
                        commentContent: comment.commentContent,
                      })
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
          <Link to={`/admin/comments?page=${page - 1}`} className="join-item btn btn-sm">
            &laquo;
          </Link>
        )}
        <span className="join-item btn btn-sm btn-disabled">
          {page} / {totalPages}
        </span>
        {page < totalPages && (
          <Link to={`/admin/comments?page=${page + 1}`} className="join-item btn btn-sm">
            &raquo;
          </Link>
        )}
      </div>

      {deleteTarget && <DeleteModal comment={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}
