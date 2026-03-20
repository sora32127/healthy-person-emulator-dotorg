import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, asc, and, sql, count, inArray, lt, gt, like, not, isNull } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  DatabaseRepository,
  CreatePostWithTagsInput,
  CreatedPostSummary,
  CreateCommentInput,
  PostData,
  CommentData,
  PreviousOrNextPostData,
  PostCardData,
  BookmarkPostCardData,
  CommentShowCardData,
  FeedPostType,
  PostFeedData,
  CommentFeedData,
  TagCount,
  NowEditingInfo,
  PostForEditing,
  PostEditHistoryEntry,
  UpdatePostWithTagsInput,
  SearchOrderBy,
  SearchPostsResult,
} from './types';
import { formatDate } from '../modules/util.server';
import * as schema from '../drizzle/schema';
import { nowUTC, nowJST } from '../drizzle/utils';

// Helper: convert D1 string timestamps to Date objects
function toDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return new Date(value);
}

export function createD1Repository(d1: D1Database): DatabaseRepository {
  const db = drizzle(d1);

  // Helper to get comment vote counts for a set of comment IDs
  async function getCommentVoteCounts(commentIds: number[]) {
    if (commentIds.length === 0) return [];
    return db
      .select({
        commentId: schema.fctCommentVoteHistory.commentId,
        voteType: schema.fctCommentVoteHistory.voteType,
        cnt: count(),
      })
      .from(schema.fctCommentVoteHistory)
      .where(inArray(schema.fctCommentVoteHistory.commentId, commentIds))
      .groupBy(schema.fctCommentVoteHistory.commentId, schema.fctCommentVoteHistory.voteType);
  }

  function getLikesCount(
    voteCounts: { commentId: number; voteType: number; cnt: number }[],
    commentId: number,
  ): number {
    return voteCounts.find((v) => v.commentId === commentId && v.voteType === 1)?.cnt || 0;
  }

  function getDislikesCount(
    voteCounts: { commentId: number; voteType: number; cnt: number }[],
    commentId: number,
  ): number {
    return voteCounts.find((v) => v.commentId === commentId && v.voteType === -1)?.cnt || 0;
  }

  // Helper to get comment counts per post for a set of post IDs
  async function getCommentCountsByPostIds(postIds: number[]) {
    if (postIds.length === 0) return [];
    return db
      .select({
        postId: schema.dimComments.postId,
        cnt: count(),
      })
      .from(schema.dimComments)
      .where(inArray(schema.dimComments.postId, postIds))
      .groupBy(schema.dimComments.postId);
  }

  // Helper to get tags for a set of post IDs
  async function getTagsByPostIds(postIds: number[]) {
    if (postIds.length === 0) return [];
    return db
      .select({
        postId: schema.relPostTags.postId,
        tagId: schema.dimTags.tagId,
        tagName: schema.dimTags.tagName,
      })
      .from(schema.relPostTags)
      .innerJoin(schema.dimTags, eq(schema.relPostTags.tagId, schema.dimTags.tagId))
      .where(inArray(schema.relPostTags.postId, postIds));
  }

  return {
    async getPostDataForSitemap() {
      const posts = await db
        .select({ postId: schema.dimPosts.postId })
        .from(schema.dimPosts)
        .where(isNull(schema.dimPosts.mergedIntoPostId));

      return posts.map((post) => ({
        loc: `https://healthy-person-emulator.org/archives/${post.postId}`,
      }));
    },

    async getTagNamesByPostId(postId: number): Promise<string[]> {
      const tags = await db
        .select({ tagName: schema.dimTags.tagName })
        .from(schema.relPostTags)
        .innerJoin(schema.dimTags, eq(schema.relPostTags.tagId, schema.dimTags.tagId))
        .where(eq(schema.relPostTags.postId, postId));

      return tags.map((tag) => tag.tagName);
    },

    async createPostWithTags({
      postContent,
      postTitle,
      hashedUserIpAddress,
      selectedTags = [],
      createdTags = [],
    }: CreatePostWithTagsInput): Promise<CreatedPostSummary> {
      const uniqueTags = Array.from(new Set([...(selectedTags ?? []), ...(createdTags ?? [])]));

      // Create the post
      const [newPost] = await db
        .insert(schema.dimPosts)
        .values({
          postAuthorIpHash: hashedUserIpAddress,
          postContent,
          postTitle,
          countLikes: 0,
          countDislikes: 0,
          commentStatus: 'open',
          postDateJst: nowJST(),
          postDateGmt: nowUTC(),
          uuid: crypto.randomUUID(),
        })
        .returning({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
          postContent: schema.dimPosts.postContent,
        });

      if (uniqueTags.length > 0) {
        // Find existing tags
        const existingTags = await db
          .select()
          .from(schema.dimTags)
          .where(inArray(schema.dimTags.tagName, uniqueTags));

        const existingTagNames = existingTags.map((tag) => tag.tagName);
        const newTagNames = uniqueTags.filter((tag) => !existingTagNames.includes(tag));

        // Create new tags
        const newTags = [];
        for (const tagName of newTagNames) {
          const [created] = await db.insert(schema.dimTags).values({ tagName }).returning();
          newTags.push(created);
        }

        const allTags = [...existingTags, ...newTags];

        // Create post-tag relations
        for (const tag of allTags) {
          await db.insert(schema.relPostTags).values({
            postId: newPost.postId,
            tagId: tag.tagId,
          });
        }
      }

      return newPost;
    },

    async getPostByPostId(postId: number): Promise<PostData> {
      const [post] = await db
        .select({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
          postContent: schema.dimPosts.postContent,
          postDateGmt: schema.dimPosts.postDateGmt,
          countLikes: schema.dimPosts.countLikes,
          countDislikes: schema.dimPosts.countDislikes,
          commentStatus: schema.dimPosts.commentStatus,
          ogpImageUrl: schema.dimPosts.ogpImageUrl,
          isWelcomed: schema.dimPosts.isWelcomed,
          isWelcomedExplanation: schema.dimPosts.isWelcomedExplanation,
          tweetIdOfFirstTweet: schema.dimPosts.tweetIdOfFirstTweet,
          blueskyPostUriOfFirstPost: schema.dimPosts.blueskyPostUriOfFirstPost,
          misskeyNoteIdOfFirstNote: schema.dimPosts.misskeyNoteIdOfFirstNote,
          mergedIntoPostId: schema.dimPosts.mergedIntoPostId,
        })
        .from(schema.dimPosts)
        .where(eq(schema.dimPosts.postId, postId))
        .limit(1);

      if (!post) {
        throw new Response(null, {
          status: 404,
          statusText: 'Post Not Found',
        });
      }

      const tags = await db
        .select({
          tagName: schema.dimTags.tagName,
          tagId: schema.dimTags.tagId,
        })
        .from(schema.relPostTags)
        .innerJoin(schema.dimTags, eq(schema.relPostTags.tagId, schema.dimTags.tagId))
        .where(eq(schema.relPostTags.postId, postId))
        .orderBy(asc(schema.dimTags.tagName));

      return {
        ...post,
        postDateGmt: toDate(post.postDateGmt),
        tags,
        postURL: `https://healthy-person-emulator.org/archives/${post.postId}`,
      };
    },

    async getCommentsByPostId(postId: number): Promise<CommentData[]> {
      const comments = await db
        .select({
          commentId: schema.dimComments.commentId,
          commentDateGmt: schema.dimComments.commentDateGmt,
          commentAuthor: schema.dimComments.commentAuthor,
          commentContent: schema.dimComments.commentContent,
          commentParent: schema.dimComments.commentParent,
        })
        .from(schema.dimComments)
        .where(eq(schema.dimComments.postId, postId))
        .orderBy(desc(schema.dimComments.commentDateGmt));

      const voteCounts = await getCommentVoteCounts(comments.map((c) => c.commentId));

      return comments.map((comment) => ({
        ...comment,
        commentDateGmt: toDate(comment.commentDateGmt),
        likesCount: getLikesCount(voteCounts, comment.commentId),
        dislikesCount: getDislikesCount(voteCounts, comment.commentId),
      }));
    },

    async getPreviousPost(postId: number): Promise<PreviousOrNextPostData> {
      const [previousPost] = await db
        .select({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
        })
        .from(schema.dimPosts)
        .where(
          and(
            lt(schema.dimPosts.postId, postId),
            not(like(schema.dimPosts.postTitle, '%プログラムテスト%')),
            isNull(schema.dimPosts.mergedIntoPostId),
          ),
        )
        .orderBy(desc(schema.dimPosts.postId))
        .limit(1);

      return previousPost as PreviousOrNextPostData;
    },

    async getNextPost(postId: number): Promise<PreviousOrNextPostData> {
      const [nextPost] = await db
        .select({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
        })
        .from(schema.dimPosts)
        .where(
          and(
            gt(schema.dimPosts.postId, postId),
            not(like(schema.dimPosts.postTitle, '%プログラムテスト%')),
            isNull(schema.dimPosts.mergedIntoPostId),
          ),
        )
        .orderBy(asc(schema.dimPosts.postId))
        .limit(1);

      return nextPost as PreviousOrNextPostData;
    },

    async getCountBookmarks(postId: number): Promise<number> {
      const [result] = await db
        .select({ count: count() })
        .from(schema.fctUserBookmarkActivity)
        .where(eq(schema.fctUserBookmarkActivity.postId, postId));
      return result.count;
    },

    async getUserId(userUuid: string): Promise<number> {
      const [user] = await db
        .select({ userId: schema.dimUsers.userId })
        .from(schema.dimUsers)
        .where(eq(schema.dimUsers.userUuid, userUuid))
        .limit(1);
      return user?.userId || 0;
    },

    async getBookmarkPostsByPagenation(
      userId: number,
      pageNumber: number,
      chunkSize: number,
    ): Promise<BookmarkPostCardData[]> {
      const offset = (pageNumber - 1) * chunkSize;

      const bookmarkPostIdsAndDate = await db
        .select({
          postId: schema.fctUserBookmarkActivity.postId,
          bookmarkDateJST: schema.fctUserBookmarkActivity.bookmarkDateJst,
        })
        .from(schema.fctUserBookmarkActivity)
        .where(eq(schema.fctUserBookmarkActivity.userId, userId))
        .orderBy(desc(schema.fctUserBookmarkActivity.bookmarkDateJst))
        .offset(offset)
        .limit(chunkSize);

      const postIds = bookmarkPostIdsAndDate.map((b) => b.postId);
      if (postIds.length === 0) return [];

      const commentCounts = await getCommentCountsByPostIds(postIds);

      const bookmarkPosts = await db
        .select({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
          postDateGmt: schema.dimPosts.postDateGmt,
          countLikes: schema.dimPosts.countLikes,
          countDislikes: schema.dimPosts.countDislikes,
          ogpImageUrl: schema.dimPosts.ogpImageUrl,
        })
        .from(schema.dimPosts)
        .where(inArray(schema.dimPosts.postId, postIds));

      const allTags = await getTagsByPostIds(postIds);

      const result = bookmarkPosts
        .map((post) => {
          const postCommentCount = commentCounts.find((c) => c.postId === post.postId)?.cnt || 0;
          const postTags = allTags
            .filter((t) => t.postId === post.postId)
            .map((t) => ({ tagName: t.tagName, tagId: t.tagId }));
          const bookmark = bookmarkPostIdsAndDate.find((b) => b.postId === post.postId);
          return {
            ...post,
            postDateGmt: toDate(post.postDateGmt),
            countComments: postCommentCount,
            tags: postTags,
            bookmarkDateJST: formatDate(toDate(bookmark?.bookmarkDateJST)),
          };
        })
        .sort((a, b) => b.bookmarkDateJST.localeCompare(a.bookmarkDateJST));

      return result;
    },

    async addOrRemoveBookmark(postId: number, userId: number) {
      const [existing] = await db
        .select({ count: count() })
        .from(schema.fctUserBookmarkActivity)
        .where(
          and(
            eq(schema.fctUserBookmarkActivity.postId, postId),
            eq(schema.fctUserBookmarkActivity.userId, userId),
          ),
        );

      if (existing.count > 0) {
        await db
          .delete(schema.fctUserBookmarkActivity)
          .where(
            and(
              eq(schema.fctUserBookmarkActivity.postId, postId),
              eq(schema.fctUserBookmarkActivity.userId, userId),
            ),
          );
        return { message: 'ブックマークを削除しました', success: true };
      }

      await db.insert(schema.fctUserBookmarkActivity).values({
        postId,
        userId,
        bookmarkDateGmt: nowUTC(),
        bookmarkDateJst: nowJST(),
      });
      return { message: 'ブックマークしました', success: true };
    },

    async recordPostVote(
      postId: number,
      voteType: 'like' | 'dislike',
      voteUserIpHash: string,
    ): Promise<void> {
      await db.insert(schema.fctPostVoteHistory).values({
        voteUserIpHash,
        postId,
        voteTypeInt: voteType === 'like' ? 1 : -1,
        voteDateGmt: nowUTC(),
        voteDateJst: nowJST(),
      });

      if (voteType === 'like') {
        await db
          .update(schema.dimPosts)
          .set({ countLikes: sql`${schema.dimPosts.countLikes} + 1` })
          .where(eq(schema.dimPosts.postId, postId));
      } else {
        await db
          .update(schema.dimPosts)
          .set({ countDislikes: sql`${schema.dimPosts.countDislikes} + 1` })
          .where(eq(schema.dimPosts.postId, postId));
      }
    },

    async recordCommentVote(
      postId: number,
      commentId: number,
      voteType: 'like' | 'dislike',
      voteUserIpHash: string,
    ): Promise<void> {
      await db.insert(schema.fctCommentVoteHistory).values({
        voteUserIpHash,
        commentId,
        postId,
        voteType: voteType === 'like' ? 1 : -1,
        commentVoteDateJst: nowJST(),
        commentVoteDateUtc: nowUTC(),
      });
    },

    async createPostComment({
      postId,
      commentAuthor,
      commentContent,
      commentParent = 0,
      commentAuthorIpHash,
    }: CreateCommentInput): Promise<void> {
      await db.insert(schema.dimComments).values({
        postId,
        commentAuthor: commentAuthor ?? 'Anonymous',
        commentContent,
        commentParent,
        commentAuthorIpHash,
        commentDateJst: nowJST(),
        commentDateGmt: nowUTC(),
        uuid: crypto.randomUUID(),
      });
    },

    async judgeIsBookmarked(postId: number, userUuid: string | undefined): Promise<boolean> {
      if (!userUuid) return false;

      const [user] = await db
        .select({ userId: schema.dimUsers.userId })
        .from(schema.dimUsers)
        .where(eq(schema.dimUsers.userUuid, userUuid))
        .limit(1);

      const userId = user?.userId || 0;

      const [result] = await db
        .select({ count: count() })
        .from(schema.fctUserBookmarkActivity)
        .where(
          and(
            eq(schema.fctUserBookmarkActivity.postId, postId),
            eq(schema.fctUserBookmarkActivity.userId, userId),
          ),
        );

      return result.count > 0;
    },

    async getRecentPostsByTagId(tagId: number): Promise<PostCardData[]> {
      // Get posts for this tag, ordered by postDateGmt desc, limited to 20
      const postRelations = await db
        .select({
          postId: schema.relPostTags.postId,
        })
        .from(schema.relPostTags)
        .innerJoin(schema.dimPosts, eq(schema.relPostTags.postId, schema.dimPosts.postId))
        .where(and(eq(schema.relPostTags.tagId, tagId), isNull(schema.dimPosts.mergedIntoPostId)))
        .orderBy(desc(schema.dimPosts.postDateGmt))
        .limit(20);

      const postIds = postRelations.map((r) => r.postId);
      if (postIds.length === 0) return [];

      const posts = await db
        .select({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
          postDateGmt: schema.dimPosts.postDateGmt,
          countLikes: schema.dimPosts.countLikes,
          countDislikes: schema.dimPosts.countDislikes,
          ogpImageUrl: schema.dimPosts.ogpImageUrl,
        })
        .from(schema.dimPosts)
        .where(inArray(schema.dimPosts.postId, postIds));

      const allTags = await getTagsByPostIds(postIds);
      const commentCounts = await getCommentCountsByPostIds(postIds);

      return posts.map((post) => ({
        ...post,
        postDateGmt: toDate(post.postDateGmt),
        tags: allTags
          .filter((t) => t.postId === post.postId)
          .map((t) => ({ tagName: t.tagName, tagId: t.tagId })),
        countComments: commentCounts.find((c) => c.postId === post.postId)?.cnt || 0,
      }));
    },

    async getRecentComments(chunkSize = 12, pageNumber = 1): Promise<CommentShowCardData[]> {
      const offset = (pageNumber - 1) * chunkSize;

      const recentComments = await db
        .select({
          commentId: schema.dimComments.commentId,
          postId: schema.dimComments.postId,
          commentContent: schema.dimComments.commentContent,
          commentDateGmt: schema.dimComments.commentDateGmt,
          commentAuthor: schema.dimComments.commentAuthor,
          postTitle: schema.dimPosts.postTitle,
        })
        .from(schema.dimComments)
        .innerJoin(schema.dimPosts, eq(schema.dimComments.postId, schema.dimPosts.postId))
        .where(
          and(
            not(like(schema.dimPosts.postTitle, '%プログラムテスト%')),
            isNull(schema.dimPosts.mergedIntoPostId),
          ),
        )
        .orderBy(desc(schema.dimComments.commentDateJst))
        .offset(offset)
        .limit(chunkSize);

      const voteCounts = await getCommentVoteCounts(recentComments.map((c) => c.commentId));

      return recentComments.map((comment) => ({
        ...comment,
        commentDateGmt: toDate(comment.commentDateGmt),
        countLikes: getLikesCount(voteCounts, comment.commentId),
        countDislikes: getDislikesCount(voteCounts, comment.commentId),
      }));
    },

    async getRandomPosts(): Promise<PostCardData[]> {
      const [totalResult] = await db
        .select({ count: count() })
        .from(schema.dimPosts)
        .where(isNull(schema.dimPosts.mergedIntoPostId));
      const postCount = totalResult.count;
      const randomPostOffset = Math.max(Math.floor(Math.random() * postCount) - 12, 0);

      const randomPostsRaw = await db
        .select({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
          postDateGmt: schema.dimPosts.postDateGmt,
          countLikes: schema.dimPosts.countLikes,
          countDislikes: schema.dimPosts.countDislikes,
          ogpImageUrl: schema.dimPosts.ogpImageUrl,
        })
        .from(schema.dimPosts)
        .where(isNull(schema.dimPosts.mergedIntoPostId))
        .orderBy(asc(schema.dimPosts.uuid))
        .offset(randomPostOffset)
        .limit(12);

      const postIds = randomPostsRaw.map((p) => p.postId);
      const commentCounts = await getCommentCountsByPostIds(postIds);
      const allTags = await getTagsByPostIds(postIds);

      return randomPostsRaw.map((post) => ({
        ...post,
        postDateGmt: toDate(post.postDateGmt),
        countComments: commentCounts.find((c) => c.postId === post.postId)?.cnt || 0,
        tags: allTags
          .filter((t) => t.postId === post.postId)
          .map((t) => ({ tagName: t.tagName, tagId: t.tagId })),
      }));
    },

    async getRandomComments(chunkSize = 12): Promise<CommentShowCardData[]> {
      const [totalResult] = await db.select({ count: count() }).from(schema.dimComments);
      const commentCount = totalResult.count;
      const randomCommentOffset = Math.max(Math.floor(Math.random() * commentCount) - chunkSize, 0);

      const randomComments = await db
        .select({
          commentId: schema.dimComments.commentId,
          commentContent: schema.dimComments.commentContent,
          commentDateGmt: schema.dimComments.commentDateGmt,
          commentAuthor: schema.dimComments.commentAuthor,
          postId: schema.dimComments.postId,
          postTitle: schema.dimPosts.postTitle,
        })
        .from(schema.dimComments)
        .innerJoin(schema.dimPosts, eq(schema.dimComments.postId, schema.dimPosts.postId))
        .orderBy(asc(schema.dimComments.uuid))
        .offset(randomCommentOffset)
        .limit(chunkSize);

      const voteCounts = await getCommentVoteCounts(randomComments.map((c) => c.commentId));

      return randomComments.map((comment) => ({
        ...comment,
        commentDateGmt: toDate(comment.commentDateGmt),
        countLikes: getLikesCount(voteCounts, comment.commentId),
        countDislikes: getDislikesCount(voteCounts, comment.commentId),
      }));
    },

    async getFeedPosts(
      pagingNumber: number,
      type: FeedPostType,
      chunkSize = 12,
      likeFromHour = 24,
      likeToHour = 0,
    ): Promise<PostFeedData> {
      const offset = (pagingNumber - 1) * chunkSize;

      if (['unboundedLikes', 'timeDesc', 'timeAsc'].includes(type)) {
        const orderByClause =
          type === 'unboundedLikes'
            ? [desc(schema.dimPosts.countLikes), desc(schema.dimPosts.postDateGmt)]
            : type === 'timeDesc'
              ? [desc(schema.dimPosts.postDateGmt)]
              : [asc(schema.dimPosts.postDateGmt)];

        const posts = await db
          .select({
            postId: schema.dimPosts.postId,
            postTitle: schema.dimPosts.postTitle,
            postDateGmt: schema.dimPosts.postDateGmt,
            countLikes: schema.dimPosts.countLikes,
            countDislikes: schema.dimPosts.countDislikes,
            ogpImageUrl: schema.dimPosts.ogpImageUrl,
          })
          .from(schema.dimPosts)
          .where(isNull(schema.dimPosts.mergedIntoPostId))
          .orderBy(...orderByClause)
          .offset(offset)
          .limit(chunkSize);

        const postIds = posts.map((p) => p.postId);
        const commentCounts = await getCommentCountsByPostIds(postIds);
        const allTags = await getTagsByPostIds(postIds);
        const [totalResult] = await db
          .select({ count: count() })
          .from(schema.dimPosts)
          .where(isNull(schema.dimPosts.mergedIntoPostId));

        const postData = posts.map((post) => ({
          postId: post.postId,
          postTitle: post.postTitle,
          postDateGmt: toDate(post.postDateGmt),
          countLikes: post.countLikes,
          countDislikes: post.countDislikes,
          ogpImageUrl: post.ogpImageUrl,
          tags: allTags
            .filter((t) => t.postId === post.postId)
            .map((t) => ({ tagName: t.tagName, tagId: t.tagId })),
          countComments: commentCounts.find((c) => c.postId === post.postId)?.cnt || 0,
        }));

        return {
          meta: {
            totalCount: totalResult.count,
            currentPage: pagingNumber,
            type,
            chunkSize,
          },
          result: postData,
        };
      }

      if (type === 'likes') {
        const fromDate = new Date(Date.now() - likeFromHour * 60 * 60 * 1000).toISOString();
        const toDate_ = new Date(Date.now() - likeToHour * 60 * 60 * 1000).toISOString();

        // Get post IDs with most likes in the time period
        const voteCountRows = await db
          .select({
            postId: schema.fctPostVoteHistory.postId,
            cnt: count(),
          })
          .from(schema.fctPostVoteHistory)
          .where(
            and(
              eq(schema.fctPostVoteHistory.voteTypeInt, 1),
              sql`${schema.fctPostVoteHistory.voteDateGmt} >= ${fromDate}`,
              sql`${schema.fctPostVoteHistory.voteDateGmt} <= ${toDate_}`,
            ),
          )
          .groupBy(schema.fctPostVoteHistory.postId)
          .orderBy(desc(count()))
          .offset(offset)
          .limit(chunkSize);

        // Get total count for pagination
        const totalCountRows = await db
          .select({
            postId: schema.fctPostVoteHistory.postId,
          })
          .from(schema.fctPostVoteHistory)
          .where(
            and(
              eq(schema.fctPostVoteHistory.voteTypeInt, 1),
              sql`${schema.fctPostVoteHistory.voteDateGmt} >= ${fromDate}`,
              sql`${schema.fctPostVoteHistory.voteDateGmt} <= ${toDate_}`,
            ),
          )
          .groupBy(schema.fctPostVoteHistory.postId);
        const totalCount = totalCountRows.length;

        const postIds = voteCountRows.map((v) => v.postId);
        if (postIds.length === 0) {
          return {
            meta: {
              totalCount: 0,
              currentPage: pagingNumber,
              type,
              likeFromHour,
              likeToHour,
              chunkSize,
            },
            result: [],
          };
        }

        const posts = await db
          .select({
            postId: schema.dimPosts.postId,
            postTitle: schema.dimPosts.postTitle,
            postDateGmt: schema.dimPosts.postDateGmt,
            countLikes: schema.dimPosts.countLikes,
            countDislikes: schema.dimPosts.countDislikes,
            ogpImageUrl: schema.dimPosts.ogpImageUrl,
          })
          .from(schema.dimPosts)
          .where(
            and(inArray(schema.dimPosts.postId, postIds), isNull(schema.dimPosts.mergedIntoPostId)),
          );

        const filteredPostIds = posts.map((p) => p.postId);
        const allTags = await getTagsByPostIds(filteredPostIds);
        const commentCounts = await getCommentCountsByPostIds(filteredPostIds);

        const postData = posts.map((post) => ({
          ...post,
          postDateGmt: toDate(post.postDateGmt),
          countComments: commentCounts.find((c) => c.postId === post.postId)?.cnt || 0,
          tags: allTags
            .filter((t) => t.postId === post.postId)
            .map((t) => ({ tagName: t.tagName, tagId: t.tagId })),
        }));

        return {
          meta: {
            totalCount,
            currentPage: pagingNumber,
            type,
            likeFromHour,
            likeToHour,
            chunkSize,
          },
          result: postData,
        };
      }

      return {
        meta: { totalCount: 0, currentPage: 0, type, chunkSize },
        result: [],
      };
    },

    async getFeedComments(
      pagingNumber: number,
      type: FeedPostType,
      chunkSize = 12,
      likeFromHour = 48,
      likeToHour = 0,
    ): Promise<CommentFeedData> {
      const offset = (pagingNumber - 1) * chunkSize;

      if (['timeDesc', 'timeAsc'].includes(type)) {
        const [totalResult] = await db.select({ count: count() }).from(schema.dimComments);

        const comments = await db
          .select({
            commentId: schema.dimComments.commentId,
            postId: schema.dimComments.postId,
            commentContent: schema.dimComments.commentContent,
            commentDateGmt: schema.dimComments.commentDateGmt,
            commentAuthor: schema.dimComments.commentAuthor,
            postTitle: schema.dimPosts.postTitle,
          })
          .from(schema.dimComments)
          .innerJoin(schema.dimPosts, eq(schema.dimComments.postId, schema.dimPosts.postId))
          .orderBy(
            type === 'timeDesc'
              ? desc(schema.dimComments.commentDateJst)
              : asc(schema.dimComments.commentDateJst),
          )
          .offset(offset)
          .limit(chunkSize);

        const voteCounts = await getCommentVoteCounts(comments.map((c) => c.commentId));

        const commentData = comments.map((comment) => ({
          ...comment,
          commentDateGmt: toDate(comment.commentDateGmt),
          countLikes: getLikesCount(voteCounts, comment.commentId),
          countDislikes: getDislikesCount(voteCounts, comment.commentId),
        }));

        return {
          meta: { totalCount: totalResult.count, currentPage: pagingNumber, type, chunkSize },
          result: commentData,
        };
      }

      if (type === 'unboundedLikes') {
        // Total count of comments that have at least one like
        const totalCountRows = await db
          .select({ postId: schema.fctCommentVoteHistory.commentId })
          .from(schema.fctCommentVoteHistory)
          .where(eq(schema.fctCommentVoteHistory.voteType, 1))
          .groupBy(schema.fctCommentVoteHistory.commentId);
        const totalCount = totalCountRows.length;

        // Get comment IDs sorted by vote count
        const commentIdRows = await db
          .select({
            commentId: schema.fctCommentVoteHistory.commentId,
            cnt: count(),
          })
          .from(schema.fctCommentVoteHistory)
          .where(eq(schema.fctCommentVoteHistory.voteType, 1))
          .groupBy(schema.fctCommentVoteHistory.commentId)
          .orderBy(desc(count()))
          .offset(offset)
          .limit(chunkSize);

        const commentIds = commentIdRows.map((c) => c.commentId);
        if (commentIds.length === 0) {
          return {
            meta: { totalCount, currentPage: pagingNumber, type, chunkSize },
            result: [],
          };
        }

        const comments = await db
          .select({
            commentId: schema.dimComments.commentId,
            postId: schema.dimComments.postId,
            commentAuthor: schema.dimComments.commentAuthor,
            commentDateGmt: schema.dimComments.commentDateGmt,
            commentContent: schema.dimComments.commentContent,
            postTitle: schema.dimPosts.postTitle,
          })
          .from(schema.dimComments)
          .innerJoin(schema.dimPosts, eq(schema.dimComments.postId, schema.dimPosts.postId))
          .where(inArray(schema.dimComments.commentId, commentIds));

        // Sort by the same order as commentIdRows
        const sortedComments = comments.sort(
          (a, b) => commentIds.indexOf(a.commentId) - commentIds.indexOf(b.commentId),
        );

        const voteCounts = await getCommentVoteCounts(commentIds);

        const commentData = sortedComments.map((comment) => ({
          ...comment,
          commentDateGmt: toDate(comment.commentDateGmt),
          countLikes: getLikesCount(voteCounts, comment.commentId),
          countDislikes: getDislikesCount(voteCounts, comment.commentId),
        }));

        return {
          meta: { totalCount, currentPage: pagingNumber, type, chunkSize },
          result: commentData,
        };
      }

      if (type === 'likes') {
        const fromDate = new Date(Date.now() - likeFromHour * 60 * 60 * 1000).toISOString();
        const toDate_ = new Date(Date.now() - likeToHour * 60 * 60 * 1000).toISOString();

        // Total count
        const totalCountRows = await db
          .select({ commentId: schema.fctCommentVoteHistory.commentId })
          .from(schema.fctCommentVoteHistory)
          .where(
            and(
              eq(schema.fctCommentVoteHistory.voteType, 1),
              sql`${schema.fctCommentVoteHistory.commentVoteDateUtc} >= ${fromDate}`,
              sql`${schema.fctCommentVoteHistory.commentVoteDateUtc} <= ${toDate_}`,
            ),
          )
          .groupBy(schema.fctCommentVoteHistory.commentId);
        const totalCount = totalCountRows.length;

        // Get comment IDs sorted by vote count in time period
        const commentIdRows = await db
          .select({
            commentId: schema.fctCommentVoteHistory.commentId,
            cnt: count(),
          })
          .from(schema.fctCommentVoteHistory)
          .where(
            and(
              eq(schema.fctCommentVoteHistory.voteType, 1),
              sql`${schema.fctCommentVoteHistory.commentVoteDateUtc} >= ${fromDate}`,
              sql`${schema.fctCommentVoteHistory.commentVoteDateUtc} <= ${toDate_}`,
            ),
          )
          .groupBy(schema.fctCommentVoteHistory.commentId)
          .orderBy(desc(count()))
          .offset(offset)
          .limit(chunkSize);

        const commentIds = commentIdRows.map((c) => c.commentId);
        if (commentIds.length === 0) {
          return {
            meta: {
              totalCount,
              currentPage: pagingNumber,
              type,
              chunkSize,
              likeFromHour,
              likeToHour,
            },
            result: [],
          };
        }

        const comments = await db
          .select({
            commentId: schema.dimComments.commentId,
            postId: schema.dimComments.postId,
            commentAuthor: schema.dimComments.commentAuthor,
            commentDateGmt: schema.dimComments.commentDateGmt,
            commentContent: schema.dimComments.commentContent,
            postTitle: schema.dimPosts.postTitle,
          })
          .from(schema.dimComments)
          .innerJoin(schema.dimPosts, eq(schema.dimComments.postId, schema.dimPosts.postId))
          .where(inArray(schema.dimComments.commentId, commentIds));

        // Sort by the same order as commentIdRows
        const sortedComments = comments.sort(
          (a, b) => commentIds.indexOf(a.commentId) - commentIds.indexOf(b.commentId),
        );

        const voteCounts = await getCommentVoteCounts(commentIds);

        const commentData = sortedComments.map((comment) => ({
          ...comment,
          commentDateGmt: toDate(comment.commentDateGmt),
          countLikes: getLikesCount(voteCounts, comment.commentId),
          countDislikes: getDislikesCount(voteCounts, comment.commentId),
        }));

        return {
          meta: {
            totalCount,
            currentPage: pagingNumber,
            type,
            chunkSize,
            likeFromHour,
            likeToHour,
          },
          result: commentData,
        };
      }

      return {
        meta: { totalCount: 0, currentPage: 0, type, chunkSize },
        result: [],
      };
    },

    async getTagsCounts(): Promise<TagCount[]> {
      const tags = await db
        .select({
          tagName: schema.dimTags.tagName,
          count: count(),
        })
        .from(schema.dimTags)
        .leftJoin(schema.relPostTags, eq(schema.dimTags.tagId, schema.relPostTags.tagId))
        .groupBy(schema.dimTags.tagId, schema.dimTags.tagName)
        .orderBy(desc(count()));

      return tags;
    },

    async getStopWords(): Promise<string[]> {
      const stopWords = await db
        .select({ stopWord: schema.dimStopWords.stopWord })
        .from(schema.dimStopWords);
      return [...new Set(stopWords.map((sw) => sw.stopWord))];
    },

    async updatePostWelcomed(postId: number, isWelcomed: boolean, explanation: string) {
      await db
        .update(schema.dimPosts)
        .set({ isWelcomed, isWelcomedExplanation: explanation })
        .where(eq(schema.dimPosts.postId, postId));
    },

    async getUserEditHistory(userUuid: string) {
      const history = await db
        .select({
          postId: schema.fctPostEditHistory.postId,
          postRevisionNumber: schema.fctPostEditHistory.postRevisionNumber,
          postEditDateGmt: schema.fctPostEditHistory.postEditDateGmt,
          postEditDateJst: schema.fctPostEditHistory.postEditDateJst,
          postTitleBeforeEdit: schema.fctPostEditHistory.postTitleBeforeEdit,
          postTitleAfterEdit: schema.fctPostEditHistory.postTitleAfterEdit,
          postTitle: schema.dimPosts.postTitle,
        })
        .from(schema.fctPostEditHistory)
        .innerJoin(schema.dimPosts, eq(schema.fctPostEditHistory.postId, schema.dimPosts.postId))
        .where(eq(schema.fctPostEditHistory.editorUserId, userUuid))
        .orderBy(desc(schema.fctPostEditHistory.postEditDateGmt))
        .limit(10);

      return history.map((h) => ({
        postId: h.postId,
        postRevisionNumber: h.postRevisionNumber,
        postEditDateGmt: toDate(h.postEditDateGmt),
        postEditDateJst: toDate(h.postEditDateJst),
        postTitleBeforeEdit: h.postTitleBeforeEdit,
        postTitleAfterEdit: h.postTitleAfterEdit,
        dim_posts: { postTitle: h.postTitle },
      }));
    },

    async getNowEditingInfo(postId: number): Promise<NowEditingInfo | null> {
      const [info] = await db
        .select({
          postId: schema.nowEditingPages.postId,
          userId: schema.nowEditingPages.userId,
          lastHeartBeatAtUtc: schema.nowEditingPages.lastHeartBeatAtUtc,
        })
        .from(schema.nowEditingPages)
        .where(eq(schema.nowEditingPages.postId, postId))
        .limit(1);

      if (!info) return null;
      return {
        postId: info.postId,
        userId: info.userId,
        lastHeartBeatAtUTC: toDate(info.lastHeartBeatAtUtc),
      };
    },

    async getPostForEditing(postId: number): Promise<PostForEditing | null> {
      const [post] = await db
        .select({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
          postContent: schema.dimPosts.postContent,
        })
        .from(schema.dimPosts)
        .where(eq(schema.dimPosts.postId, postId))
        .limit(1);

      if (!post) return null;

      const tags = await db
        .select({ tagName: schema.dimTags.tagName })
        .from(schema.relPostTags)
        .innerJoin(schema.dimTags, eq(schema.relPostTags.tagId, schema.dimTags.tagId))
        .where(eq(schema.relPostTags.postId, postId));

      return {
        postId: post.postId,
        postTitle: post.postTitle,
        postContent: post.postContent,
        tagNames: tags.map((t) => t.tagName),
      };
    },

    async getPostEditHistory(postId: number): Promise<PostEditHistoryEntry[]> {
      const history = await db
        .select({
          postRevisionNumber: schema.fctPostEditHistory.postRevisionNumber,
          postEditDateJst: schema.fctPostEditHistory.postEditDateJst,
          editorUserId: schema.fctPostEditHistory.editorUserId,
          postTitleBeforeEdit: schema.fctPostEditHistory.postTitleBeforeEdit,
          postTitleAfterEdit: schema.fctPostEditHistory.postTitleAfterEdit,
          postContentBeforeEdit: schema.fctPostEditHistory.postContentBeforeEdit,
          postContentAfterEdit: schema.fctPostEditHistory.postContentAfterEdit,
        })
        .from(schema.fctPostEditHistory)
        .where(eq(schema.fctPostEditHistory.postId, postId))
        .orderBy(desc(schema.fctPostEditHistory.postRevisionNumber));

      return history.map((h) => ({
        ...h,
        postEditDateJst: toDate(h.postEditDateJst),
      }));
    },

    async updatePostWithTagsAndHistory({
      postId,
      postTitle,
      postContentHtml,
      tags,
      editorUserId,
    }: UpdatePostWithTagsInput): Promise<CreatedPostSummary> {
      // Get the current post
      const [latestPost] = await db
        .select()
        .from(schema.dimPosts)
        .where(eq(schema.dimPosts.postId, postId))
        .limit(1);

      if (!latestPost) {
        throw new Error('Post not found');
      }

      // Get latest revision number
      const [latestRevision] = await db
        .select({ postRevisionNumber: schema.fctPostEditHistory.postRevisionNumber })
        .from(schema.fctPostEditHistory)
        .where(eq(schema.fctPostEditHistory.postId, postId))
        .orderBy(desc(schema.fctPostEditHistory.postRevisionNumber))
        .limit(1);
      const newRevisionNumber = latestRevision ? latestRevision.postRevisionNumber + 1 : 1;

      // Update the post
      const [updatedPost] = await db
        .update(schema.dimPosts)
        .set({ postTitle, postContent: postContentHtml })
        .where(eq(schema.dimPosts.postId, postId))
        .returning({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
          postContent: schema.dimPosts.postContent,
        });

      // Delete existing tags
      await db.delete(schema.relPostTags).where(eq(schema.relPostTags.postId, postId));

      // Re-create tag relations
      for (const tag of tags) {
        const [existingTag] = await db
          .select()
          .from(schema.dimTags)
          .where(eq(schema.dimTags.tagName, tag))
          .orderBy(desc(schema.dimTags.tagId))
          .limit(1);

        await db.insert(schema.relPostTags).values({
          postId,
          tagId: existingTag?.tagId || 0,
        });
      }

      // Create edit history
      await db.insert(schema.fctPostEditHistory).values({
        postId,
        postRevisionNumber: newRevisionNumber,
        editorUserId,
        postTitleBeforeEdit: latestPost.postTitle,
        postTitleAfterEdit: postTitle,
        postContentBeforeEdit: latestPost.postContent,
        postContentAfterEdit: postContentHtml,
        postEditDateJst: nowJST(),
        postEditDateGmt: nowUTC(),
      });

      return updatedPost;
    },

    async upsertNowEditingInfo(postId: number, userId: string): Promise<void> {
      await db
        .insert(schema.nowEditingPages)
        .values({
          postId,
          userId,
          lastHeartBeatAtUtc: nowUTC(),
        })
        .onConflictDoUpdate({
          target: schema.nowEditingPages.postId,
          set: {
            userId,
            lastHeartBeatAtUtc: nowUTC(),
          },
        });
    },

    async findUserByEmail(email: string) {
      const [user] = await db
        .select({
          userId: schema.dimUsers.userId,
          userUuid: schema.dimUsers.userUuid,
          email: schema.dimUsers.email,
          userAuthType: schema.dimUsers.userAuthType,
        })
        .from(schema.dimUsers)
        .where(eq(schema.dimUsers.email, email))
        .limit(1);

      return user || null;
    },

    async createGoogleUser(email: string) {
      const [user] = await db
        .insert(schema.dimUsers)
        .values({
          email,
          userAuthType: 'Google',
          userUuid: crypto.randomUUID(),
          userCreatedAtGmt: nowUTC(),
          userCreatedAtJst: nowJST(),
        })
        .returning({
          userId: schema.dimUsers.userId,
          userUuid: schema.dimUsers.userUuid,
          email: schema.dimUsers.email,
          userAuthType: schema.dimUsers.userAuthType,
        });
      return user;
    },

    async searchPosts(
      query: string,
      orderby: SearchOrderBy = 'timeDesc',
      page: number = 1,
      tags: string[] = [],
      pageSize: number = 10,
    ): Promise<SearchPostsResult> {
      const offset = (page - 1) * pageSize;
      const sanitizedQuery = query.trim();

      // Build WHERE conditions
      const conditions = [isNull(schema.dimPosts.mergedIntoPostId)];

      if (sanitizedQuery) {
        conditions.push(
          sql`(${schema.dimPosts.postTitle} LIKE ${'%' + sanitizedQuery + '%'} OR ${schema.dimPosts.postContent} LIKE ${'%' + sanitizedQuery + '%'})`,
        );
      }

      // Tag filter: find postIds that have ALL specified tags
      if (tags.length > 0) {
        for (const tag of tags) {
          conditions.push(
            sql`${schema.dimPosts.postId} IN (
              SELECT ${schema.relPostTags.postId}
              FROM ${schema.relPostTags}
              INNER JOIN ${schema.dimTags} ON ${schema.relPostTags.tagId} = ${schema.dimTags.tagId}
              WHERE ${schema.dimTags.tagName} = ${tag}
            )`,
          );
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Order by
      const orderByClause =
        orderby === 'like'
          ? [desc(schema.dimPosts.countLikes), desc(schema.dimPosts.postDateGmt)]
          : orderby === 'timeAsc'
            ? [asc(schema.dimPosts.postDateGmt)]
            : [desc(schema.dimPosts.postDateGmt)];

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(schema.dimPosts)
        .where(whereClause);
      const totalCount = totalResult.count;

      // Get paginated results
      const posts = await db
        .select({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
          postDateGmt: schema.dimPosts.postDateGmt,
          countLikes: schema.dimPosts.countLikes,
          countDislikes: schema.dimPosts.countDislikes,
        })
        .from(schema.dimPosts)
        .where(whereClause)
        .orderBy(...orderByClause)
        .offset(offset)
        .limit(pageSize);

      const postIds = posts.map((p) => p.postId);
      const allTags = await getTagsByPostIds(postIds);
      const commentCounts = await getCommentCountsByPostIds(postIds);

      const results = posts.map((post) => ({
        postId: post.postId,
        postTitle: post.postTitle,
        postDateGmt: toDate(post.postDateGmt),
        countLikes: post.countLikes,
        countDislikes: post.countDislikes,
        tagNames: allTags.filter((t) => t.postId === post.postId).map((t) => t.tagName),
        countComments: commentCounts.find((c) => c.postId === post.postId)?.cnt || 0,
      }));

      // Get tag counts for the filtered result set
      // Use raw SQL for efficiency — count tags across all matching posts (not just current page)
      let tagCountsQuery;
      if (conditions.length === 0) {
        // No filters: count all tags
        tagCountsQuery = await db
          .select({
            tagName: schema.dimTags.tagName,
            count: count(),
          })
          .from(schema.relPostTags)
          .innerJoin(schema.dimTags, eq(schema.relPostTags.tagId, schema.dimTags.tagId))
          .groupBy(schema.dimTags.tagName)
          .orderBy(desc(count()));
      } else {
        // With filters: count tags only for matching posts
        tagCountsQuery = await db
          .select({
            tagName: schema.dimTags.tagName,
            count: count(),
          })
          .from(schema.relPostTags)
          .innerJoin(schema.dimTags, eq(schema.relPostTags.tagId, schema.dimTags.tagId))
          .where(
            sql`${schema.relPostTags.postId} IN (
              SELECT ${schema.dimPosts.postId} FROM ${schema.dimPosts} WHERE ${whereClause}
            )`,
          )
          .groupBy(schema.dimTags.tagName)
          .orderBy(desc(count()));
      }

      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        metadata: {
          query: sanitizedQuery,
          count: totalCount,
          page,
          totalPages,
          orderby,
          hasMore: page < totalPages,
        },
        tagCounts: tagCountsQuery.map((t) => ({
          tagName: t.tagName,
          count: t.count,
        })),
        results,
      };
    },

    async getSourcePostsByMergedPostId(
      mergedPostId: number,
    ): Promise<{ postId: number; postTitle: string }[]> {
      return db
        .select({
          postId: schema.dimPosts.postId,
          postTitle: schema.dimPosts.postTitle,
        })
        .from(schema.dimPosts)
        .where(eq(schema.dimPosts.mergedIntoPostId, mergedPostId))
        .orderBy(asc(schema.dimPosts.postId));
    },
  };
}
