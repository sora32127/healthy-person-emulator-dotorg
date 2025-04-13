import { Prisma, PrismaClient } from "@prisma/client"
import { z } from "zod"
import { formatDate } from "./util.server";

declare global {
    var __prisma: PrismaClient | undefined;
}

let prismaInstance: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
    if (prismaInstance) {
        return prismaInstance;
    }

    const isProduction = process.env.NODE_ENV === "production";
    prismaInstance = new PrismaClient();

    // 開発環境でのホットリロード対策
    if (!isProduction) {
        global.__prisma = prismaInstance;
    }

    return prismaInstance;
}


export let prisma = getPrismaClient();

if (process.env.NODE_ENV !== "production" && global.__prisma) {
    prisma = global.__prisma;
}

export async function getPostDataForSitemap() {
    const posts = await prisma.dimPosts.findMany({
        select: {
            postId: true,
        }
    })

    return posts.map((post) => {
        return {
            loc: `https://healthy-person-emulator.org/archives/${post.postId}`
        }
    })
}

export const PostDataSchema = z.object({
    postId: z.number(),
    postTitle: z.string(),
    postContent: z.string(),
    postDateGmt: z.date(),
    countLikes: z.number(),
    countDislikes: z.number(),
    commentStatus: z.string(),
    ogpImageUrl: z.string().nullable(),
    tags: z.array(z.object({
        tagName: z.string(),
        tagId: z.number(),
    })),
    postURL: z.string(),
    isWelcomed: z.boolean().nullable(),
    isWelcomedExplanation: z.string().nullable(),
    tweetIdOfFirstTweet: z.string().nullable(),
    blueskyPostUriOfFirstPost: z.string().nullable(),
    misskeyNoteIdOfFirstNote: z.string().nullable(),
})
type PostData = z.infer<typeof PostDataSchema>;

async function getPostByPostId(postId: number): Promise<PostData> {
    const postData = await prisma.dimPosts.findUnique({
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
                        }
                    }
                },
                orderBy: {
                    dimTag: {
                        tagName: "asc",
                    }
                }
            }
        }
    }).then((post) => {
        if (!post) {
            throw new Response(null, {
                status: 404,
                statusText: "Post Not Found",
            });
        }
        const postData = {
            ...post,
            tags: post.rel_post_tags.map((tag) => tag.dimTag),
            postURL: `https://healthy-person-emulator.org/archives/${post.postId}`
        }
        return postData;
    })

    return postData;
}

const CommentDataSchema = z.object({
    commentId: z.number(),
    commentDateGmt: z.date(),
    commentAuthor: z.string(),
    commentContent: z.string(),
    likesCount: z.number(),
    dislikesCount: z.number(),
    commentParent: z.number(),
})

type CommentData = z.infer<typeof CommentDataSchema>;

async function getCommentsByPostId(postId: number): Promise<CommentData[]> {
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
            commentDateGmt: "desc"
        }
    })

    const voteCount = await prisma.fctCommentVoteHistory.groupBy({
        where: { postId },
        by: ["commentId", "voteType"],
        _count: { commentVoteId: true },
    })

    const commentsWithVoteCount = comments.map((comment) => {
        const likesCount = voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)?._count.commentVoteId || 0;
        const dislikesCount = voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)?._count.commentVoteId || 0;
        return {
            ...comment,
            likesCount,
            dislikesCount,
        }
    })
    return commentsWithVoteCount;
}

const similarPostsSchema = z.object({
    postId: z.number(),
    postTitle: z.string(),
})

type SimilarPostsData = z.infer<typeof similarPostsSchema>;

async function getSimilarPosts(postId: number): Promise<SimilarPostsData[]> {
    const similarPostsRaw = await prisma.$queryRaw`
    select json_agg(
        json_build_object(
            'postId', post_id,
            'postTitle', post_title,
            'similarity', similarity
        )
    )::varchar as result
    from search_similar_content(${postId}, 0, 16)
    ` as { result: string }[]

    const similarPosts: SimilarPostsData[] = JSON.parse(similarPostsRaw[0].result).slice(1,) // 0番目のエントリはその記事自身を指すため除外する
    return similarPosts;
}

