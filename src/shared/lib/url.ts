/**
 * API 응답에 실려 온 주소를 `<img src>` 에 넣어도 되는지(보안명세서 2장 "이미지 src").
 *
 * 응답은 서버가 만든 값이지만, 서버가 저장한 값의 출처까지 믿을 수는 없다(수정 · 이전 데이터 · 중간자).
 * `javascript:` · `data:` · `blob:` · `file:` 처럼 http(s) 가 아닌 주소는 버리고 `null` 을 돌려준다 —
 * 화면은 사진이 없는 글처럼 카테고리 그림을 그린다. 출처(S3 · CloudFront)를 좁히는 것은 CSP `img-src` 가 맡는다.
 *
 * 원래 문자열을 그대로 돌려준다(정규화한 `href` 가 아니다). 캐시 키 · 비교가 흔들리지 않게.
 */
export function safeImageUrl(value: unknown, base = currentOrigin()): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw || hasControlChar(raw)) return null
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return null
  }
  return url.protocol === 'https:' || url.protocol === 'http:' ? raw : null
}

function currentOrigin(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin
}

/** 제어 문자가 있으면 브라우저가 지우고 다시 읽는다(`java\tscript:`). 판정 전에 버린다 */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}
