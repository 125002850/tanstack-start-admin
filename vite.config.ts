import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig, type PluginOption } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nitro } from 'nitro/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(() => {
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
    server: { port: 3000 },
    plugins
  };
});
