import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

test.describe('homepage', () => {
  test('Auto axe test in TopPage', async ({ page }) => {
    await page.goto(localHostUrl);

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Auto axe test in FeedPage', async ({ page }) => {
    await page.goto(`${localHostUrl}/feed`);

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });


});