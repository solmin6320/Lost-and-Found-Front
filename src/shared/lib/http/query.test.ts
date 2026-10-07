import { describe, expect, it } from 'vitest'

import { buildQueryString } from './query'

describe('buildQueryString — 조건 → 쿼리스트링', () => {
  it('배열은 같은 이름을 되풀이한다(서버 List<PostStatus>)', () => {
    expect(buildQueryString({ status: ['OPEN', 'IN_PROGRESS'] })).toBe('status=OPEN&status=IN_PROGRESS')
  })

  it('값 하나도 그대로', () => {
    expect(buildQueryString({ status: 'DONE', page: 2 })).toBe('status=DONE&page=2')
  })

  it('비어 있는 값 · 빈 배열 · 배열 안의 빈 값은 싣지 않는다', () => {
    expect(buildQueryString({ keyword: '', type: undefined, category: null, status: [] })).toBe('')
    expect(buildQueryString({ status: ['OPEN', '', undefined] })).toBe('status=OPEN')
  })

  it('한글 · 특수문자는 인코딩한다', () => {
    expect(buildQueryString({ keyword: '지갑 & 카드' })).toBe('keyword=%EC%A7%80%EA%B0%91+%26+%EC%B9%B4%EB%93%9C')
  })

  it('조건이 없으면 빈 문자열', () => {
    expect(buildQueryString(undefined)).toBe('')
  })
})
