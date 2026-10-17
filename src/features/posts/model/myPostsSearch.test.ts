import { describe, expect, it } from 'vitest'

import { myPostsSkeletonCount } from './myPostsSearch'

/* 내가 쓴 글 카드 자리표시 수(본인 결정 2026-10-18) */
describe('myPostsSkeletonCount', () => {
  it('받은 건수가 없으면 한 쪽(20장)', () => {
    expect(myPostsSkeletonCount(undefined, 1)).toBe(20)
    expect(myPostsSkeletonCount(undefined, 7)).toBe(20)
  })

  it('받은 건수가 있으면 그 쪽에 남은 글 수 — 20장까지', () => {
    expect(myPostsSkeletonCount(3, 1)).toBe(3)
    expect(myPostsSkeletonCount(230, 1)).toBe(20)
    expect(myPostsSkeletonCount(230, 12)).toBe(10)
  })

  it('그 쪽에 글이 없을 것 같아도 한 장은 둔다(0건 · 끝을 넘은 쪽)', () => {
    expect(myPostsSkeletonCount(0, 1)).toBe(1)
    expect(myPostsSkeletonCount(230, 99)).toBe(1)
  })
})
