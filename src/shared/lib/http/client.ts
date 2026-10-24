import { env } from '@/shared/config/env'

import { getAccessToken, getAccessTokenRemainingMs } from './accessToken'
import {
  ApiError,
  CONNECTION_FAILED_MESSAGE,
  NetworkError,
  UNEXPECTED_RESPONSE,
  isErrorResponse,
} from './errors'
import { buildQueryString, type QueryValue } from './query'
import { expireSession, refreshAccessToken } from './tokenRefresh'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** 비어 있는 값(`undefined` · `null` · `''`)은 쿼리스트링에서 빠진다. 배열은 같은 이름을 되풀이한다(`status=OPEN&status=IN_PROGRESS`) */
export type { QueryValue }

export interface RequestOptions {
  method?: HttpMethod
  query?: Record<string, QueryValue>
  /** 일반 객체는 JSON 으로, `FormData` 는 그대로(multipart) 보낸다 */
  body?: unknown
  signal?: AbortSignal
  /**
   * 액세스 토큰을 싣지 않고, 401 에 재발급도 걸지 않는다. 토큰을 받으러 가는 `login` · `reissue` 전용.
   * 이 둘의 401 에 재발급을 걸면 재발급이 재발급을 부르는 무한 루프가 된다.
   */
  skipAuth?: boolean
}

/**
 * 백엔드 호출의 유일한 통로.
 *
 * 성공이면 본문(JSON)을, 204 면 `undefined` 를 돌려준다.
 * 실패면 `ApiError`(서버가 응답함) 또는 `NetworkError`(응답 없음)를 던진다.
 *
 * 401 `INVALID_ACCESS_TOKEN` 을 받으면 재발급 후 **딱 한 번** 다시 보낸다.
 * 401 은 인증 필터에서 나므로 서버는 요청을 처리하지 않았다. POST 를 다시 보내도 중복되지 않는다.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query)

  if (!options.skipAuth && options.body instanceof FormData) {
    await refreshIfExpiring()
  }

  const sentToken = options.skipAuth ? null : getAccessToken()

  try {
    return await attempt<T>(url, options, sentToken)
  } catch (error) {
    if (options.skipAuth || !isAccessTokenRejected(error)) {
      throw error
    }
  }

  // 재발급이 실패하면 그 오류가 그대로 올라간다.
  // 네트워크 오류면 status 가 없어 queryClient 가 재시도하고, 4xx 면 재시도하지 않는다
  const retryToken = await tokenForRetry(sentToken)

  try {
    return await attempt<T>(url, options, retryToken)
  } catch (error) {
    // 방금 받은 토큰도 거절됐다. 더 재발급하지 않고 세션을 끝낸다
    if (isAccessTokenRejected(error)) {
      expireSession()
    }
    throw error
  }
}

export interface StreamOptions {
  signal: AbortSignal
  /** 덧붙일 머리글(`Last-Event-ID` 등) */
  headers?: Record<string, string>
}

/**
 * 끝나지 않는 응답(SSE `text/event-stream`)을 연다. 본문을 읽지 않고 **열린 응답**을 돌려준다 — 읽는 쪽이 `response.body` 를 흘려 읽는다.
 *
 * 브라우저의 `EventSource` 는 머리글을 실을 수 없어 `Authorization: Bearer` 가 필요한 우리 서버에 못 쓴다. 그래서 `fetch` 로 연다.
 * 인증은 `request` 와 같다 — 토큰을 싣고, 401 `INVALID_ACCESS_TOKEN` 이면 재발급(탭 안 · 탭 사이 한 번) 뒤 **딱 한 번** 다시 연다.
 * 다시 연 것도 거절되면 세션을 끝낸다. 실패는 `ApiError`(서버가 응답함) · `NetworkError`(응답 없음)로 던진다.
 * 성공 응답인데 `text/event-stream` 이 아니면(개발 프록시 · CDN 이 화면 HTML 을 대신 준 경우) `UNEXPECTED_RESPONSE` 다
 */
export async function openStream(path: string, options: StreamOptions): Promise<Response> {
  const url = buildUrl(path, undefined)
  const sentToken = getAccessToken()

  try {
    return await attemptStream(url, options, sentToken)
  } catch (error) {
    if (!isAccessTokenRejected(error)) throw error
  }

  const retryToken = await tokenForRetry(sentToken)
  try {
    return await attemptStream(url, options, retryToken)
  } catch (error) {
    if (isAccessTokenRejected(error)) expireSession()
    throw error
  }
}

async function attemptStream(url: string, options: StreamOptions, token: string | null): Promise<Response> {
  const headers = new Headers({ Accept: 'text/event-stream', ...options.headers })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await send(url, {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
    signal: options.signal,
  })
  if (!response.ok) {
    // 실패 본문은 짧은 JSON 이다 — 여느 요청과 같이 읽어 ApiError 로 던진다
    await readResult<never>(response, options.signal)
  }
  if (!response.body || !(response.headers.get('Content-Type') ?? '').includes('text/event-stream')) {
    await response.body?.cancel().catch(() => undefined)
    throw new ApiError(response.status, UNEXPECTED_RESPONSE, CONNECTION_FAILED_MESSAGE)
  }
  return response
}

