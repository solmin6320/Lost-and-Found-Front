import { describe, expect, it } from 'vitest'

import { pageAnnouncement } from './pageAnnouncement'

describe('pageAnnouncement', () => {
  it('목록 · 내가 쓴 글이 같은 문장 — 몇 페이지 · 전체 · 몇째부터 몇째까지', () => {
    expect(pageAnnouncement(3, 20, 20, 230)).toBe('3페이지예요. 230건 중 41~60번째 글이에요.')
  })

  it('마지막 페이지는 받은 글 수로 끝 번호를 센다 · 천 단위 쉼표', () => {
    expect(pageAnnouncement(12, 20, 10, 230)).toBe('12페이지예요. 230건 중 221~230번째 글이에요.')
    expect(pageAnnouncement(100, 20, 20, 2400)).toBe('100페이지예요. 2,400건 중 1,981~2,000번째 글이에요.')
  })
})
