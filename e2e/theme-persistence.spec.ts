import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://preview.healthy-person-emulator.org';

function cookieDomain(): string {
  return new URL(BASE_URL).hostname;
}

async function gotoApp(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja', { timeout: 30000 });
}

test.describe('テーマ永続化', () => {
  test.setTimeout(60000);

  test('ダークに切替 → リロード → ダーク維持', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 15000 });
  });

  test('ダーク → リロード → ダーク維持 → ライト切替', async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'theme', value: 'dark', domain: cookieDomain(), path: '/' }]);
    await gotoApp(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 15000 });

    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('テーマ切替が cookie に保存される', async ({ page }) => {
    await gotoApp(page);

    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const cookies = await page.context().cookies();
    const themeCookie = cookies.find((c) => c.name === 'theme');
    expect(themeCookie).toBeDefined();
    expect(themeCookie!.value).toBe('dark');

    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const cookiesAfter = await page.context().cookies();
    const themeCookieAfter = cookiesAfter.find((c) => c.name === 'theme');
    expect(themeCookieAfter!.value).toBe('light');
  });

  test('新規タブでもテーマが引き継がれる', async ({ page, context }) => {
    await gotoApp(page);

    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const newPage = await context.newPage();
    await gotoApp(newPage);

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
