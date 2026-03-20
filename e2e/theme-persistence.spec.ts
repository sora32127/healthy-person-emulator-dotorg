import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://preview.healthy-person-emulator.org';

function cookieDomain(): string {
  return new URL(BASE_URL).hostname;
}

async function gotoAndWaitForApp(page: Page, path = '/') {
  await page.goto(path);
  await page.waitForSelector('html[lang="ja"]', { timeout: 15000 });
}

test.describe('テーマ永続化', () => {
  test.setTimeout(60000);

  test('ダークに切替 → リロード → ダーク維持', async ({ page }) => {
    await gotoAndWaitForApp(page);

    // ライトモードがデフォルト
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // テーマ切替ボタンをクリック
    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // リロード
    await page.reload();
    await page.waitForSelector('html[lang="ja"]', { timeout: 15000 });

    // ダークが維持されること
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('ダーク → リロード → ダーク維持 → ライト切替', async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'theme', value: 'dark', domain: cookieDomain(), path: '/' }]);
    await gotoAndWaitForApp(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // リロード後もダーク維持
    await page.reload();
    await page.waitForSelector('html[lang="ja"]', { timeout: 15000 });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // テーマ切替ボタンでライトに切替
    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('テーマ切替が cookie に保存される', async ({ page }) => {
    await gotoAndWaitForApp(page);

    // ダークに切替
    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // cookie が設定されていること
    const cookies = await page.context().cookies();
    const themeCookie = cookies.find((c) => c.name === 'theme');
    expect(themeCookie).toBeDefined();
    expect(themeCookie!.value).toBe('dark');

    // もう一度切替
    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const cookiesAfter = await page.context().cookies();
    const themeCookieAfter = cookiesAfter.find((c) => c.name === 'theme');
    expect(themeCookieAfter!.value).toBe('light');
  });

  test('新規タブでもテーマが引き継がれる', async ({ page, context }) => {
    await gotoAndWaitForApp(page);

    // ダークに切替
    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // 同じコンテキスト内で新しいページを開く（新規タブ相当）
    const newPage = await context.newPage();
    await gotoAndWaitForApp(newPage);

    // 新しいタブでもダークが適用されること
    await expect(newPage.locator('html')).toHaveAttribute('data-theme', 'dark');

    await newPage.close();
  });

  test('SSR時にcookieからテーマが正しく設定される', async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'theme', value: 'dark', domain: cookieDomain(), path: '/' }]);

    const response = await page.goto('/');
    const html = await response!.text();

    expect(html).toContain('data-theme="dark"');
  });
});
