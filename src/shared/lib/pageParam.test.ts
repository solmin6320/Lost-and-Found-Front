import { describe, expect, it } from 'vitest'

import { canonicalPageParam, parsePageParam } from './pageParam'

/* 주소의 page 를 고쳐 읽은 값과 맞춘다(QA-P-21). 실제 주소 바꿈은 브라우저에서 잰다(round6/r9 pg8 L) */
describe('canonicalPageParam', () => {
  it('고쳐 읽어 1페이지가 된 값은 지운다 — 0 · -1 · abc · 2.5 · 1', () => {
    for (const raw of ['0', '-1', 'abc', '2.5', '1', '']) expect(canonicalPageParam(raw, 1)).toBe('')
  })

  it('맞는 값 · 없는 값은 그대로 둔다', () => {
    expect(canonicalPageParam('3', 3)).toBeNull()
    expect(canonicalPageParam(null, 1)).toBeNull()
    expect(canonicalPageParam('99', 99)).toBeNull()
  })

  it('읽은 값과 글자가 다르면 읽은 값으로 — 02 → 2', () => {
    expect(canonicalPageParam('02', 2)).toBe('2')
  })
})

/* 숫자만으로 된 값만 페이지로 읽는다(QA-P-28) */
describe('parsePageParam', () => {
  it('숫자만 — 앞자리 0 은 숫자다', () => {
    expect(parsePageParam('3')).toBe(3)
    expect(parsePageParam('03')).toBe(3)
    expect(parsePageParam('99')).toBe(99)
  })

  it('그 밖은 1페이지 — 지수 · 16진 · 부호 · 공백 · 소수 · 섞인 글자 · 0 · 빈 값 · 없음', () => {
    for (const raw of ['1e1', '0x10', '+3', '-1', ' 3', '3 ', '2.5', '3abc', 'abc', '0', '', null]) {
      expect(parsePageParam(raw)).toBe(1)
    }
  })

  it('너무 큰 수는 1페이지(안전한 정수 밖)', () => {
    expect(parsePageParam('99999999999999999999')).toBe(1)
  })
})

describe('canonicalPageParam — page 가 여럿', () => {
  it('첫 값으로 읽은 것 하나로 정리한다', () => {
    expect(canonicalPageParam('3', 3, true)).toBe('3')
    expect(canonicalPageParam('x', 1, true)).toBe('')
  })
})
