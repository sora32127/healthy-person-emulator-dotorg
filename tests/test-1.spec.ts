import { test, expect } from '@playwright/test';

const localHostUrl = 'http://localhost:5173';

test('ユーザーは記事を閲覧できる', async ({ page }) => {
  await page.goto(localHostUrl);
  await expect(page).toHaveTitle(/トップページ/);
  await page.getByRole('link', { name: '「何が楽しくて生きてるの」と言われた時につまらない毎日の中の辛うじて楽しい出来事について熱弁してはいけない' }).first().click();
  await page.getByRole('link', { name: '力強い音楽を聞くと良い' }).click();
  await page.getByRole('link', { name: '自己批判は大事' }).click();
  await page.getByRole('link', { name: 'シャンプーとコンディショナーを間違えるな' }).click();
  await page.getByRole('link', { name: 'メンタルクリニックだとしてもはっきりと物事を伝えるべきでは無い' }).click();
  await page.getByRole('link', { name: 'フィード フィード' }).click();
  await page.getByRole('link', { name: '最新の投稿を見る' }).click();
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('button', { name: '最後' }).click();
  await page.getByRole('link', { name: 'フィード フィード' }).click();
  await page.getByRole('link', { name: 'ペペロンチーノに載っている唐辛子は食べなくても良い' }).click();
  
  await page.getByRole('link', { name: 'フィード フィード' }).click();
  await page.getByRole('link', { name: '最近いいねされた投稿を見る' }).click();
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('link', { name: 'フィード フィード' }).click();
  await page.getByRole('link', { name: 'ランダム ランダム' }).click();

  await page.getByRole('link', { name: 'ランダム ランダム' }).click();
  await page.getByRole('link', { name: '夜職に詳しいムーブはするべきではない' }).click();
  await page.getByRole('link', { name: '検索 検索' }).click();
  await page.getByPlaceholder('タグを入力').click();
  await page.getByPlaceholder('タグを入力').fill('Tw');
  await page.getByText('Twitter (154)').click();
  await page.getByPlaceholder('タグを入力').click();
  await page.getByPlaceholder('タグを入力').fill('Ins');
  await page.getByText('Instagram (11)').click();
  await page.getByRole('button', { name: '検索' }).click();
  await page.getByRole('link', { name: 'Twitterのフォロワーに対して荒らしてはならない' }).click();
  await page.getByRole('link', { name: '検索 検索' }).click();
  await page.getByRole('combobox').selectOption('fullText');
  await page.getByPlaceholder('検索キーワードを入力').click();
  await page.getByPlaceholder('検索キーワードを入力').fill('Twitter');
  await page.getByRole('button', { name: '検索' }).click();
  await page.getByRole('button', { name: '検索' }).click();
  await page.getByRole('combobox').selectOption('title');
  await page.getByPlaceholder('タイトルを入力').click();
  await page.getByRole('button', { name: '検索' }).click();
  await page.getByRole('link', { name: 'Twitter上で高額な個人間取引を行うべきではない' }).click();
  await page.getByRole('link', { name: 'ガイドライン ガイドライン' }).click();
  await page.getByRole('link', { name: '寄付する 寄付する' }).click();
  await page.getByRole('link', { name: 'サポートする' }).click();
});