import { useLoaderData, Link } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { drizzle } from 'drizzle-orm/d1';
import { desc, count } from 'drizzle-orm';
import { dimDeletedPosts } from '~/drizzle/schema';

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
        deletedPostId: dimDeletedPosts.deletedPostId,
        originalPostId: dimDeletedPosts.originalPostId,
        postTitle: dimDeletedPosts.postTitle,
        postDateGmt: dimDeletedPosts.postDateGmt,
        deletedAtUtc: dimDeletedPosts.deletedAtUtc,
        deletedByEmail: dimDeletedPosts.deletedByEmail,
        deletionReason: dimDeletedPosts.deletionReason,
        tweetIdOfFirstTweet: dimDeletedPosts.tweetIdOfFirstTweet,
        blueskyPostUriOfFirstPost: dimDeletedPosts.blueskyPostUriOfFirstPost,
        misskeyNoteIdOfFirstNote: dimDeletedPosts.misskeyNoteIdOfFirstNote,
      })
      .from(dimDeletedPosts)
      .orderBy(desc(dimDeletedPosts.deletedPostId))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(dimDeletedPosts),
  ]);

  const total = totalResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return { posts, page, totalPages, total };
}

function SnsIndicator({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <span className="badge badge-sm badge-ghost">{label}</span>;
}

export default function DeletedPostsPage() {
  const { posts, page, totalPages, total } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">削除済み記事 ({total}件)</h1>

      {posts.length === 0 ? (
        <p className="text-sm opacity-60">削除済みの記事はありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th>元ID</th>
                <th>タイトル</th>
                <th>投稿日</th>
                <th>削除日時</th>
                <th>削除者</th>
                <th>理由</th>
                <th>SNS</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.deletedPostId}>
                  <td>{post.originalPostId}</td>
                  <td className="max-w-xs truncate">{post.postTitle}</td>
                  <td className="text-sm opacity-70">{post.postDateGmt}</td>
                  <td className="text-sm opacity-70">{post.deletedAtUtc}</td>
                  <td className="text-sm">{post.deletedByEmail}</td>
                  <td className="max-w-xs truncate text-sm">{post.deletionReason || '-'}</td>
                  <td className="flex gap-1">
                    <SnsIndicator label="X" value={post.tweetIdOfFirstTweet} />
                    <SnsIndicator label="BS" value={post.blueskyPostUriOfFirstPost} />
                    <SnsIndicator label="MK" value={post.misskeyNoteIdOfFirstNote} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="join mt-4 flex justify-center">
          {page > 1 && (
            <Link to={`/admin/deleted-posts?page=${page - 1}`} className="join-item btn btn-sm">
              &laquo;
            </Link>
          )}
          <span className="join-item btn btn-sm btn-disabled">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link to={`/admin/deleted-posts?page=${page + 1}`} className="join-item btn btn-sm">
              &raquo;
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
