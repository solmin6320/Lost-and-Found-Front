import type { InfiniteData } from '@tanstack/react-query'

import { isReceiver } from '@/features/claims'
import type { PostType } from '@/features/posts'
import { parseLocalDateTime } from '@/shared/lib/localDateTime'

import { CHAT_PAGE_SIZE } from '../api/chatApi'
import type { ChatMessageResponse, ChatRoomResponse } from '../api/types'

/**
 * 채팅 화면의 말 · 판정 · 기록 합치기 — 화면과 떼어 순수 함수로 둔다(`chatView.test.ts`). 화면정의서 SCR-13 · SCR-10 대화 탭.
 */

// ── 방 찾기 · 안 읽은 수 ──

/** 이 주인 확인 요청으로 열린 방(알림 · 상세의 `[대화하기]`가 쓴다). 없으면 `null` */
export function findRoomByClaim(rooms: readonly ChatRoomResponse[] | undefined, claimId: number | null | undefined) {
  if (!rooms || claimId === null || claimId === undefined) return null
  return rooms.find((room) => room.claimId === claimId) ?? null
}

/** 대화 탭 · 종 배지의 `메시지` 수 — 방마다 안 읽은 수의 합 */
export function chatUnreadTotal(rooms: readonly ChatRoomResponse[] | undefined): number {
  return (rooms ?? []).reduce((sum, room) => sum + Math.max(0, room.unreadCount), 0)
}

/** 말할 수 있는 방이 위, 닫힌 방(읽기 전용 · 닫힘 · 차단)이 아래. 같은 묶음 안은 서버 차례(최근 메시지 순) */
export function sortRooms(rooms: readonly ChatRoomResponse[]): ChatRoomResponse[] {
  return rooms
    .map((room, index) => ({ room, index }))
    .sort((a, b) => Number(a.room.status !== 'OPEN') - Number(b.room.status !== 'OPEN') || a.index - b.index)
    .map(({ room }) => room)
}

// ── 기록 페이지 ──

export type MessagePages = InfiniteData<ChatMessageResponse[], number | undefined>

/** 다음(더 옛날) 페이지의 `before` — 받은 것 중 가장 작은 id. 받은 수가 한 페이지보다 적으면 끝(`undefined`) */
export function nextBefore(page: readonly ChatMessageResponse[], size: number = CHAT_PAGE_SIZE): number | undefined {
  if (page.length < size || page.length === 0) return undefined
  return page.reduce((min, m) => Math.min(min, m.id), Number.POSITIVE_INFINITY)
}

