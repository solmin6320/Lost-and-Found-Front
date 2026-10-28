import { describe, expect, it } from 'vitest'

import { isClaimLocked } from './postStatus'

describe('isClaimLocked — 승인한 확인 요청이 글을 붙잡고 있나', () => {
  it('연락중 + 승인한 요청이 있으면 잠근다', () => {
    expect(isClaimLocked('IN_PROGRESS', ['PENDING', 'APPROVED'])).toBe(true)
  })

  it('받기 전 · 실패(undefined)면 잠그지 않는다', () => {
    expect(isClaimLocked('IN_PROGRESS', undefined)).toBe(false)
  })

  it('승인한 요청이 없으면 잠그지 않는다(직접 연락중으로 바꾼 글)', () => {
    expect(isClaimLocked('IN_PROGRESS', ['PENDING', 'REJECTED'])).toBe(false)
    expect(isClaimLocked('IN_PROGRESS', [])).toBe(false)
  })

  it('게시중 · 완료 글은 잠그지 않는다', () => {
    expect(isClaimLocked('OPEN', ['APPROVED'])).toBe(false)
    expect(isClaimLocked('DONE', ['RECEIVED'])).toBe(false)
  })
})
