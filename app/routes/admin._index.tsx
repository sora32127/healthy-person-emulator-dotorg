import { useLoaderData, Link } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { drizzle } from 'drizzle-orm/d1';
import { desc, count } from 'drizzle-orm';
import { dimPosts } from '~/drizzle/schema';

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
        postId: dimPosts.postId,
        postTitle: dimPosts.postTitle,
        countLikes: dimPosts.countLikes,
        postDateGmt: dimPosts.postDateGmt,
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

export default function AdminIndex() {
  const { posts, page, totalPages, total } = useLoaderData<typeof loader>();

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
              <th>投稿日</th>
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
                <td className="text-sm opacity-70">{post.postDateGmt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
  );
}
