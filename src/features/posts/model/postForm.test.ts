import { describe, expect, it } from 'vitest'

import { checkPostField, emptyPostFormValues } from './postForm'

describe('날짜 칸 — 미래 날짜', () => {
  const today = '2026-10-08'
  const future = { ...emptyPostFormValues(null, today), lostFoundDate: '2026-10-09' }

  // "오늘 이후"는 오늘을 넣어 세는 말이라 오늘도 못 고르는 것처럼 읽힌다 — 고를 수 있는 끝을 긍정문으로 말한다
  it.each([
    ['LOST', '분실일은 오늘까지만 고를 수 있어요'],
    ['FOUND', '습득일은 오늘까지만 고를 수 있어요'],
    [null, '날짜는 오늘까지만 고를 수 있어요'],
  ] as const)('%s → %s', (type, expected) => {
    expect(checkPostField('lostFoundDate', { ...future, type }, today)).toBe(expected)
  })

  it('오늘은 고를 수 있다', () => {
    expect(checkPostField('lostFoundDate', { ...future, type: 'LOST', lostFoundDate: today }, today)).toBeUndefined()
  })
})
