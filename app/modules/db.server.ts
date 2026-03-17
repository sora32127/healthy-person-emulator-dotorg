import { createPrismaRepository } from '../repositories/prisma.server';
import type {
  PostData,
  CommentData,
  SimilarPostsData,
  PreviousOrNextPostData,
} from '../repositories/types';

// Re-export types and schemas from repositories/types.ts
export {
  PostCardDataSchema,
  CommentShowCardDataSchema,
} from '../repositories/types';

export type {
  PostCardData,
  CommentShowCardData,
  BookmarkPostCardData,
  FeedPostType,
  PostData,
  CommentData,
  SimilarPostsData,
  PreviousOrNextPostData,
  NowEditingInfo,
  PostForEditing,
  PostEditHistoryEntry,
  TagCount,
  CreatePostWithTagsInput,
  CreatedPostSummary,
  CreateCommentInput,
  UpdatePostWithTagsInput,
  PostFeedData,
  CommentFeedData,
} from '../repositories/types';

const repo = createPrismaRepository();

// Re-export all repository functions
export const getPostDataForSitemap = repo.getPostDataForSitemap;
export const getTagNamesByPostId = repo.getTagNamesByPostId;
export const createPostWithTags = repo.createPostWithTags;
export const getUserId = repo.getUserId;
export const getBookmarkPostsByPagenation = repo.getBookmarkPostsByPagenation;
export const addOrRemoveBookmark = repo.addOrRemoveBookmark;
export const recordPostVote = repo.recordPostVote;
export const recordCommentVote = repo.recordCommentVote;
export const createPostComment = repo.createPostComment;
export const judgeIsBookmarked = repo.judgeIsBookmarked;
export const getRecentPostsByTagId = repo.getRecentPostsByTagId;
export const getRecentComments = repo.getRecentComments;
export const getRandomPosts = repo.getRandomPosts;
export const getRandomComments = repo.getRandomComments;
export const getFeedPosts = repo.getFeedPosts;
export const getFeedComments = repo.getFeedComments;
export const getTagsCounts = repo.getTagsCounts;
export const getStopWords = repo.getStopWords;
export const updatePostWelcomed = repo.updatePostWelcomed;
export const getUserEditHistory = repo.getUserEditHistory;
export const getNowEditingInfo = repo.getNowEditingInfo;
export const getPostForEditing = repo.getPostForEditing;
export const getPostEditHistory = repo.getPostEditHistory;
export const updatePostWithTagsAndHistory = repo.updatePostWithTagsAndHistory;
export const upsertNowEditingInfo = repo.upsertNowEditingInfo;
export const findUserByEmail = repo.findUserByEmail;
export const createGoogleUser = repo.createGoogleUser;

// Test helpers
export const getOldestPostIdsForTest = repo.getOldestPostIdsForTest;
export const getNewestPostIdsForTest = repo.getNewestPostIdsForTest;
export const getUnboundedLikesPostIdsForTest = repo.getUnboundedLikesPostIdsForTest;
export const getRecentCommentIdsForTest = repo.getRecentCommentIdsForTest;
export const getOldestCommentIdsForTest = repo.getOldestCommentIdsForTest;
export const getUnboundedLikesCommentIdsForTest = repo.getUnboundedLikesCommentIdsForTest;
export const getLikedCommentsForTest = repo.getLikedCommentsForTest;

// --- getSimilarPosts: Cloudflare Vectorize, NOT part of Repository ---

async function getSimilarPosts(postId: number): Promise<SimilarPostsData[]> {
  const { getVectorsByIds, querySimilar } = await import('./cloudflare.server');

  const vectors = await getVectorsByIds([String(postId)]);
  if (vectors.length === 0 || !vectors[0].values) {
    return [];
  }

  const matches = await querySimilar(vectors[0].values, 17);

  return matches
    .filter((m) => m.id !== String(postId))
    .slice(0, 15)
    .map((m) => ({
      postId: Number(m.metadata?.postId ?? m.id),
      postTitle: String(m.metadata?.postTitle ?? ''),
    }));
}

// --- ArchiveDataEntry: orchestrator combining repo + getSimilarPosts ---

export class ArchiveDataEntry {
  postId: number;
  postTitle: string;
  postURL: string;
  postDateGmt: Date;
  postContent: string;
  commentStatus: string;
  countLikes: number;
  countDislikes: number;
  ogpImageUrl: string | null;
  tags: { tagName: string; tagId: number }[];
  comments: CommentData[];
  similarPosts: SimilarPostsData[];
  previousPost: PreviousOrNextPostData;
  nextPost: PreviousOrNextPostData;
  isWelcomed: boolean | null;
  isWelcomedExplanation: string | null;
  tweetIdOfFirstTweet: string | null;
  blueskyPostUriOfFirstPost: string | null;
  misskeyNoteIdOfFirstNote: string | null;
  countBookmarks: number;
  /*
    - TypeScript/JavaScriptの仕様上、constructorには非同期処理を利用できない
    - 回避策として、初期化処理を通じてコンストラクタを呼び出している
    */

  private constructor(
    postData: PostData,
    comments: CommentData[],
    similarPosts: SimilarPostsData[],
    previousPost: PreviousOrNextPostData,
    nextPost: PreviousOrNextPostData,
    bookmarkCount: number,
  ) {
    this.postId = postData.postId;
    this.postTitle = postData.postTitle;
    this.postURL = postData.postURL;
    this.postDateGmt = postData.postDateGmt;
    this.postContent = postData.postContent;
    this.commentStatus = postData.commentStatus;
    this.countLikes = postData.countLikes;
    this.countDislikes = postData.countDislikes;
    this.ogpImageUrl = postData.ogpImageUrl;
    this.tags = postData.tags;
    this.comments = comments;
    this.similarPosts = similarPosts;
    this.previousPost = previousPost;
    this.nextPost = nextPost;
    this.isWelcomed = postData.isWelcomed;
    this.isWelcomedExplanation = postData.isWelcomedExplanation;
    this.tweetIdOfFirstTweet = postData.tweetIdOfFirstTweet;
    this.blueskyPostUriOfFirstPost = postData.blueskyPostUriOfFirstPost;
    this.misskeyNoteIdOfFirstNote = postData.misskeyNoteIdOfFirstNote;
    this.countBookmarks = bookmarkCount;
  }

  static async getData(postId: number) {
    const postData = await repo.getPostByPostId(postId);
    const comments = await repo.getCommentsByPostId(postId);
    const similarPosts = await getSimilarPosts(postId);
    const previousPost = await repo.getPreviousPost(postId);
    const nextPost = await repo.getNextPost(postId);
    const countBookmarks = await repo.getCountBookmarks(postId);
    return new ArchiveDataEntry(
      postData,
      comments,
      similarPosts,
      previousPost,
      nextPost,
      countBookmarks,
    );
  }
}
