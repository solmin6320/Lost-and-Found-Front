import { useQuery } from '@tanstack/react-query'

import type { ClaimResponse } from '@/features/claims'
import { memberKeys } from '@/features/members'

/**
 * 받은 확인 요청 캐시 키 — `@/features/claims` 의 `receivedClaimsQueryOptions(postId).queryKey`(= `claimKeys.received`)와 **같아야 한다**
 * (`receivedClaimsCache.test.ts` 가 지킨다).
 *
 * 왜 claims 를 직접 부르지 않나 : posts 가 claims 를 정적으로 가져오면 순환이 생긴다 — members(`memberMutations` → posts) →
 * posts → claims(`claimQueries` 가 모듈을 읽는 순간 `memberKeys.all` 을 펼친다) → members(아직 초기화 전). 첫 화면이 members 부터
 * 읽으면 `Cannot access 'memberKeys' before initialization` 으로 앱이 뜨지 않는다(2026-10-28 확인). members 의 키는 함수 안에서만 읽어 안전하다
 */
export function receivedClaimsCacheKey(postId: number) {
  return [...memberKeys.all, 'claims', 'received', postId] as const
}

/**
 * 글쓴이 화면에서 받은 확인 요청을 **캐시에서만** 읽는다(요청은 보내지 않는다 — 바로 아래 `ReceivedClaims` 칸이 같은 키로 받는다).
 * 아직 받지 못했거나 실패했으면 `undefined` — 부른 쪽은 지금 동작 그대로 둔다
 */
export function useCachedReceivedClaims(postId: number): ClaimResponse[] | undefined {
  return useQuery<ClaimResponse[]>({ queryKey: receivedClaimsCacheKey(postId), enabled: false }).data
}
