import { describe, expect, it } from 'vitest'

import type { MatchResponse } from '../api/types'
import { withoutCandidate } from './matchMutations'
import {
  dismissLabel,
  matchReasons,
  matchesEmpty,
  matchesHeading,
  matchesLead,
  nextFocusCandidate,
  showsMatches,
} from './matchView'

const base: MatchResponse = {
  postId: 1,
  type: 'FOUND',
  title: '검은 반지갑 주웠어요',
  category: 'WALLET',
  location: '강남역 2번 출구',
  lostFoundDate: '2026-10-20',
  thumbnailUrl: null,
  daysApart: 0,
  similarPlace: false,
  similarText: false,
}

describe('추천 묶음 권한(SCR-11)', () => {
  it('글쓴이 · 게시중 글에만', () => {
    expect(showsMatches({ status: 'OPEN' }, true)).toBe(true)
    expect(showsMatches({ status: 'OPEN' }, false)).toBe(false)
    expect(showsMatches({ status: 'IN_PROGRESS' }, true)).toBe(false)
    expect(showsMatches({ status: 'DONE' }, true)).toBe(false)
  })
})

describe('양방향 문구 — 내 글의 반대쪽 이름(QA-P-L6)', () => {
  it('분실 글엔 습득 글, 습득 글엔 분실 글', () => {
    expect(matchesHeading('LOST')).toContain('습득 글')
    expect(matchesHeading('FOUND')).toContain('분실 글')
    expect(matchesEmpty('LOST').title).toContain('습득 글')
    expect(matchesEmpty('FOUND').title).toContain('분실 글')
    expect(matchesLead('LOST')).toContain('내 물건이에요')
    expect(matchesLead('FOUND')).toContain('제가 주웠어요')
    expect(dismissLabel('LOST')).toBe('내 물건 아니에요')
    expect(dismissLabel('FOUND')).toBe('다른 물건이에요')
  })

  it('화면 문장에 % · 점수가 없다', () => {
    const texts = [
      ...(['LOST', 'FOUND'] as const).flatMap((t) => [matchesHeading(t), matchesLead(t), ...Object.values(matchesEmpty(t))]),
      ...matchReasons({ ...base, similarPlace: true, similarText: true }).map((r) => r.text),
    ]
    for (const text of texts) expect(text).not.toMatch(/%|점수|일치율/)
  })
})

describe('맞은 이유 — 말로, 체크는 같을 때만', () => {
  it('같은 날 주운 습득 후보', () => {
    expect(matchReasons(base)).toEqual([
      { key: 'category', text: '같은 종류', same: true },
      { key: 'date', text: '같은 날 주움', same: true },
    ])
  })

  it('날짜가 다르면 체크 없이 며칠 뒤 · 전', () => {
    expect(matchReasons({ ...base, daysApart: 3 })[1]).toEqual({ key: 'date', text: '3일 뒤 주움', same: false })
    expect(matchReasons({ ...base, type: 'LOST', daysApart: 5 })[1]).toEqual({ key: 'date', text: '5일 전 잃어버림', same: false })
    expect(matchReasons({ ...base, type: 'LOST', daysApart: 0 })[1]?.text).toBe('같은 날 잃어버림')
  })

  it('장소 · 제목은 비슷할 때만 넣는다', () => {
    expect(matchReasons({ ...base, similarPlace: true }).map((r) => r.text)).toEqual(['같은 종류', '같은 날 주움', '장소 비슷'])
    expect(matchReasons({ ...base, similarPlace: true, similarText: true }).map((r) => r.key)).toEqual([
      'category',
      'date',
      'place',
      'text',
    ])
  })
})

describe('숨긴 뒤', () => {
  const list = [{ postId: 1 }, { postId: 2 }, { postId: 3 }]

  it('포커스는 다음 카드, 마지막이면 앞 카드, 하나뿐이면 없음', () => {
    expect(nextFocusCandidate(list, 1)).toBe(2)
    expect(nextFocusCandidate(list, 3)).toBe(2)
    expect(nextFocusCandidate([{ postId: 9 }], 9)).toBeNull()
    expect(nextFocusCandidate(list, 42)).toBeNull()
  })

  it('받은 목록에서 그 후보만 뺀다', () => {
    const matches = [base, { ...base, postId: 2 }]
    expect(withoutCandidate(matches, 1)?.map((m) => m.postId)).toEqual([2])
    expect(withoutCandidate(undefined, 1)).toBeUndefined()
  })
})
