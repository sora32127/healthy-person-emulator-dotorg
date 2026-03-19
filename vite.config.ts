import { cloudflareDevProxy } from '@react-router/dev/vite/cloudflare';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { getLoadContext } from './app/load-context';

export default defineConfig({
  plugins: [cloudflareDevProxy({ getLoadContext }), tailwindcss(), reactRouter()],
});