const PreviousOrNextPostSchema = z.object({
    postId: z.number(),
    postTitle: z.string(),
})

type PreviousOrNextPostData = z.infer<typeof PreviousOrNextPostSchema>;

async function getPreviousPost(postId: number): Promise<PreviousOrNextPostData> {
    const previousPost = await prisma.dimPosts.findFirst({
        where : {
            postId: {lt: postId},
            postTitle: {
                not: {
                    contains: "%プログラムテスト%"
                }
            }
        },
        orderBy: {postId: "desc"},
        select: {
            postId: true,
            postTitle: true,
        }
    }) as PreviousOrNextPostData

    return previousPost;
}

async function getNextPost(postId: number): Promise<PreviousOrNextPostData> {
    const nextPost = await prisma.dimPosts.findFirst({
        where : {
            postId: {gt: postId},
            postTitle: {
                not: {
                    contains: "%プログラムテスト%"
                }
            }
        },
        orderBy: {postId: "asc"},
        select: {
            postId: true,
            postTitle: true,
        }
    }) as PreviousOrNextPostData

    return nextPost;
}

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
        bookmarkCount: number
    ){
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
    
    static async getData(postId: number){
        const postData = await getPostByPostId(postId);
        const comments = await getCommentsByPostId(postId);
        const similarPosts = await getSimilarPosts(postId);
        const previousPost = await getPreviousPost(postId);
        const nextPost = await getNextPost(postId);
        const countBookmarks = await getCountBookmarks(postId);
        return new ArchiveDataEntry(postData, comments, similarPosts, previousPost, nextPost, countBookmarks);
    }
}

async function getCountBookmarks(postId: number): Promise<number> {
    const bookmarkCount = await prisma.fctUserBookmarkActivity.count({
        where: { postId },
    })
    return bookmarkCount;
}

export async function getUserId(userUuid: string): Promise<number>{
    const userId = await prisma.dimUsers.findUnique({
        where: { userUuid },
        select: { userId: true },
    })
    return userId?.userId || 0;
}



export async function getBookmarkPostsByPagenation(userId: number, pageNumber: number, chunkSize: number): Promise<BookmarkPostCardData[]>{
    const offset = (pageNumber - 1) * chunkSize;
    const bookmarkPostIdsAndDate = await prisma.fctUserBookmarkActivity.findMany({
        where: { userId },
        select: { postId: true, bookmarkDateJST: true },
        skip: offset,
        take: chunkSize,
        orderBy: { bookmarkDateJST: "desc" },
    })

    const commentCount = await prisma.dimComments.groupBy({
        by: ["postId"],
        _count: { commentId: true },
        where: { postId: { in: bookmarkPostIdsAndDate.map((bookmark) => bookmark.postId) } },
    })

    const bookmarkPosts = await prisma.dimPosts.findMany({
        where: { postId: { in: bookmarkPostIdsAndDate.map((bookmark) => bookmark.postId) } },
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
    })
    const bookmarkPostsWithCountComments = bookmarkPosts.map((post) => {
        const count = commentCount.find((c) => c.postId === post.postId)?._count.commentId || 0;
        return {
            ...post,
            countComments: count,
            tags: post.rel_post_tags.map((tag) => tag.dimTag),
            bookmarkDateJST: formatDate(bookmarkPostIdsAndDate.find((bookmark) => bookmark.postId === post.postId)?.bookmarkDateJST ?? new Date()),
        }
    }).sort((a, b) => {
        return b.bookmarkDateJST.localeCompare(a.bookmarkDateJST);
    })
    return bookmarkPostsWithCountComments;
}

export async function addOrRemoveBookmark(postId: number, userId: number){
    // Bookmarkが存在する場合は削除、存在しない場合は追加する
    const bookmarkCount = await prisma.fctUserBookmarkActivity.count({
        where: { postId, userId },
    })
    if (bookmarkCount > 0){
        await prisma.fctUserBookmarkActivity.deleteMany({
            where: { postId, userId },
        })
        return { message: "ブックマークを削除しました", success: true }
    }
    await prisma.fctUserBookmarkActivity.create({ data: { postId, userId } });
    return { message: "ブックマークしました", success: true }
}

