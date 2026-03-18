import { z } from 'zod';

// --- Type definitions ---

export type CreatePostWithTagsInput = {
  postContent: string;
  postTitle: string;
  hashedUserIpAddress: string;
  selectedTags?: string[];
  createdTags?: string[];
};

export type CreatedPostSummary = {
  postId: number;
  postTitle: string;
  postContent: string;
};

export type CreateCommentInput = {
  postId: number;
  commentAuthor?: string;
  commentContent: string;
  commentParent?: number;
  commentAuthorIpHash: string;
};

export type NowEditingInfo = {
  postId: number;
  userId: string;
  lastHeartBeatAtUTC: Date;
};

export type PostForEditing = {
  postId: number;
  postTitle: string;
  postContent: string;
  tagNames: string[];
};

export type PostEditHistoryEntry = {
  postRevisionNumber: number;
  postEditDateJst: Date;
  editorUserId: string;
  postTitleBeforeEdit: string;
  postTitleAfterEdit: string;
  postContentBeforeEdit: string;
  postContentAfterEdit: string;
};

export type UpdatePostWithTagsInput = {
  postId: number;
  postTitle: string;
  postContentHtml: string;
  tags: string[];
  editorUserId: string;
};

// --- Zod schemas and inferred types ---

const PostDataSchema = z.object({
  postId: z.number(),
  postTitle: z.string(),
  postContent: z.string(),
  postDateGmt: z.date(),
  countLikes: z.number(),
  countDislikes: z.number(),
  commentStatus: z.string(),
  ogpImageUrl: z.string().nullable(),
  tags: z.array(
    z.object({
      tagName: z.string(),
      tagId: z.number(),
    }),
  ),
  postURL: z.string(),
  isWelcomed: z.boolean().nullable(),
  isWelcomedExplanation: z.string().nullable(),
  tweetIdOfFirstTweet: z.string().nullable(),
  blueskyPostUriOfFirstPost: z.string().nullable(),
  misskeyNoteIdOfFirstNote: z.string().nullable(),
});
export type PostData = z.infer<typeof PostDataSchema>;

const CommentDataSchema = z.object({
  commentId: z.number(),
  commentDateGmt: z.date(),
  commentAuthor: z.string(),
  commentContent: z.string(),
  likesCount: z.number(),
  dislikesCount: z.number(),
  commentParent: z.number(),
});
export type CommentData = z.infer<typeof CommentDataSchema>;

const similarPostsSchema = z.object({
  postId: z.number(),
  postTitle: z.string(),
});
export type SimilarPostsData = z.infer<typeof similarPostsSchema>;

const PreviousOrNextPostSchema = z.object({
  postId: z.number(),
  postTitle: z.string(),
});
export type PreviousOrNextPostData = z.infer<typeof PreviousOrNextPostSchema>;

export const PostCardDataSchema = z.object({
  postId: z.number(),
  postTitle: z.string(),
  postDateGmt: z.date(),
  countLikes: z.number(),
  countDislikes: z.number(),
  ogpImageUrl: z.string().nullable(),
  tags: z.array(
    z.object({
      tagName: z.string(),
      tagId: z.number(),
    }),
  ),
  countComments: z.number(),
});
export type PostCardData = z.infer<typeof PostCardDataSchema>;

const BookmarkPostCardDataSchema = PostCardDataSchema.extend({
  bookmarkDateJST: z.string(),
});
export type BookmarkPostCardData = z.infer<typeof BookmarkPostCardDataSchema>;

export const CommentShowCardDataSchema = z.object({
  commentId: z.number(),
  postId: z.number(),
  commentContent: z.string(),
  commentDateGmt: z.date(),
  commentAuthor: z.string(),
  postTitle: z.string(),
  countLikes: z.number(),
  countDislikes: z.number(),
});
export type CommentShowCardData = z.infer<typeof CommentShowCardDataSchema>;

export type FeedPostType = 'unboundedLikes' | 'likes' | 'timeDesc' | 'timeAsc';

const PostFeedDataSchema = z.object({
  meta: z.object({
    totalCount: z.number(),
    currentPage: z.number(),
    type: z.enum(['unboundedLikes', 'likes', 'timeDesc', 'timeAsc']),
    likeFromHour: z.optional(z.number()),
    likeToHour: z.optional(z.number()),
    chunkSize: z.number(),
  }),
  result: z.array(PostCardDataSchema),
});
export type PostFeedData = z.infer<typeof PostFeedDataSchema>;

