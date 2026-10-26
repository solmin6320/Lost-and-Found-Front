import { describe, expect, it } from 'vitest'

import {
  TITLE_MAX_CHARS,
  arrivalAnnouncement,
  badgeText,
  bellLabel,
  isListedNotification,
  notificationSentence,
  notificationTime,
  sentenceText,
  shortTitle,
  unreadTotal,
  type UnreadPart,
} from './notificationCopy'

const TYPES = ['CLAIM_REQUESTED', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'MATCH_SUGGESTED', 'SOMETHING_NEW'] as const

describe('알림 문장', () => {
  it('모든 종류의 문장에 글 제목이 들어간다(QA-D-L17 · P-L12) — 승인 문장 포함', () => {
    for (const type of TYPES) {
      const text = sentenceText(notificationSentence({ type, postTitle: '검은 반지갑', actorNickname: '성수동산책러' }))
      expect(text, type).toContain('「검은 반지갑」')
    }
  })

  it('화면정의서 표 그대로 — 요청 · 승인 · 거절', () => {
    const s = (type: string) => sentenceText(notificationSentence({ type, postTitle: '지갑', actorNickname: '민수' }))
    expect(s('CLAIM_REQUESTED')).toBe('민수 님이 「지갑」에 확인 요청을 보냈어요.')
    expect(s('CLAIM_APPROVED')).toBe('민수 님이 「지갑」 확인 요청을 승인했어요.')
    expect(s('CLAIM_REJECTED')).toBe('「지갑」 확인 요청이 거절됐어요.')
  })

  it('제목 바로 뒤에 받침으로 갈리는 조사(과/와 · 이/가 · 을/를)를 붙이지 않는다', () => {
    for (const type of TYPES) {
      const text = sentenceText(notificationSentence({ type, postTitle: '지갑', actorNickname: '민수' }))
      expect(text, type).not.toMatch(/」(과|와|이|가|을|를|은|는)/)
    }
  })

  it('긴 제목은 앞부분 + … (문장 끝이 늘 보이게), 짧으면 그대로', () => {
    const long = '갤럭시S24울트라티타늄그레이투명케이스끼워진상태로분실했어요연락주세요'
    expect([...shortTitle(long)]).toHaveLength(TITLE_MAX_CHARS)
    expect(shortTitle(long).endsWith('…')).toBe(true)
    expect(shortTitle('에어팟')).toBe('에어팟')
  })

  it('이름 · 제목이 비어도 깨지지 않는다', () => {
    expect(sentenceText(notificationSentence({ type: 'CLAIM_REQUESTED', postTitle: null, actorNickname: null }))).toBe(
      '누군가 님이 글에 확인 요청을 보냈어요.',
    )
  })

  it('채팅 메시지는 알림 줄로 그리지 않는다(대화 탭이 센다)', () => {
    expect(isListedNotification({ type: 'CHAT_MESSAGE' })).toBe(false)
    expect(isListedNotification({ type: 'CLAIM_APPROVED' })).toBe(true)
  })
})

describe('알림 시각', () => {
  const now = new Date(2026, 9, 23, 22, 30)
  it.each([
    ['2026-10-23T22:29:40.123456', '방금'],
    ['2026-10-23T22:31:00', '방금'], // 기기 시계가 늦음
    ['2026-10-23T22:03:00', '27분 전'],
    ['2026-10-23T09:10:00', '13시간 전'],
    ['2026-10-22T23:59:00', '어제'],
    ['2026-10-03T08:00:00', '10월 3일'],
    ['2025-12-31T08:00:00', '2025년 12월 31일'],
    ['이상한 값', ''],
  ])('%s → %s', (value, expected) => {
    expect(notificationTime(value, now)).toBe(expected)
  })
})

describe('배지 · 종 이름 — 같은 수', () => {
  const visibleNumber = (parts: UnreadPart[]) => badgeText(unreadTotal(parts))
  const labelNumber = (parts: UnreadPart[]) => Number(/(\d+)개/.exec(bellLabel(parts))?.[1] ?? 0)

  it.each<[string, UnreadPart[]]>([
    ['알림만', [{ name: '알림', count: 3 }]],
    ['메시지만(채팅 단계)', [{ name: '알림', count: 0 }, { name: '메시지', count: 2 }]],
    ['둘 다(채팅 단계)', [{ name: '알림', count: 3 }, { name: '메시지', count: 2 }]],
  ])('%s : 배지 숫자 = 이름의 수 = 탭 수의 합', (_, parts) => {
    const sum = parts.reduce((n, p) => n + p.count, 0)
    expect(Number(visibleNumber(parts))).toBe(sum)
    expect(labelNumber(parts)).toBe(sum)
  })

  it('지금(알림 하나) 이름 — 0이면 그냥 "알림", 배지 없음', () => {
    expect(bellLabel([{ name: '알림', count: 0 }])).toBe('알림')
    expect(badgeText(0)).toBeNull()
    expect(bellLabel([{ name: '알림', count: 3 }])).toBe('알림, 안 읽은 알림 3개')
  })

  it('둘(채팅 단계) 이름은 합 · 나눠 센 수를 함께', () => {
    expect(bellLabel([{ name: '알림', count: 3 }, { name: '메시지', count: 2 }])).toBe('알림, 안 읽은 소식 5개 · 알림 3 · 메시지 2')
  })

  it('100 이상은 배지만 99+, 이름은 정확한 수', () => {
    expect(badgeText(120)).toBe('99+')
    expect(bellLabel([{ name: '알림', count: 120 }])).toBe('알림, 안 읽은 알림 120개')
  })

  it('새 알림 알림말은 수만 — 문장 전체를 읽지 않는다', () => {
    expect(arrivalAnnouncement([{ name: '알림', count: 4 }])).toBe('새 알림이 왔어요. 안 읽은 알림 4개')
  })
})
