import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

function manualChunks(id: string) {
  const normalizedId = id.replaceAll('\\', '/');

  if (!normalizedId.includes('/node_modules/')) {
    return undefined;
  }

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/')
  ) {
    return 'vendor-react';
  }

  if (normalizedId.includes('/node_modules/@tanstack/')) {
    return 'vendor-tanstack';
  }

  if (
    normalizedId.includes('/node_modules/@radix-ui/') ||
    normalizedId.includes('/node_modules/radix-ui/') ||
    normalizedId.includes('/node_modules/cmdk/') ||
    normalizedId.includes('/node_modules/vaul/')
  ) {
    return 'vendor-radix';
  }

  if (normalizedId.includes('/node_modules/recharts/')) {
    return 'vendor-charts';
  }

  if (normalizedId.includes('/node_modules/@tabler/icons-react/')) {
    return 'vendor-icons';
  }

  if (normalizedId.includes('/node_modules/@dnd-kit/')) {
    return 'vendor-dnd';
  }

  if (normalizedId.includes('/node_modules/react-day-picker/')) {
    return 'vendor-calendar';
  }

  if (normalizedId.includes('/node_modules/date-fns/')) {
    return 'vendor-date';
  }

  if (normalizedId.includes('/node_modules/motion/')) {
    return 'vendor-motion';
  }

  if (normalizedId.includes('/node_modules/zod/')) {
    return 'vendor-validation';
  }

  return undefined;
}

function normalizeBasePath(value: string | undefined) {
  if (!value || value === '/') {
    return '/';
  }

  const basePath = value.startsWith('/') ? value : `/${value}`;

  return `${basePath.replace(/\/+$/, '')}/`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appGateway = process.env.APP_GATEWAY ?? env.APP_GATEWAY ?? '';
  const proxyUrl = process.env.PROXY_URL ?? env.PROXY_URL;
  const proxy =
    proxyUrl && appGateway
      ? {
          [appGateway]: {
            target: proxyUrl,
            changeOrigin: true,
            rewrite: (path: string) =>
              path.replace(new RegExp(`^${escapeRegExp(appGateway)}`), '') || '/'
          },
          ...(appGateway === '/api'
            ? {}
            : {
                '/api': {
                  target: proxyUrl,
                  changeOrigin: true
                }
              })
        }
      : undefined;

  return {
    base: normalizeBasePath(process.env.APP_BASE_PATH ?? env.APP_BASE_PATH),
    resolve: {
      tsconfigPaths: true
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      ...(proxy ? { proxy } : {}),
      allowedHosts: ['louise-outlets-off-ambient.trycloudflare.com']
    },
    plugins: [
      tailwindcss(),
      tanstackRouter({ target: 'react' }),
      viteReact(),
      ...(process.env.ANALYZE === 'true'
        ? [visualizer({ emitFile: true, filename: 'stats.html', gzipSize: true, brotliSize: true })]
        : [])
    ],
    build: {
      rolldownOptions: {
        output: {
          manualChunks
        }
      }
    }
  };
});
