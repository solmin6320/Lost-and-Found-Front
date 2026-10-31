import { describe, expect, it } from 'vitest'

import { POST_CLAIMS_HASH, POST_MATCHES_HASH, POST_PUBLIC_MATCHES_HASH, notificationHref } from './notificationLink'

describe('알림 줄이 가는 곳(SCR-10 "누르면")', () => {
  it('받은 요청 · 승인은 그 글 상세의 확인 요청 칸', () => {
    expect(notificationHref({ type: 'CLAIM_REQUESTED', postId: 7 })).toBe('/posts/7#claims')
    expect(notificationHref({ type: 'CLAIM_APPROVED', postId: 12 })).toBe('/posts/12#claims')
    expect(POST_CLAIMS_HASH).toBe('#claims')
  })

  it('거절은 보낸 확인 요청 화면 — 글이 지워져 postId 가 없어도 간다', () => {
    expect(notificationHref({ type: 'CLAIM_REJECTED', postId: 3 })).toBe('/me/claims')
    expect(notificationHref({ type: 'CLAIM_REJECTED', postId: null })).toBe('/me/claims')
  })

  it('추천은 내 글 상세의 추천 후보 묶음(SCR-11)', () => {
    expect(notificationHref({ type: 'MATCH_SUGGESTED', postId: 5 })).toBe('/posts/5#matches')
    expect(POST_MATCHES_HASH).toBe('#matches')
  })

  it('경찰서 · 기관 보관 후보는 내 분실 글 상세의 공공 후보 묶음', () => {
    expect(notificationHref({ type: 'PUBLIC_MATCH_SUGGESTED', postId: 8 })).toBe('/posts/8#public-matches')
    expect(POST_PUBLIC_MATCHES_HASH).toBe('#public-matches')
    expect(notificationHref({ type: 'PUBLIC_MATCH_SUGGESTED', postId: null })).toBeNull()
  })

  it('그 밖의 종류는 그 글 상세(조각 없음)', () => {
    expect(notificationHref({ type: 'SOMETHING_NEW', postId: 5 })).toBe('/posts/5')
  })

  it('글이 없는 알림은 링크가 아니다(거절 제외)', () => {
    expect(notificationHref({ type: 'CLAIM_REQUESTED', postId: null })).toBeNull()
    expect(notificationHref({ type: 'CLAIM_APPROVED', postId: null })).toBeNull()
    expect(notificationHref({ type: 'MATCH_SUGGESTED', postId: null })).toBeNull()
  })
})
