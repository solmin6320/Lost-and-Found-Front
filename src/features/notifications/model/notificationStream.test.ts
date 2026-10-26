import { describe, expect, it } from 'vitest'

import { ApiError, NetworkError } from '@/shared/lib/http'

import type { NotificationResponse } from '../api/types'
import {
  RECONNECT_MAX_MS,
  STALL_MS,
  createNotificationStream,
  isFatalStreamError,
  reconnectDelay,
  type StreamStatus,
} from './notificationStream'

const encoder = new TextEncoder()
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const settle = async () => {
  for (let i = 0; i < 6; i += 1) await flush()
}

/** 서버 흉내 — 열릴 때마다 연결 하나(본문 흐름을 손으로 민다) */
function fakeServer() {
  const calls: Array<{ lastEventId: string | undefined; signal: AbortSignal }> = []
  const connections: Array<ReadableStreamDefaultController<Uint8Array>> = []
  const failures: unknown[] = []
  const open = (lastEventId: string | undefined, signal: AbortSignal) => {
    calls.push({ lastEventId, signal })
    const failure = failures.shift()
    if (failure) return Promise.reject(failure)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        connections.push(controller)
      },
    })
    return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
  }
  const last = () => connections[connections.length - 1]
  return {
    open,
    calls,
    failures,
    send: (text: string) => last().enqueue(encoder.encode(text)),
    connected: () => last().enqueue(encoder.encode('event:connected\ndata:ok\n\n')),
    notify: (id: number, read = false) =>
      last().enqueue(
        encoder.encode(
          `id:${id}\nevent:notification\ndata:${JSON.stringify({ id, type: 'CLAIM_REQUESTED', postId: 9, read })}\n\n`,
        ),
      ),
    end: () => last().close(),
    drop: () => last().error(new TypeError('network error')),
  }
}

/** 손으로 돌리는 시계 — 걸린 타이머와 그 시간을 본다 */
function fakeTimers() {
  const pending: Array<{ fn: () => void; ms: number; id: number }> = []
  let seq = 0
  return {
    pending,
    timers: {
      set: (fn: () => void, ms: number) => {
        seq += 1
        pending.push({ fn, ms, id: seq })
        return seq
      },
      clear: (id: unknown) => {
        const i = pending.findIndex((p) => p.id === id)
        if (i >= 0) pending.splice(i, 1)
      },
    },
    fire() {
      const next = pending.shift()
      next?.fn()
      return next?.ms
    },
  }
}

function setup() {
  const server = fakeServer()
  const clock = fakeTimers()
  const received: NotificationResponse[] = []
  const connects: Array<{ reconnect: boolean; resumedFrom: string | undefined }> = []
  const statuses: StreamStatus[] = []
  const stream = createNotificationStream({
    open: server.open,
    onNotification: (n) => received.push(n),
    onConnected: (info) => connects.push(info),
    onStatus: (s) => statuses.push(s),
    timers: clock.timers,
    random: () => 1, // 흔들기 없이 상한 값
  })
  return { server, clock, received, connects, statuses, stream }
}

describe('재연결 기다림 — 지수 백오프', () => {
  it('1 · 2 · 4 · 8 · 16 · 30 · 30초(상한), 흔들기는 그 값의 50 ~ 100%', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => reconnectDelay(n, () => 1))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000])
    expect(reconnectDelay(0, () => 0)).toBe(500)
    expect(reconnectDelay(20, () => 0.5)).toBeLessThanOrEqual(RECONNECT_MAX_MS)
  })

  it('다시 붙지 않는 실패는 4xx 뿐(세션 끝 · 권한), 연결 실패 · 5xx 는 다시 붙는다', () => {
    expect(isFatalStreamError(new ApiError(401, 'INVALID_ACCESS_TOKEN', 'x'))).toBe(true)
    expect(isFatalStreamError(new ApiError(403, 'FORBIDDEN_ACCESS', 'x'))).toBe(true)
    expect(isFatalStreamError(new ApiError(500, 'INTERNAL_SERVER_ERROR', 'x'))).toBe(false)
    expect(isFatalStreamError(new NetworkError())).toBe(false)
  })
})

