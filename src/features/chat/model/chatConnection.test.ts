import { describe, expect, it } from 'vitest'

import { ApiError, NetworkError } from '@/shared/lib/http'

import {
  CONNECT_TIMEOUT_MS,
  HEARTBEAT_GRACE,
  createChatConnection,
  type ChatConnectionStatus,
  type SocketLike,
} from './chatConnection'

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

/** 서버 흉내 — 열 때마다 소켓 하나. 보낸 프레임을 모으고, 서버 쪽 프레임 · 닫힘을 손으로 민다 */
class FakeSocket implements SocketLike {
  binaryType = ''
  sent: string[] = []
  closed = false
  onopen: ((event: never) => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: never) => void) | null = null
  onerror: ((event: never) => void) | null = null
  readonly url: string
  constructor(url: string) {
    this.url = url
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
  }
  open() {
    this.onopen?.({} as never)
  }
  frame(text: string) {
    this.onmessage?.({ data: text })
  }
  connected(heartBeat = '10000,10000') {
    this.frame(`CONNECTED\nversion:1.2\nheart-beat:${heartBeat}\n\n\0`)
  }
  serverClose() {
    this.onclose?.({} as never)
  }
  commands() {
    return this.sent.filter((s) => s !== '\n').map((s) => s.split('\n')[0])
  }
}

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
    /** 가장 짧은 타이머를 울린다 */
    fire() {
      if (pending.length === 0) return undefined
      const next = pending.reduce((a, b) => (b.ms < a.ms ? b : a))
      pending.splice(pending.indexOf(next), 1)
      next.fn()
      return next.ms
    },
    fireWith(ms: number) {
      const next = pending.find((p) => p.ms === ms)
      if (!next) return false
      pending.splice(pending.indexOf(next), 1)
      next.fn()
      return true
    },
  }
}

function setup(overrides: { token?: string | null; remaining?: number | null; refresh?: () => Promise<string> } = {}) {
  const sockets: FakeSocket[] = []
  const clock = fakeTimers()
  let token = overrides.token === undefined ? 'access-1' : overrides.token
  const refreshCalls: number[] = []
  const statuses: ChatConnectionStatus[] = []
  const connects: boolean[] = []
  const connection = createChatConnection({
    url: () => 'wss://example.test/ws',
    createSocket: (url) => {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket
    },
    getToken: () => token,
    tokenRemainingMs: () => overrides.remaining ?? null,
    refreshToken:
      overrides.refresh ??
      (() => {
        refreshCalls.push(1)
        token = `access-${refreshCalls.length + 1}`
        return Promise.resolve(token)
      }),
    timers: clock.timers,
    random: () => 1,
  })
  connection.onStatus(() => statuses.push(connection.status))
  connection.onConnected(({ reconnect }) => connects.push(reconnect))
  const last = () => sockets[sockets.length - 1]
  return { sockets, last, clock, connection, statuses, connects, refreshCalls }
}

