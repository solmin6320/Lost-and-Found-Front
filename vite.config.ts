/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

import { DEFAULT_IMAGE_ORIGINS, FORBIDDEN_CSP_TOKENS, buildMetaCsp, parseOriginList } from './build/csp.ts'

/**
 * 운영 빌드의 `index.html` 에 보안 meta 두 줄을 심는다(보안명세서 4장). **빌드에서만**(`apply: 'build'`).
 * 개발 서버에는 걸지 않는다 — Vite HMR 이 인라인 스크립트 · WebSocket 을 쓴다.
 *
 * - `Content-Security-Policy` — 정책은 `build/csp.ts`. CloudFront 헤더와 같은 정책이다(심층 방어 · 둘 다 걸린다)
 * - `referrer` = `same-origin` — 검색어가 주소 쿼리(`?keyword=`)에 실린다. 남의 출처(S3 · CloudFront 사진)로는
 *   Referer 를 아예 보내지 않고, 우리 API 에는 그대로 보낸다
 *
 * `<meta charset>` 바로 뒤에 넣는다. CSP meta 는 그보다 **앞의** 요소에는 걸리지 않으니 `<script>` · `<link>` 보다 먼저 와야 한다.
 */
function securityMeta({ imageOrigins, connectOrigins }: { imageOrigins: string[]; connectOrigins: string[] }): Plugin {
  const csp = buildMetaCsp({ imageOrigins, connectOrigins })
  const bad = FORBIDDEN_CSP_TOKENS.find((token) => csp.includes(token))
  if (bad) throw new Error(`CSP 에 ${bad} 가 들어갔습니다: ${csp}`)

  const charset = '<meta charset="UTF-8" />'
  return {
    name: 'lost-and-found:security-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!html.includes(charset)) throw new Error('index.html 에서 <meta charset> 을 찾지 못했습니다')
        if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) throw new Error('index.html 에 인라인 <script> 가 있습니다. CSP 가 막습니다')
        return html.replace(
          charset,
          `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n    <meta name="referrer" content="same-origin" />`,
        )
      },
    },
  }
}

/**
 * 빌드의 CSP 출처. 둘 다 빌드만 읽는다.
 * - `CSP_IMAGE_ORIGINS` — 사진 출처(`img-src`). 백엔드 `AWS_S3_BASE_URL`(운영 CloudFront)과 같은 출처. 비우면 지금의 S3 주소.
 *   브라우저 코드에는 필요 없어 `VITE_` 를 붙이지 않는다
 * - `VITE_API_BASE_URL` — API 를 다른 출처로 직접 부르도록 빌드했으면(CORS 확인용) 그 출처도 `connect-src` 에 연다
 */
function securityMetaOptions(env: Record<string, string>) {
  const imageOrigins = parseOriginList(env.CSP_IMAGE_ORIGINS, 'CSP_IMAGE_ORIGINS')
  if (imageOrigins.length === 0) {
    console.warn(
      `[security-meta] CSP_IMAGE_ORIGINS 가 비어 있어 img-src 에 ${DEFAULT_IMAGE_ORIGINS.join(' ')} 를 넣습니다. ` +
        '운영 사진 주소(CloudFront)가 다르면 사진이 보이지 않습니다.',
    )
  }
  return {
    imageOrigins: imageOrigins.length > 0 ? imageOrigins : [...DEFAULT_IMAGE_ORIGINS],
    connectOrigins: parseOriginList(env.VITE_API_BASE_URL, 'VITE_API_BASE_URL'),
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // 개발 서버가 /api 요청을 백엔드로 넘겨줄 주소.
  // 배포(11장)에서는 CloudFront 하나가 /api/* 와 /* 를 나눠 보내므로,
  // 로컬도 같은 모양(단일 오리진)으로 맞춰 둔다.
  // `VITE_` 를 붙이지 않는다 — 붙이면 `import.meta.env` 로 번들에 실릴 수 있는 공개값이 된다(보안명세서 5장).
  // 이 값은 개발 서버(Node)만 읽는다
  const proxyTarget = env.DEV_PROXY_TARGET || 'http://localhost:8080'

  return {
    // 보안 meta 는 빌드에서만 만든다. 개발 서버 · vitest 는 환경변수를 검사하지 않는다(값이 이상해도 개발은 멈추지 않게)
    plugins: command === 'build' ? [react(), securityMeta(securityMetaOptions(env))] : [react()],

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

    // 에이전트 작업용 git worktree(`.claude/worktrees/`)가 리포 안에 생기면 그 테스트까지 두 번 돈다(2026-09-29 350개 사건)
    test: {
      exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
    },

    build: {
      outDir: 'dist',
      // 운영(`vite build` 의 기본 mode)에는 소스맵을 내보내지 않는다 — 원본 코드가 그대로 공개된다(보안명세서 8장)
      sourcemap: mode !== 'production',
    },
  }
})