export const PostCardDataSchema = z.object({
    postId: z.number(),
    postTitle: z.string(),
    postDateGmt: z.date(),
    countLikes: z.number(),
    countDislikes: z.number(),
    ogpImageUrl: z.string().nullable(),
    tags: z.array(z.object({
        tagName: z.string(),
        tagId: z.number(),
    })),
    countComments: z.number(),
})

export type PostCardData = z.infer<typeof PostCardDataSchema>;

const BookmarkPostCardDataSchema = PostCardDataSchema.extend({
    bookmarkDateJST: z.string(),
})
export type BookmarkPostCardData = z.infer<typeof BookmarkPostCardDataSchema>;

export async function judgeIsBookmarked(postId: number, userUuid: string | undefined): Promise<boolean>{
    if (!userUuid) return false;
    const userId = await getUserId(userUuid);
    const bookmarkCount = await prisma.fctUserBookmarkActivity.count({
        where: { postId, userId },
    })
    return bookmarkCount > 0;
}

export async function getRecentPostsByTagId(tagId: number): Promise<PostCardData[]>{
    const recentPosts = await prisma.relPostTags.findMany({
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
                                }
                            }
                        },
                        orderBy: {
                            dimTag: {
                                tagName: "asc",
                            }
                        }
                    }
                }
            }
        },
        orderBy: { dim_posts: { postDateGmt: "desc" } },
        take: 20,
    }).then((posts) => {
        return posts.map((post) => {
            return {
                ...post.dim_posts,
                tags: post.dim_posts.rel_post_tags.map((tag) => tag.dimTag),
            }
        })
    })

    const countComments = await prisma.dimComments.groupBy({
        by: ["postId"],
        _count: { commentId: true },
        where: { postId: { in: recentPosts.map((post) => post.postId) } },
    })

    const recentPostsWithCountComments = recentPosts.map((post) => {
        const count = countComments.find((c) => c.postId === post.postId)?._count.commentId || 0;
        return {
            ...post,
            countComments: count,
        }
    })

    return recentPostsWithCountComments;
}

export const CommentShowCardDataSchema = z.object({
    commentId: z.number(),
    postId: z.number(),
    commentContent: z.string(),
    commentDateGmt: z.date(),
    commentAuthor: z.string(),
    postTitle: z.string(),
    countLikes: z.number(),
    countDislikes: z.number(),
})

export type CommentShowCardData = z.infer<typeof CommentShowCardDataSchema>;

export async function getRecentComments(chunkSize = 12, pageNumber = 1): Promise<CommentShowCardData[]>{
    const offset = (pageNumber - 1) * chunkSize;
    const recentComments = await prisma.dimComments.findMany({
        orderBy: { commentDateJst: "desc" },
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
                        contains: "%プログラムテスト%"
                    }
                }
            }
        },
        skip: offset,
    })
    const voteCount = await prisma.fctCommentVoteHistory.groupBy({
        by: ["commentId", "voteType"],
        _count: { commentVoteId: true },
        where: { commentId: { in: recentComments.map((comment) => comment.commentId) } },
    })
    const recentCommentsWithVoteCount = recentComments.map((comment) => {
        const likesCount = voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)?._count.commentVoteId || 0;
        const dislikesCount = voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)?._count.commentVoteId || 0;
        return {
            ...comment,
            postTitle: comment.dimPosts.postTitle,
            countLikes: likesCount,
            countDislikes: dislikesCount,
        }
    })

    return recentCommentsWithVoteCount;
}

