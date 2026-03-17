import { cloudflareDevProxy } from '@react-router/dev/vite/cloudflare';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import { getLoadContext } from './app/load-context';

export default defineConfig({
  plugins: [
    cloudflareDevProxy({ getLoadContext }),
    reactRouter(),
  ],
});
