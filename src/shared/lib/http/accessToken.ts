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

/**
 * 토큰 payload 의 `role` 클레임(`USER` · `MANAGER` · `ADMIN` — 원문 그대로). 없으면 `null`.
 * **화면 표시용**이다 — 계정 메뉴의 `관리자` 입구 · 관리자 화면의 첫 판정. 서명을 검사하지 않으니 믿지 않는다.
 * 권한은 서버가 가른다(관리자 API 는 서버가 403 `ACCESS_DENIED` 로 막는다, 보안명세서 1장).
 * 토큰을 받을 때(로그인 · 재발급) 한 번 읽어 둔다 — 화면이 매번 디코드하지 않고, 같은 값이면 같은 문자열이라 다시 그리지 않는다
 */
let roleClaim: string | null = null
const tokenListeners = new Set<() => void>()

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string): void {
  accessToken = token
  lifetimeMs = readLifetimeMs(token)
  receivedAt = performance.now()
  setRoleClaim(readRoleClaim(token))
}

export function clearAccessToken(): void {
  accessToken = null
  lifetimeMs = null
  setRoleClaim(null)
}

/** 지금 토큰의 `role` 클레임 원문. 토큰이 없거나 클레임이 없으면 `null`(서버는 없으면 회원으로 본다) */
export function getAccessTokenRole(): string | null {
  return roleClaim
}

/**
 * 토큰의 역할이 바뀌면 알린다(로그인 · 재발급 · 로그아웃 · 세션 만료). `useSyncExternalStore` 의 구독 함수 모양이다.
 * 매니저 임명 · 해임은 그 회원의 리프레시 토큰을 지워 **다시 로그인해야** 새 역할이 토큰에 실린다(백엔드 `ManagerService`)
 */
export function subscribeAccessTokenRole(listener: () => void): () => void {
  tokenListeners.add(listener)
  return () => {
    tokenListeners.delete(listener)
  }
}

function setRoleClaim(next: string | null) {
  if (next === roleClaim) return
  roleClaim = next
  tokenListeners.forEach((listener) => listener())
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
  const claims = readClaims(token)
  if (!claims) {
    return null
  }
  const { iat, exp } = claims
  if (typeof iat !== 'number' || typeof exp !== 'number' || exp <= iat) {
    return null
  }
  return (exp - iat) * 1000
}

/** `role` 클레임 — 문자열일 때만. 값이 무엇인지는 부르는 쪽(`features/auth` 의 `toMemberRole`)이 가른다 */
export function readRoleClaim(token: string): string | null {
  const role = readClaims(token)?.role
  return typeof role === 'string' ? role : null
}

/** JWT 가운데 조각(base64url JSON). 서명은 보지 않는다 — 시간 계산 · 화면 표시에만 쓴다 */
function readClaims(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1]
  if (!payload) {
    return null
  }
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const claims: unknown = JSON.parse(atob(base64))
    return typeof claims === 'object' && claims !== null ? (claims as Record<string, unknown>) : null
  } catch {
    return null
  }
}
