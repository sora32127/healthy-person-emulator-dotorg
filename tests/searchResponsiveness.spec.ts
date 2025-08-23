import { test, expect } from '@playwright/test';

const testURL = process.env.TEST_URL || 'http://localhost:3000';

test.describe('検索ボックスのレスポンシブネステスト', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto(`${testURL}/search2`);
    await expect(page).toHaveTitle(/検索/);
    
    // 検索システムの初期化を待つ
    await page.waitForSelector('.search-input-form', { timeout: 30000 });
    
    // 初期化完了後、検索ボックスが表示されるのを待つ
    await expect(page.getByPlaceholder('テキストを入力...')).toBeVisible();
  });

  test('キー入力が20ms以下で反映されることを確認する', async ({ page }) => {
    const searchInput = page.getByPlaceholder('テキストを入力...');
    
    // テストする文字列
    const testString = 'テスト検索';
    
    for (let i = 0; i < testString.length; i++) {
      const char = testString[i];
      const expectedValue = testString.substring(0, i + 1);
      
      // キー入力のタイミングを記録
      const startTime = Date.now();
      
      // 1文字ずつ入力
      await searchInput.type(char, { delay: 0 });
      
      // 入力値が反映されるまでの時間を測定
      await expect(searchInput).toHaveValue(expectedValue);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // 20ms以下で反映されていることを確認
      expect(responseTime).toBeLessThanOrEqual(20);
      
      console.log(`文字 "${char}" の入力レスポンス時間: ${responseTime}ms`);
    }
  });

  test('連続入力が20ms以下で反映されることを確認する', async ({ page }) => {
    const searchInput = page.getByPlaceholder('テキストを入力...');
    
    // 高速で連続入力を行う
    const testStrings = ['a', 'ab', 'abc', 'abcd', 'abcde'];
    
    for (const testString of testStrings) {
      const startTime = Date.now();
      
      // 入力値をクリアしてから新しい値を入力
      await searchInput.clear();
      await searchInput.type(testString, { delay: 0 });
      
      // 期待値が反映されるのを確認
      await expect(searchInput).toHaveValue(testString);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // 20ms以下で反映されていることを確認
      expect(responseTime).toBeLessThanOrEqual(20);
      
      console.log(`文字列 "${testString}" の入力レスポンス時間: ${responseTime}ms`);
    }
  });

  test('日本語入力が20ms以下で反映されることを確認する', async ({ page }) => {
    const searchInput = page.getByPlaceholder('テキストを入力...');
    
    // 日本語のテスト文字列
    const japaneseChars = ['あ', 'い', 'う', 'え', 'お'];
    
    for (let i = 0; i < japaneseChars.length; i++) {
      const char = japaneseChars[i];
      const expectedValue = japaneseChars.slice(0, i + 1).join('');
      
      const startTime = Date.now();
      
      // 日本語文字を入力
      await searchInput.type(char, { delay: 0 });
      
      // 入力値が反映されるまでの時間を測定
      await expect(searchInput).toHaveValue(expectedValue);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // 20ms以下で反映されていることを確認
      expect(responseTime).toBeLessThanOrEqual(20);
      
      console.log(`日本語文字 "${char}" の入力レスポンス時間: ${responseTime}ms`);
    }
  });

  test('バックスペースが20ms以下で反映されることを確認する', async ({ page }) => {
    const searchInput = page.getByPlaceholder('テキストを入力...');
    
    // 初期値を入力
    const initialText = 'test';
    await searchInput.type(initialText, { delay: 0 });
    await expect(searchInput).toHaveValue(initialText);
    
    // バックスペースで1文字ずつ削除
    for (let i = initialText.length - 1; i >= 0; i--) {
      const expectedValue = initialText.substring(0, i);
      
      const startTime = Date.now();
      
      // バックスペースキーを押下
      await searchInput.press('Backspace');
      
      // 削除が反映されるまでの時間を測定
      await expect(searchInput).toHaveValue(expectedValue);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // 20ms以下で反映されていることを確認
      expect(responseTime).toBeLessThanOrEqual(20);
      
      console.log(`バックスペース操作のレスポンス時間: ${responseTime}ms (残り文字: "${expectedValue}")`);
    }
  });

  test('ペースト操作が20ms以下で反映されることを確認する', async ({ page }) => {
    const searchInput = page.getByPlaceholder('テキストを入力...');
    
    const testText = 'これはペーストテストです';
    
    const startTime = Date.now();
    
    // クリップボードにテキストを設定してペースト
    await page.evaluate((text) => {
      navigator.clipboard.writeText(text);
    }, testText);
    
    await searchInput.focus();
    await page.keyboard.press('Meta+V'); // Macの場合
    
    // ペースト内容が反映されるまでの時間を測定
    await expect(searchInput).toHaveValue(testText);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // 20ms以下で反映されていることを確認
    expect(responseTime).toBeLessThanOrEqual(20);
    
    console.log(`ペースト操作のレスポンス時間: ${responseTime}ms`);
  });
});