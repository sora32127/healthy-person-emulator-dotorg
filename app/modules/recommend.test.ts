import { describe, it, expect } from "vitest";
import { getRecommendPosts } from "./recommend.server";

describe("getRecommendPosts", () => {
    const mockInputData = {
        viewedPosts: [
            {
                postId: 19030,
                viewedAtGMT: new Date(),
            },
            {
                postId: 35416,
                viewedAtGMT: new Date(),
            },
            {
                postId: 30929,
                viewedAtGMT: new Date(),
            },
        ],
        likedPosts: [
            {
                postId: 19030,
                likedAtGMT: new Date(),
            },
            {
                postId: 35416,
                likedAtGMT: new Date(),
            },
            {
                postId: 30929,
                likedAtGMT: new Date(),
            },
        ],
    }

    it("おすすめの投稿を返すべき", async () => {
        const recommendPosts = await getRecommendPosts(mockInputData, { elipse_weight: 1 });
        expect(recommendPosts).toHaveLength(10);
    });

    it("閲覧済みの投稿が除外されている", async () => {
        const recommendPosts = await getRecommendPosts(mockInputData, { elipse_weight: 1 });
        const allInputPostIds = [...mockInputData.viewedPosts.map(post => post.postId), ...mockInputData.likedPosts.map(post => post.postId)];
        const recommendPostIds = recommendPosts.map(post => post.postId);
        expect(recommendPostIds).not.toContain(allInputPostIds);
    });
});
