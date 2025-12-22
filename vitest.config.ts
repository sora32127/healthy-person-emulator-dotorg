import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      VITE_GOOGLE_GENERATIVE_API_KEY:
        process.env.VITE_GOOGLE_GENERATIVE_API_KEY ||
        'google-generative-api-demo-key',
    },
    exclude: ['tests', 'node_modules', 'app/tests'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportOnFailure: true,
      include: ['app/**.{js,ts,tsx}'],
      exclude: ['**/node_modules/**'],
    },
    environment: 'happy-dom',
    testTimeout: 60000,
  },
});
