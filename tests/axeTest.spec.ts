import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const testURL = process.env.TEST_URL || 'http://localhost:3000';

import chalk from 'chalk';

async function getAxeResults(page: Page) {
 await page.getByLabel('ダークモード').uncheck();
 const [accessibilityScanResultsLightMode] = await Promise.all([
   new AxeBuilder({ page }).analyze(),
 ]);
 const violationsLightMode = accessibilityScanResultsLightMode.violations.filter(
   (x) => x.impact === 'critical' || x.impact === 'serious'
 );

 console.log(chalk.bold('Light Mode Accessibility Results:'));
 if (violationsLightMode.length === 0) {
   console.log(chalk.green('No critical or serious violations found in light mode.'));
 } else {
   console.log(chalk.red(`Found ${violationsLightMode.length} critical or serious violations in light mode:`));
   violationsLightMode.forEach((violation, index) => {
     console.log(chalk.red(`${index + 1}. ${violation.description}`));
   });
 }

 console.log('');

 await page.getByLabel('ダークモード').check();
 const [accessibilityScanResultsDarkMode] = await Promise.all([
   new AxeBuilder({ page }).analyze(),
 ]);
 const violationsDarkMode = accessibilityScanResultsDarkMode.violations.filter(
   (x) => x.impact === 'critical' || x.impact === 'serious'
 );

 console.log(chalk.bold('Dark Mode Accessibility Results:'));
 if (violationsDarkMode.length === 0) {
   console.log(chalk.green('No critical or serious violations found in dark mode.'));
 } else {
   console.log(chalk.red(`Found ${violationsDarkMode.length} critical or serious violations in dark mode:`));
   violationsDarkMode.forEach((violation, index) => {
     console.log(chalk.red(`${index + 1}. ${violation.description}`));
   });
 }

 expect(violationsLightMode).toEqual([]);
 expect(violationsDarkMode).toEqual([]);
}

test.describe('自動アクセシビリティチェック', () => {
  /*
  ランダムページは実質トップページと同じなので省略
  */
  test('トップページ', async ({ page }) => {
    await page.goto(testURL);
    await getAxeResults(page);
  })
  test('フィードページ', async ({ page }) => {
    await page.goto(`${testURL}/feed?p=2`);
    await getAxeResults(page);
  })
  test('投稿ページ', async ({ page }) => {
    await page.goto(`${testURL}/post`);
    await getAxeResults(page);
  })
  test('検索ページ', async ({ page }) => {
    await page.goto(`${testURL}/search`);
    await getAxeResults(page);
  })
  test('サポートページ', async ({ page }) => {
    await page.goto(`${testURL}/support`);
    await getAxeResults(page);
  })
  test('サイト説明ページ', async ({ page }) => {
    await page.goto(`${testURL}/readme`);
    await getAxeResults(page);
  })
  test('ログインページ', async ({ page }) => {
    await page.goto(`${testURL}/login`);
    await getAxeResults(page);
  })
  test('サインアップページ', async ({ page }) => {
    await page.goto(`${testURL}/signup`);
    await getAxeResults(page);
  })
  test('パスワード紛失ページ', async ({ page }) => {
    await page.goto(`${testURL}/forgotPassword`);
    await getAxeResults(page);
  })
  test('メール送信完了ページ', async ({ page }) => {
    await page.goto(`${testURL}/email`);
    await getAxeResults(page);
  })
  test('パスワードリセットページ', async ({ page }) => {
    await page.goto(`${testURL}/resetPassword`);
    await getAxeResults(page);
  })

});