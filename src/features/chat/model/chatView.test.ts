import { describe, expect, it } from 'vitest'

import type { ChatMessageResponse, ChatRoomResponse } from '../api/types'
import {
  canSend,
  chatStatusLine,
  chatUnreadTotal,
  dayLabel,
  findRoomByClaim,
  flattenMessages,
  insertLiveMessage,
  isReceiverSide,
  maskNote,
  mergeNewestPage,
  messageSegments,
  messageTime,
  nextBefore,
  parseChatError,
  parseChatMessage,
  roomPreview,
  sortRooms,
  type MessagePages,
} from './chatView'

function room(over: Partial<ChatRoomResponse> = {}): ChatRoomResponse {
  return {
    roomId: 1,
    claimId: 10,
    postId: 100,
    postTitle: '갈색 카드지갑',
    status: 'OPEN',
    claimStatus: 'APPROVED',
    writer: false,
    partnerId: 2,
    partnerNickname: '잠실러',
    lastMessage: null,
    lastMessageAt: '2026-11-01T10:00:00',
    unreadCount: 0,
    ...over,
  }
}

function msg(id: number, over: Partial<ChatMessageResponse> = {}): ChatMessageResponse {
  return {
    id,
    roomId: 1,
    senderId: 2,
    type: 'USER',
    content: `메시지 ${id}`,
    masked: false,
    createdAt: '2026-11-01T10:00:00',
    ...over,
  }
}

/** 최신 순 페이지 — `from` 부터 `to` 까지(큰 id 먼저) */
function page(from: number, to: number): ChatMessageResponse[] {
  const list: ChatMessageResponse[] = []
  for (let id = to; id >= from; id -= 1) list.push(msg(id))
  return list
}

function pages(...list: ChatMessageResponse[][]): MessagePages {
  return { pages: list, pageParams: list.map(() => undefined) }
}

describe('방 찾기 · 안 읽은 수(SCR-10 배지 합의 메시지 쪽)', () => {
  it('claimId 로 방을 찾는다 — 없거나 claimId 가 없으면 null', () => {
    const rooms = [room({ roomId: 1, claimId: 10 }), room({ roomId: 2, claimId: 11 })]
    expect(findRoomByClaim(rooms, 11)?.roomId).toBe(2)
    expect(findRoomByClaim(rooms, 99)).toBeNull()
    expect(findRoomByClaim(rooms, null)).toBeNull()
    expect(findRoomByClaim(undefined, 10)).toBeNull()
  })

  it('안 읽은 수는 방마다의 합(음수는 0)', () => {
    expect(chatUnreadTotal([room({ unreadCount: 2 }), room({ unreadCount: 3 }), room({ unreadCount: -1 })])).toBe(5)
    expect(chatUnreadTotal(undefined)).toBe(0)
  })

  it('열린 방이 위, 닫힌 방이 아래 — 같은 묶음은 서버 차례', () => {
    const list = [
      room({ roomId: 1, status: 'CLOSED' }),
      room({ roomId: 2 }),
      room({ roomId: 3, status: 'BLOCKED' }),
      room({ roomId: 4 }),
    ]
    expect(sortRooms(list).map((r) => r.roomId)).toEqual([2, 4, 1, 3])
  })

  it('마지막 말 — 줄바꿈을 한 줄로, 없으면 방이 열렸다는 말', () => {
    expect(roomPreview({ lastMessage: '내일\n7시 괜찮으세요?' })).toBe('내일 7시 괜찮으세요?')
    expect(roomPreview({ lastMessage: null })).toBe('대화방이 열렸어요.')
  })
})

