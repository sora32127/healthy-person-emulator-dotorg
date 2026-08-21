import { defineConfig, devices } from '@playwright/test';

/**
 * ローカル開発向け Playwright 設定。
 * `pnpm run build` で生成した build/client を wrangler --local で配信し、
 * そのサーバーに対して E2E テストを実行する。
 * 利用方法: `npx playwright test --config playwright.local.config.ts e2e/support.spec.ts`
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  workers: 1, // ローカルDB を共有するため直列実行
  use: {
    baseURL: 'http://localhost:8787',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx wrangler dev --config wrangler.dev.toml --local',
    url: 'http://localhost:8787',
    reuseExistingServer: true, // 既に起動していれば再利用
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});