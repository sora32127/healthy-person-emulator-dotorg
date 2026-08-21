import { test, expect, type Page } from '@playwright/test';

/**
 * サポートページの E2E テスト。
 * 要件:
 *  - 名前とメッセージを残せる
 *  - 金額は自由に選べる
 *  - 金額は表示される
 *  - フォームとして並び、ボタンは「応援する」
 * 加えて、決済セッション生成 API のバリデーションと、Webhook の署名検証（不正拒否）を検証する。
 */

const SUPPORT_URL = '/support';

async function openSupport(page: Page) {
  await page.goto(SUPPORT_URL, { waitUntil: 'networkidle' });
}

test.describe('サポートページ', () => {
  test('応援フォームがフォーム要素として並んで表示される', async ({ page }) => {
    await openSupport(page);

    // フォーム要素
    const form = page.locator('form', { hasText: 'お名前' }).filter({
      hasText: '応援金額',
    });
    await expect(form).toBeVisible();

    // 名前・メッセージ・金額の3項目
    await expect(page.locator('label', { hasText: 'お名前（公開されます）' })).toBeVisible();
    await expect(page.locator('label', { hasText: '応援メッセージ（任意）' })).toBeVisible();
    await expect(page.locator('label', { hasText: '応援金額（円）' })).toBeVisible();

    // 数字を選ぶクイックボタンが存在しない
    await expect(page.locator('button', { hasText: /^¥[0-9,]+$/ })).toHaveCount(0);
  });

  test('応援フォームが応援メッセージ（履歴）より上に表示される', async ({ page }) => {
    await openSupport(page);

    const form = page.locator('form', { hasText: '応援金額' }).first();
    const history = page.locator('p', { hasText: '応援メッセージ（累計' }).first();

    // フォームが履歴よりも DOM 上で先にある
    await expect(form).toBeVisible();
    await expect(history).toBeVisible();
    const formBox = await form.boundingBox();
    const historyBox = await history.boundingBox();
    expect(formBox!.y).toBeLessThan(historyBox!.y);
  });

  test('Stripe下限以上の金額を1円刻みで入力できる', async ({ page }) => {
    await openSupport(page);

    const amountInput = page.locator('input[type="number"]').first();
    await expect(amountInput).toHaveAttribute('min', '50');
    await expect(amountInput).toHaveAttribute('step', '1');

    await page.locator('input[type="text"]').first().fill('E2Eサポーター');
    const submit = page.locator('button[type="submit"]', { hasText: '応援する' });

    await amountInput.fill('51');
    await expect(amountInput).toHaveValue('51');
    await expect(submit).toBeEnabled();

    await amountInput.fill('49');
    await expect(submit).toBeDisabled();
  });

  test('お名前を入れないと応援ボタンが無効', async ({ page }) => {
    await openSupport(page);

    const submit = page.locator('button[type="submit"]', { hasText: '応援する' });
    await expect(submit).toBeDisabled();
  });

  test('お名前と金額を入れると応援ボタンが有効になる', async ({ page }) => {
    await openSupport(page);

    await page.locator('input[type="text"]').first().fill('E2Eサポーター');
    const submit = page.locator('button[type="submit"]', { hasText: '応援する' });
    await expect(submit).toBeEnabled();
  });

  test('表示中の応援メッセージ（累計額）が描画される', async ({ page }) => {
    await openSupport(page);

    // 累計額の表示（例: 応援メッセージ（累計¥...））
    await expect(page.locator('p', { hasText: '応援メッセージ（累計' })).toBeVisible();
    await expect(page.locator('p', { hasText: '応援メッセージ（累計' })).toContainText('¥');
  });
});

test.describe('決済APIのセキュリティ', () => {
  test('未認証（Turnstileなし）では checkout API は 401 を返す', async ({ request }) => {
    const res = await request.post('/api/stripe/support-checkout', {
      form: {
        amountYen: '500',
        supporterName: 'テスト',
        supportMessage: 'こんにちは',
      },
    });
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { success?: boolean };
    expect(body.success).toBe(false);
  });

  test('署名が不正な Webhook は 400 で拒否される', async ({ request }) => {
    const res = await request.post('/api/stripe/webhook', {
      headers: {
        'Stripe-Signature': 't=0,v1=invalid',
        'Content-Type': 'application/json',
      },
      data: {
        id: 'evt_invalid',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_invalid' } },
      },
    });
    expect(res.status()).toBe(400);
  });
});
