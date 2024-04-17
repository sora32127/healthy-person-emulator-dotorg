import { test, expect, Page, Locator } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const testURL = process.env.TEST_URL
if (!testURL) {
    throw new Error("TEST_URLが環境変数に設定されていません");
}


test.describe('ユーザーはトップページを閲覧できる', () => {
  test('トップページが正しく表示されている', async ({ page }) => {
    await page.goto(testURL);
    await expect(page).toHaveTitle(/トップページ/);
  });
  test('各セクションの要素数が正しい', async ({ page }) => {
    await page.goto(testURL);
    await expect(page).toHaveTitle(/トップページ/);
    
    const sections = [
      { name: 'latest-posts', expectedCount: 10 },
      { name: 'recent-voted-posts', expectedCount: 10 },
      { name: 'recent-comments', expectedCount: 10 },
      { name: 'community-posts', expectedCount: 24 },
      { name: 'famed-posts', expectedCount: 6 },
    ];
  
    for (const section of sections) {
      const sectionDiv = page.locator(`.${section.name}`);
      const childDivs = await sectionDiv.locator('> div').count();
      expect(childDivs).toBe(section.expectedCount);
    }
  });

  test('PostCardが正しく表示されている', async ({ page }) => {
    await page.goto(testURL);
    await verifyPostCard(page.locator('.famed-posts').locator('> div').nth(0));
  });

  test('CommentShowCardが正しく表示されている', async ({ page }) => {
    await page.goto(testURL);
    await verifyComment(page.locator('.recent-comments').locator('> div').nth(0));
  });
});

async function verifyPostCard(postCard: Locator) {
  const timestamp = await postCard.locator(".post-timestamp").first().textContent();
  expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);

  const title = await postCard.locator(".post-title").first().textContent();
  expect(title).not.toBe('');

  const tags = await postCard.locator(".post-tag").count();
  expect(tags).toBeGreaterThan(0);
}

async function verifyComment(comment: Locator) {
  const timestamp = await comment.locator(".comment-timestamp").first().textContent();
  expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);

  const author = await comment.locator(".comment-author").first().textContent();
  expect(author).not.toBe('');

  const content = await comment.locator(".comment-content").first().textContent();
  expect(content).not.toBe('');

  const postTitle = await comment.locator(".post-title").first().textContent();
  expect(postTitle).not.toBe('');
}


test.describe("ユーザーはフィードページを閲覧できる", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testURL)
  });

  test("新着順フィードページを閲覧できる", async ({ page }) => {
    await page.getByText("最新の投稿を見る").click();
    await expect(page).toHaveTitle(/フィード - ページ2/);
    await verifyPostCard(page.locator(".feed-posts").locator("> div").nth(0));
    const latestFeedPostCountFirst = await page.locator(".feed-posts").locator("> div").count();
    await expect(latestFeedPostCountFirst).toBe(10);
    await page.getByText("前へ").click();
    await expect(page).toHaveTitle(/フィード - ページ1/);
    const latestFeedPostCountSecond = await page.locator(".feed-posts").locator("> div").count();
    await expect(latestFeedPostCountSecond).toBe(10);
    await page.getByText("次へ").click();
    await expect(page).toHaveTitle(/フィード - ページ2/);
    await page.getByText("次へ").click();
    await expect(page).toHaveTitle(/フィード - ページ3/);
  });

  test("いいね順フィードページを閲覧できる", async ({ page }) => {
    await page.getByText("最近いいねされた投稿を見る").click();
    await expect(page).toHaveTitle(/いいね順 - 24時間前～0時間前/);
    const likedFeedPostCountFirst = await page.locator(".feed-posts").locator("> div").count();
    await expect(likedFeedPostCountFirst).toBeGreaterThanOrEqual(4);
  });

  test("新着順といいね順を切り替えられる", async ({ page }) => {
    await page.getByText("最新の投稿を見る").click();
    await expect(page).toHaveTitle(/フィード - ページ2/);
    await page.getByText("いいね順").click();
    await expect(page).toHaveTitle(/いいね順 - 24時間前～0時間前/);
    await page.getByText("新着順").click();
    await expect(page).toHaveTitle(/フィード - ページ1/);
  });


})

test('ユーザーはランダムページを閲覧できる', async ({ page }) => {
  await page.goto(`${testURL}/random`);
  await expect(page).toHaveTitle(/ランダム記事・コメント/);
  const randomPostsCount = await page.locator(".random-posts").locator("> div").count();
  await expect(randomPostsCount).toBe(10);
  const randomCommentsCount = await page.locator(".random-comments").locator("> div").count();
  await expect(randomCommentsCount).toBe(10);
});