export async function getRandomPosts(): Promise<PostCardData[]> {
    /*
    prisma.dimPosts.findManyRandomを利用してもランダムな記事を取得することは可能であるが、タイムアウトしてしまうため、インデックスを作成したuuidを使って疑似的にランダムな記事を取得している
    */
    const postCount = await prisma.dimPosts.count();
    const randomPostOffset = Math.max(
        Math.floor(Math.random() * postCount) - 12,
        0
    );

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
                        tagName: "asc",
                    }
                }
            },
        },
        orderBy: { uuid : "asc"},
        skip: randomPostOffset,
        take: 12,
    })
    const commentCount = await prisma.dimComments.groupBy({
        by: ["postId"],
        _count: { commentId: true },
        where: { postId: { in: randomPostsRaw.map((post) => post.postId) } },
    })
    const randomPosts = randomPostsRaw.map((post) => {
        const count = commentCount.find((c) => c.postId === post.postId)?._count.commentId || 0;
        return {
            ...post,
            countComments: count,
            tags: post.rel_post_tags.map((tag) => tag.dimTag),
        }
    })
    return randomPosts;
}

export async function getRandomComments(chunkSize = 12): Promise<CommentShowCardData[]>{
    const commentCount = await prisma.dimComments.count();
    const randomCommentOffset = Math.max(
        Math.floor(Math.random() * commentCount) - chunkSize,
        0
    );

    const randomComments = await prisma.dimComments.findMany({
        select: {
            commentId: true,
            commentContent: true,
            commentDateGmt: true,
            commentAuthor: true,
            postId: true,
            dimPosts: { select: { postTitle: true } },
        },
        orderBy: { uuid: "asc" },
        take: chunkSize,
        skip: randomCommentOffset,
    })
    const voteCount = await prisma.fctCommentVoteHistory.groupBy({
        by: ["commentId", "voteType"],
        _count: { commentVoteId: true },
        where: { commentId: { in: randomComments.map((comment) => comment.commentId) } },
    })
    const randomCommentsWithVoteCount = randomComments.map((comment) => {
        const likesCount = voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)?._count.commentVoteId || 0;
        const dislikesCount = voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)?._count.commentVoteId || 0;
        return {
            ...comment,
            countLikes: likesCount,
            countDislikes: dislikesCount,
            postTitle: comment.dimPosts.postTitle,
        }
    })
    return randomCommentsWithVoteCount;
}

export type FeedPostType = "unboundedLikes" | "likes" | "timeDesc" | "timeAsc"
const PostFeedDataSchema = z.object({
    meta: z.object({
        totalCount: z.number(),
        currentPage: z.number(),
        type: z.enum(["unboundedLikes", "likes", "timeDesc", "timeAsc"]),
        likeFromHour: z.optional(z.number()),
        likeToHour: z.optional(z.number()),
        chunkSize: z.number(),
    }),
    result: z.array(PostCardDataSchema),
})
type PostFeedData = z.infer<typeof PostFeedDataSchema>;

