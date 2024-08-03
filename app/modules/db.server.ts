import { createClient } from "@libsql/client/web";
import { AppLoadContext } from "@remix-run/cloudflare";
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from "../../drizzle/schema";
import { dimPosts } from "../../drizzle/schema";
import { desc } from "drizzle-orm";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { z } from "zod";

interface Env {
    TURSO_DATABASE_URL: string;
    TURSO_AUTH_TOKEN: string;
}

// Zodスキーマの定義
const PostCardSchema = z.object({
    postId: z.number(),
    postTitle: z.string(),
    postDateGmt: z.string(),
    countLikes: z.number(),
    countDislikes: z.number(),
    tags: z.array(z.string()),
});

type PostCard = z.infer<typeof PostCardSchema>;

const CommentShowCardSchema = z.object({
    commentId: z.number(),
    commentContent: z.string(),
    commentDateGmt: z.string(),
    commentAuthor: z.string(),
    postId: z.number(),
    dimPosts: z.object({
        postTitle: z.string(),
    }),
});

type CommentShowCard = z.infer<typeof CommentShowCardSchema>;


function getTursoClient(serverContext: AppLoadContext){
    const env = serverContext.cloudflare.env as Env;
    const TURSO_DATABASE_URL = env.TURSO_DATABASE_URL;
    const TURSO_AUTH_TOKEN = env.TURSO_AUTH_TOKEN;
    const client = createClient({
        url: TURSO_DATABASE_URL,
        authToken: TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(client);
    const prisma = new PrismaClient({ adapter });
    return prisma;
}

async function getMostRecentPosts(serverContext: AppLoadContext, count: number = 10): Promise<PostCard[]> {
    const db = getTursoClient(serverContext);
    const rawData = await db.dimPosts.findMany({
        orderBy: { postDateGmt: "desc" },
        take: count,
        select: {
            postId: true,
            postTitle: true,
            postDateGmt: true,
            countLikes: true,
            countDislikes: true,
            relPostTags: {
                select: {
                    dimTags: {
                        select: {
                            tagName: true,
                        },
                    },
                },
            },
        },
    });
    const posts = rawData.map((post) => ({
        postId: post.postId,
        postTitle: post.postTitle,
        postDateGmt: post.postDateGmt,
        countLikes: post.countLikes,
        countDislikes: post.countDislikes,
        tags: post.relPostTags.map((tag) => tag.dimTags.tagName),
    }));

    return posts;
}

async function getRecentVotedPosts(serverContext: AppLoadContext, count: number = 10): Promise<PostCard[]> {
    const db = getTursoClient(serverContext);
    const recentVotedPostsAgg = await db.fctPostVoteHistory.groupBy({
        by: ["postId"],
        where: { 
            voteDateGmt : { 
                gte: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
                lte: new Date(),
            },
            voteTypeInt : { in : [1]}
        },
        _count: { voteUserIpHash: true },
        orderBy: { _count: { voteUserIpHash: "desc" } },
        take: 10,
    });

    const recentVotedPostsRaw = await db.dimPosts.findMany({
        where: { postId: { in: recentVotedPostsAgg.map((post) => post.postId) } },
        select: {
            postId: true,
            postTitle: true,
            postDateGmt: true,
            countLikes: true,
            countDislikes: true,
            relPostTags: {
                select: {
                    dimTags: {
                        select: {
                            tagName: true,
                        },
                    },
                },
            },
        },
    });

    const posts = recentVotedPostsRaw.map((post) => ({
        postId: post.postId,
        postTitle: post.postTitle,
        postDateGmt: post.postDateGmt,
        countLikes: post.countLikes,
        countDislikes: post.countDislikes,
        tags: post.relPostTags.map((tag) => tag.dimTags.tagName),
    }));
    return posts;
}

async function getPostsByTagId(serverContext: AppLoadContext, tagId: number, count: number = 10): Promise<PostCard[]> {
    const db = getTursoClient(serverContext);
    const rawData = await db.relPostTags.findMany({
        where: { tagId: { equals: tagId } },
        select : {
            dimPosts: {
                select : {
                    postId: true,
                    postTitle: true,
                    postDateGmt: true,
                    countLikes: true,
                    countDislikes: true,
                    relPostTags: {
                    select: {
                    dimTags: {
                        select: {
                            tagName: true,
                        },
                    },
                },
            },
        },
    }},
    take: 100,
    orderBy : { dimPosts : { postDateGmt : "desc" }},
    });

    const posts = rawData.map((post) => ({
        postId: post.dimPosts.postId,
        postTitle: post.dimPosts.postTitle,
        postDateGmt: post.dimPosts.postDateGmt,
        countLikes: post.dimPosts.countLikes,
        countDislikes: post.dimPosts.countDislikes,
        tags: post.dimPosts.relPostTags.map((tag) => tag.dimTags.tagName),
    }));
    return posts;
}

async function getMostRecentComments(serverContext: AppLoadContext): Promise<CommentShowCard[]> {
    const db = getTursoClient(serverContext);
    const rawData = await db.dimComments.findMany({
        orderBy: { commentDateJst: "desc" },
        take: 10,
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
    })
    const comments = rawData.map((comment) => ({
        commentId: comment.commentId,
        commentContent: comment.commentContent,
        commentDateGmt: comment.commentDateGmt,
        commentAuthor: comment.commentAuthor,
        postId: comment.postId,
        dimPosts: {
            postTitle: comment.dimPosts.postTitle,
        },
    }));
    return comments;
}

export { getMostRecentPosts, getRecentVotedPosts, getPostsByTagId, PostCardSchema, getMostRecentComments, CommentShowCardSchema }