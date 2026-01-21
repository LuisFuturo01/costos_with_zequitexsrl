import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import basicSsl from '@vitejs/plugin-basic-ssl' // Plugin removed to fix type error

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()], 
  server: {
    host: true,
    port: 5173,
    hmr: {
      clientPort: 5173
    }
  }
})
