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
  test.describe.configure({ mode: 'serial', retries: 2 });
  test.setTimeout(60000);

  test('テーマ切替ボタンでテーマが切り替わり cookie に保存される', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // ダークに切替
    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // cookie が dark に設定されていること
    const cookies = await page.context().cookies();
    const themeCookie = cookies.find((c) => c.name === 'theme');
    expect(themeCookie).toBeDefined();
    expect(themeCookie!.value).toBe('dark');

    // ライトに戻す
    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const cookiesAfter = await page.context().cookies();
    expect(cookiesAfter.find((c) => c.name === 'theme')!.value).toBe('light');
  });

  test('cookie に dark を設定して開くとダークモードで表示される', async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'theme', value: 'dark', domain: cookieDomain(), path: '/' }]);
    await gotoApp(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('ダークモードでライトに切替できる', async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'theme', value: 'dark', domain: cookieDomain(), path: '/' }]);
    await gotoApp(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.click('[aria-label="テーマ切替"]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === 'theme')!.value).toBe('light');
  });

  test('新規タブでも cookie のテーマが引き継がれる', async ({ context }) => {
    const page1 = await context.newPage();
    await page1
      .context()
      .addCookies([{ name: 'theme', value: 'dark', domain: cookieDomain(), path: '/' }]);
    await gotoApp(page1);
    await expect(page1.locator('html')).toHaveAttribute('data-theme', 'dark');

    const page2 = await context.newPage();
    await gotoApp(page2);
    await expect(page2.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page1.close();
    await page2.close();
  });

  test('SSR レスポンスに cookie のテーマが反映される', async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'theme', value: 'dark', domain: cookieDomain(), path: '/' }]);

    const response = await page.goto('/');
    const html = await response!.text();
    expect(html).toContain('data-theme="dark"');
  });
});
