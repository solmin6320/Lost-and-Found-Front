import { queryOptions } from '@tanstack/react-query'

import { memberKeys } from '@/features/members'

import { getMyClaims, getReceivedClaims, normalizeMyClaimsParams } from '../api/claimApi'
import type { MyClaimsParams } from '../api/types'

/**
 * 확인 요청 쿼리 키 — **회원 키(`memberKeys.all`) 아래에** 둔다. 답은 비공개라 로그아웃 · 세션 만료 때
 * `AuthProvider` 가 `memberKeys.all` 을 지우며 같이 지워진다(관리자 키와 같은 까닭).
 */
export const claimKeys = {
  all: [...memberKeys.all, 'claims'] as const,
  /** 글쓴이가 받은 요청 — 글마다 */
  receivedAll: () => [...claimKeys.all, 'received'] as const,
  received: (postId: number) => [...claimKeys.receivedAll(), postId] as const,
  /** 내가 보낸 요청 — 쪽마다 */
  mines: () => [...claimKeys.all, 'mine'] as const,
  mine: (params: MyClaimsParams) => [...claimKeys.mines(), normalizeMyClaimsParams(params)] as const,
}

/** 받은 요청(글쓴이만 부른다) */
export function receivedClaimsQueryOptions(postId: number) {
  return queryOptions({
    queryKey: claimKeys.received(postId),
    queryFn: ({ signal }) => getReceivedClaims(postId, signal),
  })
}

/** 내가 보낸 요청. 화면이 이전 쪽을 붙잡는 옵션을 덧붙여 펼쳐 쓴다 */
export function myClaimsQueryOptions(params: MyClaimsParams = {}) {
  return queryOptions({
    queryKey: claimKeys.mine(params),
    queryFn: ({ signal }) => getMyClaims(params, signal),
  })
}
