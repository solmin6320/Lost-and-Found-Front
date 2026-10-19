/**
 * 시안용 목 데이터(2026-10-19). **숫자 · 글은 예시**다 — 통계 · 매칭 · 알림 · 채팅 API 가 생기면 그 응답으로 바뀐다.
 * 모양은 백엔드에 요청할 응답 초안이기도 하다(보고서의 "백엔드에 필요한 API" 와 같은 이름).
 */

/** GET /api/stats/summary (초안) */
export interface StatsSummary {
  /** 오늘 0시부터 올라온 글(분실 · 습득) */
  today: { lost: number; found: number }
  /** 이번 달 완료(주인 찾음)로 바뀐 글 */
  returnedThisMonth: number
  /** 이번 달 완료 글의 평균 되찾기 일수(올린 날 → 완료) */
  avgDaysToReturn: number
  /** 최근 7일 날마다 올라온 글. 마지막이 오늘 */
  last7Days: { date: string; lost: number; found: number }[]
}

export function mockStats(): StatsSummary {
  return {
    today: { lost: 14, found: 9 },
    returnedThisMonth: 41,
    avgDaysToReturn: 3.2,
    last7Days: [
      { date: '2026-10-13', lost: 11, found: 7 },
      { date: '2026-10-14', lost: 17, found: 12 },
      { date: '2026-10-15', lost: 9, found: 10 },
      { date: '2026-10-16', lost: 13, found: 6 },
      { date: '2026-10-17', lost: 21, found: 15 },
      { date: '2026-10-18', lost: 18, found: 11 },
      { date: '2026-10-19', lost: 14, found: 9 },
    ],
  }
}

export function emptyStats(): StatsSummary {
  return {
    today: { lost: 0, found: 0 },
    returnedThisMonth: 0,
    avgDaysToReturn: 0,
    last7Days: ['13', '14', '15', '16', '17', '18', '19'].map((d) => ({ date: `2026-10-${d}`, lost: 0, found: 0 })),
  }
}

/** GET /api/notifications (초안) — SSE 로 새 알림이 오면 맨 앞에 붙는다 */
export type NotificationKind = 'CLAIM_REQUESTED' | 'CLAIM_APPROVED' | 'CLAIM_REJECTED' | 'MATCH_SUGGESTED'

export interface LabNotification {
  id: number
  kind: NotificationKind
  /** 알림이 가리키는 글 */
  postId: number
  postTitle: string
  /** 상대 닉네임(확인 요청 · 승인 · 거절) 또는 후보 수(매칭) */
  actor?: string
  matchCount?: number
  /** 승인이면 열린 대화방 */
  roomId?: number
  createdAt: string
  read: boolean
}

export function mockNotifications(): LabNotification[] {
  return [
    { id: 91, kind: 'MATCH_SUGGESTED', postId: 25, postTitle: '검은색 가죽 반지갑 잃어버렸어요', matchCount: 3, createdAt: '2026-10-19T18:42:00', read: false },
    { id: 90, kind: 'CLAIM_REQUESTED', postId: 21, postTitle: '학생증 주웠어요 (한국대학교)', actor: '신촌주민', createdAt: '2026-10-19T17:05:00', read: false },
    { id: 89, kind: 'CLAIM_APPROVED', postId: 18, postTitle: '갈색 카드지갑 주인 찾습니다', actor: '잠실러', roomId: 7, createdAt: '2026-10-19T11:20:00', read: false },
    { id: 88, kind: 'CLAIM_REJECTED', postId: 16, postTitle: '안경 (검은 뿔테) 케이스째', actor: '종로', createdAt: '2026-10-18T21:47:00', read: true },
    { id: 87, kind: 'MATCH_SUGGESTED', postId: 19, postTitle: '갤럭시S24울트라 티타늄그레이 분실했어요', matchCount: 1, createdAt: '2026-10-18T09:13:00', read: true },
    { id: 86, kind: 'CLAIM_APPROVED', postId: 12, postTitle: '빨간 장지갑 주웠습니다', actor: '부산사람', roomId: 6, createdAt: '2026-10-16T15:30:00', read: true },
  ]
}

/** GET /api/chat/rooms (초안) */
export interface LabChatRoom {
  id: number
  postId: number
  postTitle: string
  postType: 'LOST' | 'FOUND'
  postCategory: 'WALLET' | 'ELECTRONICS' | 'CARD' | 'CLOTHES' | 'ETC'
  partner: string
  lastMessage: string
  lastAt: string
  unread: number
  /** 수령이 끝나 닫힌 방 — 읽기만 된다 */
  closed: boolean
}

