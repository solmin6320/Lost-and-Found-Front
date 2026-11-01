/**
 * 1:1 채팅 응답 형태. 원본 : Lost-and-Found `dto/response/ChatRoomResponse` · `ChatMessageResponse` ·
 * `entity/ChatRoomStatus` · `ChatMessageType`(7.6 ③, `feature/chat`)
 */

import type { ClaimStatus } from '@/features/claims'

/**
 * 방 상태.
 *   OPEN       말할 수 있다
 *   READ_ONLY  승인이 취소됐다 — 읽기만
 *   CLOSED     물건을 받아 끝났다(또는 글이 지워졌다 — 서버가 CLOSED 로 준다)
 *   BLOCKED    당사자 한쪽이 차단했다 — 두 사람 사이에 새 방도 열리지 않는다
 */
export type ChatRoomStatus = 'OPEN' | 'READ_ONLY' | 'CLOSED' | 'BLOCKED'

export type ChatMessageType = 'USER' | 'SYSTEM'

/** `GET /api/chat/rooms` 의 항목 — 최근 메시지 순 */
export interface ChatRoomResponse {
  roomId: number
  /** 방을 연 주인 확인 요청. 요청이 지워졌으면 `null` */
  claimId: number | null
  /** 그 글. 글이 지워졌으면 `null`(방은 CLOSED) */
  postId: number | null
  /** 방이 열릴 때의 글 제목(그 뒤 바뀌어도 그대로) */
  postTitle: string
  status: ChatRoomStatus | (string & {})
  claimStatus: ClaimStatus | null
  /** 내가 글쓴이인가. 물건을 받는 쪽은 글 종류로 갈린다(습득 글 = 요청자, 분실 글 = 글쓴이 — `isReceiver`) */
  writer: boolean
  partnerId: number
  partnerNickname: string
  /** 마지막 메시지 본문(서버가 이미 가린 것). 없으면 `null` */
  lastMessage: string | null
  /** 마지막 메시지 시각(없으면 방이 열린 시각). 서버 `LocalDateTime`(시간대 없음) */
  lastMessageAt: string
  unreadCount: number
}

/** 메시지 하나 — 기록(`GET …/messages`)과 실시간(`/topic/rooms/{id}`)이 같은 모양 */
export interface ChatMessageResponse {
  id: number
  roomId: number
  /** 안내 메시지(방 열림 · 승인 취소 · 받았어요 · 차단)면 `null` */
  senderId: number | null
  type: ChatMessageType | (string & {})
  /**
   * 서버가 **저장 전에 가린** 본문 — 원문은 서버에도 없다. 가린 자리는 `[전화번호]` · `[계좌번호]` · `[이메일]` 조각으로 들어 있다.
   * 화면은 바꾸지 않고 그 조각을 표시만 한다(텍스트로만 — HTML 해석 없음)
   */
  content: string
  /** 가린 곳이 있는가 */
  masked: boolean
  createdAt: string
}

/** STOMP `/user/queue/errors` — 보낸 연결에만 오는 실패 */
export interface ChatErrorPayload {
  code: string
  message: string
}

/** 메시지 한 개의 최대 글자 수. 원본 : `ChatSendRequest.content` `@Size(max = 1000)` */
export const CHAT_MESSAGE_MAX_LENGTH = 1000
