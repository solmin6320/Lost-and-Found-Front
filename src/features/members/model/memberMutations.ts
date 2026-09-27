import { useMutation, useQueryClient } from '@tanstack/react-query'

import { postKeys } from '@/features/posts'

import { updateNickname } from '../api/memberApi'
import { meQueryOptions } from './memberQueries'

/**
 * [3.6] 닉네임 변경.
 *
 * 성공하면 응답을 `members/me` 캐시에 넣는다. 인증 상태가 이 캐시를 따라가서 헤더 닉네임도 바로 바뀐다.
 * 게시글 캐시는 무효화한다. 사용자에게 "지금까지 쓴 글의 이름도 바뀝니다"라고 알렸는데
 * 캐시에 남은 상세가 옛 이름을 보여주면 안 된다. 댓글 캐시는 상세 키 아래에 있어 같이 무효화된다.
 *
 * 실패 code : `DUPLICATE_NICKNAME`(409) · `INVALID_INPUT`(400). 같은 닉네임은 200 이라 성공으로 온다.
 */
export function useUpdateNickname() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateNickname,
    // 쓰기는 자동 재시도하지 않는다(queryClient 기본값과 같다). 훅에서 덮어쓰지 않도록 적어 둔다
    retry: 0,
    onSuccess: (me) => {
      queryClient.setQueryData(meQueryOptions().queryKey, me)
      // 기다리지 않는다. 기다리면 게시글을 다시 받을 때까지 저장 버튼이 잠겨 있다
      void queryClient.invalidateQueries({ queryKey: postKeys.all })
    },
  })
}
