import { useCallback, useEffect, useSyncExternalStore } from 'react'

import { getAccessToken, getAccessTokenRemainingMs, refreshAccessToken } from '@/shared/lib/http'

import { chatSocketUrl } from '../api/chatApi'
import { createChatConnection, type ChatConnection, type ChatConnectionStatus, type SocketLike } from './chatConnection'

/**
 * 탭 하나에 채팅 연결 **하나** — 방 화면들이 나눠 쓴다(쓰는 곳이 생기면 열고, 다 떠나면 닫는다).
 *
 * - 쓰는 곳이 0이 되면 잠깐(2초) 기다렸다 닫는다 — 방에서 방으로 옮길 때 · 개발 모드 StrictMode 의 두 번 그리기에 다시 열지 않게
 * - 로그아웃 · 세션 만료(`enabled` 가 꺼짐)면 기다리지 않고 바로 닫는다
 * - 탭이 숨으면 끊고(상대가 보고 있지 않다고 서버가 알림을 만든다), 보이면 바로 붙는다. 브라우저가 다시 온라인이면 기다리지 않는다
 */
let shared: ChatConnection | null = null
let users = 0
let lingerTimer: ReturnType<typeof setTimeout> | null = null
let detachPageEvents: (() => void) | null = null

const LINGER_MS = 2_000

function connection(): ChatConnection {
  shared ??= createChatConnection({
    url: () => chatSocketUrl(),
    // 브라우저 WebSocket 의 이벤트 처리기 모양이 `SocketLike` 보다 넓다(this · Event) — 쓰는 것은 같다
    createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
    getToken: getAccessToken,
    tokenRemainingMs: getAccessTokenRemainingMs,
    refreshToken: refreshAccessToken,
  })
  return shared
}

function attachPageEvents(conn: ChatConnection) {
  const syncVisibility = () => {
    if (document.visibilityState === 'hidden') conn.pause()
    else conn.resume()
  }
  const onOnline = () => conn.retryNow()
  document.addEventListener('visibilitychange', syncVisibility)
  window.addEventListener('online', onOnline)
  return () => {
    document.removeEventListener('visibilitychange', syncVisibility)
    window.removeEventListener('online', onOnline)
  }
}

function acquire(): ChatConnection {
  const conn = connection()
  users += 1
  if (lingerTimer !== null) {
    clearTimeout(lingerTimer)
    lingerTimer = null
  }
  if (users === 1) {
    detachPageEvents ??= attachPageEvents(conn)
    conn.start()
    if (document.visibilityState === 'hidden') conn.pause()
  }
  return conn
}

function close() {
  detachPageEvents?.()
  detachPageEvents = null
  shared?.stop()
}

function release(immediately: boolean) {
  users = Math.max(0, users - 1)
  if (users > 0) return
  if (lingerTimer !== null) clearTimeout(lingerTimer)
  lingerTimer = null
  if (immediately) {
    close()
    return
  }
  lingerTimer = setTimeout(() => {
    lingerTimer = null
    if (users === 0) close()
  }, LINGER_MS)
}

const noopSubscribe = () => () => undefined

/**
 * 채팅 연결을 쓴다(`enabled` 동안). 연결과 지금 상태를 돌려준다 — 끊김 줄 · 보내기 단추가 상태를 본다.
 * 로그인했을 때만 켠다
 */
export function useChatConnection(enabled: boolean): { connection: ChatConnection | null; status: ChatConnectionStatus } {
  useEffect(() => {
    if (!enabled) return
    acquire()
    let released = false
    return () => {
      if (released) return
      released = true
      // 화면을 떠남 — 잠깐 기다렸다 닫는다. 로그아웃이면 다음 그리기에서 `enabled` 가 꺼져 이미 닫혔다
      release(false)
    }
  }, [enabled])

  // 로그아웃 · 세션 만료 — 기다리지 않고 닫는다(토큰이 없어진 연결을 남기지 않는다)
  useEffect(() => {
    if (enabled || users > 0) return
    if (lingerTimer !== null) {
      clearTimeout(lingerTimer)
      lingerTimer = null
      close()
    }
  }, [enabled])

  const conn = enabled ? connection() : null
  const subscribe = useCallback(
    (listener: () => void) => (conn ? conn.onStatus(listener) : noopSubscribe()),
    [conn],
  )
  const status = useSyncExternalStore(subscribe, () => (conn ? conn.status : 'idle'))
  return { connection: conn, status }
}
