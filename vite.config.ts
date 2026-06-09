import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nitro } from 'nitro/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const plugins: PluginOption[] = [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: 'node-server' }),
    viteReact()
  ];

  if (process.env.ANALYZE === 'true') {
    plugins.push(
      visualizer({ emitFile: true, filename: 'stats.html', gzipSize: true, brotliSize: true })
    );
  }

  return {
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        [env.APP_GATEWAY]: {
          target: env.PROXY_URL,
          changeOrigin: true,
          headers: {
            'x-proxy-target': env.PROXY_URL
          },
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-proxy-target', env.PROXY_URL);
            });
          }
        }
      }
    },
    plugins
  };
});
