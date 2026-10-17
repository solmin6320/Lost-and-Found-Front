import { describe, expect, it } from 'vitest'

import { canonicalPageParam } from './pageParam'

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
