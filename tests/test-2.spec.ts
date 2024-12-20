import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.locator('a > .btn').click();
  await page.getByLabel('結果善：').check();
  await page.getByLabel('結果悪：').check();
  await page.getByLabel('結果善：').check();
});