describe('실시간 알림 연결', () => {
  it('알림을 받으면 그 id 를 적고, 끊기면 그 id 를 Last-Event-ID 로 실어 다시 붙는다', async () => {
    const { server, clock, received, connects, stream } = setup()
    stream.start()
    await settle()
    expect(server.calls[0].lastEventId).toBeUndefined()
    server.connected()
    server.send(':heartbeat\n\n')
    server.notify(41)
    server.notify(42)
    await settle()
    expect(received.map((n) => n.id)).toEqual([41, 42])
    expect(stream.status).toBe('open')

    server.drop()
    await settle()
    expect(stream.status).toBe('waiting')
    expect(clock.fire()).toBe(1000)
    await settle()
    expect(server.calls[1].lastEventId).toBe('42')
    server.connected()
    await settle()
    expect(connects).toEqual([
      { reconnect: false, resumedFrom: undefined },
      { reconnect: true, resumedFrom: '42' },
    ])
  })

  it('서버의 정상 종료(30분)도 다시 붙는다 — 붙어 있었으니 처음 기다림(1초)부터', async () => {
    const { server, clock, stream } = setup()
    stream.start()
    await settle()
    server.connected()
    await settle()
    server.end()
    await settle()
    expect(clock.pending.map((p) => p.ms)).toEqual([1000])
  })

  it('계속 실패하면 기다림이 1 · 2 · 4초로 늘고, 붙으면(connected) 처음으로 돌아간다', async () => {
    const { server, clock, stream } = setup()
    server.failures.push(new NetworkError(), new NetworkError(), new ApiError(503, 'UNEXPECTED_RESPONSE', 'x'))
    stream.start()
    await settle()
    const waits: Array<number | undefined> = []
    for (let i = 0; i < 3; i += 1) {
      waits.push(clock.fire())
      await settle()
    }
    expect(waits).toEqual([1000, 2000, 4000])
    // 넷째는 열렸다 — connected 를 받고 끊기면 다시 1초
    server.connected()
    await settle()
    server.drop()
    await settle()
    expect(clock.pending.map((p) => p.ms)).toEqual([1000])
  })

  it('4xx(재발급까지 해 본 401)는 다시 두드리지 않고 멈춘다', async () => {
    const { server, clock, stream } = setup()
    server.failures.push(new ApiError(401, 'INVALID_ACCESS_TOKEN', '액세스 토큰이 유효하지 않거나 만료되었습니다'))
    stream.start()
    await settle()
    expect(stream.status).toBe('stopped')
    expect(clock.pending).toHaveLength(0)
    expect(server.calls).toHaveLength(1)
  })

  it('숨으면(pause) 끊고 기다림도 지운다, 보이면(resume) 기다리지 않고 Last-Event-ID 로 붙는다', async () => {
    const { server, clock, stream } = setup()
    stream.start()
    await settle()
    server.connected()
    server.notify(7)
    await settle()
    stream.pause()
    await settle()
    expect(server.calls[0].signal.aborted).toBe(true)
    expect(stream.status).toBe('paused')
    expect(clock.pending).toHaveLength(0)
    stream.resume()
    await settle()
    expect(server.calls).toHaveLength(2)
    expect(server.calls[1].lastEventId).toBe('7')
  })

  it('기다리는 중 숨으면 타이머가 지워진다 — 숨은 탭이 몰래 다시 붙지 않는다', async () => {
    const { server, clock, stream } = setup()
    server.failures.push(new NetworkError())
    stream.start()
    await settle()
    expect(clock.pending).toHaveLength(1)
    stream.pause()
    expect(clock.pending).toHaveLength(0)
    expect(server.calls).toHaveLength(1)
  })

  it('다시 온라인(retryNow)이면 기다림을 건너뛴다. 열려 있을 때는 아무것도 하지 않는다', async () => {
    const { server, clock, stream } = setup()
    server.failures.push(new NetworkError(), new NetworkError())
    stream.start()
    await settle()
    clock.fire()
    await settle()
    expect(clock.pending[0].ms).toBe(2000)
    stream.retryNow()
    await settle()
    expect(server.calls).toHaveLength(3)
    // 다시 붙기 기다림은 지워졌고, 열린 연결의 죽음 감시(45초)만 남는다
    expect(clock.pending.map((p) => p.ms)).toEqual([STALL_MS])
    server.connected()
    await settle()
    stream.retryNow()
    await settle()
    expect(server.calls).toHaveLength(3)
  })

  it('멈추면(stop — 로그아웃) 연결을 끊고 그 뒤 온 알림은 받지 않는다', async () => {
    const { server, received, stream } = setup()
    stream.start()
    await settle()
    server.connected()
    await settle()
    stream.stop()
    await settle()
    expect(server.calls[0].signal.aborted).toBe(true)
    expect(stream.status).toBe('stopped')
    expect(received).toHaveLength(0)
  })

  it('45초 동안 아무것도 오지 않으면(반쯤 끊긴 연결) 끊고 Last-Event-ID 로 다시 붙는다. heartbeat 가 오면 다시 센다', async () => {
    const { server, clock, stream } = setup()
    stream.start()
    await settle()
    server.connected()
    server.notify(12)
    await settle()
    expect(clock.pending.map((p) => p.ms)).toEqual([STALL_MS])
    server.send(':heartbeat\n\n')
    await settle()
    expect(clock.pending.map((p) => p.ms)).toEqual([STALL_MS]) // 다시 걸렸다(하나뿐)
    expect(clock.fire()).toBe(STALL_MS)
    await settle()
    expect(server.calls[0].signal.aborted).toBe(true)
    expect(stream.status).toBe('waiting')
    expect(clock.fire()).toBe(1000)
    await settle()
    expect(server.calls[1].lastEventId).toBe('12')
  })

  it('모양이 다른 data 는 버린다(캐시를 깨지 않게)', async () => {
    const { server, received, stream } = setup()
    stream.start()
    await settle()
    server.connected()
    server.send('id:3\nevent:notification\ndata:not json\n\n')
    server.send('id:4\nevent:notification\ndata:{"id":"4"}\n\n')
    server.notify(5)
    await settle()
    expect(received.map((n) => n.id)).toEqual([5])
    expect(stream.lastEventId).toBe('5')
  })
})
