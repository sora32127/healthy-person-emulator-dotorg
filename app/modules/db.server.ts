import { createD1Repository } from '../repositories/d1.server';
import type { DatabaseRepository } from '../repositories/types';
import type {
  PostData,
  CommentData,
  SimilarPostsData,
  PreviousOrNextPostData,
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

let _repo: DatabaseRepository | null = null;

export function initDb(d1: D1Database) {
  if (_repo) return;
  _repo = createD1Repository(d1);
}

function getRepo(): DatabaseRepository {
  if (!_repo) {
    const env = (globalThis as any).__cloudflareEnv;
    if (env?.DB) {
      initDb(env.DB);
    }
    if (!_repo) throw new Error('DB not initialized and no env available.');
  }
  return _repo;
}

// Re-export all repository functions
export const getPostDataForSitemap = (...args: Parameters<DatabaseRepository['getPostDataForSitemap']>) => getRepo().getPostDataForSitemap(...args);
export const getTagNamesByPostId = (...args: Parameters<DatabaseRepository['getTagNamesByPostId']>) => getRepo().getTagNamesByPostId(...args);
export const createPostWithTags = (...args: Parameters<DatabaseRepository['createPostWithTags']>) => getRepo().createPostWithTags(...args);
export const getUserId = (...args: Parameters<DatabaseRepository['getUserId']>) => getRepo().getUserId(...args);
export const getBookmarkPostsByPagenation = (...args: Parameters<DatabaseRepository['getBookmarkPostsByPagenation']>) => getRepo().getBookmarkPostsByPagenation(...args);
export const addOrRemoveBookmark = (...args: Parameters<DatabaseRepository['addOrRemoveBookmark']>) => getRepo().addOrRemoveBookmark(...args);
export const recordPostVote = (...args: Parameters<DatabaseRepository['recordPostVote']>) => getRepo().recordPostVote(...args);
export const recordCommentVote = (...args: Parameters<DatabaseRepository['recordCommentVote']>) => getRepo().recordCommentVote(...args);
export const createPostComment = (...args: Parameters<DatabaseRepository['createPostComment']>) => getRepo().createPostComment(...args);
export const judgeIsBookmarked = (...args: Parameters<DatabaseRepository['judgeIsBookmarked']>) => getRepo().judgeIsBookmarked(...args);
export const getRecentPostsByTagId = (...args: Parameters<DatabaseRepository['getRecentPostsByTagId']>) => getRepo().getRecentPostsByTagId(...args);
export const getRandomPosts = (...args: Parameters<DatabaseRepository['getRandomPosts']>) => getRepo().getRandomPosts(...args);
export const getRandomComments = (...args: Parameters<DatabaseRepository['getRandomComments']>) => getRepo().getRandomComments(...args);
export const getFeedPosts = (...args: Parameters<DatabaseRepository['getFeedPosts']>) => getRepo().getFeedPosts(...args);
export const getFeedComments = (...args: Parameters<DatabaseRepository['getFeedComments']>) => getRepo().getFeedComments(...args);
export const getTagsCounts = (...args: Parameters<DatabaseRepository['getTagsCounts']>) => getRepo().getTagsCounts(...args);
export const getStopWords = (...args: Parameters<DatabaseRepository['getStopWords']>) => getRepo().getStopWords(...args);
export const updatePostWelcomed = (...args: Parameters<DatabaseRepository['updatePostWelcomed']>) => getRepo().updatePostWelcomed(...args);
export const getUserEditHistory = (...args: Parameters<DatabaseRepository['getUserEditHistory']>) => getRepo().getUserEditHistory(...args);
export const getNowEditingInfo = (...args: Parameters<DatabaseRepository['getNowEditingInfo']>) => getRepo().getNowEditingInfo(...args);
export const getPostForEditing = (...args: Parameters<DatabaseRepository['getPostForEditing']>) => getRepo().getPostForEditing(...args);
export const getPostEditHistory = (...args: Parameters<DatabaseRepository['getPostEditHistory']>) => getRepo().getPostEditHistory(...args);
export const updatePostWithTagsAndHistory = (...args: Parameters<DatabaseRepository['updatePostWithTagsAndHistory']>) => getRepo().updatePostWithTagsAndHistory(...args);
export const upsertNowEditingInfo = (...args: Parameters<DatabaseRepository['upsertNowEditingInfo']>) => getRepo().upsertNowEditingInfo(...args);
export const findUserByEmail = (...args: Parameters<DatabaseRepository['findUserByEmail']>) => getRepo().findUserByEmail(...args);
export const createGoogleUser = (...args: Parameters<DatabaseRepository['createGoogleUser']>) => getRepo().createGoogleUser(...args);

// --- getSimilarPosts: Cloudflare Vectorize, NOT part of Repository ---

async function getSimilarPosts(postId: number): Promise<SimilarPostsData[]> {
  try {
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
  } catch (error) {
    // Vectorize/AI unavailable (e.g. local dev) — return empty
    console.warn('getSimilarPosts failed, returning empty:', (error as Error).message);
    return [];
  }
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
    const repo = getRepo();
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
