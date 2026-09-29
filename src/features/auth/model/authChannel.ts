/**
 * 탭끼리 로그인이 끝났음을 알리는 통로(`BroadcastChannel`). 보안명세서 3장 · 8장.
 *
 * 액세스 토큰은 탭마다 메모리에 따로 있다. 탭 A 에서 로그아웃해도 탭 B 는 토큰(서버에서 최대 5분 유효) ·
 * 내 정보 · 내가 쓴 글 캐시 · 쓰던 글 보관(sessionStorage 도 탭마다 따로다)을 그대로 들고 있다.
 * 공용 기기에서 로그아웃하고 떠나면 다음 사람이 뒤에 남은 탭에서 이전 사람으로 글을 쓸 수 있었다(2026-09-29 검수 M2).
 *
 * - **싣는 것은 고정된 값 하나뿐이다**(`{ type: 'logout' }` · `{ type: 'session-ended' }`). 토큰 · 회원 번호 · 이메일은
 *   싣지 않는다 — 같은 출처의 모든 탭 · 스크립트가 읽는다
 * - **받은 메시지는 모양을 검사한 뒤에만** 처리한다(`parseAuthBroadcast`). 다른 모양은 버린다
 * - **로그인은 알리지 않는다.** 다른 탭은 새로고침 · 다음 재발급에 쿠키로 따라온다. 로그인을 퍼뜨리는 것은
 *   세션을 넓히는 쪽이라 방어가 아니다
 * - 받은 탭은 다시 방송하지 않는다(메아리 금지 — 부르는 쪽 `AuthProvider` 가 지킨다)
 * - `BroadcastChannel` 이 없는 환경이면 조용히 아무것도 하지 않는다. 그때는 예전처럼 탭 B 가 다음 재발급에서 끊긴다
 */

export type AuthBroadcast =
  /** 사용자가 직접 로그아웃했다 — 받은 탭은 쓰던 글 보관까지 지운다(공용 기기) */
  | { type: 'logout' }
  /** 서버가 세션을 끝냈다(재발급 거절 · 비밀번호 변경) — 받은 탭은 쓰던 글을 보관한다(다시 로그인해 이어 쓰기) */
  | { type: 'session-ended' }

export const AUTH_CHANNEL_NAME = 'lost-and-found:auth'

const TYPES: ReadonlySet<string> = new Set<AuthBroadcast['type']>(['logout', 'session-ended'])

/**
 * 채널로 받은 값이 우리 신호인가. 아니면 `null`.
 * `type` 하나만 가진 평범한 객체이고 그 값이 정해진 것일 때만 받는다 — 다른 키가 붙어 있어도 버린다(무엇이 실려 오든 믿지 않는다)
 */
export function parseAuthBroadcast(data: unknown): AuthBroadcast | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  if (Object.getPrototypeOf(data) !== Object.prototype) return null
  const keys = Object.keys(data)
  if (keys.length !== 1 || keys[0] !== 'type') return null
  const { type } = data as { type: unknown }
  return typeof type === 'string' && TYPES.has(type) ? ({ type } as AuthBroadcast) : null
}

export interface AuthChannel {
  /** 다른 탭에 알린다. 던지지 않는다 */
  post(message: AuthBroadcast): void
  close(): void
}

/** 테스트가 가짜를 넣는 자리. 기본은 브라우저의 `BroadcastChannel`(없으면 `null`) */
export type ChannelFactory = (name: string) => Pick<BroadcastChannel, 'postMessage' | 'close' | 'onmessage'> | null

const createBroadcastChannel: ChannelFactory = (name) =>
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(name)

/**
 * 채널을 연다. 다른 탭의 신호가 오면 `onMessage`(모양 검사를 통과한 것만). 이 탭이 보낸 것은 이 탭에 오지 않는다.
 * 채널을 열 수 없으면(지원 안 함 · 막힘) 아무것도 하지 않는 채널을 돌려준다
 */
export function openAuthChannel(
  onMessage: (message: AuthBroadcast) => void,
  create: ChannelFactory = createBroadcastChannel,
): AuthChannel {
  let channel: ReturnType<ChannelFactory> = null
  try {
    channel = create(AUTH_CHANNEL_NAME)
  } catch {
    channel = null
  }
  if (!channel) return { post: () => {}, close: () => {} }

  const opened = channel
  opened.onmessage = (event: MessageEvent) => {
    const message = parseAuthBroadcast(event.data)
    if (message) onMessage(message)
  }
  return {
    post(message) {
      try {
        // 받은 값을 되돌려 보내지 않는다 — 늘 새로 만든 고정 값만 보낸다
        opened.postMessage({ type: message.type })
      } catch {
        // 닫힌 채널 — 알릴 곳이 없다
      }
    },
    close() {
      opened.onmessage = null
      opened.close()
    },
  }
}

const signedOutElsewhereListeners = new Set<() => void>()

/**
 * 다른 탭에서 직접 로그아웃했다는 신호를 받았을 때 불린다(로그인 상태가 바뀌기 **전**). 해제 함수를 돌려준다.
 * 로그인이 필요한 화면이 로그인 화면으로 보내며 까닭("다른 창에서 로그아웃했어요.")을 고르는 데 쓴다
 */
export function subscribeSignedOutElsewhere(listener: () => void): () => void {
  signedOutElsewhereListeners.add(listener)
  return () => {
    signedOutElsewhereListeners.delete(listener)
  }
}

export function notifySignedOutElsewhere(): void {
  signedOutElsewhereListeners.forEach((listener) => listener())
}
