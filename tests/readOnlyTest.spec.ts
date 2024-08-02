import { test, expect, Page, Locator } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const testURL = process.env.TEST_URL;
if (!testURL) {
  throw new Error("TEST_URLが環境変数に設定されていません");
}

// トップページのテスト
test.describe('トップページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testURL);
  });

  test('ページタイトルが正しく表示されている', async ({ page }) => {
    await expect(page).toHaveTitle(/トップページ/);
  });

  test('各セクションの要素数が正しい', async ({ page }) => {
    const sections = [
      { name: 'latest-posts > div', expectedCount: 10 },
      { name: 'recent-voted-posts > div', expectedCount: 10 },
      { name: 'recent-comments > div', expectedCount: 10 },
      { name: 'community-posts > div', expectedCount: 24 },
      { name: 'famed-posts > div', expectedCount: 6 },
    ];

    for (const section of sections) {
      await verifyElementCount(page, `.${section.name}`, section.expectedCount);
    }
  });

  test('PostCardが正しく表示されている', async ({ page }) => {
    await verifyPostCard(page.locator('.famed-posts').locator('> div').nth(0));
  });

  test('CommentShowCardが正しく表示されている', async ({ page }) => {
    await verifyComment(page.locator('.recent-comments').locator('> div').nth(0));
  });
});

// フィードページのテスト
test.describe("フィードページ", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testURL);
  });

  test("新着順フィードページを閲覧できる", async ({ page }) => {
    await navigateToLatestFeed(page);
    await verifyElementCount(page, ".feed-posts > div", 10);
    await navigateToPreviousPage(page);
    await expect(page).toHaveTitle(/フィード - ページ1/);
    await verifyElementCount(page, ".feed-posts > div", 10);
    await navigateToNextPage(page);
    await expect(page).toHaveTitle(/フィード - ページ2/);
    await navigateToNextPage(page);
    await verifyPostCard(page.locator('.feed-posts').locator('> div').nth(0));
  });

  test("いいね順フィードページを閲覧できる", async ({ page }) => {
    await navigateToLikedFeed(page);
    await expect(page).toHaveTitle(/いいね順 - 24時間前～0時間前/);
    await verifyElementMinCount(page, ".feed-posts > div", 4);
  });

  test("新着順・いいね順・無期限いいね順を切り替えられる", async ({ page }) => {
    await navigateToLatestFeed(page);
    await page.getByText("いいね順").nth(0).click();
    await expect(page).toHaveTitle(/いいね順 - 24時間前～0時間前/);
    await page.getByText("新着順").click();
    await expect(page).toHaveTitle(/フィード - ページ1/);
    await page.getByText("無期限いいね順").click();
    await expect(page).toHaveTitle(/無期限いいね順 - ページ1/);
    await verifyElementCount(page, ".feed-posts > div", 10);

  });
});

// ランダムページのテスト
test('ランダムページ', async ({ page }) => {
  await page.goto(`${testURL}/random`);
  await expect(page).toHaveTitle(/ランダム記事・コメント/);
  await verifyElementCount(page, ".random-posts > div", 10);
  await verifyElementCount(page, ".random-comments > div", 10);
});

// 寄付ページのテスト
test('寄付ページ', async ({ page }) => {
  await page.goto(`${testURL}/support`);
  await expect(page).toHaveTitle(/サポートする/);
  await page.getByRole('link', { name: 'サポートする' }).nth(1).click();
  await expect(page).toHaveTitle(/contradiction29｜pixivFANBOX/);
});



// サイト説明ページのテスト
test('サイト説明ページ', async ({ page }) => {
  await page.goto(`${testURL}/readme`);
  await expect(page).toHaveTitle(/サイト説明/);
});

