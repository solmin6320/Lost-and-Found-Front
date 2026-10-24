import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearAccessToken, getAccessToken, setAccessToken } from './accessToken'
import { openStream } from './client'
import { ApiError, NetworkError, UNEXPECTED_RESPONSE } from './errors'
import { setTokenRefresher, subscribeSessionExpired } from './tokenRefresh'

const SSE = { 'Content-Type': 'text/event-stream;charset=UTF-8' }
const rejected = () =>
  new Response(JSON.stringify({ code: 'INVALID_ACCESS_TOKEN', message: '액세스 토큰이 유효하지 않거나 만료되었습니다' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
const opened = () => new Response('event:connected\ndata:ok\n\n', { status: 200, headers: SSE })

type Call = { url: string; auth: string | null; lastEventId: string | null; accept: string | null; credentials: RequestCredentials | undefined }

function stubFetch(responses: Array<() => Response | Promise<Response>>) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers)
    calls.push({
      url,
      auth: headers.get('Authorization'),
      lastEventId: headers.get('Last-Event-ID'),
      accept: headers.get('Accept'),
      credentials: init.credentials,
    })
    const next = responses.shift()
    if (!next) throw new Error('예상보다 많이 불렀다')
    return Promise.resolve(next())
  })
  return calls
}

describe('openStream — 머리글이 필요한 SSE 를 fetch 로 연다', () => {
  // `navigator.locks` 가 없는 환경(노드)은 탭 안 단일 비행만 — 시험에서 그대로 쓴다
  beforeEach(() => {
    setAccessToken('old-token')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    clearAccessToken()
  })

  it('토큰 · Last-Event-ID · Accept · 쿠키를 싣고 열린 응답을 준다', async () => {
    const calls = stubFetch([opened])
    const response = await openStream('/api/notifications/stream', { signal: new AbortController().signal, headers: { 'Last-Event-ID': '42' } })
    expect(await response.text()).toContain('connected')
    expect(calls).toEqual([
      { url: '/api/notifications/stream', auth: 'Bearer old-token', lastEventId: '42', accept: 'text/event-stream', credentials: 'include' },
    ])
  })

  it('401 INVALID_ACCESS_TOKEN → 재발급 한 번 → 새 토큰으로 다시 연다', async () => {
    let refreshed = 0
    setTokenRefresher(async () => {
      refreshed += 1
      return 'new-token'
    })
    const calls = stubFetch([rejected, opened])
    const response = await openStream('/api/notifications/stream', { signal: new AbortController().signal })
    expect(response.ok).toBe(true)
    expect(refreshed).toBe(1)
    expect(calls.map((c) => c.auth)).toEqual(['Bearer old-token', 'Bearer new-token'])
    expect(getAccessToken()).toBe('new-token')
  })

  it('새 토큰도 거절되면 세션을 끝내고(만료 알림) ApiError 401 을 던진다 — 더 재발급하지 않는다', async () => {
    let refreshed = 0
    setTokenRefresher(async () => {
      refreshed += 1
      return 'new-token'
    })
    let expired = 0
    const unsubscribe = subscribeSessionExpired(() => {
      expired += 1
    })
    stubFetch([rejected, rejected])
    await expect(openStream('/api/notifications/stream', { signal: new AbortController().signal })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_ACCESS_TOKEN',
    })
    expect(refreshed).toBe(1)
    expect(expired).toBe(1)
    unsubscribe()
  })

  it('성공인데 event-stream 이 아니면(화면 HTML 이 대신 옴) UNEXPECTED_RESPONSE', async () => {
    stubFetch([() => new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } })])
    const error = await openStream('/api/notifications/stream', { signal: new AbortController().signal }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe(UNEXPECTED_RESPONSE)
  })

  it('응답이 없으면 NetworkError(다시 붙을 대상)', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    await expect(openStream('/api/notifications/stream', { signal: new AbortController().signal })).rejects.toBeInstanceOf(NetworkError)
  })
})
