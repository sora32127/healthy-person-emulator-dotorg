import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    exclude: ['tests', 'node_modules', 'app/tests', '.agent/**', '.codex/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportOnFailure: true,
    },
    environment: 'happy-dom',
    testTimeout: 60000,
  },
});