async function attempt<T>(url: string, options: RequestOptions, token: string | null): Promise<T> {
  const response = await send(url, buildInit(options, token))
  return readResult<T>(response, options.signal)
}

/** 이보다 적게 남았으면 multipart 를 보내기 전에 미리 재발급한다 */
const MULTIPART_TOKEN_MARGIN_MS = 60_000

/**
 * 사진을 실은 요청(multipart)은 **토큰이 곧 끝나면 먼저 재발급하고** 보낸다.
 *
 * 글을 쓰는 데 5분이 넘게 걸리는 게 보통이라, 그냥 보내면 첫 시도가 거의 항상 401 이다.
 * 401 은 인증 필터가 본문을 읽기 전에 내리는데, 몇 MB 짜리 본문을 서버(Tomcat)가 다 받아 주지 않고
 * 연결을 끊으면 브라우저는 401 대신 네트워크 오류를 본다. 그러면 재발급 · 재시도 경로를 타지 못하고
 * "연결하지 못했어요"가 뜬다. 사진 수 MB 를 두 번 올리는 낭비도 막는다.
 *
 * 재발급은 `refreshAccessToken()` 을 거친다 — 동시에 여럿이 불러도 한 번만 나간다.
 * 토큰이 없거나(비로그인) 수명을 못 읽으면 아무것도 하지 않고 평소 경로(401 → 재발급)에 맡긴다.
 */
async function refreshIfExpiring(): Promise<void> {
  const remaining = getAccessTokenRemainingMs()
  if (remaining !== null && remaining < MULTIPART_TOKEN_MARGIN_MS) {
    await refreshAccessToken()
  }
}

function isAccessTokenRejected(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === 'INVALID_ACCESS_TOKEN'
}

function tokenForRetry(sentToken: string | null): Promise<string> {
  const current = getAccessToken()
  // 이 요청이 나가 있는 사이 다른 요청이 재발급을 끝냈다. 또 재발급하지 않고 새 토큰으로 보낸다
  if (current !== null && current !== sentToken) {
    return Promise.resolve(current)
  }
  return refreshAccessToken()
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const search = buildQueryString(query)
  // apiBaseUrl 이 빈 문자열이면 상대경로 — 개발은 Vite 프록시, 배포는 CloudFront 가 받는다
  return `${env.apiBaseUrl}${path}${search ? `?${search}` : ''}`
}

function buildInit(options: RequestOptions, token: string | null): RequestInit {
  const headers = new Headers({ Accept: 'application/json' })
  let body: BodyInit | undefined

  // 공개 API(목록·상세)에도 싣는다. 상세의 조회수 집계가 로그인 회원 기준이다
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (options.body instanceof FormData) {
    // Content-Type 을 직접 넣지 않는다. 브라우저가 boundary 를 붙여 채운다.
    // 401 뒤 재시도에 같은 FormData 를 다시 넣어도 된다 — fetch 가 보낼 때마다 새로 직렬화하고,
    // 안의 File 은 Blob 이라 몇 번이고 다시 읽힌다(스트림처럼 소모되지 않는다)
    body = options.body
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  return {
    method: options.method ?? 'GET',
    headers,
    body,
    // 리프레시 토큰 쿠키를 싣는다. 빠뜨리면 로그인은 되는데 5분 뒤 재발급이 401 로 조용히 실패한다
    credentials: 'include',
    signal: options.signal,
  }
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    // 취소는 오류가 아니다. TanStack Query 가 알아서 처리하도록 그대로 넘긴다
    if (init.signal?.aborted) {
      throw error
    }
    throw new NetworkError({ cause: error })
  }
}

async function readResult<T>(response: Response, signal: AbortSignal | undefined): Promise<T> {
  let text: string
  try {
    text = await response.text()
  } catch (error) {
    if (signal?.aborted) {
      throw error
    }
    throw new NetworkError({ cause: error })
  }

  if (response.ok) {
    if (text === '') {
      return undefined as T
    }
    const body = parseJson(text)
    if (body === INVALID_JSON) {
      // 성공인데 JSON 이 아니다. 데이터로 취급하지 않고 실패로 드러낸다
      throw new ApiError(response.status, UNEXPECTED_RESPONSE, CONNECTION_FAILED_MESSAGE)
    }
    return body as T
  }

  const body = parseJson(text)
  if (isErrorResponse(body)) {
    throw new ApiError(response.status, body.code, body.message)
  }
  throw new ApiError(response.status, UNEXPECTED_RESPONSE, CONNECTION_FAILED_MESSAGE)
}

const INVALID_JSON = Symbol('INVALID_JSON')

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return INVALID_JSON
  }
}
