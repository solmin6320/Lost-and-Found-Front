import { useMutation, useQueryClient } from '@tanstack/react-query'

import { dismissPublicMatch } from '../api/publicMatchApi'
import type { PublicMatchResponse } from '../api/publicMatchTypes'
import { publicMatchKeys } from './publicMatchQueries'

/** 화면이 틀렸다는 뜻인 실패 — 그사이 후보가 사라졌거나(30일 지나 지워짐 · 다른 탭에서 숨김) 내 글이 아니게 됐다. 창을 닫고 다시 받는다 */
export const PUBLIC_MATCH_STALE_CODES = ['PUBLIC_MATCH_NOT_FOUND', 'POST_NOT_FOUND', 'FORBIDDEN_ACCESS'] as const

/** 받은 후보에서 하나를 뺀다(순수 — 시험) */
export function withoutPublicItem(
  list: PublicMatchResponse[] | undefined,
  itemId: number,
): PublicMatchResponse[] | undefined {
  return list?.filter((item) => item.itemId !== itemId)
}

/**
 * 공공 후보 숨기기 — `useDismissMatch` 와 같은 흐름. 성공하면 받은 목록에서 **바로 뺀 뒤** 다시 받는다.
 * 실패해도 다시 받는다 — 다른 탭에서 숨겼거나 그사이 지워졌을 수 있다
 */
export function useDismissPublicMatch(postId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: number) => dismissPublicMatch(postId, itemId),
    retry: 0,
    onSuccess: (_data, itemId) => {
      queryClient.setQueryData<PublicMatchResponse[]>(publicMatchKeys.post(postId), (list) => withoutPublicItem(list, itemId))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: publicMatchKeys.post(postId) }),
  })
}