export function mockRooms(): LabChatRoom[] {
  return [
    { id: 7, postId: 18, postTitle: '갈색 카드지갑 주인 찾습니다', postType: 'FOUND', postCategory: 'WALLET', partner: '잠실러', lastMessage: '내일 저녁 7시 롯데월드몰 지하 1층 안내데스크 앞 괜찮으세요?', lastAt: '2026-10-19T18:51:00', unread: 2, closed: false },
    { id: 6, postId: 12, postTitle: '빨간 장지갑 주웠습니다', postType: 'FOUND', postCategory: 'WALLET', partner: '부산사람', lastMessage: '잘 받았습니다. 정말 감사해요!', lastAt: '2026-10-17T20:02:00', unread: 0, closed: true },
    { id: 5, postId: 24, postTitle: '에어팟 프로 2세대 왼쪽 한 쪽 주웠습니다', postType: 'FOUND', postCategory: 'ELECTRONICS', partner: '성수동산책러', lastMessage: '케이스 뒷면에 스티커 있는지 알려 주실 수 있나요?', lastAt: '2026-10-15T13:12:00', unread: 0, closed: false },
  ]
}

/**
 * GET /api/chat/rooms/{id}/messages (초안). 서버가 보낼 때 이미 가린 글자다 — 화면은 가린 자리(`masked`)를 표시만 한다.
 * `masked` = [시작, 끝) 글자 위치 + 무엇을 가렸는지
 */
export interface LabMessage {
  id: number
  mine: boolean
  text: string
  masked?: { start: number; end: number; kind: 'PHONE' | 'ACCOUNT' }[]
  sentAt: string
  /** 상대가 읽었는지(내 메시지만) */
  read?: boolean
  /** 시스템 안내(승인 · 닫힘) */
  system?: boolean
}

function maskedText(parts: (string | { mask: string; kind: 'PHONE' | 'ACCOUNT' })[]) {
  let text = ''
  const masked: NonNullable<LabMessage['masked']> = []
  for (const part of parts) {
    if (typeof part === 'string') text += part
    else {
      masked.push({ start: text.length, end: text.length + part.mask.length, kind: part.kind })
      text += part.mask
    }
  }
  return { text, masked }
}

export function mockMessages(closed: boolean): LabMessage[] {
  const phone = maskedText(['제 번호 ', { mask: '010-****-****', kind: 'PHONE' }, ' 이에요. 급하면 전화 주세요'])
  const account = maskedText(['계좌는 ', { mask: '국민 ******-**-****', kind: 'ACCOUNT' }, ' 인데 사례는 정말 괜찮아요. 찾으셔서 다행이에요!'])
  const list: LabMessage[] = [
    { id: 1, mine: false, system: true, text: '잠실러 님이 확인 요청을 승인했어요. 이 대화는 두 분만 볼 수 있어요.', sentAt: '2026-10-19T11:20:00' },
    { id: 2, mine: true, text: '안녕하세요! 갈색 카드지갑 제 것 같아요. 안에 하나카드 체크카드랑 도서관 회원증 있지 않나요?', sentAt: '2026-10-19T11:22:00', read: true },
    { id: 3, mine: false, text: '네 맞아요. 회원증 이름 앞 글자만 확인할게요. 성이 김 씨 맞으세요?', sentAt: '2026-10-19T11:31:00' },
    { id: 4, mine: true, text: '네 김이에요.', sentAt: '2026-10-19T11:32:00', read: true },
    { id: 5, mine: true, ...phone, sentAt: '2026-10-19T11:32:30', read: true },
    { id: 6, mine: false, text: '번호는 가려져서 보이지 않아요. 여기서 시간 정해요!', sentAt: '2026-10-19T18:45:00' },
    { id: 7, mine: false, text: '내일 저녁 7시 롯데월드몰 지하 1층 안내데스크 앞 괜찮으세요?', sentAt: '2026-10-19T18:51:00' },
  ]
  if (!closed) return list
  return [
    ...list,
    { id: 8, mine: true, text: '네 좋아요. 내일 뵐게요!', sentAt: '2026-10-19T18:53:00', read: true },
    { id: 9, mine: true, text: '잘 받았어요! 사례하고 싶은데 계좌 알려 주실 수 있나요?', sentAt: '2026-10-20T19:20:00', read: true },
    { id: 10, mine: false, ...account, sentAt: '2026-10-20T19:24:00' },
    { id: 11, mine: false, system: true, text: '잠실러 님이 글을 완료로 바꿔 대화가 닫혔어요. 지난 대화는 30일 동안 볼 수 있어요.', sentAt: '2026-10-20T19:30:00' },
  ]
}
