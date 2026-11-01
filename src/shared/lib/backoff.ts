/**
 * 실시간 연결(알림 SSE · 채팅 STOMP)이 끊겼을 때 다시 붙는 간격 — 두 연결이 같은 규칙을 쓴다.
 *
 * 지수 백오프 1 · 2 · 4 · 8 · 16 · 30초(상한), 각 값의 50 ~ 100% 사이에서 고른다(반쪽 흔들기, equal jitter) —
 * 서버가 다시 뜰 때 여러 탭 · 여러 사람이 한꺼번에 몰리지 않게.
 */

export const RECONNECT_BASE_MS = 1_000
export const RECONNECT_MAX_MS = 30_000

/** `attempt` 번째(0부터) 다시 붙기 전 기다림 */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt)
  return Math.round(ceiling / 2 + random() * (ceiling / 2))
}

/** 시계를 바꿔 끼우는 자리 — 시험에서 가짜 시계로 재연결 규칙을 그대로 돌린다 */
export interface StreamTimers {
  set: (fn: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

export const defaultTimers: StreamTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}
