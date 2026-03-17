import { Prisma, PrismaClient } from '@prisma/client';
import { formatDate } from '../modules/util.server';
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
} from './types';

declare global {
  var __prisma: PrismaClient | undefined;
}

let prismaInstance: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  prismaInstance = new PrismaClient();

  // 開発環境でのホットリロード対策
  if (!isProduction) {
    global.__prisma = prismaInstance;
  }

  return prismaInstance;
}

export function createPrismaRepository(): DatabaseRepository {
  let prisma = getPrismaClient();

  if (process.env.NODE_ENV !== 'production' && global.__prisma) {
    prisma = global.__prisma;
  }

  return {
    async getPostDataForSitemap() {
      const posts = await prisma.dimPosts.findMany({
        select: {
          postId: true,
        },
      });

      return posts.map((post) => {
        return {
          loc: `https://healthy-person-emulator.org/archives/${post.postId}`,
        };
      });
    },

    async getTagNamesByPostId(postId: number): Promise<string[]> {
      const tags = await prisma.relPostTags.findMany({
        where: { postId },
        select: {
          dimTag: {
            select: {
              tagName: true,
            },
          },
        },
      });

      return tags.map((tag) => tag.dimTag.tagName);
    },

    async createPostWithTags({
      postContent,
      postTitle,
      hashedUserIpAddress,
      selectedTags = [],
      createdTags = [],
    }: CreatePostWithTagsInput): Promise<CreatedPostSummary> {
      const uniqueTags = Array.from(new Set([...(selectedTags ?? []), ...(createdTags ?? [])]));

      return prisma.$transaction(async (tx) => {
        const newPost = await tx.dimPosts.create({
          data: {
            postAuthorIPHash: hashedUserIpAddress,
            postContent,
            postTitle,
            countLikes: 0,
            countDislikes: 0,
            commentStatus: 'open',
          },
          select: {
            postId: true,
            postTitle: true,
            postContent: true,
          },
        });

        if (uniqueTags.length > 0) {
          const existingTags = await tx.dimTags.findMany({
            where: {
              tagName: {
                in: uniqueTags,
              },
            },
          });

          const existingTagNames = existingTags.map((tag) => tag.tagName);
          const newTagNames = uniqueTags.filter((tag) => !existingTagNames.includes(tag));

          const newTags = await Promise.all(
            newTagNames.map(async (tagName) => {
              return tx.dimTags.create({ data: { tagName } });
            }),
          );

          const allTags = [...existingTags, ...newTags];

          await Promise.all(
            allTags.map(async (tag) => {
              await tx.relPostTags.create({
                data: { postId: newPost.postId, tagId: tag.tagId },
              });
            }),
          );
        }

        return newPost;
      });
    },

    async getPostByPostId(postId: number): Promise<PostData> {
      const postData = await prisma.dimPosts
        .findUnique({
          where: { postId },
          select: {
            postId: true,
            postTitle: true,
            postContent: true,
            postDateGmt: true,
            countLikes: true,
            countDislikes: true,
            commentStatus: true,
            ogpImageUrl: true,
            isWelcomed: true,
            isWelcomedExplanation: true,
            tweetIdOfFirstTweet: true,
            blueskyPostUriOfFirstPost: true,
            misskeyNoteIdOfFirstNote: true,
            rel_post_tags: {
              select: {
                dimTag: {
                  select: {
                    tagName: true,
                    tagId: true,
                  },
                },
              },
              orderBy: {
                dimTag: {
                  tagName: 'asc',
                },
              },
            },
          },
        })
        .then((post) => {
          if (!post) {
            throw new Response(null, {
              status: 404,
              statusText: 'Post Not Found',
            });
          }
          const postData = {
            ...post,
            tags: post.rel_post_tags.map((tag) => tag.dimTag),
            postURL: `https://healthy-person-emulator.org/archives/${post.postId}`,
          };
          return postData;
        });

      return postData;
    },

    async getCommentsByPostId(postId: number): Promise<CommentData[]> {
      const comments = await prisma.dimComments.findMany({
        where: { postId },
        select: {
          commentId: true,
          commentDateGmt: true,
          commentAuthor: true,
          commentContent: true,
          commentParent: true,
        },
        orderBy: {
          commentDateGmt: 'desc',
        },
      });

      const voteCount = await prisma.fctCommentVoteHistory.groupBy({
        where: { postId },
        by: ['commentId', 'voteType'],
        _count: { commentVoteId: true },
      });

      const commentsWithVoteCount = comments.map((comment) => {
        const likesCount =
          voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)?._count
            .commentVoteId || 0;
        const dislikesCount =
          voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)?._count
            .commentVoteId || 0;
        return {
          ...comment,
          likesCount,
          dislikesCount,
        };
      });
      return commentsWithVoteCount;
    },

    async getPreviousPost(postId: number): Promise<PreviousOrNextPostData> {
      const previousPost = (await prisma.dimPosts.findFirst({
        where: {
          postId: { lt: postId },
          postTitle: {
            not: {
              contains: '%プログラムテスト%',
            },
          },
        },
        orderBy: { postId: 'desc' },
        select: {
          postId: true,
          postTitle: true,
        },
      })) as PreviousOrNextPostData;

      return previousPost;
    },

    async getNextPost(postId: number): Promise<PreviousOrNextPostData> {
      const nextPost = (await prisma.dimPosts.findFirst({
        where: {
          postId: { gt: postId },
          postTitle: {
            not: {
              contains: '%プログラムテスト%',
            },
          },
        },
        orderBy: { postId: 'asc' },
        select: {
          postId: true,
          postTitle: true,
        },
      })) as PreviousOrNextPostData;

      return nextPost;
    },

    async getCountBookmarks(postId: number): Promise<number> {
      const bookmarkCount = await prisma.fctUserBookmarkActivity.count({
        where: { postId },
      });
      return bookmarkCount;
    },

    async getUserId(userUuid: string): Promise<number> {
      const userId = await prisma.dimUsers.findUnique({
        where: { userUuid },
        select: { userId: true },
      });
      return userId?.userId || 0;
    },

    async getBookmarkPostsByPagenation(
      userId: number,
      pageNumber: number,
      chunkSize: number,
    ): Promise<BookmarkPostCardData[]> {
      const offset = (pageNumber - 1) * chunkSize;
      const bookmarkPostIdsAndDate = await prisma.fctUserBookmarkActivity.findMany({
        where: { userId },
        select: { postId: true, bookmarkDateJST: true },
        skip: offset,
        take: chunkSize,
        orderBy: { bookmarkDateJST: 'desc' },
      });

      const commentCount = await prisma.dimComments.groupBy({
        by: ['postId'],
        _count: { commentId: true },
        where: {
          postId: { in: bookmarkPostIdsAndDate.map((bookmark) => bookmark.postId) },
        },
      });

      const bookmarkPosts = await prisma.dimPosts.findMany({
        where: {
          postId: { in: bookmarkPostIdsAndDate.map((bookmark) => bookmark.postId) },
        },
        select: {
          postId: true,
          postTitle: true,
          postDateGmt: true,
          countLikes: true,
          countDislikes: true,
          ogpImageUrl: true,
          rel_post_tags: {
            select: {
              dimTag: { select: { tagName: true, tagId: true } },
            },
          },
        },
      });
      const bookmarkPostsWithCountComments = bookmarkPosts
        .map((post) => {
          const count = commentCount.find((c) => c.postId === post.postId)?._count.commentId || 0;
          return {
            ...post,
            countComments: count,
            tags: post.rel_post_tags.map((tag) => tag.dimTag),
            bookmarkDateJST: formatDate(
              bookmarkPostIdsAndDate.find((bookmark) => bookmark.postId === post.postId)
                ?.bookmarkDateJST ?? new Date(),
            ),
          };
        })
        .sort((a, b) => {
          return b.bookmarkDateJST.localeCompare(a.bookmarkDateJST);
        });
      return bookmarkPostsWithCountComments;
    },

    async addOrRemoveBookmark(postId: number, userId: number) {
      const bookmarkCount = await prisma.fctUserBookmarkActivity.count({
        where: { postId, userId },
      });
      if (bookmarkCount > 0) {
        await prisma.fctUserBookmarkActivity.deleteMany({
          where: { postId, userId },
        });
        return { message: 'ブックマークを削除しました', success: true };
      }
      await prisma.fctUserBookmarkActivity.create({ data: { postId, userId } });
      return { message: 'ブックマークしました', success: true };
    },

    async recordPostVote(
      postId: number,
      voteType: 'like' | 'dislike',
      voteUserIpHash: string,
    ): Promise<void> {
      await prisma.$transaction(async (tx) => {
        await tx.fctPostVoteHistory.create({
          data: {
            voteUserIpHash,
            postId,
            voteTypeInt: voteType === 'like' ? 1 : -1,
          },
        });
        const updateData =
          voteType === 'like' ? { countLikes: { increment: 1 } } : { countDislikes: { increment: 1 } };
        await tx.dimPosts.update({
          where: { postId },
          data: updateData,
        });
      });
    },

    async recordCommentVote(
      postId: number,
      commentId: number,
      voteType: 'like' | 'dislike',
      voteUserIpHash: string,
    ): Promise<void> {
      await prisma.fctCommentVoteHistory.create({
        data: {
          voteUserIpHash,
          commentId,
          postId,
          voteType: voteType === 'like' ? 1 : -1,
        },
      });
    },

    async createPostComment({
      postId,
      commentAuthor,
      commentContent,
      commentParent = 0,
      commentAuthorIpHash,
    }: CreateCommentInput): Promise<void> {
      await prisma.dimComments.create({
        data: {
          postId,
          commentAuthor,
          commentContent,
          commentParent,
          commentAuthorIpHash,
        },
      });
    },

    async judgeIsBookmarked(
      postId: number,
      userUuid: string | undefined,
    ): Promise<boolean> {
      if (!userUuid) return false;
      const userId = await prisma.dimUsers.findUnique({
        where: { userUuid },
        select: { userId: true },
      });
      const bookmarkCount = await prisma.fctUserBookmarkActivity.count({
        where: { postId, userId: userId?.userId || 0 },
      });
      return bookmarkCount > 0;
    },

    async getRecentPostsByTagId(tagId: number): Promise<PostCardData[]> {
      const recentPosts = await prisma.relPostTags
        .findMany({
          where: { tagId },
          select: {
            dim_posts: {
              select: {
                postId: true,
                postTitle: true,
                postDateGmt: true,
                countLikes: true,
                countDislikes: true,
                ogpImageUrl: true,
                rel_post_tags: {
                  select: {
                    dimTag: {
                      select: {
                        tagName: true,
                        tagId: true,
                      },
                    },
                  },
                  orderBy: {
                    dimTag: {
                      tagName: 'asc',
                    },
                  },
                },
              },
            },
          },
          orderBy: { dim_posts: { postDateGmt: 'desc' } },
          take: 20,
        })
        .then((posts) => {
          return posts.map((post) => {
            return {
              ...post.dim_posts,
              tags: post.dim_posts.rel_post_tags.map((tag) => tag.dimTag),
            };
          });
        });

      const countComments = await prisma.dimComments.groupBy({
        by: ['postId'],
        _count: { commentId: true },
        where: { postId: { in: recentPosts.map((post) => post.postId) } },
      });

      const recentPostsWithCountComments = recentPosts.map((post) => {
        const count = countComments.find((c) => c.postId === post.postId)?._count.commentId || 0;
        return {
          ...post,
          countComments: count,
        };
      });

      return recentPostsWithCountComments;
    },

    async getRecentComments(
      chunkSize = 12,
      pageNumber = 1,
    ): Promise<CommentShowCardData[]> {
      const offset = (pageNumber - 1) * chunkSize;
      const recentComments = await prisma.dimComments.findMany({
        orderBy: { commentDateJst: 'desc' },
        take: chunkSize,
        select: {
          commentId: true,
          postId: true,
          commentContent: true,
          commentDateGmt: true,
          commentAuthor: true,
          dimPosts: {
            select: {
              postTitle: true,
            },
          },
        },
        where: {
          dimPosts: {
            postTitle: {
              not: {
                contains: '%プログラムテスト%',
              },
            },
          },
        },
        skip: offset,
      });
      const voteCount = await prisma.fctCommentVoteHistory.groupBy({
        by: ['commentId', 'voteType'],
        _count: { commentVoteId: true },
        where: {
          commentId: { in: recentComments.map((comment) => comment.commentId) },
        },
      });
      const recentCommentsWithVoteCount = recentComments.map((comment) => {
        const likesCount =
          voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)?._count
            .commentVoteId || 0;
        const dislikesCount =
          voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)?._count
            .commentVoteId || 0;
        return {
          ...comment,
          postTitle: comment.dimPosts.postTitle,
          countLikes: likesCount,
          countDislikes: dislikesCount,
        };
      });

      return recentCommentsWithVoteCount;
    },

    async getRandomPosts(): Promise<PostCardData[]> {
      const postCount = await prisma.dimPosts.count();
      const randomPostOffset = Math.max(Math.floor(Math.random() * postCount) - 12, 0);

      const randomPostsRaw = await prisma.dimPosts.findMany({
        select: {
          postId: true,
          postTitle: true,
          postDateGmt: true,
          countLikes: true,
          countDislikes: true,
          ogpImageUrl: true,
          rel_post_tags: {
            select: {
              dimTag: {
                select: {
                  tagName: true,
                  tagId: true,
                },
              },
            },
            orderBy: {
              dimTag: {
                tagName: 'asc',
              },
            },
          },
        },
        orderBy: { uuid: 'asc' },
        skip: randomPostOffset,
        take: 12,
      });
      const commentCount = await prisma.dimComments.groupBy({
        by: ['postId'],
        _count: { commentId: true },
        where: { postId: { in: randomPostsRaw.map((post) => post.postId) } },
      });
      const randomPosts = randomPostsRaw.map((post) => {
        const count = commentCount.find((c) => c.postId === post.postId)?._count.commentId || 0;
        return {
          ...post,
          countComments: count,
          tags: post.rel_post_tags.map((tag) => tag.dimTag),
        };
      });
      return randomPosts;
    },

    async getRandomComments(chunkSize = 12): Promise<CommentShowCardData[]> {
      const commentCount = await prisma.dimComments.count();
      const randomCommentOffset = Math.max(Math.floor(Math.random() * commentCount) - chunkSize, 0);

      const randomComments = await prisma.dimComments.findMany({
        select: {
          commentId: true,
          commentContent: true,
          commentDateGmt: true,
          commentAuthor: true,
          postId: true,
          dimPosts: { select: { postTitle: true } },
        },
        orderBy: { uuid: 'asc' },
        take: chunkSize,
        skip: randomCommentOffset,
      });
      const voteCount = await prisma.fctCommentVoteHistory.groupBy({
        by: ['commentId', 'voteType'],
        _count: { commentVoteId: true },
        where: {
          commentId: { in: randomComments.map((comment) => comment.commentId) },
        },
      });
      const randomCommentsWithVoteCount = randomComments.map((comment) => {
        const likesCount =
          voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)?._count
            .commentVoteId || 0;
        const dislikesCount =
          voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)?._count
            .commentVoteId || 0;
        return {
          ...comment,
          countLikes: likesCount,
          countDislikes: dislikesCount,
          postTitle: comment.dimPosts.postTitle,
        };
      });
      return randomCommentsWithVoteCount;
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
        const posts = (await prisma.$queryRaw`
            select post_id, post_title, post_date_gmt, count_likes, count_dislikes, ogp_image_url
            from dim_posts
            ${
              type === 'unboundedLikes'
                ? Prisma.raw('order by count_likes desc, post_date_gmt desc')
                : type === 'timeDesc'
                  ? Prisma.raw('order by post_date_gmt desc')
                  : type === 'timeAsc'
                    ? Prisma.raw('order by post_date_gmt asc')
                    : Prisma.empty
            }
            offset ${offset} limit ${chunkSize}
            `) as {
          post_id: number;
          post_title: string;
          post_date_gmt: Date;
          count_likes: number;
          count_dislikes: number;
          ogp_image_url: string | null;
        }[];
        const commentCount = await prisma.dimComments.groupBy({
          by: ['postId'],
          _count: { commentId: true },
          where: { postId: { in: posts.map((post) => post.post_id) } },
        });
        const tagNames = await prisma.relPostTags.findMany({
          where: { postId: { in: posts.map((post) => post.post_id) } },
          select: {
            postId: true,
            dimTag: {
              select: {
                tagId: true,
                tagName: true,
              },
            },
          },
        });
        const totalCount = await prisma.dimPosts.count();
        const postData = posts.map((post) => {
          return {
            postId: post.post_id,
            postTitle: post.post_title,
            postDateGmt: post.post_date_gmt,
            countLikes: post.count_likes,
            countDislikes: post.count_dislikes,
            ogpImageUrl: post.ogp_image_url,
            tags: tagNames.filter((tag) => tag.postId === post.post_id).map((tag) => tag.dimTag),
            countComments: commentCount.find((c) => c.postId === post.post_id)?._count.commentId || 0,
          };
        });
        return {
          meta: {
            totalCount: totalCount,
            currentPage: pagingNumber,
            type: type,
            chunkSize: chunkSize,
          },
          result: postData,
        };
      }
      if (type === 'likes') {
        const voteCount = await prisma.fctPostVoteHistory.groupBy({
          by: ['postId'],
          _count: { voteUserIpHash: true },
          where: {
            voteTypeInt: { in: [1] },
            voteDateGmt: {
              gte: new Date(new Date().getTime() - likeFromHour * 60 * 60 * 1000),
              lte: new Date(new Date().getTime() - likeToHour * 60 * 60 * 1000),
            },
          },
          orderBy: { _count: { voteUserIpHash: 'desc' } },
          take: chunkSize,
          skip: offset,
        });
        const totalCountRaw = await prisma.fctPostVoteHistory.groupBy({
          by: ['postId'],
          _count: { voteUserIpHash: true },
          where: {
            voteTypeInt: { in: [1] },
            voteDateGmt: {
              gte: new Date(new Date().getTime() - likeFromHour * 60 * 60 * 1000),
              lte: new Date(new Date().getTime() - likeToHour * 60 * 60 * 1000),
            },
          },
        });
        const totalCount = totalCountRaw.length;
        const postIds = voteCount.map((vote) => vote.postId);
        const posts = await prisma.dimPosts.findMany({
          where: { postId: { in: postIds } },
          select: {
            postId: true,
            postTitle: true,
            postDateGmt: true,
            countLikes: true,
            countDislikes: true,
            ogpImageUrl: true,
            rel_post_tags: {
              select: {
                dimTag: {
                  select: {
                    tagId: true,
                    tagName: true,
                  },
                },
              },
            },
          },
        });
        const countComments = await prisma.dimComments.groupBy({
          by: ['postId'],
          _count: { commentId: true },
          where: { postId: { in: posts.map((post) => post.postId) } },
        });
        const postData = posts.map((post) => {
          return {
            ...post,
            countComments: countComments.find((c) => c.postId === post.postId)?._count.commentId || 0,
            tags: post.rel_post_tags.map((tag) => tag.dimTag),
          };
        });
        return {
          meta: {
            totalCount: totalCount,
            currentPage: pagingNumber,
            type: type,
            likeFromHour: likeFromHour,
            likeToHour: likeToHour,
            chunkSize: chunkSize,
          },
          result: postData,
        };
      }
      return {
        meta: {
          totalCount: 0,
          currentPage: 0,
          type: type,
          chunkSize: chunkSize,
        },
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
        const totalCount = await prisma.dimComments.count();
        const comments = await prisma.dimComments.findMany({
          orderBy: { commentDateJst: type === 'timeDesc' ? 'desc' : 'asc' },
          take: chunkSize,
          skip: offset,
          select: {
            commentId: true,
            postId: true,
            commentContent: true,
            commentDateGmt: true,
            commentAuthor: true,
            dimPosts: {
              select: {
                postTitle: true,
              },
            },
          },
        });
        const voteCount = await prisma.fctCommentVoteHistory.groupBy({
          by: ['commentId', 'voteType'],
          _count: { commentVoteId: true },
          where: {
            commentId: { in: comments.map((comment) => comment.commentId) },
          },
        });
        const commentData = comments.map((comment) => {
          const likesCount =
            voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)
              ?._count.commentVoteId || 0;
          const dislikesCount =
            voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)
              ?._count.commentVoteId || 0;
          return {
            ...comment,
            countLikes: likesCount,
            countDislikes: dislikesCount,
            postTitle: comment.dimPosts.postTitle,
          };
        });
        return {
          meta: {
            totalCount: totalCount,
            currentPage: pagingNumber,
            type: type,
            chunkSize: chunkSize,
          },
          result: commentData,
        };
      }
      if (type === 'unboundedLikes') {
        const totalCountRaw = (await prisma.$queryRaw`
            with raw as (
            select post_id, count(post_id) from fct_comment_vote_history
            where vote_type = 1
            group by post_id
            having count(post_id) >= 1
            )
            select count(*) from raw;
            `) as { count: bigint }[];
        const totalCount = Number(totalCountRaw[0].count);

        const commentIds = await prisma.fctCommentVoteHistory.groupBy({
          by: ['commentId'],
          _count: { commentVoteId: true },
          orderBy: { _count: { commentVoteId: 'desc' } },
          take: chunkSize,
          skip: offset,
          where: { voteType: { in: [1] } },
        });
        const comments = await prisma.dimComments
          .findMany({
            select: {
              commentId: true,
              postId: true,
              commentAuthor: true,
              commentDateGmt: true,
              commentContent: true,
              dimPosts: {
                select: {
                  postTitle: true,
                },
              },
            },
            where: {
              commentId: { in: commentIds.map((comment) => comment.commentId) },
            },
          })
          .then((comments) => {
            // commentIdsと同じ順番で並び替える
            return comments.sort(
              (a, b) =>
                commentIds.findIndex((c) => c.commentId === a.commentId) -
                commentIds.findIndex((c) => c.commentId === b.commentId),
            );
          });
        const voteCount = await prisma.fctCommentVoteHistory.groupBy({
          by: ['commentId', 'voteType'],
          _count: { commentVoteId: true },
          where: {
            commentId: { in: comments.map((comment) => comment.commentId) },
          },
        });

        const commentData = comments.map((comment) => {
          return {
            ...comment,
            postTitle: comment.dimPosts.postTitle,
            countLikes:
              voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)
                ?._count.commentVoteId || 0,
            countDislikes:
              voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)
                ?._count.commentVoteId || 0,
          };
        });
        return {
          meta: {
            totalCount: totalCount,
            currentPage: pagingNumber,
            type: type,
            chunkSize: chunkSize,
          },
          result: commentData,
        };
      }

      if (type === 'likes') {
        const totalCountRaw = await prisma.fctCommentVoteHistory.groupBy({
          by: ['commentId'],
          _count: { commentVoteId: true },
          where: {
            voteType: { in: [1] },
            comment_vote_date_utc: {
              gte: new Date(new Date().getTime() - likeFromHour * 60 * 60 * 1000),
              lte: new Date(new Date().getTime() - likeToHour * 60 * 60 * 1000),
            },
          },
        });
        const totalCount = totalCountRaw.length;
        const commentIds = await prisma.fctCommentVoteHistory.groupBy({
          by: ['commentId'],
          _count: { commentVoteId: true },
          orderBy: { _count: { commentVoteId: 'desc' } },
          take: chunkSize,
          skip: offset,
          where: {
            voteType: { in: [1] },
            comment_vote_date_utc: {
              gte: new Date(new Date().getTime() - likeFromHour * 60 * 60 * 1000),
              lte: new Date(new Date().getTime() - likeToHour * 60 * 60 * 1000),
            },
          },
        });
        const comments = await prisma.dimComments
          .findMany({
            select: {
              commentId: true,
              postId: true,
              commentAuthor: true,
              commentDateGmt: true,
              commentContent: true,
              dimPosts: {
                select: {
                  postTitle: true,
                },
              },
            },
            where: {
              commentId: { in: commentIds.map((comment) => comment.commentId) },
            },
            orderBy: { commentDateJst: 'desc' },
          })
          .then((comments) => {
            return comments.sort(
              (a, b) =>
                commentIds.findIndex((c) => c.commentId === a.commentId) -
                commentIds.findIndex((c) => c.commentId === b.commentId),
            );
          });

        const voteCount = await prisma.fctCommentVoteHistory.groupBy({
          by: ['commentId', 'voteType'],
          _count: { commentVoteId: true },
          where: {
            commentId: { in: comments.map((comment) => comment.commentId) },
          },
        });

        const commentData = comments.map((comment) => {
          return {
            ...comment,
            postTitle: comment.dimPosts.postTitle,
            countLikes:
              voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)
                ?._count.commentVoteId || 0,
            countDislikes:
              voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)
                ?._count.commentVoteId || 0,
          };
        });
        return {
          meta: {
            totalCount: totalCount,
            currentPage: pagingNumber,
            type: type,
            chunkSize: chunkSize,
            likeFromHour: likeFromHour,
            likeToHour: likeToHour,
          },
          result: commentData,
        };
      }
      return {
        meta: {
          totalCount: 0,
          currentPage: 0,
          type: type,
          chunkSize: chunkSize,
        },
        result: [],
      };
    },

    async getTagsCounts(): Promise<TagCount[]> {
      const tags = await prisma.dimTags.findMany({
        select: {
          tagName: true,
          _count: {
            select: { relPostTags: true },
          },
        },
        orderBy: {
          relPostTags: {
            _count: 'desc',
          },
        },
      });
      const allTagsOnlyForSearch: TagCount[] = tags.map((tag) => {
        return { tagName: tag.tagName, count: tag._count.relPostTags };
      });

      return allTagsOnlyForSearch;
    },

    async getStopWords(): Promise<string[]> {
      const stopWords = await prisma.dimStopWords.findMany({
        select: { stopWord: true },
      });
      return [...new Set(stopWords.map((stopWord) => stopWord.stopWord))];
    },

    async updatePostWelcomed(postId: number, isWelcomed: boolean, explanation: string) {
      await prisma.dimPosts.update({
        where: { postId },
        data: { isWelcomed: isWelcomed, isWelcomedExplanation: explanation },
      });
    },

    async getUserEditHistory(userUuid: string) {
      const userEditHistory = await prisma.fctPostEditHistory.findMany({
        where: { editorUserId: userUuid },
        orderBy: { postEditDateGmt: 'desc' },
        take: 10,
        select: {
          postId: true,
          postRevisionNumber: true,
          postEditDateGmt: true,
          postEditDateJst: true,
          postTitleBeforeEdit: true,
          postTitleAfterEdit: true,
          dim_posts: {
            select: {
              postTitle: true,
            },
          },
        },
      });
      return userEditHistory;
    },

    async getNowEditingInfo(postId: number): Promise<NowEditingInfo | null> {
      const info = await prisma.nowEditingPages.findUnique({
        where: { postId },
        select: {
          postId: true,
          userId: true,
          lastHeartBeatAtUTC: true,
        },
      });
      return info;
    },

    async getPostForEditing(postId: number): Promise<PostForEditing | null> {
      const post = await prisma.dimPosts.findUnique({
        where: { postId },
        select: {
          postId: true,
          postTitle: true,
          postContent: true,
          rel_post_tags: {
            select: {
              dimTag: {
                select: {
                  tagName: true,
                },
              },
            },
          },
        },
      });

      if (!post) {
        return null;
      }

      return {
        postId: post.postId,
        postTitle: post.postTitle,
        postContent: post.postContent,
        tagNames: post.rel_post_tags.map((rel) => rel.dimTag.tagName),
      };
    },

    async getPostEditHistory(postId: number): Promise<PostEditHistoryEntry[]> {
      const history = await prisma.fctPostEditHistory.findMany({
        select: {
          postRevisionNumber: true,
          postEditDateJst: true,
          editorUserId: true,
          postTitleBeforeEdit: true,
          postTitleAfterEdit: true,
          postContentBeforeEdit: true,
          postContentAfterEdit: true,
        },
        where: { postId },
        orderBy: { postRevisionNumber: 'desc' },
      });
      return history;
    },

    async updatePostWithTagsAndHistory({
      postId,
      postTitle,
      postContentHtml,
      tags,
      editorUserId,
    }: UpdatePostWithTagsInput): Promise<CreatedPostSummary> {
      return prisma.$transaction(
        async (tx) => {
          const latestPost = await tx.dimPosts.findUnique({
            where: { postId },
          });

          if (!latestPost) {
            throw new Error('Post not found');
          }

          const latestRevision = await tx.fctPostEditHistory.findFirst({
            select: { postRevisionNumber: true },
            where: { postId },
            orderBy: { postRevisionNumber: 'desc' },
          });
          const newRevisionNumber = latestRevision ? latestRevision.postRevisionNumber + 1 : 1;

          const updatedPost = await tx.dimPosts.update({
            where: { postId },
            data: {
              postTitle,
              postContent: postContentHtml,
            },
            select: {
              postId: true,
              postTitle: true,
              postContent: true,
            },
          });

          await tx.relPostTags.deleteMany({ where: { postId } });

          for (const tag of tags) {
            const existingTag = await tx.dimTags.findFirst({
              where: { tagName: tag },
              orderBy: { tagId: 'desc' },
            });

            await tx.relPostTags.create({
              data: {
                postId,
                tagId: existingTag?.tagId || 0,
              },
            });
          }

          await tx.fctPostEditHistory.create({
            data: {
              postId,
              postRevisionNumber: newRevisionNumber,
              editorUserId,
              postTitleBeforeEdit: latestPost.postTitle,
              postTitleAfterEdit: postTitle,
              postContentBeforeEdit: latestPost.postContent,
              postContentAfterEdit: postContentHtml,
            },
          });

          return updatedPost;
        },
        {
          timeout: 20000,
        },
      );
    },

    async upsertNowEditingInfo(postId: number, userId: string): Promise<void> {
      await prisma.nowEditingPages.upsert({
        where: { postId },
        update: {
          userId,
          lastHeartBeatAtUTC: new Date(),
        },
        create: {
          postId,
          userId,
        },
      });
    },

    async findUserByEmail(email: string) {
      return prisma.dimUsers.findUnique({
        where: { email },
      });
    },

    async createGoogleUser(email: string) {
      return prisma.dimUsers.create({
        data: {
          email,
          userAuthType: 'Google',
        },
      });
    },

    // Test helpers
    async getOldestPostIdsForTest(chunkSize: number) {
      const posts = await prisma.dimPosts.findMany({
        orderBy: { postDateGmt: 'asc' },
        take: chunkSize * 2,
      });
      return posts.map((post) => post.postId);
    },

    async getNewestPostIdsForTest(chunkSize: number) {
      const posts = await prisma.dimPosts.findMany({
        orderBy: { postDateGmt: 'desc' },
        take: chunkSize * 2,
      });
      return posts.map((post) => post.postId);
    },

    async getUnboundedLikesPostIdsForTest(chunkSize: number) {
      const posts = (await prisma.$queryRaw`
        select post_id
        from dim_posts
        order by count_likes desc, post_date_gmt desc
        limit ${chunkSize * 2}
        `) as { post_id: number }[];
      return posts.map((post) => post.post_id);
    },

    async getRecentCommentIdsForTest(chunkSize = 12) {
      const commentIds = await prisma.dimComments.findMany({
        orderBy: { commentDateJst: 'desc' },
        take: chunkSize * 2,
      });
      return commentIds.map((comment) => comment.commentId);
    },

    async getOldestCommentIdsForTest(chunkSize = 12) {
      const commentIds = await prisma.dimComments.findMany({
        orderBy: { commentDateJst: 'asc' },
        take: chunkSize * 2,
      });
      return commentIds.map((comment) => comment.commentId);
    },

    async getUnboundedLikesCommentIdsForTest(chunkSize = 12) {
      const commentIds = await prisma.fctCommentVoteHistory.groupBy({
        by: ['commentId'],
        _count: { commentVoteId: true },
        orderBy: { _count: { commentVoteId: 'desc' } },
        take: chunkSize * 2,
        where: { voteType: { in: [1] } },
      });
      const comments = await prisma.dimComments.findMany({
        select: { commentId: true },
        where: {
          commentId: { in: commentIds.map((comment) => comment.commentId) },
        },
        orderBy: { commentDateJst: 'desc' },
      });
      return comments.map((comment) => comment.commentId);
    },

    async getLikedCommentsForTest(chunkSize = 12, likeFromHour = 48, likeToHour = 0) {
      const commentIds = await prisma.fctCommentVoteHistory.groupBy({
        by: ['commentId'],
        _count: { commentVoteId: true },
        orderBy: { _count: { commentVoteId: 'desc' } },
        take: chunkSize,
        where: {
          voteType: { in: [1] },
          comment_vote_date_utc: {
            gte: new Date(new Date().getTime() - likeFromHour * 60 * 60 * 1000),
            lte: new Date(new Date().getTime() - likeToHour * 60 * 60 * 1000),
          },
        },
      });
      const comments = await prisma.dimComments.findMany({
        select: { commentId: true },
        where: {
          commentId: { in: commentIds.map((comment) => comment.commentId) },
        },
        orderBy: { commentDateJst: 'desc' },
      });
      return comments.map((comment) => comment.commentId);
    },
  };
}