/** 페이지들(각각 최신 순) → 화면 차례(옛날 → 최근) · id 겹침 없이 */
export function flattenMessages(pages: readonly (readonly ChatMessageResponse[])[] | undefined): ChatMessageResponse[] {
  if (!pages) return []
  const byId = new Map<number, ChatMessageResponse>()
  for (const page of pages) for (const m of page) if (!byId.has(m.id)) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

function hasMessage(data: MessagePages, id: number) {
  return data.pages.some((page) => page.some((m) => m.id === id))
}

/** 실시간으로 온 메시지 하나를 맨 앞 페이지(최신)에 더한다. 이미 있으면 그대로(같은 객체) */
export function insertLiveMessage(data: MessagePages | undefined, message: ChatMessageResponse): MessagePages | undefined {
  if (!data || data.pages.length === 0) return data
  if (hasMessage(data, message.id)) return data
  const [first, ...rest] = data.pages
  return { ...data, pages: [[message, ...first].sort((a, b) => b.id - a.id), ...rest] }
}

/**
 * 다시 붙은 뒤 받은 최신 페이지를 합친다. 아는 것과 겹치면(끊긴 동안 온 것이 한 페이지 안) 모르는 것만 더하고,
 * 최신 페이지가 꽉 찼는데 아는 것과 하나도 겹치지 않으면 사이가 비었다(`gap`) — 부른 쪽이 기록 전체를 다시 받는다
 */
export function mergeNewestPage(
  data: MessagePages | undefined,
  newest: readonly ChatMessageResponse[],
  size: number = CHAT_PAGE_SIZE,
): { data: MessagePages | undefined; gap: boolean } {
  if (!data || data.pages.length === 0) return { data, gap: false }
  const known = new Set(data.pages.flatMap((page) => page.map((m) => m.id)))
  const unknown = newest.filter((m) => !known.has(m.id))
  if (unknown.length === 0) return { data, gap: false }
  const overlaps = unknown.length < newest.length
  if (!overlaps && newest.length >= size) return { data, gap: true }
  const [first, ...rest] = data.pages
  return { data: { ...data, pages: [[...unknown, ...first].sort((a, b) => b.id - a.id), ...rest] }, gap: false }
}

/** 실시간 · 기록에서 온 JSON 이 메시지 모양인지 — 모르는 모양은 버린다(캐시를 깨지 않게) */
export function parseChatMessage(body: string): ChatMessageResponse | null {
  try {
    const value = JSON.parse(body) as Partial<ChatMessageResponse> | null
    if (
      !value ||
      typeof value !== 'object' ||
      typeof value.id !== 'number' ||
      typeof value.roomId !== 'number' ||
      typeof value.content !== 'string' ||
      typeof value.createdAt !== 'string'
    ) {
      return null
    }
    return {
      id: value.id,
      roomId: value.roomId,
      senderId: typeof value.senderId === 'number' ? value.senderId : null,
      type: typeof value.type === 'string' ? value.type : 'USER',
      content: value.content,
      masked: value.masked === true,
      createdAt: value.createdAt,
    }
  } catch {
    return null
  }
}

/** `/user/queue/errors` 본문 → 서버 문장. 모양이 틀리면 `null` */
export function parseChatError(body: string): { code: string; message: string } | null {
  try {
    const value = JSON.parse(body) as { code?: unknown; message?: unknown } | null
    if (!value || typeof value.code !== 'string' || typeof value.message !== 'string') return null
    return { code: value.code, message: value.message }
  } catch {
    return null
  }
}

/** 안내 메시지(방 열림 · 승인 취소 · 받았어요 · 차단)인가 */
export function isSystemMessage(message: Pick<ChatMessageResponse, 'type' | 'senderId'>): boolean {
  return message.type === 'SYSTEM' || message.senderId === null
}

// ── 상태 한 줄 ──

/**
 * 물건을 받는 쪽인가 — 서버 `Claim.receiverId` 와 같은 판정(습득 글은 요청자, 분실 글은 글쓴이). ‘받았어요’는 이쪽에만.
 * 방 응답에는 글 종류가 없어 그 글 상세의 `type` 으로 가른다. 글을 모르면(지워짐 · 아직 받는 중) `null`
 */
export function isReceiverSide(postType: PostType | null | undefined, writer: boolean): boolean | null {
  if (!postType) return null
  return isReceiver(postType, writer ? 'author' : 'claimant')
}

export type ChatStatusKind = 'approved' | 'received' | 'canceled' | 'blocked' | 'closed' | 'open'

/**
 * 방의 지금 상태를 한 번만 말하는 줄(화면정의서 SCR-13 "상태 한 줄은 실제 claim 상태에서만 바뀐다" · 1.6 "한 번만").
 *   - 말할 수 있는 방(OPEN) : 머리 아래 한 줄(`place: 'head'`) — 승인됨 + 받는 쪽만 ‘받았어요’
 *   - 닫힌 방 : 입력 줄 자리에 까닭 한 줄(`place: 'bottom'`) — 입력 칸 대신. 머리 줄은 그리지 않는다(같은 말을 두 곳에 하지 않는다)
 * 서버의 안내 메시지(대화 안 기록)는 그때 일어난 일이고, 이 줄은 지금 상태다
 */
export interface ChatStatusLine {
  kind: ChatStatusKind
  place: 'head' | 'bottom'
  text: string
  /** ‘받았어요’ 단추를 그린다 */
  canReceive: boolean
}

export function chatStatusLine(
  room: Pick<ChatRoomResponse, 'status' | 'claimStatus' | 'postId' | 'claimId'>,
  receiver: boolean | null,
): ChatStatusLine {
  switch (room.status) {
    case 'OPEN':
      if (room.claimStatus === 'APPROVED') {
        return receiver
          ? {
              kind: 'approved',
              place: 'head',
              text: '승인됨 · 만나서 물건을 받으면 눌러 주세요.',
              canReceive: room.claimId !== null,
            }
          : {
              kind: 'approved',
              place: 'head',
              text:
                receiver === false
                  ? '승인됨 · 만나서 전해 주세요. 상대가 받았다고 누르면 대화가 닫혀요.'
                  : '승인됨 · 만날 시간과 장소를 정해 보세요.',
              canReceive: false,
            }
      }
      return { kind: 'open', place: 'head', text: '만날 시간과 장소를 정해 보세요.', canReceive: false }
    case 'READ_ONLY':
      return { kind: 'canceled', place: 'bottom', text: '승인이 취소됐어요. 대화는 읽기만 할 수 있어요.', canReceive: false }
    case 'BLOCKED':
      return { kind: 'blocked', place: 'bottom', text: '차단된 대화예요. 메시지를 보낼 수 없어요.', canReceive: false }
    default:
      // CLOSED(또는 모르는 상태) — 받아서 닫혔는지, 글이 지워져 닫혔는지
      if (room.claimStatus === 'RECEIVED') {
        return { kind: 'received', place: 'bottom', text: '물건을 받아 대화가 닫혔어요.', canReceive: false }
      }
      if (room.postId === null) {
        return { kind: 'closed', place: 'bottom', text: '글이 지워져 대화가 닫혔어요.', canReceive: false }
      }
      return { kind: 'closed', place: 'bottom', text: '대화가 닫혔어요. 메시지를 보낼 수 없어요.', canReceive: false }
  }
}

/** 말할 수 있는 방인가 — 입력 칸을 그린다 */
export function canSend(room: Pick<ChatRoomResponse, 'status'>): boolean {
  return room.status === 'OPEN'
}

// ── 가린 조각 ──

export type MaskKind = 'PHONE' | 'ACCOUNT' | 'EMAIL'

const MASK_TOKEN = /\[(전화번호|계좌번호|이메일)\]/g
const MASK_KIND: Record<string, MaskKind> = { 전화번호: 'PHONE', 계좌번호: 'ACCOUNT', 이메일: 'EMAIL' }

export const MASK_LABEL: Record<MaskKind, string> = { PHONE: '전화번호', ACCOUNT: '계좌번호', EMAIL: '이메일' }

export type MessageSegment = { text: string; mask?: undefined } | { text: string; mask: MaskKind }

/**
 * 본문을 글 · 가린 조각으로 가른다. 서버가 `masked` 라고 한 메시지만 — 그 밖에는 사용자가 친 `[전화번호]` 글자일 수 있다.
 * 글자는 바꾸지 않는다(가린 조각의 글자도 서버가 준 `[전화번호]` 그대로 이어 붙이면 원문이 된다)
 */
export function messageSegments(content: string, masked: boolean): MessageSegment[] {
  if (!masked) return [{ text: content }]
  const segments: MessageSegment[] = []
  let at = 0
  for (const match of content.matchAll(MASK_TOKEN)) {
    const start = match.index ?? 0
    if (start > at) segments.push({ text: content.slice(at, start) })
    segments.push({ text: match[0], mask: MASK_KIND[match[1]] })
    at = start + match[0].length
  }
  if (at < content.length) segments.push({ text: content.slice(at) })
  return segments.length > 0 ? segments : [{ text: content }]
}

/**
 * 가린 메시지 아래 한 줄 — 받은 쪽 · 보낸 쪽 말이 다르다(화면정의서 SCR-13 구성). 무엇을 가렸는지는 조각 이름표가 말하니
 * 여기서는 종류 이름을 되풀이하지 않는다(받침에 따라 갈리는 조사도 피한다)
 */
export function maskNote(segments: readonly MessageSegment[], mine: boolean): string | null {
  if (!segments.some((s) => s.mask)) return null
  return mine ? '개인정보는 자동으로 가렸어요. 상대에게도 이렇게 보여요.' : '보낸 분이 쓴 개인정보를 자동으로 가렸어요.'
}

// ── 시각 ──

/** 말풍선 옆 시각 — `오후 3:05` */
export function messageTime(value: string): string {
  const at = parseLocalDateTime(value)
  if (!at) return ''
  const h = at.getHours()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(at.getMinutes()).padStart(2, '0')}`
}

/** 날 바뀜 줄 — `10월 19일 일요일`(다른 해면 연도까지) */
export function dayLabel(value: string, now: Date = new Date()): string {
  const at = parseLocalDateTime(value)
  if (!at) return ''
  const day = `${at.getMonth() + 1}월 ${at.getDate()}일 ${'일월화수목금토'[at.getDay()]}요일`
  return at.getFullYear() === now.getFullYear() ? day : `${at.getFullYear()}년 ${day}`
}

/** 두 시각이 같은 날인가(날 바뀜 줄을 넣을지) */
export function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10)
}

/** 대화 목록의 마지막 말 — 없으면 방이 열렸다는 말 */
export function roomPreview(room: Pick<ChatRoomResponse, 'lastMessage'>): string {
  const text = room.lastMessage?.replace(/\s+/g, ' ').trim()
  return text || '대화방이 열렸어요.'
}