test('ユーザーは記事を検索できる', async ({ page }) => {
  await page.goto(`${testURL}/search`);
  await expect(page).toHaveTitle(/検索/);
  await page.getByRole('combobox').selectOption('tag');

  // タグ検索 - 一つのタグで検索
  await page.getByPlaceholder('タグを入力').click();
  await page.getByPlaceholder('タグを入力').fill('T');
  await page.getByText(/Twitter/).click();
  await page.getByRole('button', { name: '検索' }).click();
  await expect(page).toHaveTitle(/タグ検索: Twitter/);
  const SearchResultTagCountFirst = await page.locator(".search-results").locator("> div").count();
  await expect(SearchResultTagCountFirst).toBe(10);
  await page.getByText('次へ').click();
  await expect(page).toHaveTitle(/タグ検索: Twitter/);
  const SearchResultTagCountSecond = await page.locator(".search-results").locator("> div").count();
  await expect(SearchResultTagCountSecond).toBe(10);
  await page.getByText('前へ').click();
  await expect(page).toHaveTitle(/タグ検索: Twitter/);

  // タグ検索 - 複数のタグで検索
  await page.goto(`${testURL}/search`);
  await expect(page).toHaveTitle(/検索/);
  await page.getByRole('combobox').selectOption('tag');
  await page.getByPlaceholder('タグを入力').click();
  await page.getByPlaceholder('タグを入力').fill('T');
  await page.getByText(/Twitter/).click();
  await page.getByPlaceholder('タグを入力').click();
  await page.getByPlaceholder('タグを入力').fill('やらないほ');
  await page.getByText(/やらないほうがよいこと/).click();
  await page.getByRole('button', { name: '検索' }).click();
  await expect(page).toHaveTitle(/タグ検索: Twitter, やらないほうがよいこと/);
  const SearchResultTagCountThird = await page.locator(".search-results").locator("> div").count();
  await expect(SearchResultTagCountThird).toBe(10);
  await page.getByText('次へ').click();
  await expect(page).toHaveTitle(/タグ検索: Twitter, やらないほうがよいこと/);
  const SearchResultTagCountFourth = await page.locator(".search-results").locator("> div").count();
  await expect(SearchResultTagCountFourth).toBe(10);

  // 全文検索
  await page.goto(`${testURL}/search`);
  await expect(page).toHaveTitle(/検索/);
  await page.getByRole('combobox').selectOption('fullText');
  await page.getByPlaceholder('検索キーワードを入力').click();
  await page.getByPlaceholder('検索キーワードを入力').fill('ASD');
  await page.getByRole('button', { name: '検索' }).click();
  await expect(page).toHaveTitle(/全文検索: ASD/);
  const SearchResultFullTextCountFirst = await page.locator(".search-results").locator("> div").count();
  await expect(SearchResultFullTextCountFirst).toBe(10);
  await page.getByText('次へ').click();
  await expect(page).toHaveTitle(/全文検索: ASD/);
  const SearchResultFullTextCountSecond = await page.locator(".search-results").locator("> div").count();
  await expect(SearchResultFullTextCountSecond).toBe(10);

  // タイトル検索
  await page.goto(`${testURL}/search`);
  await expect(page).toHaveTitle(/検索/);
  await page.getByRole('combobox').selectOption('title');
  await page.getByPlaceholder('タイトルを入力').click();
  await page.getByPlaceholder('タイトルを入力').fill('Twitter');
  await page.getByRole('button', { name: '検索' }).click();
  await expect(page).toHaveTitle(/タイトル検索: Twitter/);
  const SearchResultTitleCountFirst = await page.locator(".search-results").locator("> div").count();
  await expect(SearchResultTitleCountFirst).toBe(10);
  await page.getByText('次へ').click();
  await expect(page).toHaveTitle(/タイトル検索: Twitter/);
  const SearchResultTitleCountSecond = await page.locator(".search-results").locator("> div").count();
  await expect(SearchResultTitleCountSecond).toBe(10);
});

test('ユーザーは寄付ページを閲覧できる', async ({ page }) => {
  await page.goto(`${testURL}/support`);
  await expect(page).toHaveTitle(/サポートする/);
  await page.getByRole('button', { name: 'サポートする' }).click();
  await expect(page).toHaveTitle(/KENJOUSYA emulator/);
});

test('ユーザーはサイト説明ページを閲覧できる', async ({ page }) => {
  await page.goto(`${testURL}/readme`);
  await expect(page).toHaveTitle(/サイト説明/);
});