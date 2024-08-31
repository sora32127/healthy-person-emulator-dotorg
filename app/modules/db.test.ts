import { expect, test } from "vitest";
import { ArchiveDataEntry, CommentShowCardDataSchema, getFeedComments, getFeedPosts, getLikedCommentsForTest, getNewestPostIdsForTest, getOldestCommentIdsForTest, getOldestPostIdsForTest, getRecentCommentIdsForTest, getRecentComments, getUnboundedLikesCommentIdsForTest, getUnboundedLikesPostIdsForTest, PostCardDataSchema } from "./db.server";
import { describe } from "node:test";


describe("記事ID23576の正しいデータを返すこと", async () => {
    test("記事ID23576の正しいデータを返すこと", async () => {
        const archiveDataEntry = await ArchiveDataEntry.getData(23576);
        expect(archiveDataEntry.postId).toBe(23576);
        expect(archiveDataEntry.postTitle).toBe('無神論者の火');
        expect(archiveDataEntry.tags).toContainEqual({ tagName: 'クリスマス', tagId: 381 });
        expect(archiveDataEntry.tags).toContainEqual({ tagName: '学生', tagId: 21 });
        expect(archiveDataEntry.tags).toContainEqual({ tagName: '小学生', tagId: 35 });
        expect(archiveDataEntry.countLikes).toBeGreaterThan(30);
        expect(archiveDataEntry.countDislikes).toBeGreaterThan(5);
        expect(archiveDataEntry.postDateGmt).toEqual(new Date('2023-02-11T05:57:26.000Z'));
        expect(archiveDataEntry.postContent).not.toBe('');
        expect(archiveDataEntry.similarPosts).toHaveLength(15);
        expect(archiveDataEntry.previousPost.postTitle).toBe('無知識でアナルにローターを入れるべきでは無い');
        expect(archiveDataEntry.nextPost.postTitle).toBe('無能が消去法で大学を決めるべきではない');
    })
});

describe("getFeedPostsが正しいデータを返すこと", async () =>  {
    const likeFromHour = 0;
    const likeToHour = 24;
    const chunkSize = 12;
    describe("古い順の場合", async () => {
        test("古い順, 1ページ目", async () => {
            const oldestPostIds = await getOldestPostIdsForTest(chunkSize);
            const pagingNumber = 1;
            const type = "timeAsc";
            const feedPosts = await getFeedPosts(pagingNumber, type, chunkSize);
            expect(feedPosts.meta.totalCount).toBeGreaterThan(9000);
            expect(feedPosts.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const post = PostCardDataSchema.parse(feedPosts.result[i]);
                expect(post.postId).toBe(oldestPostIds[i]);
            }
        })
        test("古い順, 2ページ目", async () => {
            const oldestPostIds = await getOldestPostIdsForTest(chunkSize);
            const pagingNumber = 2;
            const type = "timeAsc";
            const feedPosts = await getFeedPosts(pagingNumber, type, chunkSize);
            expect(feedPosts.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const post = PostCardDataSchema.parse(feedPosts.result[i]);
                expect(post.postId).toBe(oldestPostIds[i+chunkSize]);
            }
        })
    })

    describe("新着順の場合", async () => {
        test("新着順, 1ページ目", async () => {
            const newestPostIds = await getNewestPostIdsForTest(chunkSize);
            const pagingNumber = 1;
            const type = "timeDesc";
            const feedPosts = await getFeedPosts(pagingNumber, type, chunkSize);
            expect(feedPosts.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const post = PostCardDataSchema.parse(feedPosts.result[i]);
                expect(post.postId).toBe(newestPostIds[i]);
            }
        })
        test("新着順, 2ページ目", async () => {
            const newestPostIds = await getNewestPostIdsForTest(chunkSize);
            const pagingNumber = 2;
            const type = "timeDesc";
            const feedPosts = await getFeedPosts(pagingNumber, type, chunkSize);
            expect(feedPosts.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const post = PostCardDataSchema.parse(feedPosts.result[i]);
                expect(post.postId).toBe(newestPostIds[i+chunkSize]);
            }
        })
    })
    describe("いいね順の場合", async () => {
        test("いいね順, 1ページ目", async () => {
            const pagingNumber = 1;
            const type = "likes";
            const feedPosts = await getFeedPosts(pagingNumber, type, chunkSize);
            expect(feedPosts.result.length).toBeGreaterThan(0);
            // 時間によって違うのでテストが難しい
        })
    })
    describe("無期限いいね順の場合", async () => {
        test("無期限いいね順, 1ページ目", async () => {
            const unboundedLikesPostIds = await getUnboundedLikesPostIdsForTest(chunkSize);
            const pagingNumber = 1;
            const type = "unboundedLikes";
            const feedPosts = await getFeedPosts(pagingNumber, type, chunkSize);
            expect(feedPosts.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const post = PostCardDataSchema.parse(feedPosts.result[i]);
                expect(post.postId).toBe(unboundedLikesPostIds[i]);
            }   
        })
        test("無期限いいね順, 2ページ目", async () => {
            const unboundedLikesPostIds = await getUnboundedLikesPostIdsForTest(chunkSize);
            const pagingNumber = 2;
            const type = "unboundedLikes";
            const feedPosts = await getFeedPosts(pagingNumber, type, chunkSize);
            expect(feedPosts.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const post = PostCardDataSchema.parse(feedPosts.result[i]);
                expect(post.postId).toBe(unboundedLikesPostIds[i+chunkSize]);
            }
        })
    })
});

