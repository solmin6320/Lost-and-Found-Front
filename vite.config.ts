import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // 개발 서버가 /api 요청을 백엔드로 넘겨줄 주소.
  // 배포(11장)에서는 CloudFront 하나가 /api/* 와 /* 를 나눠 보내므로,
  // 로컬도 같은 모양(단일 오리진)으로 맞춰 둔다.
  // `VITE_` 를 붙이지 않는다 — 붙이면 `import.meta.env` 로 번들에 실릴 수 있는 공개값이 된다(보안명세서 5장).
  // 이 값은 개발 서버(Node)만 읽는다
  const proxyTarget = env.DEV_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    server: {
      port: 5173,
      // 5173이 막혀 있으면 조용히 5174로 옮겨가지 않고 실패시킨다.
      // 포트가 바뀌면 백엔드 CORS 화이트리스트에서 벗어난다.
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
    },
  }
})
