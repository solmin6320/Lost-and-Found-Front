import { parseLocalDateTime, relativeTime } from '@/shared/lib/localDateTime'

import type { NotificationResponse } from '../api/types'

/**
 * 알림 문장 · 시각 · 종 이름 — 화면에 쓰는 말을 한곳에(화면정의서 SCR-10 "알림 종류" 표).
 *
 * - **글 제목은 늘 넣는다**(QA-D-L17 · P-L12) — 「제목」 꺾쇠로 감싸 문장과 가른다. 제목 뒤 조사는 받침에 따라 갈리는 것(과/와 · 이/가)을 쓰지 않는다
 *   (`「지갑」에` · `「지갑」 확인 요청` 처럼 받침과 상관없는 말만, QA-D-L16 · P-L20)
 * - 승인 문장 끝 "대화를 시작할 수 있어요."(채팅 단계, 2026-11-02) — 누르면 그 방으로 간다. 방이 없다고 확인된 승인(차단한 두 사람 —
 *   서버가 방을 열지 않는다)에는 붙이지 않는다(`chat: false`) — 갈 수 없는 곳을 약속하지 않는다
 * - `CHAT_MESSAGE` 는 알림 줄로 그리지 않는다 — 대화 탭의 안 읽은 수로 센다
 */

/** 문장 조각. `strong` 은 굵게(누가 · 어느 글) */
export interface Segment {
  text: string
  strong?: boolean
}

export type NotificationKind = 'request' | 'approved' | 'rejected' | 'match' | 'publicMatch' | 'other'

export function notificationKind(type: string): NotificationKind {
  switch (type) {
    case 'CLAIM_REQUESTED':
      return 'request'
    case 'CLAIM_APPROVED':
      return 'approved'
    case 'CLAIM_REJECTED':
      return 'rejected'
    case 'MATCH_SUGGESTED':
      return 'match'
    case 'PUBLIC_MATCH_SUGGESTED':
      return 'publicMatch'
    default:
      return 'other'
  }
}

/** 알림 줄로 그리는 것인가 — 채팅 메시지는 대화 탭이 센다 */
export function isListedNotification(n: Pick<NotificationResponse, 'type'>): boolean {
  return n.type !== 'CHAT_MESSAGE'
}

/**
 * 문장 안 제목의 최대 글자 수. 글 제목은 100자까지라(띄어쓰기 없는 제목도 있다) 그대로 넣으면 알림 한 줄이 여덟 줄이 된다(실측 1280 184px).
 * 넘으면 앞부분 + `…` — 문장의 끝(무엇이 일어났는지)이 늘 보이게. 온전한 제목은 누르면 가는 상세에 있다
 */
export const TITLE_MAX_CHARS = 24

export function shortTitle(title: string): string {
  const chars = [...title.trim()]
  return chars.length > TITLE_MAX_CHARS ? `${chars.slice(0, TITLE_MAX_CHARS - 1).join('').trimEnd()}…` : chars.join('')
}

export function notificationSentence(
  n: Pick<NotificationResponse, 'type' | 'postTitle' | 'actorNickname'>,
  options: { chat?: boolean } = {},
): Segment[] {
  const title: Segment = n.postTitle ? { text: `「${shortTitle(n.postTitle)}」`, strong: true } : { text: '글' }
  const actor: Segment = { text: n.actorNickname || '누군가', strong: Boolean(n.actorNickname) }
  switch (n.type) {
    case 'CLAIM_REQUESTED':
      return [actor, { text: ' 님이 ' }, title, { text: '에 확인 요청을 보냈어요.' }]
    case 'CLAIM_APPROVED':
      return [
        actor,
        { text: ' 님이 ' },
        title,
        { text: options.chat === false ? ' 확인 요청을 승인했어요.' : ' 확인 요청을 승인했어요. 대화를 시작할 수 있어요.' },
      ]
    case 'CLAIM_REJECTED':
      return [title, { text: ' 확인 요청이 거절됐어요.' }]
    case 'MATCH_SUGGESTED':
      // 몇 건인지 · 상대가 분실 글인지 습득 글인지는 응답에 아직 없다(자동 매칭 단계) — 그 전까지는 수 없이
      return [title, { text: ' 글과 비슷한 글이 올라왔어요.' }]
    case 'PUBLIC_MATCH_SUGGESTED':
      // 우리 사이트 글이 아니라 물건 — 어디에 맡겨졌는지까지 한 문장에(누르면 그 글 상세의 공공 후보 묶음). 건수는 응답에 없다
      return [title, { text: ' 글과 비슷한 물건이 경찰서 · 기관에 맡겨져 있어요.' }]
    default:
      return [title, { text: '에 새 소식이 있어요.' }]
  }
}

/** 문장을 글자 하나로(스크린리더 · 시험) */
export function sentenceText(segments: Segment[]): string {
  return segments.map((s) => s.text).join('')
}

/** 서버 시각 읽기 · 상대 시각은 대화 목록 · 말풍선과 같이 쓴다(`shared/lib/localDateTime`) */
export { parseLocalDateTime }

/** 알림 시각 — 가까울수록 상대 시각(`relativeTime` 그대로 — 대화 목록과 같은 말) */
export function notificationTime(value: string, now: Date = new Date()): string {
  return relativeTime(value, now)
}

/**
 * 종 안 읽은 수의 묶음 — 탭마다 하나. 지금은 알림 하나뿐이고 채팅이 생기면 `메시지` 가 붙는다.
 * **배지 숫자 = 종 이름의 수 = 탭 수의 합**(QA-D-L11 · P-L4) — 셋을 이 한 곳에서 만든다
 */
export interface UnreadPart {
  /** 종 이름 안에서 부르는 이름 — `알림` · `메시지` */
  name: string
  count: number
}

export function unreadTotal(parts: readonly UnreadPart[]): number {
  return parts.reduce((sum, part) => sum + Math.max(0, part.count), 0)
}

/** 배지 글자. 0이면 그리지 않는다(`null`). 100 이상은 `99+`(이름은 정확한 수를 읽는다) */
export function badgeText(total: number): string | null {
  if (total <= 0) return null
  return total > 99 ? '99+' : String(total)
}

/**
 * 종의 이름(스크린리더). 보이는 배지와 **같은 수**를 읽는다.
 *   하나 : `알림, 안 읽은 알림 3개`
 *   둘   : `알림, 안 읽은 소식 5개 · 알림 3 · 메시지 2`(채팅 단계)
 */
export function bellLabel(parts: readonly UnreadPart[]): string {
  const total = unreadTotal(parts)
  if (total === 0) return '알림'
  if (parts.length === 1) return `알림, 안 읽은 ${parts[0].name} ${total}개`
  return `알림, 안 읽은 소식 ${total}개 · ${parts.map((p) => `${p.name} ${Math.max(0, p.count)}`).join(' · ')}`
}

/** 새 알림이 왔을 때 한 번 읽어 주는 말 — 문장 전체가 아니라 수만(SCR-10 접근성) */
export function arrivalAnnouncement(parts: readonly UnreadPart[]): string {
  return `새 알림이 왔어요. ${bellLabel(parts).replace(/^알림, /, '')}`
}