describe("getFeedCommentsが正しいデータを返すこと", async () => {
    const chunkSize = 12;
    describe("新着順の場合", async () => {
        test("新着順, 1ページ目", async () => {
            const recentCommentIds = await getRecentCommentIdsForTest(chunkSize);
            const pagingNumber = 1;
            const type = "timeDesc";
            const feedComments = await getFeedComments(pagingNumber, type, chunkSize);

            expect(feedComments.meta.totalCount).toBeGreaterThan(10000);
            expect(feedComments.meta.chunkSize).toBe(chunkSize);
            expect(feedComments.meta.currentPage).toBe(pagingNumber);
            expect(feedComments.meta.type).toBe(type);

            expect(feedComments.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const comment = CommentShowCardDataSchema.parse(feedComments.result[i]);
                expect(comment.commentId).toBe(recentCommentIds[i]);
            }
        })

        test("新着順, 2ページ目", async () => {
            const recentCommentIds = await getRecentCommentIdsForTest(chunkSize);
            const pagingNumber = 2;
            const type = "timeDesc";
            const feedComments = await getFeedComments(pagingNumber, type, chunkSize);
            expect(feedComments.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const comment = CommentShowCardDataSchema.parse(feedComments.result[i]);
                expect(comment.commentId).toBe(recentCommentIds[i+chunkSize]);
            }
        })

        test("古い順, 1ページ目", async () => {
            const oldestCommentIds = await getOldestCommentIdsForTest(chunkSize);
            const pagingNumber = 1;
            const type = "timeAsc";
            const feedComments = await getFeedComments(pagingNumber, type, chunkSize);
            expect(feedComments.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const comment = CommentShowCardDataSchema.parse(feedComments.result[i]);
                expect(comment.commentId).toBe(oldestCommentIds[i]);
            }
        })

        test("古い順, 2ページ目", async () => {
            const oldestCommentIds = await getOldestCommentIdsForTest(chunkSize);
            const pagingNumber = 2;
            const type = "timeAsc";
            const feedComments = await getFeedComments(pagingNumber, type, chunkSize);
            expect(feedComments.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const comment = CommentShowCardDataSchema.parse(feedComments.result[i]);
                expect(comment.commentId).toBe(oldestCommentIds[i+chunkSize]);
            }
        })


        test("無期限いいね順, 1ページ目", async () => {
            const unboundedLikesCommentIds = await getUnboundedLikesCommentIdsForTest(chunkSize);
            const pagingNumber = 1;
            const type = "unboundedLikes";
            const feedComments = await getFeedComments(pagingNumber, type, chunkSize);
            expect(feedComments.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const comment = CommentShowCardDataSchema.parse(feedComments.result[i]);
            }
        })

        test("無期限いいね順, 2ページ目", async () => {
            const unboundedLikesCommentIds = await getUnboundedLikesCommentIdsForTest(chunkSize);
            const pagingNumber = 2;
            const type = "unboundedLikes";
            const feedComments = await getFeedComments(pagingNumber, type, chunkSize);
            expect(feedComments.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const comment = CommentShowCardDataSchema.parse(feedComments.result[i]);
            }
        })

        test("いいね順, 1ページ目", async () => {
            const likesCommentIds = await getLikedCommentsForTest(chunkSize);
            const pagingNumber = 1;
            const type = "likes";
            const feedComments = await getFeedComments(pagingNumber, type, chunkSize);
            expect(feedComments.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const comment = CommentShowCardDataSchema.parse(feedComments.result[i]);
            }
        })

        test("いいね順, 2ページ目", async () => {
            const likesCommentIds = await getLikedCommentsForTest(chunkSize);
            const pagingNumber = 2;
            const type = "likes";
            const feedComments = await getFeedComments(pagingNumber, type, chunkSize);
            expect(feedComments.result).toHaveLength(chunkSize);
            for (let i = 0; i < chunkSize; i++) {
                const comment = CommentShowCardDataSchema.parse(feedComments.result[i]);
            }
        })
    })
})