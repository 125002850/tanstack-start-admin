import viteReact from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), viteReact()],
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    exclude: ['.agents/**', '.claude/**', 'e2e', 'node_modules'],
    clearMocks: true,
    server: {
      deps: {
        inline: ['@tanstack/react-table']
      }
    }
  }
});
