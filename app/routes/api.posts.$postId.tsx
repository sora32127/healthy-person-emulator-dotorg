/**
 * 投稿本文取得API（外部公開）
 * 検索API（/api/search）でヒットしたpostIdから、本文・コメント・タグ等の詳細を取得する。
 *
 * GET /api/posts/:postId
 */
import type { LoaderFunctionArgs } from 'react-router';
import { ArchiveDataEntry } from '~/modules/db.server';

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const postIdParam = params.postId;
  const postId = Number(postIdParam);
  if (!Number.isInteger(postId) || postId < 1) {
    return jsonError(400, 'postId must be a positive integer');
  }

  let entry: ArchiveDataEntry;
  try {
    entry = await ArchiveDataEntry.getData(postId);
  } catch (e) {
    if (e instanceof Response && e.status === 404) {
      return jsonError(404, 'Post not found');
    }
    throw e;
  }

  const origin = new URL(request.url).origin;
  const payload = {
    postId: entry.postId,
    postTitle: entry.postTitle,
    postUrl: `${origin}/archives/${entry.postId}`,
    postDateGmt: entry.postDateGmt.toISOString(),
    postContentHtml: entry.postContent,
    commentStatus: entry.commentStatus,
    countLikes: entry.countLikes,
    countDislikes: entry.countDislikes,
    countBookmarks: entry.countBookmarks,
    countComments: entry.comments.length,
    ogpImageUrl: entry.ogpImageUrl,
    isWelcomed: entry.isWelcomed,
    isWelcomedExplanation: entry.isWelcomedExplanation,
    tags: entry.tags.map((t) => ({ tagName: t.tagName, tagId: t.tagId })),
    comments: entry.comments.map((c) => ({
      commentId: c.commentId,
      commentDateGmt: c.commentDateGmt.toISOString(),
      commentAuthor: c.commentAuthor,
      commentContent: c.commentContent,
      likesCount: c.likesCount,
      dislikesCount: c.dislikesCount,
      commentParent: c.commentParent,
    })),
    similarPosts: entry.similarPosts.map((p) => ({
      postId: p.postId,
      postTitle: p.postTitle,
      postUrl: `${origin}/archives/${p.postId}`,
    })),
    previousPost: entry.previousPost
      ? {
          postId: entry.previousPost.postId,
          postTitle: entry.previousPost.postTitle,
          postUrl: `${origin}/archives/${entry.previousPost.postId}`,
        }
      : null,
    nextPost: entry.nextPost
      ? {
          postId: entry.nextPost.postId,
          postTitle: entry.nextPost.postTitle,
          postUrl: `${origin}/archives/${entry.nextPost.postId}`,
        }
      : null,
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
