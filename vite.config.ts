import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        [env.APP_GATEWAY]: {
          target: env.PROXY_URL,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      tanstackRouter({ target: 'react' }),
      viteReact(),
      ...(process.env.ANALYZE === 'true'
        ? [visualizer({ emitFile: true, filename: 'stats.html', gzipSize: true, brotliSize: true })]
        : []),
    ],
  };
});
