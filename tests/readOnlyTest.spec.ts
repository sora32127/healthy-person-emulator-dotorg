import { test, expect, type Page, type Locator } from '@playwright/test';

const testURL = process.env.TEST_URL || 'http://localhost:3000';

// トップページのテスト
test.describe('トップページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(testURL);
  });

  test('ページタイトルが正しく表示されている', async ({ page }) => {
    await expect(page).toHaveTitle(/トップページ/);
  });

  test('最新の投稿セクションに投稿が表示されている', async ({ page }) => {
    const postCount = await page
      .locator('.latest-posts > div > div')
      .count();
    expect(postCount).toBeGreaterThanOrEqual(1);
  });

  test('最近のコメントセクションにコメントが表示されている', async ({
    page,
  }) => {
    const commentCount = await page
      .locator('.recent-comments > div > div')
      .count();
    expect(commentCount).toBeGreaterThanOrEqual(1);
  });

  test('PostCardが正しく表示されている', async ({ page }) => {
    const firstPostCard = page.locator('.latest-posts > div > div').first();
    await verifyPostCard(firstPostCard);
  });

  test('CommentShowCardが正しく表示されている', async ({ page }) => {
    const firstComment = page.locator('.recent-comments > div > div').first();
    await verifyComment(firstComment);
  });
});

// フィードページのテスト
test.describe('フィードページ', () => {
  test('新着順フィードページを閲覧できる', async ({ page }) => {
    await page.goto(testURL);
    await navigateToLatestFeed(page);
    const postCount = await page
      .locator('.feed-posts section > div > div')
      .count();
    expect(postCount).toBeGreaterThanOrEqual(1);
  });

  test('いいね順フィードページを閲覧できる', async ({ page }) => {
    await page.goto(testURL);
    await navigateToLikedFeed(page);
    await expect(page).toHaveTitle(/いいね順/);
  });

  test('新着順・いいね順・無期限いいね順を切り替えられる', async ({ page }) => {
    await page.goto(testURL);
    await navigateToLatestFeed(page);
    await page.getByText('いいね順').nth(0).click();
    await expect(page).toHaveTitle(/いいね順/);
    await page.getByText('新着順').click();
    await expect(page).toHaveTitle(/新着順/);
    await page.getByText('無期限いいね順').click();
    await expect(page).toHaveTitle(/無期限いいね順/);
  });
});

// 寄付ページのテスト
test('寄付ページ', async ({ page }) => {
  await page.goto(`${testURL}/support`);
  await expect(page).toHaveTitle(/サポートする/);
});

// サイト説明ページのテスト
test('サイト説明ページ', async ({ page }) => {
  await page.goto(`${testURL}/readme`);
  await expect(page).toHaveTitle(/サイト説明/);
});

// 記事検索のテスト
test('検索ページを表示できる', async ({ page }) => {
  await page.goto(`${testURL}/search`);
  await expect(page).toHaveTitle(/検索/);
});

// 共通処理の関数化
async function verifyPostCard(postCard: Locator) {
  await verifyElementTextNotEmpty(postCard, '.post-title');
  const postTagCount = await postCard.locator('.post-tag').count();
  expect(postTagCount).toBeGreaterThanOrEqual(1);
}

async function verifyComment(comment: Locator) {
  await verifyElementTextNotEmpty(comment, '.comment-content');
  await verifyElementTextNotEmpty(comment, '.post-title');
}

async function verifyElementTextNotEmpty(locator: Locator, selector: string) {
  const text = await locator.locator(selector).first().textContent();
  expect(text).not.toBe('');
}

async function navigateToLatestFeed(page: Page) {
  await page.getByText('最新の投稿を見る').click();
  await expect(page).toHaveTitle(/新着順/);
}

async function navigateToLikedFeed(page: Page) {
  await page.getByText('最近いいねされた投稿を見る').click();
  await expect(page).toHaveTitle(/いいね順/);
}

