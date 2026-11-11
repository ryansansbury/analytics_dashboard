import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/*
 * Where the app is served from. The live app sits at the root of its own
 * origin beside Flask. The static demo lives in a folder on
 * www.ryansansbury.com, beside the site's other demos, so its assets, routes,
 * and data files all start with /analytics-dashboard/. DEMO_BASE overrides it
 * for anyone hosting the static build somewhere else.
 */
const base = process.env.DEMO_BASE ?? (process.env.VITE_STATIC_DATA === 'true' ? '/analytics-dashboard/' : '/')

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // The charting library and React change far less often than the app,
        // so they ship as their own files and stay cached across deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/](recharts|d3-[^\\/]+|victory-vendor|decimal\.js-light|es-toolkit)[\\/]/.test(id)) return 'charts'
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler|@tanstack)[\\/]/.test(id)) return 'react'
          return 'vendor'
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts', 'src/main.tsx'],
    },
  },
})
