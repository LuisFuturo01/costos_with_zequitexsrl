import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Ponemos 'all' Y TAMBIÉN el dominio específico que te da el error
    allowedHosts: [
      'n6yo63nf6iod.share.zrok.io', 
      '.zrok.io', 
      'all'
    ],
    cors: true
  }
})