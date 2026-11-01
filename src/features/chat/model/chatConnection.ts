import { defaultTimers, reconnectDelay, type StreamTimers } from '@/shared/lib/backoff'
import { ApiError } from '@/shared/lib/http'
import { HEARTBEAT, createStompParser, encodeFrame, negotiateHeartbeat, type StompFrame } from '@/shared/lib/stomp'

/**
 * 채팅 실시간 연결 하나(WebSocket + STOMP 1.2)를 붙들고 있는 것 — 알림 SSE(`notifications/model/notificationStream`)와 같은 규칙.
 * 화면(`useChatConnection`)과 떼어 둔 까닭 : 소켓 · 시계 · 토큰 함수를 바꿔 끼워 재연결 규칙을 그대로 시험한다(`chatConnection.test.ts`).
 *
 * 규칙
 * - **연결은 하나.** 여러 방 · 여러 화면이 같은 연결에 구독만 더한다. 다시 열기 전에 앞 소켓을 닫는다
 * - CONNECT 머리글 `Authorization: Bearer <액세스 토큰>`(주소에 싣지 않는다). 토큰이 곧 끝나면(30초 안) 먼저 재발급하고 연다
 * - **연결 전 ERROR**(토큰이 없거나 틀림 — 서버가 ERROR 뒤 끊는다)면 재발급(탭 안 · 탭 사이 한 번, `refreshAccessToken`) 뒤 **한 번만** 바로 다시 연다.
 *   또 거절되면 백오프로. 재발급이 4xx 로 거절되면(세션 끝) 멈춘다 — 세션 만료 처리는 http 계층이 이미 했다
 * - 연결 중에 토큰이 만료돼도 서버는 연결을 그대로 둔다. 다시 열 때 새 토큰을 싣는다
 * - **끊기면 지수 백오프로 다시 붙는다**(1 · 2 · 4 · 8 · 16 · 30초, 각 50 ~ 100%). CONNECTED 를 받으면 처음 값으로
 * - 심장박동 : 서버와 맞춘 간격(10초)마다 빈 줄을 보내고, 받는 쪽은 그 2.5배 동안 한 바이트도 없으면 죽은 연결로 보고 다시 붙는다
 *   (프록시 · 로드밸런서 · 와이파이 전환의 반쯤 끊긴 연결). 여는 데 10초가 넘어도 다시
 * - 다시 붙으면 구독을 모두 다시 건다. 끊긴 동안의 메시지는 화면이 기록 API 로 메운다(`onConnected({ reconnect: true })`)
 * - 쉬기(`pause`) : 탭이 숨으면 끊는다(상대가 보고 있지 않다고 서버가 알림을 만든다). 다시 보이면 백오프 없이 바로 붙는다
 */

export type ChatConnectionStatus = 'idle' | 'connecting' | 'open' | 'waiting' | 'paused' | 'stopped'

