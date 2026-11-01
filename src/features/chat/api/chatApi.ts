import { env } from '@/shared/config/env'
import { request } from '@/shared/lib/http'

import type { ChatMessageResponse, ChatRoomResponse } from './types'

/** 한 번에 받는 지난 메시지 수(서버 기본 30, 최대 50) */
export const CHAT_PAGE_SIZE = 30

/** `GET /api/chat/rooms` — 내 대화방 전부, 최근 메시지 순. 로그인 필요 */
export function getChatRooms(signal?: AbortSignal): Promise<ChatRoomResponse[]> {
  return request<ChatRoomResponse[]>('/api/chat/rooms', { signal })
}

/**
 * `GET /api/chat/rooms/{roomId}/messages?before=&size=` — **최신 순**. 더 옛날 것은 받은 것 중 가장 작은 id 를 `before` 로.
 * 받은 수가 `size` 보다 적으면 끝이다.
 * 실패 code : `CHAT_ROOM_FORBIDDEN`(403, 당사자 아님) · `CHAT_ROOM_NOT_FOUND`(404)
 */
export function getChatMessages(
  roomId: number,
  before: number | undefined,
  signal?: AbortSignal,
): Promise<ChatMessageResponse[]> {
  return request<ChatMessageResponse[]>(`/api/chat/rooms/${roomId}/messages`, {
    query: { before, size: CHAT_PAGE_SIZE },
    signal,
  })
}

/**
 * `PATCH /api/chat/rooms/{roomId}/read` — 204. 방의 마지막 메시지까지 읽음.
 * 서버가 그 방의 안 읽은 `CHAT_MESSAGE` 알림도 함께 읽음으로 바꾼다
 */
export function markChatRoomRead(roomId: number): Promise<void> {
  return request<void>(`/api/chat/rooms/${roomId}/read`, { method: 'PATCH' })
}

/**
 * `POST /api/chat/rooms/{roomId}/block` — 204. 방이 BLOCKED 가 되고 안내 메시지가 방에 온다. 되돌리는 API 는 없다.
 * 두 사람 사이에 새 방도 열리지 않는다(`ChatRoomService.open` 이 BLOCKED 방을 본다)
 */
export function blockChatRoom(roomId: number): Promise<void> {
  return request<void>(`/api/chat/rooms/${roomId}/block`, { method: 'POST' })
}

/**
 * 채팅 WebSocket 주소 — STOMP 끝점 `/ws`(SockJS 없음). API 와 같은 출처다 :
 *   - `VITE_API_BASE_URL` 이 비었으면(개발 · 배포 모두) 이 화면의 출처. 개발은 Vite 프록시(`ws: true`)가 백엔드로, 배포는 CloudFront `/ws` 동작이 EC2 로 넘긴다
 *   - 다른 출처 API 로 빌드했으면 그 출처(`https` → `wss`)
 * 토큰은 주소에 싣지 않는다(기록 · 서버 로그에 남는다, 보안명세서 3장) — CONNECT 프레임 머리글로 보낸다
 */
export function chatSocketUrl(location: Pick<Location, 'protocol' | 'host'> = window.location): string {
  const base = env.apiBaseUrl ? new URL(env.apiBaseUrl) : null
  const secure = (base ? base.protocol : location.protocol) === 'https:'
  const host = base ? base.host : location.host
  return `${secure ? 'wss' : 'ws'}://${host}/ws`
}