// 記事検索のテスト
test.describe('記事検索', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${testURL}/search`);
    await expect(page).toHaveTitle(/検索/);
  });
  /*
  検証項目は以下の通り
  - 一つのタグのみで検索を行う
  - 複数のタグのみで検索を行う
  - キーワードで検索を行う
  - キーワードとタグで検索を行う
  */
  test('一つのタグのみで検索を行う', async ({ page }) => {
    await page.getByPlaceholder("タグを検索...").fill("やっては")
    await page.getByText(/やってはいけないこと/).click();
    await page.getByRole("button", { name: "検索" }).click();
    await verifySearchResults(page, /検索結果 タグ: やってはいけないこと/, 10, 2);
  });

  test('複数のタグのみで検索を行う', async ({ page }) => {
    await page.getByPlaceholder("タグを検索...").fill("やってはいけないこと")
    await page.getByText(/やってはいけないこと/).click();
    await page.getByPlaceholder("タグを検索...").fill("AS")
    await page.getByText(/ASD/).click();
    await page.getByRole("button", { name: "検索" }).click();
    await verifySearchResults(page, /検索結果 タグ: やってはいけないこと, ASD/, 10, 2);
  });

  test('キーワードで検索を行う', async ({ page }) => {
    await page.getByPlaceholder("検索キーワードを入力").fill("Twitter");
    await page.getByRole("button", { name: "検索" }).click();
    await verifySearchResults(page, /検索結果 キーワード: Twitter/, 10, 2);
  });

  test('キーワードとタグで検索を行う', async ({ page }) => {
    await page.getByPlaceholder("検索キーワードを入力").fill("Twitter");
    await page.getByPlaceholder("タグを検索...").fill("やってはいけないこと")
    await page.getByText(/やってはいけないこと/).click();
    await page.getByRole("button", { name: "検索" }).click();
    await verifySearchResults(page, /検索結果 キーワード: Twitter タグ: やってはいけないこと/, 10, 2);
  });
});

// 共通処理の関数化
async function verifyElementCount(page: Page, selector: string, expectedCount: number) {
  const count = await page.locator(selector).count();
  expect(count).toBe(expectedCount);
}

async function verifyElementMinCount(page: Page, selector: string, minCount: number) {
  const count = await page.locator(selector).count();
  expect(count).toBeGreaterThanOrEqual(minCount);
}

async function verifyPostCard(postCard: Locator) {
  await verifyElementTextMatch(postCard, ".post-timestamp", /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  await verifyElementTextNotEmpty(postCard, ".post-title");
  await verifyElementMinCount(postCard, ".post-tag", 1);
}

async function verifyComment(comment: Locator) {
  await verifyElementTextMatch(comment, ".comment-timestamp", /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  await verifyElementTextNotEmpty(comment, ".comment-author");
  await verifyElementTextNotEmpty(comment, ".comment-content");
  await verifyElementTextNotEmpty(comment, ".post-title");
}

async function verifyElementTextMatch(locator: Locator, selector: string, pattern: RegExp) {
  const text = await locator.locator(selector).first().textContent();
  expect(text).toMatch(pattern);
}

async function verifyElementTextNotEmpty(locator: Locator, selector: string) {
  const text = await locator.locator(selector).first().textContent();
  expect(text).not.toBe('');
}

async function navigateToLatestFeed(page: Page) {
  await page.getByText("最新の投稿を見る").click();
  await expect(page).toHaveTitle(/フィード - ページ2/);
}

async function navigateToLikedFeed(page: Page) {
  await page.getByText("最近いいねされた投稿を見る").click();
  await expect(page).toHaveTitle(/いいね順 - 24時間前～0時間前/);
}

async function verifySearchResults(page: Page, titlePattern: RegExp, expectedCount: number, maxPage: number) {
  await expect(page).toHaveTitle(titlePattern);
  await verifyElementCount(page, ".search-results > div", expectedCount);

  for (let i = 2; i <= maxPage; i++) {
    await navigateToNextPage(page);
    await expect(page).toHaveTitle(titlePattern);
    await verifyElementCount(page, ".search-results > div", expectedCount);
  }

  await navigateToPreviousPage(page);
  await expect(page).toHaveTitle(titlePattern);
}

async function navigateToNextPage(page: Page) {
  await page.getByText('次へ').click();
}

async function navigateToPreviousPage(page: Page) {
  await page.getByText('前へ').click();
}