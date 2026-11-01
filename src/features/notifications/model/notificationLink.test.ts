import { describe, expect, it } from 'vitest'

import { POST_CLAIMS_HASH, POST_MATCHES_HASH, POST_PUBLIC_MATCHES_HASH, notificationHref } from './notificationLink'

describe('알림 줄이 가는 곳(SCR-10 "누르면")', () => {
  it('받은 요청 · 승인은 그 글 상세의 확인 요청 칸', () => {
    expect(notificationHref({ type: 'CLAIM_REQUESTED', postId: 7 })).toBe('/posts/7#claims')
    expect(notificationHref({ type: 'CLAIM_APPROVED', postId: 12 })).toBe('/posts/12#claims')
    expect(POST_CLAIMS_HASH).toBe('#claims')
  })

  it('승인은 그 요청으로 열린 대화방(SCR-13) — 방 목록에서 claimId 로 찾는다', () => {
    const rooms = new Map([[40, 7]])
    const find = (claimId: number) => rooms.get(claimId) ?? null
    expect(notificationHref({ type: 'CLAIM_APPROVED', postId: 12, claimId: 40 }, find)).toBe('/chat/7')
    // 글이 지워져도 방이 있으면 방으로
    expect(notificationHref({ type: 'CLAIM_APPROVED', postId: null, claimId: 40 }, find)).toBe('/chat/7')
  })

  it('승인인데 방을 못 찾으면(목록 전 · 방 없음) 지금처럼 그 글 상세의 확인 요청 칸', () => {
    expect(notificationHref({ type: 'CLAIM_APPROVED', postId: 12, claimId: 41 }, () => null)).toBe('/posts/12#claims')
    expect(notificationHref({ type: 'CLAIM_APPROVED', postId: 12, claimId: 41 }, () => undefined)).toBe('/posts/12#claims')
    expect(notificationHref({ type: 'CLAIM_APPROVED', postId: 12, claimId: null }, () => 7)).toBe('/posts/12#claims')
  })

  it('승인이 아닌 종류는 방을 찾지 않는다', () => {
    expect(notificationHref({ type: 'CLAIM_REQUESTED', postId: 7, claimId: 40 }, () => 9)).toBe('/posts/7#claims')
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
