import type { NotificationResponse } from '../api/types'

/**
 * 알림 문장 · 시각 · 종 이름 — 화면에 쓰는 말을 한곳에(화면정의서 SCR-10 "알림 종류" 표).
 *
 * - **글 제목은 늘 넣는다**(QA-D-L17 · P-L12) — 「제목」 꺾쇠로 감싸 문장과 가른다. 제목 뒤 조사는 받침에 따라 갈리는 것(과/와 · 이/가)을 쓰지 않는다
 *   (`「지갑」에` · `「지갑」 확인 요청` 처럼 받침과 상관없는 말만, QA-D-L16 · P-L20)
 * - 승인 문장의 "대화를 시작할 수 있어요"는 **채팅이 생긴 뒤** 붙인다 — 지금 붙이면 갈 수 없는 곳을 약속한다(막다른 길)
 * - `CHAT_MESSAGE` 는 알림 줄로 그리지 않는다 — 대화 탭의 안 읽은 수로 센다(채팅 단계)
 */

/** 문장 조각. `strong` 은 굵게(누가 · 어느 글) */
export interface Segment {
  text: string
  strong?: boolean
}

export type NotificationKind = 'request' | 'approved' | 'rejected' | 'match' | 'other'

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

export function notificationSentence(n: Pick<NotificationResponse, 'type' | 'postTitle' | 'actorNickname'>): Segment[] {
  const title: Segment = n.postTitle ? { text: `「${shortTitle(n.postTitle)}」`, strong: true } : { text: '글' }
  const actor: Segment = { text: n.actorNickname || '누군가', strong: Boolean(n.actorNickname) }
  switch (n.type) {
    case 'CLAIM_REQUESTED':
      return [actor, { text: ' 님이 ' }, title, { text: '에 확인 요청을 보냈어요.' }]
    case 'CLAIM_APPROVED':
      return [actor, { text: ' 님이 ' }, title, { text: ' 확인 요청을 승인했어요.' }]
    case 'CLAIM_REJECTED':
      return [title, { text: ' 확인 요청이 거절됐어요.' }]
    case 'MATCH_SUGGESTED':
      // 몇 건인지 · 상대가 분실 글인지 습득 글인지는 응답에 아직 없다(자동 매칭 단계) — 그 전까지는 수 없이
      return [title, { text: ' 글과 비슷한 글이 올라왔어요.' }]
    default:
      return [title, { text: '에 새 소식이 있어요.' }]
  }
}

/** 문장을 글자 하나로(스크린리더 · 시험) */
export function sentenceText(segments: Segment[]): string {
  return segments.map((s) => s.text).join('')
}

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/

/** 서버 `LocalDateTime`(시간대 없음) → 이 기기 시각으로 읽은 `Date`. 서버와 기기가 같은 시간대(한국)라고 본다 */
export function parseLocalDateTime(value: string): Date | null {
  const m = LOCAL_DATE_TIME.exec(value)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0))
}

/**
 * 알림 시각 — 가까울수록 상대 시각(사람들이 알림에서 기대하는 말, 제이콥).
 * 1분 안 `방금` · 1시간 안 `N분 전` · 오늘 `N시간 전` · 어제 `어제` · 올해 `M월 D일` · 그 전 `YYYY년 M월 D일`.
 * 기기 시계가 서버보다 늦어 앞날로 보이면 `방금`
 */
export function notificationTime(value: string, now: Date = new Date()): string {
  const at = parseLocalDateTime(value)
  if (!at) return ''
  const diffMin = Math.floor((now.getTime() - at.getTime()) / 60_000)
  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(now) - day(at)) / 86_400_000)
  if (days === 0) return `${Math.floor(diffMin / 60)}시간 전`
  if (days === 1) return '어제'
  if (at.getFullYear() === now.getFullYear()) return `${at.getMonth() + 1}월 ${at.getDate()}일`
  return `${at.getFullYear()}년 ${at.getMonth() + 1}월 ${at.getDate()}일`
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
