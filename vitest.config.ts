import { defineConfig } from 'vite-plus';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './app'),
    },
  },
  test: {
    // Bundle the sanitizer's CommonJS/ESM dependencies under the project's Node options.
    deps: {
      optimizer: {
        client: { enabled: true, include: ['sanitize-html'] },
        ssr: { enabled: true, include: ['sanitize-html'] },
      },
    },
    exclude: ['node_modules', 'app/tests', '.agent/**', '.codex/**', '.claude/**', 'e2e/**', 'e2e-local/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportOnFailure: true,
    },
    environment: 'happy-dom',
    testTimeout: 60000,
  },
});
