import { describe, test, expect } from "vitest";
import { PostCardDataSchema } from "./db.server";
import { getSearchResults, searchResultsSchema } from "./search.server";
import { getRecentPostTitlesForTest, getMostLikedPostTitlesForTest, getMostRecentKeywardPostIdsForTest, getMostLikedKeywardPostIdsForTest, getOldestTagPostIdsForTest, getMostRecentTagPostIdsForTest, getMostLikedTagPostIdsForTest, getOldestKeywardPostIdsForTest, getLatestKeywardTagPostIdsForTest, getMostLikedKeywardTagPostIdsForTest } from "./search.testhelper";

describe("getSearchResultsが正しいデータを返すこと", async () => {
    /*
    - 形式の正しさはparseでチェックする
    - 中身の正しさはtitleでチェックする
    */
    describe("キーワードなし、タグなしの場合", async () => {
        test("時系列昇順, 1ページ目", async () => {

            const searchResults = await getSearchResults(
                "",
                [],
                1,
                "timeAsc"
            );
            searchResultsSchema.parse(searchResults);
            // meta
            expect(searchResults.meta.totalCount).toBe(0);
            const countOfUnReccommendedTags = searchResults.meta.tags.filter((tag) => tag.tagName === "やってはいけないこと")[0].count;
            expect(countOfUnReccommendedTags).toBeGreaterThanOrEqual(2000);

            // results
            expect(searchResults.results).toStrictEqual([]);
        })
        test("時系列昇順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                [],
                2,
                "timeAsc"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.meta.totalCount).toBe(0);
            expect(searchResults.results).toStrictEqual([]);
        })
        test("時系列降順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                [],
                1,
                "timeDesc"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.meta.totalCount).toBe(0);
            expect(searchResults.results).toStrictEqual([]);
        })
        test("時系列降順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                [],
                2,
                "timeDesc"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.meta.totalCount).toBe(0);
            expect(searchResults.results).toStrictEqual([]);
        })
        test("いいね降順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                [],
                1,
                "like"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.meta.totalCount).toBe(0);
            expect(searchResults.results).toStrictEqual([]);
        })
        test("いいね降順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                [],
                2,
                "like"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.meta.totalCount).toBe(0);
            expect(searchResults.results).toStrictEqual([]);
        })
    })
    

    describe("キーワードあり、タグなしの場合", async () => {
        const timeAscIds = 
            [
                16414,
                17086,
                16212,
                19208,
                16888,
                18814,
                19190,
                26242,
                20390,
                23594,
                24802,
                20306,
                20326,
                25972,
                17156,
                24894,
                19492,
                23800,
                20224,
                25548,
            ]
        const mostRecentPostIds = await getMostRecentKeywardPostIdsForTest();
        const mostLikedPostIds = await getMostLikedKeywardPostIdsForTest();
     
        test("投稿日昇順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "いけない 人",
                [],
                1,
                "timeAsc"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.meta.totalCount).toBeGreaterThan(1150);
            expect(searchResults.meta.tags.length).toBeGreaterThan(500);
            const countOfUnReccommendedTags = searchResults.meta.tags.filter((tag) => tag.tagName === "やってはいけないこと")[0].count;
            expect(countOfUnReccommendedTags).toBeGreaterThan(452);

            expect(searchResults.results).toHaveLength(10);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(timeAscIds[index]);
            })
        })
        test("投稿日昇順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "いけない 人",
                [],
                2,
                "timeAsc"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(timeAscIds[index + 10]);
            })
        })
        test("投稿日降順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "いけない 人",
                [],
                1,
                "timeDesc"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(mostRecentPostIds[index]);
            })
        })

        test("投稿日降順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "いけない 人",
                [],
                2,
                "timeDesc"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(mostRecentPostIds[index + 10]);
            })
        })
        test("いいね降順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "いけない 人",
                [],
                1,
                "like"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(mostLikedPostIds[index]);
            })
        })
        test("いいね降順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "いけない 人",
                [],
                2,
                "like"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(mostLikedPostIds[index + 10]);
            })
        })
    })
    
    describe("タグあり、キーワードなしの場合", async () => {
        /* 行数確認用SQL
        with tag_ids as (
            select tag_id, tag_name from dim_tags
            where tag_name in (
                'やってはいけないこと', '対人関係'
            )
        ),
        tag_count as (
        select
            post_id
        from rel_post_tags
        where tag_id in (select tag_id from tag_ids)
        group by 1
        having count(*) = 2
        )
        select count(*) from tag_count;
        */
        /*
        タグの投稿数確認用SQL
        with tag_ids as (
            select tag_id, tag_name from dim_tags
            where tag_name in (
                'やってはいけないこと', '対人関係'
            )
            ),
        post_ids as (
            select
                post_id
            from rel_post_tags
            where tag_id in (select tag_id from tag_ids)
            group by 1
            having count(*) = 2
            ),
        rel_tags as (
            select
                rel_post_tags.post_id,
                dim_tags.tag_id,
                tag_name
            from rel_post_tags
            left join dim_tags
            on rel_post_tags.tag_id = dim_tags.tag_id
            where post_id in (select post_id from post_ids)
            )
        select
            tag_name,
            count(distinct post_id) as post_count
        from rel_tags
        group by 1
        order by 2 desc
        */
        const timeAscPostIds = await getOldestTagPostIdsForTest();
        const timeDescPostIds = await getMostRecentTagPostIdsForTest();
        const mostLikedPostIds = await getMostLikedTagPostIdsForTest();
        test("投稿日昇順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                ["やってはいけないこと", "対人関係"],
                1,
                "timeAsc"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.meta.totalCount).toBeGreaterThan(330);
            expect(searchResults.meta.totalCount).toBeLessThan(500);
            expect(searchResults.meta.tags.length).toBeGreaterThan(265);
            expect(searchResults.meta.tags.length).toBeLessThan(400);
            expect(searchResults.meta.tags.filter((tag) => tag.tagName === "やってはいけないこと")[0].count).toBe(searchResults.meta.totalCount);
            expect(searchResults.meta.tags.filter((tag) => tag.tagName === "対人関係")[0].count).toBe(searchResults.meta.totalCount);
            const countOfUnReccommendedTags = searchResults.meta.tags.filter((tag) => tag.tagName === "人間関係")[0].count;
            expect(countOfUnReccommendedTags).toBeGreaterThan(75);

            expect(searchResults.results).toHaveLength(10);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(timeAscPostIds[index]);
                expect(result.tags.filter((tag) => tag.tagName === "やってはいけないこと")).toHaveLength(1);
                expect(result.tags.filter((tag) => tag.tagName === "対人関係")).toHaveLength(1);
            })
        })
        test("投稿日昇順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                ["やってはいけないこと", "対人関係"],
                2,
                "timeAsc"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(timeAscPostIds[index + 10]);
                expect(result.tags.filter((tag) => tag.tagName === "やってはいけないこと")).toHaveLength(1);
                expect(result.tags.filter((tag) => tag.tagName === "対人関係")).toHaveLength(1);
            })
        })
        
       test("投稿日降順, 1ページ目", async () => {
        const searchResults = await getSearchResults(
            "",
            ["やってはいけないこと", "対人関係"],
            1,
            "timeDesc"
        );
        searchResultsSchema.parse(searchResults);
        expect(searchResults.results).toHaveLength(10);
        searchResults.results.forEach((result, index) => {
            PostCardDataSchema.parse(result);
            expect(result.postId).toBe(timeDescPostIds[index]);
        })
       })
       test("投稿日降順, 2ページ目", async () => {
        const searchResults = await getSearchResults(
            "",
            ["やってはいけないこと", "対人関係"],
            2,
            "timeDesc"
        );
        searchResultsSchema.parse(searchResults);
        expect(searchResults.results).toHaveLength(10);
        searchResults.results.forEach((result, index) => {
            PostCardDataSchema.parse(result);
            expect(result.postId).toBe(timeDescPostIds[index + 10]);
        })
       })
    test("いいね降順, 1ページ目", async () => {
        const searchResults = await getSearchResults(
            "",
            ["やってはいけないこと", "対人関係"],
            1,
            "like"
        );
        searchResultsSchema.parse(searchResults);
        searchResults.results.forEach((result, index) => {
            PostCardDataSchema.parse(result);
            expect(result.postId).toBe(mostLikedPostIds[index]);
        })
    })
    test("いいね降順, 2ページ目", async () => {
        const searchResults = await getSearchResults(
            "",
            ["やってはいけないこと", "対人関係"],
            2,
            "like"
        );
        searchResultsSchema.parse(searchResults);
        searchResults.results.forEach((result, index) => {
            PostCardDataSchema.parse(result);
            expect(result.postId).toBe(mostLikedPostIds[index + 10]);
        })
    })
    })
    describe("キーワードあり、タグありの場合", async () => {
        const oldestPostIds = await getOldestKeywardPostIdsForTest();
        const latestPostIds = await getLatestKeywardTagPostIdsForTest();
        const mostLikedPosts = await getMostLikedKeywardTagPostIdsForTest();

        test("投稿日昇順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "人 いけない",
                ["コミュニケーション", "やってはいけないこと"],
                1,
                "timeAsc"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.meta.totalCount).toBeGreaterThan(100);
            expect(searchResults.meta.totalCount).toBeLessThan(200);
            expect(searchResults.meta.tags.length).toBeGreaterThan(100);
            expect(searchResults.meta.tags.length).toBeLessThan(200);
            expect(searchResults.meta.tags.filter((tag) => tag.tagName === "コミュニケーション")[0].count).toBe(searchResults.meta.totalCount);
            expect(searchResults.meta.tags.filter((tag) => tag.tagName === "やってはいけないこと")[0].count).toBe(searchResults.meta.totalCount);

            expect(searchResults.results).toHaveLength(10);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(oldestPostIds[index]);
                expect(result.tags.filter((tag) => tag.tagName === "コミュニケーション")).toHaveLength(1);
                expect(result.tags.filter((tag) => tag.tagName === "やってはいけないこと")).toHaveLength(1);
            })
        })
        test("投稿日昇順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "人 いけない",
                ["コミュニケーション", "やってはいけないこと"],
                2,
                "timeAsc"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(oldestPostIds[index + 10]);
            })
        })
        test("投稿日降順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "人 いけない",
                ["コミュニケーション", "やってはいけないこと"],
                1,
                "timeDesc"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(latestPostIds[index]);
            })
        })
        test("投稿日降順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "人 いけない",
                ["コミュニケーション", "やってはいけないこと"],
                2,
                "timeDesc"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(latestPostIds[index + 10]);
            })
        })
        test("いいね降順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "人 いけない",
                ["コミュニケーション", "やってはいけないこと"],
                1,
                "like"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(mostLikedPosts[index]);
            })
        })
        test("いいね降順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "人 いけない",
                ["コミュニケーション", "やってはいけないこと"],
                2,
                "like"
            );
            searchResultsSchema.parse(searchResults);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postId).toBe(mostLikedPosts[index + 10]);
            })
        })
    })
});