export async function getFeedPosts(pagingNumber: number, type: FeedPostType, chunkSize = 12, likeFromHour = 24, likeToHour = 0,): Promise<PostFeedData>{
    const offset = (pagingNumber - 1) * chunkSize;
    if (["unboundedLikes", "timeDesc", "timeAsc"].includes(type)){
        const posts = await prisma.$queryRaw`
        select post_id, post_title, post_date_gmt, count_likes, count_dislikes, ogp_image_url
        from dim_posts
        ${type === "unboundedLikes" ? Prisma.raw("order by count_likes desc, post_date_gmt desc")
        : type === "timeDesc" ? Prisma.raw("order by post_date_gmt desc")
        : type === "timeAsc" ? Prisma.raw("order by post_date_gmt asc")
        : Prisma.empty}
        offset ${offset} limit ${chunkSize}
        ` as { post_id: number; post_title: string; post_date_gmt: Date; count_likes: number; count_dislikes: number; ogp_image_url: string | null }[]
        const commentCount = await prisma.dimComments.groupBy({
            by: ["postId"],
            _count: { commentId: true },
            where: { postId: { in: posts.map((post) => post.post_id) } },
        })
        const tagNames = await prisma.relPostTags.findMany({
            where: { postId: { in: posts.map((post) => post.post_id) } },
            select: {
                postId: true,
                dimTag: {
                    select: {
                        tagId: true,
                        tagName: true,
                    }
                }
            },
        })
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
            }
        })
        return {
            meta: {
                totalCount: totalCount,
                currentPage: pagingNumber,
                type: type,
                chunkSize: chunkSize,
            },
            result: postData,
        }
    }
    if (type === "likes"){
        const voteCount = await prisma.fctPostVoteHistory.groupBy({
            by: ["postId"],
            _count: { voteUserIpHash: true },
            where: {
                voteTypeInt: { in: [1] },
                voteDateGmt: {
                    gte: new Date(new Date().getTime() - likeFromHour * 60 * 60 * 1000),
                    lte: new Date(new Date().getTime() - likeToHour * 60 * 60 * 1000)
                }
            },
            orderBy: { _count: { voteUserIpHash: "desc" } },
            take: chunkSize,
            skip: offset,
        })
        const totalCountRaw = await prisma.fctPostVoteHistory.groupBy({
            by: ["postId"],
            _count: { voteUserIpHash: true },
            where: {
                voteTypeInt: { in: [1] },
                voteDateGmt: {
                    gte: new Date(new Date().getTime() - likeFromHour * 60 * 60 * 1000),
                    lte: new Date(new Date().getTime() - likeToHour * 60 * 60 * 1000)
                }
            }
        })
        const totalCount = totalCountRaw.length;
        const postIds = voteCount.map((vote) => vote.postId)
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
                            }
                        }
                    }
                }
            }
        })
        const countComments = await prisma.dimComments.groupBy({
            by: ["postId"],
            _count: { commentId: true },
            where: { postId: { in: posts.map((post) => post.postId) } },
        })
        const postData = posts.map((post) => {
            return {
                ...post,
                countComments: countComments.find((c) => c.postId === post.postId)?._count.commentId || 0,
                tags: post.rel_post_tags.map((tag) => tag.dimTag),
            }
        })
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
        }
    }
    return {
        meta: {
            totalCount: 0,
            currentPage: 0,
            type: type,
            chunkSize: chunkSize,
        },
        result: [],
    }
}

export async function getOldestPostIdsForTest(chunkSize: number){
    const posts = await prisma.dimPosts.findMany({
        orderBy: { postDateGmt: "asc" },
        take: chunkSize * 2,
    })
    return posts.map((post) => post.postId);
}

export async function getNewestPostIdsForTest(chunkSize: number){
    const posts = await prisma.dimPosts.findMany({
        orderBy: { postDateGmt: "desc" },
        take: chunkSize * 2,
    })
    return posts.map((post) => post.postId);
}

export async function getUnboundedLikesPostIdsForTest(chunkSize: number){
    const posts = await prisma.$queryRaw`
    select post_id
    from dim_posts
    order by count_likes desc, post_date_gmt desc
    limit ${chunkSize * 2}
    ` as { post_id: number }[]
    return posts.map((post) => post.post_id);
}

const CommentFeedDataSchema = z.object({
    meta: z.object({
        totalCount: z.number(),
        currentPage: z.number(),
        type: z.enum(["timeDesc", "timeAsc", "unboundedLikes", "likes"]),
        chunkSize: z.number(),
        likeFromHour: z.optional(z.number()),
        likeToHour: z.optional(z.number()),
    }),
    result: z.array(CommentShowCardDataSchema),
})
type CommentFeedData = z.infer<typeof CommentFeedDataSchema>;

