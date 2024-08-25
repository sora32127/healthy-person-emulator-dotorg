import { describe, expect, test } from "vitest";
import { ArchiveDataEntry, getMostLikedKeywardPostIdsForTest, getMostLikedPostTitlesForTest, getMostRecentKeywardPostIdsForTest, getRecentPostTitlesForTest, getSearchResults, PostCardDataSchema, searchResultsSchema } from "./db.server";

/*
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
});
*/
describe("getSearchResultsが正しいデータを返すこと", async () => {
    /*
    - 形式の正しさはparseでチェックする
    - 中身の正しさはtitleでチェックする
    */
   /*
    describe("キーワードなし、タグなしの場合", async () => {
        const timeAscTitles = [
            "就職活動で「本当は働きたくないんですが...」と言ってはいけない",
            "文化祭でゲイポルノビデオ作品を切り貼りしたポスターを作ってはいけない",
            "就職活動で他社の志望度が高いと言ってはならない",
            "人と話す時は目を見てハッキリした声で話した方がよい",
            "親孝行した方がよい",
            "他人との非日常的な食事中に美味しいと感じている旨を伝えなければならない",
            "声が小さいことを指摘された後に最大音量で発声してはならない",
            "「テーマは自由に決めてよい」と言われた場合に本当に自由に決定してはいけない",
            "LINEの返信時には30分以上空けなければならない",
            "他人がケガをした際にまずする話の議題は「ミトコンドリア」ではない",
            "他人のペットの死をジョークにしない",
            "pixiv共有リンクから人のpixivアカウントを特定してはいけない。",
            "なりすまし行為をしてはいけない",
            "ガンを告知された時あのセリフを言ってはいけない",
            "複数の条件をひとつの質問に押し込んではいけない",
            "休憩時間に昼飯も食わず外を歩き回らないほうがいい",
            "感情の根拠を問わない",
            "1人でプリクラを撮って他者にそのプリクラを配ってはいけない",
            "人に突然お金をあげてはいけない",
            "自分のアパートのゴミ捨て場があるのに自治会のゴミ捨て場にゴミを捨ててはいけない",
        ]
        const recentPostTitles = await getRecentPostTitlesForTest();
        const mostLikedPostTitles = await getMostLikedPostTitlesForTest();
        test("時系列昇順, 1ページ目", async () => {

            const searchResults = await getSearchResults(
                "",
                [],
                1,
                "timeAsc"
            );
            searchResultsSchema.parse(searchResults);
            // meta
            expect(searchResults.meta.totalCount).toBeGreaterThan(8000);
            const countOfUnReccommendedTags = searchResults.meta.tags.filter((tag) => tag.tagName === "やってはいけないこと")[0].count;
            expect(countOfUnReccommendedTags).toBeGreaterThanOrEqual(2000);

            // results
            expect(searchResults.results).toHaveLength(10);
            searchResults.results.forEach((result, index) => {
                expect(result.postTitle).toBe(timeAscTitles[index]);
                PostCardDataSchema.parse(result);
            })
        })
        test("時系列昇順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                [],
                2,
                "timeAsc"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.results).toHaveLength(10);
            searchResults.results.forEach((result, index) => {
                expect(result.postTitle).toBe(timeAscTitles[index + 10]);
                PostCardDataSchema.parse(result);
            })
        })
        test("時系列降順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                [],
                1,
                "timeDesc"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.results).toHaveLength(10);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postTitle).toBe(recentPostTitles[index]);
            })
        })
        test("時系列降順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                [],
                2,
                "timeDesc"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.results).toHaveLength(10);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postTitle).toBe(recentPostTitles[index + 10]);
            })
        })
        test("いいね降順, 1ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                [],
                1,
                "like"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.results).toHaveLength(10);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postTitle).toBe(mostLikedPostTitles[index]);
            })
        })
        test("いいね降順, 2ページ目", async () => {
            const searchResults = await getSearchResults(
                "",
                [],
                2,
                "like"
            );
            searchResultsSchema.parse(searchResults);
            expect(searchResults.results).toHaveLength(10);
            searchResults.results.forEach((result, index) => {
                PostCardDataSchema.parse(result);
                expect(result.postTitle).toBe(mostLikedPostTitles[index + 10]);
            })
        })
    })
    */

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
            expect(searchResults.meta.tags.length).toBeGreaterThan(550);
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
});
