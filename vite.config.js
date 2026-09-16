import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { handlePronounceRequest } from './api/pronounce-audio.mjs'

const backendUrl = process.env.VITE_API_PROXY || process.env.VITE_API_URL || 'http://localhost:3000'

function pronouncePlugin() {
  const middleware = (req, res, next) => {
    const path = req.url?.split('?')[0]
    if (path !== '/api/pronounce' && path !== '/inklex-pronounce') {
      next()
      return
    }

    void handlePronounceRequest(req, res).catch(() => {
      res.statusCode = 502
      res.end()
    })
  }

  return {
    name: 'inklex-pronounce',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [pronouncePlugin(), react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/data/firestore.rules.test.ts'],
  },
  server: {
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
        bypass(req) {
          if (req.url?.split('?')[0] === '/api/pronounce') {
            return req.url
          }
        },
      },
    },
  },
})
