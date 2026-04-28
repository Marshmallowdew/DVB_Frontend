import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [
    vue(), 
    // vueDevTools(),
    mkcert()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    https: true, // Фронтенд работает по https
    host: 'localhost',
    port: 5173,
    proxy: {
      '/api': {
        // ТАРГЕТ ДОЛЖЕН БЫТЬ HTTP, потому что Django в Докере работает без сертификатов
        target: 'http://localhost:8000', 
        changeOrigin: true,
        secure: false, 
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: {
          '*': '/'
        }
      },
      // И для вебсокетов тоже обычный 'ws://'
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  }
})