describe('기록 페이지 합치기', () => {
  it('다음 페이지 before = 받은 것 중 가장 작은 id, 한 페이지보다 적으면 끝', () => {
    expect(nextBefore(page(71, 100), 30)).toBe(71)
    expect(nextBefore(page(1, 10), 30)).toBeUndefined()
    expect(nextBefore([], 30)).toBeUndefined()
  })

  it('페이지들을 옛날 → 최근 한 줄로, 겹친 id 는 한 번', () => {
    const list = flattenMessages([page(5, 8), page(1, 5)])
    expect(list.map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('실시간 메시지는 맨 앞 페이지에 — 이미 있으면 같은 객체', () => {
    const data = pages(page(3, 4), page(1, 2))
    const next = insertLiveMessage(data, msg(5))!
    expect(next.pages[0].map((m) => m.id)).toEqual([5, 4, 3])
    expect(next.pages[1]).toBe(data.pages[1])
    expect(insertLiveMessage(next, msg(5))).toBe(next)
    expect(insertLiveMessage(next, msg(2))).toBe(next)
    expect(insertLiveMessage(undefined, msg(1))).toBeUndefined()
  })

  it('다시 붙은 뒤 최신 페이지 — 겹치면 모르는 것만 더한다', () => {
    const data = pages(page(1, 10))
    const { data: merged, gap } = mergeNewestPage(data, page(6, 15), 10)
    expect(gap).toBe(false)
    expect(flattenMessages(merged!.pages).map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
  })

  it('다시 붙은 뒤 최신 페이지 — 꽉 찼는데 겹치지 않으면 사이가 빈 것', () => {
    const data = pages(page(1, 10))
    expect(mergeNewestPage(data, page(21, 30), 10)).toEqual({ data, gap: true })
    // 꽉 차지 않았으면 그 사이가 전부다(빈 곳 없음)
    expect(mergeNewestPage(data, page(11, 13), 10).gap).toBe(false)
    // 새것이 없으면 그대로
    expect(mergeNewestPage(data, page(5, 10), 10).data).toBe(data)
  })

  it('메시지 모양 검사 — 모르는 모양은 버리고, 빠진 값은 안전한 값으로', () => {
    expect(parseChatMessage('{"id":1,"roomId":2,"senderId":null,"type":"SYSTEM","content":"열렸어요","masked":false,"createdAt":"2026-11-01T10:00:00"}')).toEqual({
      id: 1,
      roomId: 2,
      senderId: null,
      type: 'SYSTEM',
      content: '열렸어요',
      masked: false,
      createdAt: '2026-11-01T10:00:00',
    })
    expect(parseChatMessage('{"id":"1"}')).toBeNull()
    expect(parseChatMessage('not json')).toBeNull()
    expect(parseChatError('{"code":"CHAT_ROOM_NOT_OPEN","message":"메시지를 보낼 수 없는 대화방입니다"}')?.code).toBe('CHAT_ROOM_NOT_OPEN')
    expect(parseChatError('{}')).toBeNull()
  })
})

describe('상태 한 줄(SCR-13) — 실제 방 · 요청 상태에서만', () => {
  it('받는 쪽 판정 — 습득 글은 요청자, 분실 글은 글쓴이. 글을 모르면 null', () => {
    expect(isReceiverSide('FOUND', false)).toBe(true)
    expect(isReceiverSide('FOUND', true)).toBe(false)
    expect(isReceiverSide('LOST', true)).toBe(true)
    expect(isReceiverSide('LOST', false)).toBe(false)
    expect(isReceiverSide(null, false)).toBeNull()
  })

  it('승인됨 — 받는 쪽만 받았어요, 주는 쪽은 전해 달라는 말', () => {
    const receiver = chatStatusLine(room(), true)
    expect(receiver).toMatchObject({ kind: 'approved', place: 'head', canReceive: true })
    expect(receiver.text).toContain('승인됨')
    const giver = chatStatusLine(room(), false)
    expect(giver).toMatchObject({ canReceive: false, place: 'head' })
    expect(giver.text).toContain('전해 주세요')
    // 글 종류를 아직 모르면 단추를 그리지 않는다
    expect(chatStatusLine(room(), null).canReceive).toBe(false)
  })

  it('닫힌 방은 입력 줄 자리에 까닭 한 줄 — 받음 · 승인 취소 · 차단 · 글 지워짐', () => {
    expect(chatStatusLine(room({ status: 'CLOSED', claimStatus: 'RECEIVED' }), true)).toMatchObject({
      kind: 'received',
      place: 'bottom',
      text: '물건을 받아 대화가 닫혔어요.',
    })
    expect(chatStatusLine(room({ status: 'READ_ONLY', claimStatus: 'REJECTED' }), true).text).toBe(
      '승인이 취소됐어요. 대화는 읽기만 할 수 있어요.',
    )
    expect(chatStatusLine(room({ status: 'BLOCKED' }), true).kind).toBe('blocked')
    expect(chatStatusLine(room({ status: 'CLOSED', claimStatus: null, postId: null }), true).text).toBe(
      '글이 지워져 대화가 닫혔어요.',
    )
    expect(canSend(room())).toBe(true)
    expect(canSend(room({ status: 'READ_ONLY' }))).toBe(false)
  })
})

describe('가린 조각 · 시각', () => {
  it('서버가 가린 메시지만 조각으로 — 글자는 바꾸지 않는다', () => {
    const segments = messageSegments('제 번호 [전화번호] 이고 메일은 [이메일] 이에요', true)
    expect(segments).toEqual([
      { text: '제 번호 ' },
      { text: '[전화번호]', mask: 'PHONE' },
      { text: ' 이고 메일은 ' },
      { text: '[이메일]', mask: 'EMAIL' },
      { text: ' 이에요' },
    ])
    expect(segments.map((s) => s.text).join('')).toBe('제 번호 [전화번호] 이고 메일은 [이메일] 이에요')
    expect(messageSegments('[계좌번호]', true)).toEqual([{ text: '[계좌번호]', mask: 'ACCOUNT' }])
    // 가리지 않은 메시지의 같은 글자는 사용자가 친 글자다
    expect(messageSegments('[전화번호] 라고 쓰면 돼요', false)).toEqual([{ text: '[전화번호] 라고 쓰면 돼요' }])
  })

  it('가린 메시지 아래 한 줄 — 보낸 쪽 · 받은 쪽 말이 다르다', () => {
    const segments = messageSegments('[전화번호]', true)
    expect(maskNote(segments, true)).toContain('상대에게도 이렇게 보여요')
    expect(maskNote(segments, false)).toContain('보낸 분이')
    expect(maskNote(messageSegments('안녕', true), false)).toBeNull()
  })

  it('말풍선 시각 · 날 바뀜 줄', () => {
    expect(messageTime('2026-11-01T15:05:00')).toBe('오후 3:05')
    expect(messageTime('2026-11-01T00:30:00')).toBe('오전 12:30')
    expect(messageTime('2026-11-01T12:00:00')).toBe('오후 12:00')
    expect(dayLabel('2026-11-01T10:00:00', new Date(2026, 10, 2))).toBe('11월 1일 일요일')
    expect(dayLabel('2025-12-31T10:00:00', new Date(2026, 10, 2))).toBe('2025년 12월 31일 수요일')
  })
})
