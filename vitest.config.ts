import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    tsconfigPaths: true
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
