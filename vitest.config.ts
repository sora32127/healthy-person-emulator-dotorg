import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    env: {
      VITE_GOOGLE_GENERATIVE_API_KEY:
        process.env.VITE_GOOGLE_GENERATIVE_API_KEY || 'google-generative-api-demo-key',
    },
    exclude: ['tests', 'node_modules', 'app/tests'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportOnFailure: true,
    },
    environment: 'happy-dom',
    testTimeout: 60000,
  },
});
