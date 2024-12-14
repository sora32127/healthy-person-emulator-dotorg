import { test, expect, Page } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config();

const testURL = process.env.TEST_URL;
if (!testURL) {
  throw new Error("TEST_URLが環境変数に設定されていません");
}

const nowDateTime = new Date().toISOString();
test.describe.configure({ retries: 2 });

test.describe('投稿フォームのテスト', () => {
  test.setTimeout(30000);

  test.beforeEach(async ({ page }) => {
    await page.goto(`${testURL}/post`);
    await expect(page).toHaveTitle(/投稿/);
  });

  test('最小限の要素を入力して投稿 * 結果悪', async ({ page }) => {
    // 投稿タイプの選択
    await page.getByRole('radio', { name: '結果悪：' }).click();

    // 5W1H+Thenの入力
    await page.getByLabel(/その状況の「主役」は誰ですか？/).fill('テストユーザーが');
    await page.getByLabel(/いつ起こったことですか？/).fill('昨日');
    await page.getByLabel(/どこで起こったことですか？/).fill('公園で');
    await page.getByLabel(/なぜそのような行動をしたのですか？/).fill('面白そうだったから');
    await page.getByLabel(/その主役は、何に対してはたらきかけましたか？/).fill('友人に');
    await page.getByLabel(/その主役は、対象をどうしましたか？/).fill('冗談を言った');
    await page.getByLabel(/行動の結果としてどうなりましたか？/).fill('空気が悪くなった');

    // 健常行動ブレイクポイントの入力（最低1つ必要）
    await page.getByPlaceholder('友人の言動は冗談だという事に気が付く必要があった').fill('相手の気持ちを考えていなかった');

    // どうすればよかったかの入力（最低1つ必要）
    await page.getByPlaceholder('冗談に対してただ笑うべきだった').fill('黙っているべきだった');

    // タイトルの入力
    await page.getByRole('textbox').last().fill(`プログラムテスト-${nowDateTime}`);

    // 投稿ボタンのクリック
    await page.getByRole('button', { name: '投稿する' }).click();

    // プレビューモーダルの確認
    await expect(page.locator('.modal').nth(0)).toBeVisible();
    await page.getByRole('button', { name: '投稿する' }).last().click();

    // 投稿完了後の遷移確認
    await expect(page).toHaveURL(/\/archives\/\d+/);
  });

  test('最大限の要素を入力して投稿 * 結果善', async ({ page }) => {
    // 投稿タイプの選択
    await page.getByRole('radio', { name: '結果善：' }).click();

    // 5W1H+Thenの入力
    await page.getByLabel(/その状況の「主役」は誰ですか？/).fill('テストユーザーが');
    await page.getByLabel(/いつ起こったことですか？/).fill('昨日');
    await page.getByLabel(/どこで起こったことですか？/).fill('家で');
    await page.getByLabel(/なぜそのような行動をしたのですか？/).fill('相手のことを考えて');
    await page.getByLabel(/その主役は、何に対してはたらきかけましたか？/).fill('同居人が作ってくれる料理について');
    await page.getByLabel(/その主役は、対象をどうしましたか？/).fill('感謝の言葉を伝えた');
    await page.getByLabel(/行動の結果としてどうなりましたか？/).fill('関係が良好になった');

    // 前提条件の追加
    await page.getByRole('button', { name: '追加' }).click();
    await page.getByRole('textbox').first().fill('同居人は以前から料理を作ってくれていた');

    // なぜやってよかったのかの入力（最低1つ必要）
    await page.getByPlaceholder(/一般的に料理とは手間のかかる作業であり/).fill('感謝の気持ちを伝えることで関係が深まる');
    await page.getByPlaceholder(/敬意はコミュニケーションに対して/).fill('相手も嬉しそうだった');

    // やらなかったらどうなっていたかの入力（最低1つ必要）
    await page.getByPlaceholder(/相手がかけた手間に対して敬意をわないことは/).fill('関係が希薄になっていた');
    await page.getByPlaceholder(/関係が改善されることはなく/).fill('相手も不安になっていた');

    // 備考の入力
    await page.getByPlaceholder(/舌が過度に肥えてしまい/).fill('その後も良好な関係が続いている');

    // タイトルの入力
    await page.getByRole('textbox').last().fill(`プログラムテスト-${nowDateTime}`);

    // 投稿ボタンのクリック
    await page.getByRole('button', { name: '投稿する' }).click();

    // プレビューモーダルの確認
    await expect(page.locator('.modal').nth(0)).toBeVisible();
    await page.getByRole('button', { name: '投稿する' }).last().click();

    // 投稿完了後の遷移確認
    await expect(page).toHaveURL(/\/archives\/\d+/);
  });

  test('必須項目が未入力の場合はエラーが表示される', async ({ page }) => {
    await page.getByRole('button', { name: '投稿する' }).click();
    await expect(page.getByText('5W1H+Then状況説明>「誰が」は必須です')).toBeVisible();
  });

  test('反省/良かった点の入力が全て空の場合はエラーが表示される', async ({ page }) => {
    // 投稿タイプの選択と5W1H+Thenの入力
    await page.getByRole('radio', { name: '結果悪：' }).click();
    await page.getByLabel(/その状況の「主役」は誰ですか？/).fill('テストユーザーが');
    await page.getByLabel(/いつ起こったことですか？/).fill('昨日');
    await page.getByLabel(/どこで起こったことですか？/).fill('公園で');
    await page.getByLabel(/なぜそのような行動をしたのですか？/).fill('面白そうだったから');
    await page.getByLabel(/その主役は、何に対してはたらきかけましたか？/).fill('友人に');
    await page.getByLabel(/その主役は、対象をどうしましたか？/).fill('冗談を言った');
    await page.getByLabel(/行動の結果としてどうなりましたか？/).fill('空気が悪くなった');

    // タイトルだけ入力
    await page.getByRole('textbox').last().fill(`プログラムテスト-${nowDateTime}`);

    await page.getByRole('button', { name: '投稿する' }).click();
    await expect(page.getByText('「健常行動ブレイクポイント」もしくは「なぜやってよかったのか」は最低一つ入力してください')).toBeVisible();
    await expect(page.getByText('「どうすればよかったか」もしくは「やらなかったらどうなっていたか」は最低一つ入力してください')).toBeVisible();
  });

  test('タイトルに#を含める場合はエラーが表示される', async ({ page }) => {
    // 必須項目を入力
    await page.getByRole('radio', { name: '結果悪：' }).click();
    await page.getByLabel(/その状況の「主役」は誰ですか？/).fill('テストユーザーが');
    await page.getByLabel(/いつ起こったことですか？/).fill('昨日');
    await page.getByLabel(/どこで起こったことですか？/).fill('公園で');
    await page.getByLabel(/なぜそのような行動をしたのですか？/).fill('面白そうだったから');
    await page.getByLabel(/その主役は、何に対してはたらきかけましたか？/).fill('友人に');
    await page.getByLabel(/その主役は、対象をどうしましたか？/).fill('冗談を言った');
    await page.getByLabel(/行動の結果としてどうなりましたか？/).fill('空気が悪くなった');
    await page.getByPlaceholder('友人の言動は冗談だという事に気が付く必要があった').fill('相手の気持ちを考えていなかった');
    await page.getByPlaceholder('冗談に対してただ笑うべきだった').fill('黙っているべきだった');

    // タイトルに#を含める
    await page.getByRole('textbox').last().fill('#プログラムテスト');

    await page.getByRole('button', { name: '投稿する' }).click();
    await expect(page.getByText('タイトルに「#」（ハッシュタグ）を含めることはできません。')).toBeVisible();
  });

  test('フォームをクリアできる', async ({ page }) => {
    // いくつかの要素を入力
    await page.getByRole('radio', { name: '結果悪：' }).click();
    await page.getByLabel(/その状況の「主役」は誰ですか？/).fill('テストユーザーが');
    
    // クリアボタンをクリック
    await page.getByRole('button', { name: 'フォームをクリアする' }).click();
    await page.getByRole('button', { name: 'はい' }).click();

    // 入力がクリアされていることを確認
    await expect(page.getByLabel(/その状況の「主役」は誰ですか？/)).toHaveValue('');
  });
});