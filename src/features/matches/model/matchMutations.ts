import { useMutation, useQueryClient } from '@tanstack/react-query'

import { dismissMatch } from '../api/matchApi'
import type { MatchResponse } from '../api/types'
import { matchKeys } from './matchQueries'

/** 화면이 틀렸다는 뜻인 실패 — 그사이 후보가 사라졌거나(글 삭제 · 완료) 내 글이 아니게 됐다. 창을 닫고 다시 받는다 */
export const MATCH_STALE_CODES = ['MATCH_NOT_FOUND', 'POST_NOT_FOUND', 'FORBIDDEN_ACCESS'] as const

/** 받은 후보에서 하나를 뺀다(순수 — 시험) */
export function withoutCandidate(list: MatchResponse[] | undefined, candidatePostId: number): MatchResponse[] | undefined {
  return list?.filter((match) => match.postId !== candidatePostId)
}

/**
 * 후보 숨기기. 성공하면 받은 목록에서 **바로 뺀 뒤** 다시 받는다(카드가 다시 받기를 기다리지 않고 사라진다).
 * 실패해도 다시 받는다 — 다른 탭에서 숨겼거나 후보 글이 그사이 끝났을 수 있다
 */
export function useDismissMatch(postId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (candidatePostId: number) => dismissMatch(postId, candidatePostId),
    retry: 0,
    onSuccess: (_data, candidatePostId) => {
      queryClient.setQueryData<MatchResponse[]>(matchKeys.post(postId), (list) => withoutCandidate(list, candidatePostId))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: matchKeys.post(postId) }),
  })
}
