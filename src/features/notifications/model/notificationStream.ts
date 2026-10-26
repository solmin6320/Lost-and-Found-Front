import { ApiError } from '@/shared/lib/http'
import { createSseParser } from '@/shared/lib/sse'

import type { NotificationResponse } from '../api/types'

/**
 * 실시간 알림 연결 하나를 붙들고 있는 것 — 열기 · 읽기 · 끊기면 다시 붙기 · 숨으면 쉬기.
 *
 * 화면(`useNotificationStream`)과 떼어 둔 까닭 : 시계 · 여는 함수를 바꿔 끼워 재연결 규칙을 그대로 시험한다(`notificationStream.test.ts`).
 *
 * 규칙
 * - **연결은 하나.** 다시 열기 전에 앞 연결을 끊는다(`AbortController`)
 * - 알림을 받을 때마다 그 `id` 를 적어 두고, 다시 열 때 `Last-Event-ID` 로 보낸다 — 끊긴 동안 온 알림을 서버가 다시 보낸다
 * - **끊기면 지수 백오프로 다시 붙는다** : 1 · 2 · 4 · 8 · 16 · 30초(상한), 각 값의 50 ~ 100% 사이에서 고른다(여러 탭 · 사람이 한꺼번에 몰리지 않게).
 *   `connected` 를 받으면(실제로 붙으면) 처음 값으로 돌아간다. 서버가 30분 만에 끝낸 정상 종료도 끊김과 같다 — 0.5 ~ 1초 뒤 다시 붙는다
 * - **다시 붙지 않는 실패** : 서버가 4xx 로 거절했다(401 은 http 계층이 재발급을 한 번 해 보고도 안 된 것 — 세션이 끝났다). 다시 두드려도 같다
 * - **소식 없는 연결은 죽은 것으로 본다** : 서버는 15초마다 주석 줄(heartbeat)을 보낸다. 45초(세 번) 동안 한 바이트도 오지 않으면 끊고 다시 붙는다 —
 *   중간 장비(프록시 · 로드밸런서 · 와이파이 전환)가 연결을 반쯤 끊으면 브라우저는 끊긴 줄 모르고 영원히 기다린다(개발 프록시에서 실측 — 서버 쪽 소켓을 끊어도 브라우저 연결은 열린 채였다)
 * - 쉬기(`pause`) : 탭이 숨으면 끊는다. 다시 보이면(`resume`) 백오프 없이 바로 붙는다 — 그 사이 온 알림은 `Last-Event-ID` 로 받는다
 */

export type StreamStatus = 'idle' | 'connecting' | 'open' | 'waiting' | 'paused' | 'stopped'

export interface StreamTimers {
  set: (fn: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

export interface NotificationStreamOptions {
  /** 연결을 연다(실패하면 던진다). 기본은 `openNotificationStream` */
  open: (lastEventId: string | undefined, signal: AbortSignal) => Promise<Response>
  onNotification: (notification: NotificationResponse) => void
  /** 서버가 `connected` 를 보냈다(첫 연결 · 다시 붙음 모두) */
  onConnected?: (info: { reconnect: boolean; resumedFrom: string | undefined }) => void
  onStatus?: (status: StreamStatus) => void
  timers?: StreamTimers
  /** 0 이상 1 미만 — 시험에서 고정한다 */
  random?: () => number
}

export const RECONNECT_BASE_MS = 1_000
export const RECONNECT_MAX_MS = 30_000
/** 이만큼 아무것도 오지 않으면 죽은 연결 — 서버 heartbeat(15초) 세 번 */
export const STALL_MS = 45_000

/** `attempt` 번째(0부터) 다시 붙기 전 기다림. 지수 백오프 + 반쪽 흔들기(equal jitter) */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt)
  return Math.round(ceiling / 2 + random() * (ceiling / 2))
}

/** 다시 두드려도 같은 실패 — 서버가 4xx 로 거절했다(세션 끝 · 권한 없음) */
export function isFatalStreamError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500
}

/** `data` 가 알림 모양인지 — 모르는 모양은 버린다(캐시를 깨지 않게) */
export function parseNotification(data: string): NotificationResponse | null {
  try {
    const value = JSON.parse(data) as Partial<NotificationResponse> | null
    if (!value || typeof value !== 'object' || typeof value.id !== 'number' || typeof value.type !== 'string') return null
    return value as NotificationResponse
  } catch {
    return null
  }
}

