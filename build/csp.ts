/**
 * 운영 빌드의 Content-Security-Policy (보안명세서 4장).
 *
 * 같은 정책을 두 곳에 건다.
 *   1. `dist/index.html` 의 `<meta http-equiv>` — 이 파일을 쓰는 Vite 플러그인(`vite.config.ts`)이 빌드 때만 심는다
 *   2. CloudFront 응답 헤더 정책 — `docs/cloudfront-response-headers-policy.json`
 *
 * 둘 다 걸리면 브라우저는 **둘 다** 지킨다(교집합). 한쪽만 넓혀도 좁은 쪽이 이긴다 — 이미지 출처를 바꾸면 두 곳을 같이 고친다.
 * `csp.test.ts` 가 문서의 JSON 과 여기서 만든 헤더 값이 같은지 본다.
 *
 * meta 로는 걸 수 없는 지시어가 있다 — `frame-ancestors` · `report-uri` · `sandbox`. 헤더 쪽에만 넣는다.
 */

/**
 * 운영 사진 CloudFront(사진 버킷 `lostfound-images-solmin-seoul` 을 OAC 로 내보내는 배포). `CSP_IMAGE_ORIGINS` 가 없을 때 쓴다.
 * 배포 빌드도 같은 값을 `CSP_IMAGE_ORIGINS` 로 넣는다(배포.md 4장). S3 주소를 직접 넣지 않는다 — 버킷은 퍼블릭 읽기를 닫아 두어
 * S3 주소의 사진은 403 이다. `deploy/s3-upload.sh` 가 빌드의 `img-src` 에 이 출처가 있는지 · S3 주소가 없는지 본다
 */
export const DEFAULT_IMAGE_ORIGINS = ['https://d1xmzetvs0f1oh.cloudfront.net'] as const

export interface CspOptions {
  /** 게시글 사진을 내려주는 출처(S3 · CloudFront). `img-src` 에 붙는다 */
  imageOrigins: readonly string[]
  /** 같은 출처가 아닌 API 주소(`VITE_API_BASE_URL` 을 채웠을 때만). `connect-src` 에 붙는다 */
  connectOrigins?: readonly string[]
}

/**
 * 출처 목록 문자열(공백 · 쉼표로 가름)을 검사해 `https://host[:port]` 모양으로 돌려준다.
 *
 * 환경변수가 그대로 정책 문자열에 들어가므로 여기서 막는다. `'unsafe-inline'` · `*` · `data:` · 경로가 붙은 주소 ·
 * `;` 를 넣어 지시어를 하나 더 만드는 값은 **빌드를 실패시킨다.** 조용히 버리면 운영에서 사진만 안 보인다.
 * `http:` 는 내 컴퓨터(`localhost` · `127.0.0.1`)만 받는다 — 목 서버 · 로컬 S3 확인용.
 */
export function parseOriginList(raw: string | undefined, name: string): string[] {
  if (!raw || !raw.trim()) return []
  return raw
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((value) => toOrigin(value, name))
}

function toOrigin(value: string, name: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name}: 주소가 아닙니다 — ${value}`)
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  const allowedProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && local)
  const bare = url.username === '' && url.password === '' && (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash
  // URL 파서는 호스트의 `;` · `*` · `'` 를 받아 준다. 그대로 두면 `;` 뒤에 지시어를 하나 더 만들 수 있다
  const plainHost = /^[a-z0-9.-]+$/.test(url.hostname)
  if (!allowedProtocol || !bare || !plainHost) {
    throw new Error(`${name}: https 출처(경로 없이 https://host[:port])만 넣습니다 — ${value}`)
  }
  return url.origin
}

/**
 * meta 와 헤더가 같이 쓰는 지시어. 순서를 고정한다(문서 JSON 과 글자 그대로 비교한다).
 *
 * - `script-src 'self'` — 인라인 · `eval` 없음. 화면 모드 초기화도 같은 출처 파일(`/theme-init.js`)이다
 * - `style-src 'self'` — `'unsafe-inline'` 없음. React 의 `style` prop 은 CSSOM(`el.style.x = …`)으로 들어가
 *   CSP 가 막지 않는다. 막히는 것은 HTML 의 `style="…"` 속성 · `<style>` 요소 · `setAttribute('style')` 인데 앱에 없다
 * - `img-src 'self' blob: <사진 출처>` — `blob:` 은 등록 · 수정의 미리보기(`URL.createObjectURL`). `data:` 는 넣지 않는다
 * - `connect-src 'self'` — API 는 같은 출처(`/api/*`, CloudFront 가 EC2 로 넘김)
 * - `base-uri 'none'` — `<base>` 를 끼워 상대 주소 스크립트를 남의 서버로 돌리는 것을 막는다. 앱은 `<base>` 를 쓰지 않는다
 * - `require-trusted-types-for 'script'` · `trusted-types 'none'` — `innerHTML` · `eval` 같은 문자열 → 코드 통로를
 *   브라우저가 막는다. 번들에서 이 통로를 쓰는 곳은 React 의 `dangerouslySetInnerHTML`(앱이 쓰지 않는다)뿐이라
 *   정책을 하나도 만들지 않는다(`'none'`). 운영 빌드에서 목록 · 상세 · 로그인 · 등록(사진) · 설정을 돌려 위반 0건을 확인했다
 * - `upgrade-insecure-requests` — 혹시 섞여 들어온 `http://` 사진 주소를 https 로 올려 받는다
 */
function commonDirectives({ imageOrigins, connectOrigins = [] }: CspOptions): string[] {
  const list = (...values: readonly string[]) => values.filter(Boolean).join(' ')
  return [
    `default-src 'self'`,
    `script-src 'self'`,
    `style-src 'self'`,
    `img-src ${list(`'self'`, 'blob:', ...imageOrigins)}`,
    `font-src 'self'`,
    `connect-src ${list(`'self'`, ...connectOrigins)}`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    `require-trusted-types-for 'script'`,
    `trusted-types 'none'`,
    `upgrade-insecure-requests`,
  ]
}

/** `<meta http-equiv="Content-Security-Policy">` 의 content */
export function buildMetaCsp(options: CspOptions): string {
  return commonDirectives(options).join('; ')
}

/**
 * CloudFront 응답 헤더의 값. meta 정책에 **meta 로는 안 되는 것**을 더한다.
 * - `frame-ancestors 'none'` — 클릭재킹. 우리 화면을 남의 페이지 `<iframe>` 에 넣지 못한다(`X-Frame-Options: DENY` 도 같이 보낸다)
 */
export function buildHeaderCsp(options: CspOptions): string {
  return [...commonDirectives(options), `frame-ancestors 'none'`].join('; ')
}

/** 이 문자열이 들어가면 정책이 무너진다. 플러그인이 심기 전에 한 번 더 본다 */
export const FORBIDDEN_CSP_TOKENS = [`'unsafe-inline'`, `'unsafe-eval'`, `'unsafe-hashes'`, `data:`] as const
