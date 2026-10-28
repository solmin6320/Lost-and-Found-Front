import { describe, expect, it } from 'vitest'

import { receivedClaimsQueryOptions } from '@/features/claims'

import { receivedClaimsCacheKey } from './receivedClaimsCache'

describe('receivedClaimsCacheKey', () => {
  it('claims 의 받은 요청 쿼리 키와 같다 — 내 글 관리가 아래 칸과 같은 캐시를 읽는다', () => {
    expect(receivedClaimsCacheKey(101)).toEqual(receivedClaimsQueryOptions(101).queryKey)
  })
})