const defaultTimers: StreamTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface NotificationStream {
  start(): void
  pause(): void
  resume(): void
  /** 연결이 끊긴 채 기다리는 중이면 바로 다시 붙는다(브라우저가 다시 온라인이 됐다) */
  retryNow(): void
  stop(): void
  readonly status: StreamStatus
  readonly lastEventId: string | undefined
}

export function createNotificationStream(options: NotificationStreamOptions): NotificationStream {
  const timers = options.timers ?? defaultTimers
  const random = options.random ?? Math.random
  let status: StreamStatus = 'idle'
  let lastEventId: string | undefined
  let attempt = 0
  let controller: AbortController | null = null
  let timer: unknown = null
  let everConnected = false
  let watchdog: unknown = null

  function setStatus(next: StreamStatus) {
    if (status === next) return
    status = next
    options.onStatus?.(next)
  }

  function cancelTimer() {
    if (timer !== null) {
      timers.clear(timer)
      timer = null
    }
  }

  function abort() {
    stopWatchdog()
    controller?.abort()
    controller = null
  }

  function stopWatchdog() {
    if (watchdog !== null) {
      timers.clear(watchdog)
      watchdog = null
    }
  }

  /** 바이트가 올 때마다 다시 건다. 울리면 그 연결을 끊고 다시 붙는다 */
  function armWatchdog(mine: AbortController) {
    stopWatchdog()
    watchdog = timers.set(() => {
      watchdog = null
      if (controller !== mine) return
      controller = null
      mine.abort()
      schedule()
    }, STALL_MS)
  }

  function schedule() {
    const delay = reconnectDelay(attempt, random)
    attempt += 1
    setStatus('waiting')
    timer = timers.set(() => {
      timer = null
      connect()
    }, delay)
  }

  function connect() {
    cancelTimer()
    abort()
    const mine = new AbortController()
    controller = mine
    setStatus('connecting')
    void run(mine)
  }

  async function run(mine: AbortController) {
    const resumedFrom = lastEventId
    try {
      const response = await options.open(lastEventId, mine.signal)
      if (mine.signal.aborted) return
      await read(response, mine, resumedFrom)
      if (mine.signal.aborted) return
      // 서버가 끝냈다(30분) · 중간 장비가 끊었다 — 다시 붙는다
      controller = null
      schedule()
    } catch (error) {
      if (mine.signal.aborted || controller !== mine) return
      controller = null
      if (isFatalStreamError(error)) {
        setStatus('stopped')
        return
      }
      schedule()
    }
  }

  async function read(response: Response, mine: AbortController, resumedFrom: string | undefined) {
    const body = response.body
    if (!body) return
    const reader = body.getReader()
    const decoder = new TextDecoder()
    const parser = createSseParser((message) => {
      if (mine.signal.aborted) return
      if (message.event === 'connected') {
        attempt = 0
        setStatus('open')
        options.onConnected?.({ reconnect: everConnected, resumedFrom })
        everConnected = true
        return
      }
      if (message.event !== 'notification') return
      if (message.lastEventId) lastEventId = message.lastEventId
      const notification = parseNotification(message.data)
      if (notification) options.onNotification(notification)
    })
    const stopReading = () => void reader.cancel().catch(() => undefined)
    mine.signal.addEventListener('abort', stopReading, { once: true })
    armWatchdog(mine)
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (controller === mine) armWatchdog(mine)
        parser.push(decoder.decode(value, { stream: true }))
      }
      parser.push(decoder.decode())
      parser.end()
    } finally {
      mine.signal.removeEventListener('abort', stopReading)
      if (controller === mine || controller === null) stopWatchdog()
    }
  }

  return {
    start() {
      if (status !== 'idle' && status !== 'stopped') return
      attempt = 0
      connect()
    },
    pause() {
      if (status === 'idle' || status === 'stopped' || status === 'paused') return
      cancelTimer()
      abort()
      setStatus('paused')
    },
    resume() {
      if (status !== 'paused') return
      attempt = 0
      connect()
    },
    retryNow() {
      if (status !== 'waiting') return
      attempt = 0
      connect()
    },
    stop() {
      cancelTimer()
      abort()
      setStatus('stopped')
    },
    get status() {
      return status
    },
    get lastEventId() {
      return lastEventId
    },
  }
}
