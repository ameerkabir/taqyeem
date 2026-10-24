import { fileURLToPath } from 'node:url'

import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'remix/component',
  },
  environments: {
    taqyeem: {
      optimizeDeps: {
        include: [
          'remix/router',
          'remix/routes',
          'remix/middleware/render',
          'remix/component',
          'remix/component/jsx-dev-runtime',
        ],
      },
    },
    client: {
      build: {
        rollupOptions: {
          input: fileURLToPath(new URL('./client.ts', import.meta.url)),
          output: {
            entryFileNames: 'assets/client.js',
            chunkFileNames: 'assets/[name]-[hash].js',
          },
        },
      },
      optimizeDeps: {
        // The dependency scanner runs its own Rolldown pass and doesn't inherit the
        // top-level `esbuild.jsx*` options, so without this it assumes a React JSX
        // runtime and fails to resolve `react/jsx-dev-runtime` for .tsx files.
        rolldownOptions: {
          transform: {
            jsx: { runtime: 'automatic', importSource: 'remix/component' },
          },
        },
      },
    },
  },
  plugins: [cloudflare()],
})
