import { cloudflare } from '@cloudflare/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  plugins: [
    command === 'serve' &&
      cloudflare({
        configPath: 'wrangler.dev.toml',
        config: { main: 'workers/dev.ts' },
        viteEnvironment: { name: 'ssr' },
        remoteBindings: false,
      }),
    tailwindcss(),
    reactRouter(),
  ],
}));