/** 브라우저 `WebSocket` 중 쓰는 것만 — 시험에서 가짜로 바꿔 낀다 */
export interface SocketLike {
  binaryType?: string
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: ((event: never) => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: ((event: never) => void) | null
  onerror: ((event: never) => void) | null
}

export interface ChatConnectionOptions {
  url: () => string
  createSocket: (url: string) => SocketLike
  /** 지금 액세스 토큰(메모리). 없으면 `null` — 연결하지 않는다 */
  getToken: () => string | null
  /** 지금 토큰이 앞으로 몇 ms 더 쓸 수 있는지(`getAccessTokenRemainingMs`) */
  tokenRemainingMs?: () => number | null
  /** 재발급(`refreshAccessToken` — 동시에 여럿이 불러도 한 번) */
  refreshToken: () => Promise<string>
  timers?: StreamTimers
  random?: () => number
}

/** 내가 바라는 심장박동(보내기, 받기) — 서버 `WebSocketConfig` 와 같은 10초 */
export const CLIENT_HEARTBEAT: readonly [number, number] = [10_000, 10_000]
/** 받는 심장박동을 이 배수만큼 못 받으면 죽은 연결 */
export const HEARTBEAT_GRACE = 2.5
/** 소켓을 열고 CONNECTED 를 받기까지 기다리는 한도 */
export const CONNECT_TIMEOUT_MS = 10_000
/** 이보다 적게 남은 토큰은 열기 전에 재발급한다 */
export const TOKEN_MARGIN_MS = 30_000
/** 보낸 연결에만 오는 실패(`ChatController` `@SendToUser`) */
export const ERROR_QUEUE = '/user/queue/errors'

export interface ChatConnection {
  start(): void
  pause(): void
  resume(): void
  /** 끊긴 채 기다리는 중이면 바로 다시 붙는다(브라우저가 다시 온라인) */
  retryNow(): void
  stop(): void
  /** 구독. 연결이 없으면 붙을 때 건다. 해제 함수를 돌려준다 */
  subscribe(destination: string, onMessage: (body: string) => void): () => void
  /** 열려 있을 때만 보낸다. 못 보냈으면 `false` */
  send(destination: string, body: string): boolean
  onStatus(listener: () => void): () => void
  onConnected(listener: (info: { reconnect: boolean }) => void): () => void
  /** `/user/queue/errors` 본문 */
  onServerError(listener: (body: string) => void): () => void
  readonly status: ChatConnectionStatus
}

interface Subscription {
  destination: string
  onMessage: (body: string) => void
}

export function createChatConnection(options: ChatConnectionOptions): ChatConnection {
  const timers = options.timers ?? defaultTimers
  const random = options.random ?? Math.random
  const subscriptions = new Map<string, Subscription>()
  const statusListeners = new Set<() => void>()
  const connectedListeners = new Set<(info: { reconnect: boolean }) => void>()
  const errorListeners = new Set<(body: string) => void>()
  let nextId = 0
  let status: ChatConnectionStatus = 'idle'
  let socket: SocketLike | null = null
  /** 지금 소켓의 차례 — 늦게 도착한 옛 소켓 · 옛 재발급의 소식을 버린다 */
  let generation = 0
  let attempt = 0
  let connected = false
  let everConnected = false
  let authRetried = false
  let retryTimer: unknown = null
  let watchdog: unknown = null
  let beatTimer: unknown = null
  let incomingMs = 0

  function setStatus(next: ChatConnectionStatus) {
    if (status === next) return
    status = next
    statusListeners.forEach((listener) => listener())
  }

  function clear(handle: unknown) {
    if (handle !== null) timers.clear(handle)
  }

  function stopTimers() {
    clear(watchdog)
    clear(beatTimer)
    watchdog = null
    beatTimer = null
  }

  function cancelRetry() {
    clear(retryTimer)
    retryTimer = null
  }

  /** 지금 소켓을 조용히 닫는다(닫힘 소식은 무시된다) */
  function drop() {
    generation += 1
    stopTimers()
    connected = false
    const old = socket
    socket = null
    if (old) {
      old.onopen = null
      old.onmessage = null
      old.onerror = null
      old.onclose = null
      try {
        old.close(1000)
      } catch {
        // 이미 닫힌 소켓
      }
    }
  }

  function schedule() {
    drop()
    const delay = reconnectDelay(attempt, random)
    attempt += 1
    setStatus('waiting')
    retryTimer = timers.set(() => {
      retryTimer = null
      connect()
    }, delay)
  }

  function armWatchdog(ms: number) {
    clear(watchdog)
    const mine = generation
    watchdog = timers.set(() => {
      watchdog = null
      if (mine === generation) schedule()
    }, ms)
  }

  function startBeats(ms: number) {
    clear(beatTimer)
    beatTimer = null
    if (ms <= 0) return
    const mine = generation
    const beat = () => {
      if (mine !== generation || !socket) return
      try {
        socket.send(HEARTBEAT)
      } catch {
        // 닫히는 중 — 닫힘 소식이 다시 붙인다
      }
      beatTimer = timers.set(beat, ms)
    }
    beatTimer = timers.set(beat, ms)
  }

  function sendFrame(command: string, headers: Record<string, string>, body = '') {
    socket?.send(encodeFrame(command, headers, body))
  }

  function subscribeFrame(id: string, destination: string) {
    sendFrame('SUBSCRIBE', { id, destination })
  }

  function connect() {
    cancelRetry()
    drop()
    setStatus('connecting')
    const mine = generation
    void open(mine)
  }

  async function open(mine: number) {
    const remaining = options.tokenRemainingMs?.() ?? null
    if (remaining !== null && remaining < TOKEN_MARGIN_MS) {
      try {
        await options.refreshToken()
      } catch (error) {
        if (mine !== generation) return
        failWith(error)
        return
      }
      if (mine !== generation) return
    }
    const token = options.getToken()
    if (!token) {
      // 로그인하지 않았다 — 두드릴 까닭이 없다(로그인하면 화면이 다시 연다)
      setStatus('stopped')
      return
    }

    let ws: SocketLike
    try {
      ws = options.createSocket(options.url())
    } catch {
      schedule()
      return
    }
    socket = ws
    ws.binaryType = 'arraybuffer'
    let refusedBeforeConnect = false
    const parser = createStompParser(
      (frame) => handleFrame(frame, mine, () => (refusedBeforeConnect = true)),
      () => undefined,
    )
    armWatchdog(CONNECT_TIMEOUT_MS)

    ws.onopen = () => {
      if (mine !== generation) return
      sendFrame('CONNECT', {
        'accept-version': '1.2',
        host: hostOf(options.url()),
        'heart-beat': CLIENT_HEARTBEAT.join(','),
        Authorization: `Bearer ${token}`,
      })
    }
    ws.onmessage = (event) => {
      if (mine !== generation) return
      if (connected && incomingMs > 0) armWatchdog(incomingMs * HEARTBEAT_GRACE)
      parser.push(decode(event.data))
    }
    ws.onerror = () => undefined
    ws.onclose = () => {
      if (mine !== generation) return
      if (refusedBeforeConnect && !authRetried) {
        // 토큰이 거절됐다 — 재발급하고 한 번만 바로 다시 연다
        authRetried = true
        drop()
        setStatus('connecting')
        const next = generation
        options.refreshToken().then(
          () => {
            if (next === generation && status === 'connecting') connect()
          },
          (error: unknown) => {
            if (next === generation) failWith(error)
          },
        )
        return
      }
      schedule()
    }
  }

  function failWith(error: unknown) {
    // 재발급이 거절됐다(4xx) — 세션이 끝났다. 다시 두드려도 같다
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      drop()
      setStatus('stopped')
      return
    }
    schedule()
  }