export async function getFeedComments(pagingNumber: number, type: FeedPostType, chunkSize = 12, likeFromHour = 48, likeToHour = 0,): Promise<CommentFeedData>{
    const offset = (pagingNumber - 1) * chunkSize;
    if (["timeDesc", "timeAsc"].includes(type)){
        const totalCount = await prisma.dimComments.count();
        const comments = await prisma.dimComments.findMany({
            orderBy: { commentDateJst: type === "timeDesc" ? "desc" : "asc" },
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
                    }
                }
            }
        })
        const voteCount = await prisma.fctCommentVoteHistory.groupBy({
            by: ["commentId", "voteType"],
            _count: { commentVoteId: true },
            where: { commentId: { in: comments.map((comment) => comment.commentId) } },
        })
        const commentData = comments.map((comment) => {
            const likesCount = voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)?._count.commentVoteId || 0;
            const dislikesCount = voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)?._count.commentVoteId || 0;
            return {
                ...comment,
                countLikes: likesCount,
                countDislikes: dislikesCount,
                postTitle: comment.dimPosts.postTitle,
            }
        })
        return {
            meta: {
                totalCount: totalCount,
                currentPage: pagingNumber,
                type: type,
                chunkSize: chunkSize,
            },
            result: commentData,
        }
    }
    if (type === "unboundedLikes"){
        const totalCountRaw = await prisma.$queryRaw`
        with raw as (
        select post_id, count(post_id) from fct_comment_vote_history
        where vote_type = 1
        group by post_id
        having count(post_id) >= 1
        )
        select count(*) from raw;
        ` as { count: bigint }[]
        const totalCount = Number(totalCountRaw[0].count);

        const commentIds = await prisma.fctCommentVoteHistory.groupBy({
            by: ["commentId"],
            _count: { commentVoteId: true },
            orderBy: { _count: { commentVoteId: "desc" } },
            take: chunkSize,
            skip: offset,
            where: { voteType: { in: [1] } },
        })
        const comments = await prisma.dimComments.findMany({
            select: { 
                commentId: true,
                postId: true,
                commentAuthor: true,
                commentDateGmt: true,
                commentContent: true,
                dimPosts: {
                    select: {
                        postTitle: true,
                    }
                }
            },
            where: { commentId: { in: commentIds.map((comment) => comment.commentId) } },
        }).then((comments) => {
            // commentIdsと同じ順番で並び替える
            return comments.sort((a, b) => commentIds.findIndex((c) => c.commentId === a.commentId) - commentIds.findIndex((c) => c.commentId === b.commentId));
        })
        const voteCount = await prisma.fctCommentVoteHistory.groupBy({
            by: ["commentId", "voteType"],
            _count: { commentVoteId: true },
            where: { commentId: { in: comments.map((comment) => comment.commentId) } },
        })

        const commentData = comments.map((comment) => {
            return {
                ...comment,
                postTitle: comment.dimPosts.postTitle,
                countLikes: voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)?._count.commentVoteId || 0,
                countDislikes: voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)?._count.commentVoteId || 0,
            }
        })
        return {
            meta: {
                totalCount: totalCount,
                currentPage: pagingNumber,
                type: type,
                chunkSize: chunkSize,
            },
            result: commentData,
        }
    }

    if (type === "likes"){
        const totalCountRaw = await prisma.fctCommentVoteHistory.groupBy({
            by: ["commentId"],
            _count: { commentVoteId: true },
            where: { voteType: { in: [1] }, comment_vote_date_utc: {
                gte: new Date(new Date().getTime() - likeFromHour * 60 * 60 * 1000),
                lte: new Date(new Date().getTime() - likeToHour * 60 * 60 * 1000)
            } }
        })
        const totalCount = totalCountRaw.length;
        const commentIds = await prisma.fctCommentVoteHistory.groupBy({
            by: ["commentId"],
            _count: { commentVoteId: true },
            orderBy: { _count: { commentVoteId: "desc" } },
            take: chunkSize,
            skip: offset,
            where: { 
                voteType: { in: [1] },
                comment_vote_date_utc: {
                    gte: new Date(new Date().getTime() - likeFromHour * 60 * 60 * 1000),
                    lte: new Date(new Date().getTime() - likeToHour * 60 * 60 * 1000)
                }
            }
        })
        const comments = await prisma.dimComments.findMany({
            select: { 
                commentId: true,
                postId: true,
                commentAuthor: true,
                commentDateGmt: true,
                commentContent: true,
                dimPosts: {
                    select: {
                        postTitle: true,
                    }
                }
            },
            where: { commentId: { in: commentIds.map((comment) => comment.commentId) } },
            orderBy: { commentDateJst: "desc" },
        }).then((comments) => {
            return comments.sort((a, b) => commentIds.findIndex((c) => c.commentId === a.commentId) - commentIds.findIndex((c) => c.commentId === b.commentId));
        })

        const voteCount = await prisma.fctCommentVoteHistory.groupBy({
            by: ["commentId", "voteType"],
            _count: { commentVoteId: true },
            where: { commentId: { in: comments.map((comment) => comment.commentId) } },
        })

        const commentData = comments.map((comment) => {
            return {
                ...comment,
                postTitle: comment.dimPosts.postTitle,
                countLikes: voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === 1)?._count.commentVoteId || 0,
                countDislikes: voteCount.find((vote) => vote.commentId === comment.commentId && vote.voteType === -1)?._count.commentVoteId || 0,
            }
        })
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
        }
    }
    return {
        meta: {
            totalCount: 0,
            currentPage: 0,
            type: type,
            chunkSize: chunkSize,
        },
        result: [],
    }
}

