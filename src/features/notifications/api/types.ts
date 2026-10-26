/**
 * 알림 응답 형태. 원본 : Lost-and-Found `dto/response/NotificationResponse` · `entity/NotificationType`(PR #43)
 */

/**
 * 알림 종류. 지금 서버가 내는 것은 확인 요청 셋(`ClaimService`)이다.
 * `MATCH_SUGGESTED`(자동 매칭) · `CHAT_MESSAGE`(채팅)는 이름만 있고 아직 내지 않는다 — 문장은 준비해 둔다(SCR-10)
 */
export type NotificationType = 'CLAIM_REQUESTED' | 'CLAIM_APPROVED' | 'CLAIM_REJECTED' | 'MATCH_SUGGESTED' | 'CHAT_MESSAGE'

export interface NotificationResponse {
  id: number
  /** 서버에 새 종류가 생겨도 화면이 깨지지 않게 문자열도 받는다(아는 종류가 아니면 공통 문장) */
  type: NotificationType | (string & {})
  /** 대상 글. 글이 지워져도 알림은 남는다 */
  postId: number | null
  claimId: number | null
  /** 알림이 만들어질 때의 글 제목(그 뒤 글 제목이 바뀌어도 그대로) */
  postTitle: string | null
  /** 한 사람 — 요청자(받은 요청) · 글쓴이(승인 · 거절) */
  actorNickname: string | null
  read: boolean
  /** 서버 `LocalDateTime`(시간대 없음, 서버 시각) */
  createdAt: string
}

/** `GET /api/notifications/unread-count` */
export interface UnreadCountResponse {
  count: number
}
