import { reactRouter } from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { type ConfigEnv, defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }: ConfigEnv) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
  return defineConfig({
    plugins: [
      reactRouter(),
      tsconfigPaths(),
    ],
  });
});