describe('createChatConnection — 연결 · 인증', () => {
  it('열리면 CONNECT 에 Bearer 토큰 · 심장박동, 주소에는 토큰이 없다', async () => {
    const { last, connection } = setup()
    connection.start()
    await flush()
    expect(last().url).toBe('wss://example.test/ws')
    last().open()
    const connect = last().sent[0]
    expect(connect).toContain('CONNECT\naccept-version:1.2\n')
    expect(connect).toContain('Authorization:Bearer access-1\n')
    expect(connect).toContain('heart-beat:10000,10000\n')
    expect(last().url).not.toContain('access')
  })

  it('CONNECTED 를 받으면 열림 · 오류 칸 구독 · 미리 건 구독을 건다', async () => {
    const { last, connection, connects } = setup()
    const got: string[] = []
    connection.subscribe('/topic/rooms/7', (body) => got.push(body))
    connection.start()
    await flush()
    last().open()
    last().connected()
    expect(connection.status).toBe('open')
    expect(connects).toEqual([false])
    const subs = last().sent.filter((s) => s.startsWith('SUBSCRIBE'))
    expect(subs.some((s) => s.includes('destination:/user/queue/errors'))).toBe(true)
    expect(subs.some((s) => s.includes('destination:/topic/rooms/7'))).toBe(true)
    const id = /id:(sub-\d+)/.exec(subs.find((s) => s.includes('/topic/rooms/7'))!)![1]
    last().frame(`MESSAGE\nsubscription:${id}\ndestination:/topic/rooms/7\n\n{"id":1}\0`)
    expect(got).toEqual(['{"id":1}'])
  })

  it('토큰이 없으면 열지 않고 멈춘다', async () => {
    const { sockets, connection } = setup({ token: null })
    connection.start()
    await flush()
    expect(sockets).toHaveLength(0)
    expect(connection.status).toBe('stopped')
  })

  it('토큰이 곧 끝나면 먼저 재발급하고 새 토큰으로 연다', async () => {
    const { last, connection, refreshCalls } = setup({ remaining: 5_000 })
    connection.start()
    await flush()
    expect(refreshCalls).toHaveLength(1)
    last().open()
    expect(last().sent[0]).toContain('Authorization:Bearer access-2')
  })

  it('연결 전 ERROR(토큰 거절) → 재발급 한 번 → 바로 다시 열기. 또 거절되면 백오프', async () => {
    const { sockets, last, connection, refreshCalls, clock } = setup()
    connection.start()
    await flush()
    last().open()
    last().frame('ERROR\nmessage:invalid\n\n\0')
    last().serverClose()
    await flush()
    expect(refreshCalls).toHaveLength(1)
    expect(sockets).toHaveLength(2)
    last().open()
    expect(last().sent[0]).toContain('Authorization:Bearer access-2')
    // 둘째 거절 — 재발급하지 않고 기다렸다 다시
    last().frame('ERROR\nmessage:invalid\n\n\0')
    last().serverClose()
    await flush()
    expect(refreshCalls).toHaveLength(1)
    expect(connection.status).toBe('waiting')
    expect(clock.pending.map((p) => p.ms)).toContain(1_000)
  })

  it('재발급이 4xx 로 거절되면(세션 끝) 멈춘다', async () => {
    const { last, connection, sockets } = setup({
      refresh: () => Promise.reject(new ApiError(401, 'INVALID_REFRESH_TOKEN', 'x')),
    })
    connection.start()
    await flush()
    last().open()
    last().frame('ERROR\nmessage:invalid\n\n\0')
    last().serverClose()
    await flush()
    expect(connection.status).toBe('stopped')
    expect(sockets).toHaveLength(1)
  })

  it('재발급이 네트워크 오류면 백오프로 다시', async () => {
    const { last, connection } = setup({ refresh: () => Promise.reject(new NetworkError()) })
    connection.start()
    await flush()
    last().open()
    last().frame('ERROR\nmessage:invalid\n\n\0')
    last().serverClose()
    await flush()
    expect(connection.status).toBe('waiting')
  })
})

