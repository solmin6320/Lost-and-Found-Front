/**
 * 액세스 토큰(5분)은 이 모듈 변수에만 둔다.
 *
 * localStorage · sessionStorage 에 쓰지 않는다. XSS 한 줄이면 통째로 긁힌다(보안명세서 3장).
 * 새로고침하면 비워지고, 앱 시작 시 `POST /api/auth/reissue` 로 되살린다.
 * 토큰 값을 콘솔에 찍지 않는다.
 */
let accessToken: string | null = null

/** 이 토큰의 수명(ms, 서버의 `exp - iat`). 읽지 못하면 `null` */
let lifetimeMs: number | null = null
/** 이 탭이 토큰을 받은 시각(`performance.now()`) */
let receivedAt = 0

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string): void {
  accessToken = token
  lifetimeMs = readLifetimeMs(token)
  receivedAt = performance.now()
}

export function clearAccessToken(): void {
  accessToken = null
  lifetimeMs = null
}

/**
 * 지금 토큰이 앞으로 몇 ms 더 쓸 수 있는지. 토큰이 없거나 수명을 못 읽으면 `null`.
 *
 * 브라우저 시계와 서버 시계는 어긋날 수 있어 `exp` 를 `Date.now()` 와 직접 비교하지 않는다.
 * 수명(`exp - iat`, 둘 다 서버 시각)만 토큰에서 읽고, 흐른 시간은 받은 뒤부터 이 탭이 잰다.
 * 받는 데 걸린 시간만큼 실제보다 조금 길게 나오니 쓰는 쪽이 여유를 둔다.
 *
 * 서명은 검사하지 않는다. 시간 계산에만 쓰고, 믿을지는 서버가 정한다.
 */
export function getAccessTokenRemainingMs(): number | null {
  if (accessToken === null || lifetimeMs === null) {
    return null
  }
  return lifetimeMs - (performance.now() - receivedAt)
}

function readLifetimeMs(token: string): number | null {
  const payload = token.split('.')[1]
  if (!payload) {
    return null
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const { iat, exp } = JSON.parse(atob(base64)) as { iat?: unknown; exp?: unknown }
    if (typeof iat !== 'number' || typeof exp !== 'number' || exp <= iat) {
      return null
    }
    return (exp - iat) * 1000
  } catch {
    return null
  }
}
