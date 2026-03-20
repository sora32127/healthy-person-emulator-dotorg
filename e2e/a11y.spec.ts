import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const REPORT_DIR = resolve(import.meta.dirname, '../a11y-results');
mkdirSync(REPORT_DIR, { recursive: true });

function getStaticRoutes(): { path: string; name: string }[] {
  const routesDir = resolve(import.meta.dirname, '../app/routes');
  const files = readdirSync(routesDir);

  const excludePatterns = [
    /\$/, // パラメータ付きルート
    /^api\./, // APIルート
    /^auth\./, // 認証ルート
    /^logout/, // ログアウト
    /^\$\.tsx$/, // catch-all
    /^sitemap/, // sitemap
    /^feed/, // feed
    /^_layout\.tsx$/, // レイアウトファイル自体
    /signup/, // サインアップ系
    /Verified/, // 認証後ページ
    /bookmark/, // ログイン必要
    /comment\.tsx$/, // ログイン必要
    /editHistory/, // ログイン必要
    /random/, // リダイレクト
    /preview/, // プレビュー
  ];

  return files
    .filter((f) => f.startsWith('_layout.') && f.endsWith('.tsx'))
    .filter((f) => !excludePatterns.some((p) => p.test(f)))
    .map((f) => {
      const segment = f.replace('_layout.', '').replace('.tsx', '');
      if (segment === '_index') {
        return { path: '/', name: 'index' };
      }
      const urlPath = '/' + segment.replace(/\./g, '/');
      return { path: urlPath, name: segment };
    });
}

const routes = getStaticRoutes();
const colorSchemes = ['light', 'dark'] as const;

for (const route of routes) {
  for (const colorScheme of colorSchemes) {
    test(`a11y [${colorScheme}]: ${route.name} (${route.path})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(route.path, { waitUntil: 'networkidle' });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const entry = {
        route: route.path,
        colorScheme,
        violations: results.violations.map((v) => ({
          impact: v.impact ?? 'unknown',
          id: v.id,
          description: v.description,
          nodes: v.nodes.map((n) => n.html.substring(0, 150)),
        })),
      };

      const filename = `${route.name}--${colorScheme}.json`;
      writeFileSync(resolve(REPORT_DIR, filename), JSON.stringify(entry, null, 2));

      const violations = results.violations.map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.description}\n` +
          v.nodes.map((n) => `  - ${n.html.substring(0, 120)}`).join('\n'),
      );

      expect(violations, `a11y violations:\n${violations.join('\n\n')}`).toHaveLength(0);
    });
  }
}
