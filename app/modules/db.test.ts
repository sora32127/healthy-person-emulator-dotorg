import { expect, test } from "vitest";
import { ArchiveDataEntry, getSearchResults } from "./db.server";

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

test("getSearchResultsが正しいデータを返すこと", async () => {
    // キーワードなし、タグなしの場合
    const q = "";
    const tags: string[] = [];
    const p = 1;
    const orderby = "timeDesc";
    const searchResults = await getSearchResults(
        q,
        tags,
        p,
        orderby
    );
    expect(searchResults.meta.totalCount).toBeGreaterThan(8000);
    expect(searchResults.results).toHaveLength(10);
    const searchResultsKeyWord = await getSearchResults(
        "コミュニケーション",
        [],
        1,
        "timeDesc"
    );
    expect(searchResultsKeyWord.meta.totalCount).toBeGreaterThan(100);

    const searchResultsWithTags = await getSearchResults(
        "",
        ["学生"],
        1,
        "timeDesc"
    );
    expect(searchResultsWithTags.meta.totalCount).toBeGreaterThan(100);
    const searchResultsWithKeywordAndTags = await getSearchResults(
        "コミュニケーション",
        ["学生"],
        1,
        "timeDesc"
    );
    expect(searchResultsWithKeywordAndTags.meta.totalCount).toBeGreaterThan(100);
});
