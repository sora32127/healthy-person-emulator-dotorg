import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const localHostUrl = 'http://localhost:5173';

test('ユーザーはトップページを閲覧できる', async ({ page }) => {
  await page.goto(localHostUrl);
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
  await page.goto(localHostUrl);
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
  await page.goto(localHostUrl);
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
  await page.goto(`${localHostUrl}/random`);
  await expect(page).toHaveTitle(/ランダム記事・コメント/);
  const randomPostsCount = await page.locator(".random-posts").locator("> div").count();
  await expect(randomPostsCount).toBe(10);
  const randomCommentsCount = await page.locator(".random-comments").locator("> div").count();
  await expect(randomCommentsCount).toBe(10);
});

test('ユーザーは記事を検索できる', async ({ page }) => {
  await page.goto(`${localHostUrl}/search`);
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
  await page.goto(`${localHostUrl}/search`);
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
  await page.goto(`${localHostUrl}/search`);
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
  await page.goto(`${localHostUrl}/search`);
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
  await page.goto(`${localHostUrl}/beSponsor`);
  await expect(page).toHaveTitle(/スポンサーになる/);
  await page.getByRole('button', { name: 'サポートする' }).click();
  await expect(page).toHaveTitle(/KENJOUSYA emulator/);
});

test('ユーザーはガイドラインページを閲覧できる', async ({ page }) => {
  await page.goto(`${localHostUrl}/readme`);
  await expect(page).toHaveTitle(/ガイドライン/);
});

test('ユーザーはテンプレートから記事を投稿できる', async ({ page }) => {
  await page.goto(`${localHostUrl}/post`);
  await expect(page).toHaveTitle(/投稿/);

  // 最小限の要素を入力して投稿 * 結果悪 * タグ作成なし
  await page.getByText("結果悪").click();
  await page.getByLabel("Who").fill('S1');
  await page.locator(".健常行動ブレイクポイント-0").fill('R1');
  await page.locator(".どうすればよかったか-0").fill('CR1');
  await page.locator(".タイトル-0").fill('プログラムテスト-SB-1');
  await page.getByRole('button', { name: '投稿する' }).click();
  await expect(page).toHaveTitle(/プログラムテスト-SB-1/);

  // 最大限の要素を入力して投稿 * 結果善 * タグ作成あり
  await page.goto(`${localHostUrl}/post`);
  await expect(page).toHaveTitle(/投稿/);
  await page.getByText("結果善").click();
  await page.getByLabel("Who").fill('S1');
  await page.getByLabel("When").fill('S2');
  await page.getByLabel("Where").fill('S3');
  await page.getByLabel("Why").fill('S4');
  await page.getByLabel("What").fill('S5');
  await page.getByLabel("How").fill('S6');
  await page.getByLabel("Then").fill('S7');

  await page.getByText("テキスト入力を追加").click();
  await page.locator('#input-0').fill('A1');
  await page.getByText("テキスト入力を追加").click();
  await page.locator('#input-1').fill('A2');
  await page.getByText("テキスト入力を追加").click();
  await page.locator('#input-2').fill('A3');

  await page.locator(".なぜやってよかったのか-0").fill('R1');
  await page.locator(".なぜやってよかったのか-1").fill('R2');
  await page.locator(".なぜやってよかったのか-2").fill('R3');

  await page.locator(".やらなかったらどうなっていたか-0").fill('CR1');
  await page.locator(".やらなかったらどうなっていたか-1").fill('CR2');
  await page.locator(".やらなかったらどうなっていたか-2").fill('CR3');

  await page.locator(".備考-0").fill('N1');
  await page.locator(".備考-1").fill('N2');
  await page.locator(".備考-2").fill('N3');


  await page.getByText(/やってはいけないこと/).click();
  await page.getByText(/T.M.Revolution/).click();
  await page.getByText(/やったほうがよいこと/).click();
  const todaysDate = new Date().toISOString().split('T')[0];

  await page.locator(".タイトル-0").fill(`プログラムテスト-MG-1-${todaysDate}`);
  await page.locator(".tag-create-box-input").fill(`タグ作成テスト-${todaysDate}`);
  await page.getByText('タグを作成').click();

  await page.getByRole('button', { name: '投稿する' }).click();

  await expect(page).toHaveTitle(`プログラムテスト-MG-1-${todaysDate}`);

});

test("ユーザーはログインして記事を編集できる", async ({ page }) => {
  await page.goto(`${localHostUrl}`);
  const todaysDate = new Date().toISOString().split('T')[0];
  const postName = `プログラムテスト-MG-1-${todaysDate}`
  await page.getByText(postName).click();
  await expect(page).toHaveTitle(postName);

  // サインインしていない状態で編集できないことを確認する
  await page.getByText('編集する').click();
  await expect(page).toHaveTitle(/ログイン/);

  // サインインできることを確認する
  const loginTestEmail = process.env.LOGIN_TEST_EMAIL;
  const loginTestPassword = process.env.LOGIN_TEST_PASSWORD;
  if (!loginTestEmail || !loginTestPassword) {
    throw new Error("ログイン情報が環境変数に設定されていません");
  }
  await page.getByLabel("メールアドレス:").fill(loginTestEmail);
  await page.getByLabel("パスワード:").fill(loginTestPassword);
  await page.getByRole('button', { name: 'ログイン' }).click();

  // 編集ページに移動できることを確認する
  await expect(page).toHaveTitle(/編集/);

  // タイトル・タグ・本文をすべて編集する
  const newPostName = `プログラムテスト-MG-1-${todaysDate}-編集後`;
  await page.locator(".edit-post-title").clear();
  await page.locator(".edit-post-title").fill(newPostName);

  await page.locator(".edit-tag-search-input").fill("Twi")
  await page.getByText(/Twitter/).click();
  await page.locator(".edit-tag-remove-button").nth(1).click();

  await page.locator(".w-md-editor-text-input").clear();
  await page.locator(".w-md-editor-text-input").fill("本文を編集しました");

  // 編集を完了する
  await page.locator(".edit-post-submit-button").click();
  await expect(page).toHaveTitle(newPostName);
});