describe('createChatConnection — 끊김 · 다시 붙기', () => {
  it('끊기면 1 · 2 · 4초 … 로 다시 붙고, 붙으면 처음 값으로 · 다시 붙음을 알린다', async () => {
    const { sockets, last, connection, clock, connects } = setup()
    connection.start()
    await flush()
    last().open()
    last().connected()
    last().serverClose()
    expect(connection.status).toBe('waiting')
    expect(clock.fireWith(1_000)).toBe(true)
    await flush()
    expect(sockets).toHaveLength(2)
    last().serverClose()
    expect(clock.fireWith(2_000)).toBe(true)
    await flush()
    last().open()
    last().connected()
    expect(connects).toEqual([false, true])
    last().serverClose()
    expect(clock.pending.some((p) => p.ms === 1_000)).toBe(true)
  })

  it('심장박동 — 10초마다 빈 줄을 보내고, 25초 동안 아무것도 없으면 끊고 다시', async () => {
    const { last, connection, clock } = setup()
    connection.start()
    await flush()
    last().open()
    last().connected()
    expect(clock.fireWith(10_000)).toBe(true)
    expect(last().sent).toContain('\n')
    const first = last()
    expect(clock.fireWith(10_000 * HEARTBEAT_GRACE)).toBe(true)
    expect(first.closed).toBe(true)
    expect(connection.status).toBe('waiting')
  })

  it('받은 바이트(심장박동 포함)마다 죽음 감시를 다시 건다', async () => {
    const { last, connection, clock } = setup()
    connection.start()
    await flush()
    last().open()
    last().connected()
    last().frame('\n')
    expect(clock.pending.filter((p) => p.ms === 10_000 * HEARTBEAT_GRACE)).toHaveLength(1)
  })

  it('열고 10초 안에 CONNECTED 가 없으면 다시', async () => {
    const { last, connection, clock } = setup()
    connection.start()
    await flush()
    last().open()
    expect(clock.fireWith(CONNECT_TIMEOUT_MS)).toBe(true)
    expect(connection.status).toBe('waiting')
  })

  it('숨으면 끊고(쉼), 보이면 기다리지 않고 붙는다 · 온라인이면 기다림을 건너뛴다', async () => {
    const { sockets, last, connection, clock } = setup()
    connection.start()
    await flush()
    last().open()
    last().connected()
    connection.pause()
    expect(connection.status).toBe('paused')
    expect(last().closed).toBe(true)
    expect(clock.pending).toHaveLength(0)
    connection.resume()
    await flush()
    expect(sockets).toHaveLength(2)
    last().serverClose()
    expect(connection.status).toBe('waiting')
    connection.retryNow()
    await flush()
    expect(sockets).toHaveLength(3)
  })

  it('멈추면 소켓을 닫고 다시 붙지 않는다', async () => {
    const { last, connection, clock } = setup()
    connection.start()
    await flush()
    last().open()
    last().connected()
    connection.stop()
    expect(last().closed).toBe(true)
    expect(connection.status).toBe('stopped')
    expect(clock.pending).toHaveLength(0)
  })
})

describe('createChatConnection — 구독 · 보내기', () => {
  it('열린 뒤 구독하면 바로 SUBSCRIBE, 해제하면 UNSUBSCRIBE', async () => {
    const { last, connection } = setup()
    connection.start()
    await flush()
    last().open()
    last().connected()
    const off = connection.subscribe('/topic/rooms/3', () => undefined)
    expect(last().commands().slice(-1)).toEqual(['SUBSCRIBE'])
    off()
    expect(last().commands().slice(-1)).toEqual(['UNSUBSCRIBE'])
  })

  it('보내기는 열려 있을 때만 — SEND 프레임 · JSON', async () => {
    const { last, connection } = setup()
    expect(connection.send('/app/rooms/3', '{}')).toBe(false)
    connection.start()
    await flush()
    last().open()
    expect(connection.send('/app/rooms/3', '{}')).toBe(false)
    last().connected()
    expect(connection.send('/app/rooms/3', '{"content":"안녕"}')).toBe(true)
    expect(last().sent.slice(-1)[0]).toBe('SEND\ndestination:/app/rooms/3\ncontent-type:application/json\n\n{"content":"안녕"}\0')
  })

  it('보낸 연결의 오류(/user/queue/errors)를 알린다', async () => {
    const { last, connection } = setup()
    const errors: string[] = []
    connection.onServerError((body) => errors.push(body))
    connection.start()
    await flush()
    last().open()
    last().connected()
    last().frame('MESSAGE\nsubscription:errors\ndestination:/user/queue/errors\n\n{"code":"CHAT_ROOM_NOT_OPEN","message":"x"}\0')
    expect(errors).toEqual(['{"code":"CHAT_ROOM_NOT_OPEN","message":"x"}'])
  })
})
