import { reactRouter } from '@react-router/dev/vite';
import { type ConfigEnv, defineConfig, loadEnv } from 'vite-plus';

export default defineConfig(({ mode }: ConfigEnv) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
  return defineConfig({
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [reactRouter()],
  });
});
