import { useMutation, useQueryClient } from '@tanstack/react-query'

import { postKeys } from '@/features/posts'

import { approveClaim, createClaim, receiveClaim, rejectClaim } from '../api/claimApi'
import { claimKeys } from './claimQueries'

/** 요청 하나에 하는 일 — 승인 · 거절(승인된 요청이면 승인 취소) · 받았어요 */
export type ClaimDecision = 'approve' | 'reject' | 'receive'

/** 화면이 틀렸다는 뜻인 실패 — 그사이 상태가 바뀌었다. 다시 받아 맞춘다 */
export const CLAIM_STALE_CODES = [
  'INVALID_CLAIM_STATUS',
  'CLAIM_NOT_ACCEPTING',
  'DUPLICATE_CLAIM',
  'CLAIM_NOT_FOUND',
  'FORBIDDEN_ACCESS',
  'POST_NOT_FOUND',
] as const

/**
 * 요청이 바뀌면 함께 바뀌는 것 — 그 글 상세(상태 · 대기 수 · 내 요청 · 주인 확인), 받은 요청, 내가 보낸 요청, 목록(글 상태).
 * 상세는 그 글만(`exact` — 댓글 캐시는 두고). 다시 받는 것을 기다리지 않는다
 */
function useRefreshClaim() {
  const queryClient = useQueryClient()
  return (postId: number) => {
    void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId), exact: true })
    void queryClient.invalidateQueries({ queryKey: claimKeys.all })
    void queryClient.invalidateQueries({ queryKey: postKeys.lists() })
  }
}

/** [4.7] 확인 요청 보내기. 성공 · 상태가 어긋난 실패(이미 보냄 · 게시중 아님) 모두 다시 받는다 */
export function useCreateClaim(postId: number) {
  const refresh = useRefreshClaim()
  return useMutation({
    mutationFn: (answer: string) => createClaim(postId, { answer: answer.trim() }),
    retry: 0,
    onSuccess: () => refresh(postId),
    onError: () => refresh(postId),
  })
}

/** [4.8] 승인 · 거절 · 받았어요. 실패해도 다시 받는다 — 다른 탭 · 다른 사람이 바꿨을 수 있다 */
export function useDecideClaim(postId: number) {
  const refresh = useRefreshClaim()
  return useMutation({
    mutationFn: ({ claimId, decision }: { claimId: number; decision: ClaimDecision }) =>
      decision === 'approve' ? approveClaim(claimId) : decision === 'reject' ? rejectClaim(claimId) : receiveClaim(claimId),
    retry: 0,
    onSettled: () => refresh(postId),
  })
}
