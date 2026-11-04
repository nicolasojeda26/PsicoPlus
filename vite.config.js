import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En desarrollo, sirve /api/arca con la misma función que usa Vercel en producción.
const arcaDevApi = () => ({
  name: 'arca-dev-api',
  configureServer(server) {
    server.middlewares.use('/api/arca', async (req, res) => {
      let raw = ''
      for await (const chunk of req) raw += chunk
      const { default: handler } = await server.ssrLoadModule('/api/arca.js')
      const shim = {
        setHeader: (k, v) => res.setHeader(k, v),
        status(code) { res.statusCode = code; return shim },
        json(obj) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) },
      }
      req.body = raw ? JSON.parse(raw) : {}
      await handler(req, shim)
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    arcaDevApi(),
  ],
})