const CommentFeedDataSchema = z.object({
  meta: z.object({
    totalCount: z.number(),
    currentPage: z.number(),
    type: z.enum(['timeDesc', 'timeAsc', 'unboundedLikes', 'likes']),
    chunkSize: z.number(),
    likeFromHour: z.optional(z.number()),
    likeToHour: z.optional(z.number()),
  }),
  result: z.array(CommentShowCardDataSchema),
});
export type CommentFeedData = z.infer<typeof CommentFeedDataSchema>;

const tagCountSchema = z.object({
  tagName: z.string(),
  count: z.number(),
});
export type TagCount = z.infer<typeof tagCountSchema>;

// --- DatabaseRepository interface ---

export interface DatabaseRepository {
  getPostDataForSitemap(): Promise<{ loc: string }[]>;
  getTagNamesByPostId(postId: number): Promise<string[]>;
  createPostWithTags(input: CreatePostWithTagsInput): Promise<CreatedPostSummary>;
  getUserId(userUuid: string): Promise<number>;
  getBookmarkPostsByPagenation(userId: number, pageNumber: number, chunkSize: number): Promise<BookmarkPostCardData[]>;
  addOrRemoveBookmark(postId: number, userId: number): Promise<{ message: string; success: boolean }>;
  recordPostVote(postId: number, voteType: 'like' | 'dislike', voteUserIpHash: string): Promise<void>;
  recordCommentVote(postId: number, commentId: number, voteType: 'like' | 'dislike', voteUserIpHash: string): Promise<void>;
  createPostComment(input: CreateCommentInput): Promise<void>;
  judgeIsBookmarked(postId: number, userUuid: string | undefined): Promise<boolean>;
  getRecentPostsByTagId(tagId: number): Promise<PostCardData[]>;
  getRecentComments(chunkSize?: number, pageNumber?: number): Promise<CommentShowCardData[]>;
  getRandomPosts(): Promise<PostCardData[]>;
  getRandomComments(chunkSize?: number): Promise<CommentShowCardData[]>;
  getFeedPosts(pagingNumber: number, type: FeedPostType, chunkSize?: number, likeFromHour?: number, likeToHour?: number): Promise<PostFeedData>;
  getFeedComments(pagingNumber: number, type: FeedPostType, chunkSize?: number, likeFromHour?: number, likeToHour?: number): Promise<CommentFeedData>;
  getTagsCounts(): Promise<TagCount[]>;
  getStopWords(): Promise<string[]>;
  updatePostWelcomed(postId: number, isWelcomed: boolean, explanation: string): Promise<void>;
  getUserEditHistory(userUuid: string): Promise<{
    postId: number;
    postRevisionNumber: number;
    postEditDateGmt: Date;
    postEditDateJst: Date;
    postTitleBeforeEdit: string;
    postTitleAfterEdit: string;
    dim_posts: { postTitle: string };
  }[]>;
  getNowEditingInfo(postId: number): Promise<NowEditingInfo | null>;
  getPostForEditing(postId: number): Promise<PostForEditing | null>;
  getPostEditHistory(postId: number): Promise<PostEditHistoryEntry[]>;
  updatePostWithTagsAndHistory(input: UpdatePostWithTagsInput): Promise<CreatedPostSummary>;
  upsertNowEditingInfo(postId: number, userId: string): Promise<void>;
  findUserByEmail(email: string): Promise<{
    userId: number;
    userUuid: string;
    email: string | null;
    userAuthType: string | null;
  } | null>;
  createGoogleUser(email: string): Promise<{
    userId: number;
    userUuid: string;
    email: string | null;
    userAuthType: string | null;
  }>;

  // Internal functions used by ArchiveDataEntry
  getPostByPostId(postId: number): Promise<PostData>;
  getCommentsByPostId(postId: number): Promise<CommentData[]>;
  getPreviousPost(postId: number): Promise<PreviousOrNextPostData>;
  getNextPost(postId: number): Promise<PreviousOrNextPostData>;
  getCountBookmarks(postId: number): Promise<number>;

  // Test helpers
  getOldestPostIdsForTest(chunkSize: number): Promise<number[]>;
  getNewestPostIdsForTest(chunkSize: number): Promise<number[]>;
  getUnboundedLikesPostIdsForTest(chunkSize: number): Promise<number[]>;
  getRecentCommentIdsForTest(chunkSize?: number): Promise<number[]>;
  getOldestCommentIdsForTest(chunkSize?: number): Promise<number[]>;
  getUnboundedLikesCommentIdsForTest(chunkSize?: number): Promise<number[]>;
  getLikedCommentsForTest(chunkSize?: number, likeFromHour?: number, likeToHour?: number): Promise<number[]>;
}
