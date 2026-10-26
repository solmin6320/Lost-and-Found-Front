import { useMutation, useQueryClient } from '@tanstack/react-query'

import { appointManager, dismissManager } from '../api/adminApi'
import type { AdminMemberResponse, ManagerChange } from '../api/types'
import { adminKeys } from './adminQueries'
import { managerChangeFailure } from './managerChange'

export interface ManagerChangeVariables {
  member: AdminMemberResponse
  change: ManagerChange
}

/**
 * 매니저 임명 · 해임. 성공하면 회원 목록(모든 검색 · 역할 · 페이지)을 다시 받는다 — 역할 탭의 줄이 옮겨 간다.
 * 그사이 바뀌어 거절됐을 때(`stale`)도 다시 받는다 — 지금 상태를 맞춘다. 다시 받는 것을 기다리지 않는다(버튼이 그만큼 잠겨 있지 않게).
 * 쓰기는 자동 재시도하지 않는다(queryClient 기본값과 같다)
 */
export function useManagerChange() {
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: adminKeys.memberLists() })

  return useMutation({
    mutationFn: ({ member, change }: ManagerChangeVariables) =>
      change === 'appoint' ? appointManager(member.id) : dismissManager(member.id),
    retry: 0,
    onSuccess: refresh,
    onError: (error) => {
      if (managerChangeFailure(error) === 'stale') refresh()
    },
  })
}
