import { describe, expect, it } from 'vitest'

import { POST_TYPE_LABEL } from './labels'
import {
  ALL_POSTS_HEADING,
  POST_INTENTS,
  SEARCH_RESULTS_HEADING,
  intentHintTail,
  intentShowing,
  postListHeading,
} from './postIntent'

describe('분실 · 습득 칸 — 칸 이름 = 보여 주는 글의 종류(본인 결정 2026-10-07)', () => {
  it('분실 칸이 앞, 습득 칸이 뒤', () => {
    expect(POST_INTENTS.map((intent) => intent.concept)).toEqual(['LOST', 'FOUND'])
  })

  it('칸이 거는 유형 = 칸의 유형(엇갈리지 않는다)', () => {
    expect(intentShowing('LOST')?.concept).toBe('LOST')
    expect(intentShowing('FOUND')?.concept).toBe('FOUND')
    expect(intentShowing(undefined)).toBeUndefined()
  })

  it.each(POST_INTENTS.map((intent) => [intent.concept, intent] as const))(
    '%s 칸의 문구는 모두 그 종류를 말한다',
    (type, intent) => {
      const badge = POST_TYPE_LABEL[type] // 분실 · 습득 — 카드 이름표
      // 칸 아래 한 줄은 카드 이름표와 같은 말
      expect(intent.sees).toBe(`${badge} 글`)
      // 결과 제목 = 칸 이름
      expect(intent.heading).toBe(intent.label.join(' '))
      // 올리는 글도 같은 종류
      expect(intent.next.action).toBe(`${badge} 글 올리기`)
      expect(intent.next.description).toContain(`${badge} 글`)
      expect(intent.empty.title).toContain(`${badge} 글`)
      expect(intent.empty.description).toContain(`${badge} 글`)
      // 반대 종류의 말이 섞이지 않는다
      const other = POST_TYPE_LABEL[type === 'LOST' ? 'FOUND' : 'LOST']
      for (const text of [intent.sees, intent.heading, intent.next.title, intent.next.action, intent.empty.title]) {
        expect(text).not.toContain(other)
      }
    },
  )

  it('칸 이름은 잃어버린 물건 · 주운 물건', () => {
    expect(intentShowing('LOST')?.label.join(' ')).toBe('잃어버린 물건')
    expect(intentShowing('FOUND')?.label.join(' ')).toBe('주운 물건')
  })

  it('보이는 문구에 줄표(—)를 쓰지 않는다', () => {
    for (const intent of POST_INTENTS) {
      const texts = [
        ...intent.label,
        intent.sees,
        intent.heading,
        ...Object.values(intent.next),
        ...Object.values(intent.empty),
        intent.write.lead,
      ]
      for (const text of texts) expect(text).not.toMatch(/[—–]/)
    }
  })
})

describe('결과 제목', () => {
  it('칸을 골랐으면 칸 이름', () => {
    expect(postListHeading('LOST')).toBe('잃어버린 물건')
    expect(postListHeading('FOUND', '지갑')).toBe('주운 물건')
  })

  it('칸 없이 검색어만 있으면 "검색 결과"(검색어는 제목에 넣지 않는다)', () => {
    expect(postListHeading(undefined, '지갑')).toBe(SEARCH_RESULTS_HEADING)
    expect(postListHeading(undefined, '지갑')).not.toContain('지갑')
  })

  it('아무것도 없으면 최근 올라온 물건', () => {
    expect(postListHeading(undefined)).toBe(ALL_POSTS_HEADING)
  })
})

describe('intentHintTail — 칸 아래 한 줄의 뒷부분', () => {
  it('건수가 있으면 "12건 보기", 고른 쪽은 "보는 중"', () => {
    expect(intentHintTail(12, false)).toBe('12건 보기')
    expect(intentHintTail(12345, true)).toBe('12,345건 보는 중')
  })

  it('건수를 모르면 "모두", 검색어 · 필터가 걸려 있으면 숫자 없이', () => {
    expect(intentHintTail(undefined, false)).toBe('모두 보기')
    expect(intentHintTail(null, true)).toBe('보는 중')
  })
})
