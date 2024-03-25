import { test, expect } from '@playwright/test';

const localHostUrl = 'http://localhost:5173';

test('has title on TopPage', async ({ page }) => {
  await page.goto(localHostUrl);
  await expect(page).toHaveTitle(/健常者エミュレータ事例集/);
});

test('get feed link', async ({ page }) => {
  await page.goto(localHostUrl);
  await page.getByRole('link', { name: 'Go to the feed' }).click();
  await page.getByRole('link', { name: 'パソコンのキーボードはフロントUSBに刺したほうがいい' }).click();
  await expect(page).toHaveTitle(/パソコンのキーボードはフロントUSBに刺したほうがいい/);
});
