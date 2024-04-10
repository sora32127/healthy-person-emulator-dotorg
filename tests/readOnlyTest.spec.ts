import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const testURL = process.env.TEST_URL
if (!testURL) {
    throw new Error("TEST_URLが環境変数に設定されていません");
}


test('ユーザーはトップページを閲覧できる', async ({ page }) => {
  await page.goto(testURL);
  await expect(page).toHaveTitle(/トップページ/);

  // latest-posts
  const latestPostsDiv = page.locator('.latest-posts');
  const latestPostsChildDivs = await latestPostsDiv.locator('> div').count();
  expect(latestPostsChildDivs).toBe(10);

  // recent-voted-posts
  const recentVotedPostsDiv = page.locator('.recent-voted-posts');
  const recentVotedPostsChildDivs = await recentVotedPostsDiv.locator('> div').count();
  expect(recentVotedPostsChildDivs).toBe(10);

  // recent-comments
  const recentCommentsDiv = page.locator('.recent-comments');
  const recentCommentsChildDivs = await recentCommentsDiv.locator('> div').count();
  expect(recentCommentsChildDivs).toBe(10);

  // community-posts
  const communityPostsDiv = page.locator('.community-posts');
  const communityPostsChildDivs = await communityPostsDiv.locator('> div').count();
  expect(communityPostsChildDivs).toBe(24);

  // famed-posts
  const famedPostsDiv = page.locator('.famed-posts');
  const famedPostsChildDivs = await famedPostsDiv.locator('> div').count();
  expect(famedPostsChildDivs).toBe(6);

  // famed-postsを利用し、PostCardが正しく表示されているか確認
  const firstFamedPost = await famedPostsDiv.locator('> div').nth(0);
  const firstFamedPostTimestamp = await firstFamedPost.locator(".post-timestamp").first().textContent();
  expect(firstFamedPostTimestamp).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  const firstFamedPostTitle = await firstFamedPost.locator(".post-title").first().textContent();
  expect(firstFamedPostTitle).not.toBe('');
  const firstFamedPostTags = await firstFamedPost.locator(".post-tag").count();
  expect(firstFamedPostTags).toBeGreaterThan(0);

  // 最新のコメントが正しく表示されているか確認
  const firstRecentComment = await recentCommentsDiv.locator('> div').nth(0);
  const firstRecentCommentTimestamp = await firstRecentComment.locator(".comment-timestamp").first().textContent();
  expect(firstRecentCommentTimestamp).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  const firstRecentCommentAuthor = await firstRecentComment.locator(".comment-author").first().textContent();
  expect(firstRecentCommentAuthor).not.toBe('');
  const firstRecentCommentContent = await firstRecentComment.locator(".comment-content").first().textContent();
  expect(firstRecentCommentContent).not.toBe('');
  const firstRecentCommentPostTitle = await firstRecentComment.locator(".post-title").first().textContent();
  expect(firstRecentCommentPostTitle).not.toBe('');
  

});

test('ユーザーはフィードページを閲覧できる', async ({ page }) => {
  // 新着順フィードページ
  await page.goto(testURL);
  await page.getByText('最新の投稿を見る').click();
  await expect(page).toHaveTitle(/フィード - ページ2/);
  const latestFeedPostCountFirst = await page.locator(".feed-posts").locator("> div").count()
  await expect(latestFeedPostCountFirst).toBe(10);
  await page.getByText('前へ').click();
  await expect(page).toHaveTitle(/フィード - ページ1/);
  const latestFeedPostCountSecond = await page.locator(".feed-posts").locator("> div").count()
  await expect(latestFeedPostCountSecond).toBe(10);
  await page.getByText('次へ').click();
  await expect(page).toHaveTitle(/フィード - ページ2/);
  await page.getByText('次へ').click();
  await expect(page).toHaveTitle(/フィード - ページ3/);

  // いいね順フィードページ
  await page.goto(testURL);
  await page.getByText('最近いいねされた投稿を見る').click();
  await expect(page).toHaveTitle(/いいね順 - 24時間前～0時間前/);
  const likedFeedPostCountFirst = await page.locator(".feed-posts").locator("> div").count()
  await expect(likedFeedPostCountFirst).toBe(10);
  await page.getByText('前へ').click();
  await expect(page).toHaveTitle(/いいね順 - 24時間前～0時間前/);
  const likedFeedPostCountSecond = await page.locator(".feed-posts").locator("> div").count()
  await expect(likedFeedPostCountSecond).toBe(10);
  await page.getByText('次へ').click();
  await expect(page).toHaveTitle(/いいね順 - 24時間前～0時間前/);
  await page.getByText('次へ').click();
  await expect(page).toHaveTitle(/いいね順 - 24時間前～0時間前/);

  // いいね順から新着順に切り替え
  await page.getByText('新着順').click();
  await expect(page).toHaveTitle(/フィード - ページ1/);
  const latestFeedPostCountThird = await page.locator(".feed-posts").locator("> div").count()
  await expect(latestFeedPostCountThird).toBe(10);
  await page.getByText('いいね順').click();
  await expect(page).toHaveTitle(/いいね順 - 24時間前～0時間前/);
  const likedFeedPostCountThird = await page.locator(".feed-posts").locator("> div").count()
  await expect(likedFeedPostCountThird).toBe(10);
});

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