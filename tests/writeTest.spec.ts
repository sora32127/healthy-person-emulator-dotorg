import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const testURL = process.env.TEST_URL
if (!testURL) {
    throw new Error("TEST_URLが環境変数に設定されていません");
}

test('ユーザーはテンプレートから記事を投稿できる', async ({ page }) => {
  await page.goto(`${testURL}/post`);
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
  await page.goto(`${testURL}/post`);
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
  await page.goto(`${testURL}`);
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

test("ユーザーは記事に対していいね・よくないねをすることができる", async ({ page }) => {
  await page.goto(`${testURL}`);
  const todaysDate = new Date().toISOString().split('T')[0];
  const postName = `プログラムテスト-MG-1-${todaysDate}-編集後`
  await page.getByText(postName).click();
  await expect(page).toHaveTitle(postName);

  // いいねをする いいね数が増えること、一回しかいいねできないことを確認
  await page.getByRole('button', { name: 'Like 0', exact: true }).click();
  await page.getByRole('button', { name: 'Like 1', exact: true }).click();
  await page.getByRole('button', { name: 'Like 1', exact: true }).click();

  await page.getByRole('button', { name: 'Dislike 0', exact: true }).click();
  await page.getByRole('button', { name: 'Dislike 1', exact: true }).click();
  await page.getByRole('button', { name: 'Dislike 1', exact: true }).click();
  await expect(page).toHaveTitle(postName);

});

test("ユーザーは記事にコメントし、コメントに対していいね・よくないねができる", async ({ page }) => {
  await page.goto(`${testURL}`);
  const todaysDate = new Date().toISOString().split('T')[0];
  const postName = `プログラムテスト-MG-1-${todaysDate}-編集後`
  await page.getByText(postName).click();
  await expect(page).toHaveTitle(postName);


  await page.getByLabel('コメント').fill('Test Comment');
  await page.getByRole('button', { name: 'コメント' }).click();
  await expect(page).toHaveTitle(postName);

  
  await page.getByRole('button', { name: 'Like 0', exact: true }).click();
  await page.getByRole('button', { name: 'Like 1', exact: true }).click();
  await page.getByRole('button', { name: 'Like 1', exact: true }).click();

  await page.getByRole('button', { name: 'Dislike 0', exact: true }).click();
  await page.getByRole('button', { name: 'Dislike 1', exact: true }).click();
  await page.getByRole('button', { name: 'Dislike 1', exact: true }).click();
  await expect(page).toHaveTitle(postName);
});
