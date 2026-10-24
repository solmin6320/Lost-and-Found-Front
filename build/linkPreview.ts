import { parseOriginList } from './csp.ts'

/**
 * 링크 미리보기(Open Graph · Twitter 카드)의 사이트 주소. docs/배포.md 10장.
 *
 * 디스코드 · 카카오톡 · 슬랙은 `og:image` · `og:url` 을 **절대 주소**로만 읽는다(`/og-image.png` 는 그림이 안 뜬다).
 * 도메인은 바뀔 수 있어(2026-12 예정) `index.html` 에는 `__SITE_URL__` 자리만 두고, 빌드가 `SITE_URL` 로 채운다.
 *
 * - `SITE_URL` — 배포 워크플로의 GitHub 변수 `SITE_URL`(배포 확인에 이미 쓰는 값)을 그대로 넘긴다.
 *   브라우저 코드는 이 값을 읽지 않아 `VITE_` 를 붙이지 않는다(`CSP_IMAGE_ORIGINS` 와 같은 까닭)
 * - 비우면 지금 운영 주소. 값은 `https://host` 하나 — 경로 · 쿼리 · 따옴표가 붙으면 빌드를 멈춘다(속성 값에 그대로 들어간다)
 */
export const DEFAULT_SITE_URL = 'https://d3gltjya6f51ok.cloudfront.net'

/** `index.html` 에서 사이트 주소로 바꿀 자리 */
export const SITE_URL_TOKEN = '__SITE_URL__'

/** `SITE_URL` 을 검사해 `https://host[:port]`(끝 `/` 없음)로 돌려준다. 비었으면 기본값 */
export function resolveSiteOrigin(raw: string | undefined): string {
  const origins = parseOriginList(raw, 'SITE_URL')
  if (origins.length === 0) return DEFAULT_SITE_URL
  if (origins.length > 1) throw new Error(`SITE_URL: 주소는 하나만 넣습니다 — ${raw}`)
  return origins[0]
}

/** `index.html` 의 `__SITE_URL__` 을 모두 사이트 주소로 바꾼다. 자리가 하나도 없으면 메타를 지운 것이라 멈춘다 */
export function fillSiteUrl(html: string, origin: string): string {
  if (!html.includes(SITE_URL_TOKEN)) throw new Error(`index.html 에 ${SITE_URL_TOKEN} 자리가 없습니다(링크 미리보기 메타)`)
  return html.replaceAll(SITE_URL_TOKEN, origin)
}
