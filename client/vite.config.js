import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // The client always talks to same-origin /api and /socket.io; in dev they are proxied to the API server.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          // Heavy libraries get their own long-cacheable chunks and are only loaded by the pages that need them.
          // Only the libraries themselves are pinned; shared helpers (clsx, etc.) are left to Rollup
          // so the entry chunk never has to preload the 3D or chart bundles.
          manualChunks(id) {
            // Vite/Rollup runtime helpers would otherwise be hoisted into whichever lazy chunk used
            // them first, forcing the entry to preload that whole chunk.
            if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'react-vendor';
            if (!id.includes('node_modules')) return undefined;
            if (/node_modules[\\/](three|three-stdlib|@react-three|troika-[^\\/]+)[\\/]/.test(id)) return 'three';
            if (/node_modules[\\/](recharts|recharts-scale|victory-vendor|d3-[^\\/]+)[\\/]/.test(id)) return 'charts';
            if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|clsx|tailwind-merge|@babel[\\/]runtime)[\\/]/.test(id)) {
              return 'react-vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});
