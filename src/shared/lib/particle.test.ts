import { describe, expect, it } from 'vitest'

import { particle } from './particle'

describe('particle — 받침에 맞는 조사', () => {
  it.each([
    ['분실일', '을', '을'],
    ['날짜', '을', '를'],
    ['사진', '은', '은'],
    ['장소', '은', '는'],
    ['제목', '이', '이'],
    ['카드', '이', '가'],
  ] as const)('%s + %s → %s', (word, kind, expected) => {
    expect(particle(word, kind)).toBe(expected)
  })

  it('으로 — 받침이 있으면 으로, 없으면 로', () => {
    expect(particle('목록', '으로')).toBe('으로')
    expect(particle('학교', '으로')).toBe('로')
  })

  it('으로 — ㄹ 받침은 받침 없음처럼 로', () => {
    expect(particle('글', '으로')).toBe('로')
    expect(particle('서울', '으로')).toBe('로')
    expect(particle('분실일', '으로')).toBe('로')
  })

  it('ㄹ 받침 예외는 으로에만 적용된다', () => {
    expect(particle('글', '을')).toBe('을')
    expect(particle('글', '이')).toBe('이')
    expect(particle('서울', '은')).toBe('은')
  })

  it('끝 글자가 한글 음절이 아니면 받침 없는 쪽', () => {
    expect(particle('ABC', '을')).toBe('를')
    expect(particle('12', '이')).toBe('가')
    expect(particle('ㄱ', '을')).toBe('를')
    expect(particle('', '으로')).toBe('로')
  })

  it('한글 음절 범위의 양 끝(가 · 힣)', () => {
    expect(particle('가', '을')).toBe('를')
    expect(particle('힣', '을')).toBe('을')
  })
})