  function handleFrame(frame: StompFrame, mine: number, refused: () => void) {
    if (mine !== generation) return
    switch (frame.command) {
      case 'CONNECTED': {
        connected = true
        attempt = 0
        authRetried = false
        const beats = negotiateHeartbeat(CLIENT_HEARTBEAT, frame.headers['heart-beat'])
        incomingMs = beats.incoming
        startBeats(beats.outgoing)
        if (incomingMs > 0) armWatchdog(incomingMs * HEARTBEAT_GRACE)
        else {
          clear(watchdog)
          watchdog = null
        }
        subscribeFrame('errors', ERROR_QUEUE)
        for (const [id, sub] of subscriptions) subscribeFrame(id, sub.destination)
        setStatus('open')
        const reconnect = everConnected
        everConnected = true
        connectedListeners.forEach((listener) => listener({ reconnect }))
        return
      }
      case 'MESSAGE': {
        const id = frame.headers.subscription
        if (id === 'errors') {
          errorListeners.forEach((listener) => listener(frame.body))
          return
        }
        const sub = id ? subscriptions.get(id) : undefined
        sub?.onMessage(frame.body)
        return
      }
      case 'ERROR':
        // 연결 전이면 토큰 거절, 연결 뒤면 구독 · 보내기 거절 — 어느 쪽이든 서버가 곧 끊는다. 끊김 소식(onclose)이 다음을 정한다
        if (!connected) refused()
        return
      default:
        return
    }
  }

  return {
    start() {
      if (status !== 'idle' && status !== 'stopped') return
      attempt = 0
      authRetried = false
      connect()
    },
    pause() {
      if (status === 'idle' || status === 'stopped' || status === 'paused') return
      cancelRetry()
      drop()
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
      cancelRetry()
      drop()
      setStatus('stopped')
    },
    subscribe(destination, onMessage) {
      nextId += 1
      const id = `sub-${nextId}`
      subscriptions.set(id, { destination, onMessage })
      if (connected) subscribeFrame(id, destination)
      return () => {
        if (!subscriptions.delete(id)) return
        if (connected) {
          try {
            sendFrame('UNSUBSCRIBE', { id })
          } catch {
            // 닫히는 중
          }
        }
      }
    },
    send(destination, body) {
      if (!connected || !socket) return false
      try {
        sendFrame('SEND', { destination, 'content-type': 'application/json' }, body)
        return true
      } catch {
        return false
      }
    },
    onStatus(listener) {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    onConnected(listener) {
      connectedListeners.add(listener)
      return () => connectedListeners.delete(listener)
    },
    onServerError(listener) {
      errorListeners.add(listener)
      return () => errorListeners.delete(listener)
    },
    get status() {
      return status
    },
  }
}

const decoder = typeof TextDecoder === 'undefined' ? null : new TextDecoder()

function decode(data: unknown): string {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer && decoder) return decoder.decode(data)
  return ''
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}