export async function getRecentCommentIdsForTest(chunkSize=12){
    const commentIds = await prisma.dimComments.findMany({
        orderBy: { commentDateJst: "desc" },
        take: chunkSize * 2,
    })
    return commentIds.map((comment) => comment.commentId);
}

export async function getOldestCommentIdsForTest(chunkSize=12){
    const commentIds = await prisma.dimComments.findMany({
        orderBy: { commentDateJst: "asc" },
        take: chunkSize * 2,
    })
    return commentIds.map((comment) => comment.commentId);
}

export async function getUnboundedLikesCommentIdsForTest(chunkSize=12){
    const commentIds = await prisma.fctCommentVoteHistory.groupBy({
        by: ["commentId"],
        _count: { commentVoteId: true },
        orderBy: { _count: { commentVoteId: "desc" } },
        take: chunkSize * 2,
        where: { voteType: { in: [1] } },
    })
    const comments = await prisma.dimComments.findMany({
        select : { commentId: true },
        where: { commentId: { in: commentIds.map((comment) => comment.commentId) } },
        orderBy: { commentDateJst: "desc" },
    })
    return comments.map((comment) => comment.commentId);
}

export async function getLikedCommentsForTest(chunkSize=12, likeFromHour=48, likeToHour=0){
    const commentIds = await prisma.fctCommentVoteHistory.groupBy({
        by: ["commentId"],
        _count: { commentVoteId: true },
        orderBy: { _count: { commentVoteId: "desc" } },
        take: chunkSize,
        where: { voteType: { in: [1] }, comment_vote_date_utc: {
            gte: new Date(new Date().getTime() - likeFromHour * 60 * 60 * 1000),
            lte: new Date(new Date().getTime() - likeToHour * 60 * 60 * 1000)
        } }
    })
    const comments = await prisma.dimComments.findMany({
        select: { commentId: true },
        where: { commentId: { in: commentIds.map((comment) => comment.commentId) } },
        orderBy: { commentDateJst: "desc" },
    })
    return comments.map((comment) => comment.commentId);
}

const tagCountSchema = z.object({
    tagName: z.string(),
    count: z.number(),
})
type TagCount = z.infer<typeof tagCountSchema>;

export async function getTagsCounts () : Promise<TagCount[]> {
    const tags = await prisma.dimTags.findMany({
        select: {
          tagName: true,
          _count: {
            select: { relPostTags: true },
          },
        },
        orderBy: {
          relPostTags: {
            _count: "desc",
          },
        },
      });
    const allTagsOnlyForSearch: TagCount[] = tags.map((tag) => {
        return { tagName: tag.tagName, count: tag._count.relPostTags };
    });

    return allTagsOnlyForSearch;
}

export async function getStopWords() : Promise<string[]> {
    const stopWords = await prisma.dimStopWords.findMany({
        select: { stopWord: true },
    })
    // ユニーク化
    return [...new Set(stopWords.map((stopWord) => stopWord.stopWord))];
}

export async function updatePostWelcomed(postId: number, isWelcomed: boolean, explanation: string){
    await prisma.dimPosts.update({
        where: { postId },
        data: { isWelcomed: isWelcomed, isWelcomedExplanation: explanation },
    })
}

export async function getUserEditHistory(userUuid: string){
    const userEditHistory = await prisma.fctPostEditHistory.findMany({
        where: { editorUserId: userUuid },
        orderBy: { postEditDateGmt: "desc" },
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
                }
            }
        }
    })
    return userEditHistory;
}
