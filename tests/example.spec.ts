import { test, expect } from '@playwright/test';

const localHostUrl = 'http://localhost:5173';

test('ユーザーは記事を閲覧できる', async ({ page }) => {
  await page.goto(localHostUrl);
  await expect(page).toHaveTitle(/健常者エミュレータ事例集/);
});
