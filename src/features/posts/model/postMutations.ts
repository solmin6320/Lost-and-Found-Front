import { useMutation, useQueryClient } from '@tanstack/react-query'

import { hasErrorCode } from '@/shared/lib/http'

import { changePostStatus, deletePost } from '../api/postApi'
import type { PostDetailResponse, PostStatus } from '../api/types'
import { postKeys } from './postQueries'

/**
 * [4.6] 상태 변경. `mutate(nextStatus)`.
 *
 * **낙관적 업데이트를 하지 않는다.** 응답이 빠르고(한 행 UPDATE), 실패하는 경우는 전부
 * 화면이 틀렸다는 뜻이다(이미 완료됨 · 남의 글 · 지워진 글). 배지를 먼저 바꿨다가 되돌리면
 * 특히 `DONE` 에서 "완료됐다"가 잠깐 보였다 사라진다. 버튼은 `isPending` 동안 잠근다.
 *
 * 성공하면
 * - 상세 캐시의 `status` · `updatedAt` 을 응답으로 고친다(상세를 다시 받지 않는다 — 조회수 집계 요청이다)
 * - 목록은 무효화한다. 상태 필터(`status=OPEN`)가 걸린 목록에서 빠져야 할 수 있어 값만 고치면 틀린다
 *
 * 실패하면 `INVALID_STATUS_TRANSITION`(409, 다른 탭에서 이미 완료) · `POST_NOT_FOUND`(404) 는
 * 캐시가 낡았다는 뜻이라 상세를 다시 받는다. `FORBIDDEN_ACCESS`(403) 는 그대로 둔다.
 */
export function useChangePostStatus(postId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (status: PostStatus) => changePostStatus(postId, { status }),
    retry: 0,
    onSuccess: (result) => {
      queryClient.setQueryData<PostDetailResponse>(postKeys.detail(postId), (detail) =>
        detail ? { ...detail, status: result.status, updatedAt: result.updatedAt } : detail,
      )
      void queryClient.invalidateQueries({ queryKey: postKeys.lists() })
    },
    onError: (error) => {
      if (hasErrorCode(error, 'INVALID_STATUS_TRANSITION') || hasErrorCode(error, 'POST_NOT_FOUND')) {
        // 댓글까지 다시 받을 이유는 없다
        void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId), exact: true })
      }
    },
  })
}

/**
 * [4.4] 게시글 삭제. `mutate(postId)`. 되돌릴 수 없으니 부르기 전에 확인을 받는다.
 *
 * 성공하면 그 글의 상세 · 댓글 캐시를 지우고 목록을 무효화한다.
 * 화면 이동은 부른 쪽의 `onSuccess` 에서 **바로** 한다. 이 훅의 정리가 먼저 끝난 뒤에 불린다.
 *
 * ```ts
 * deletePost.mutate(post.id, { onSuccess: () => navigate(paths.postList, { replace: true }) })
 * ```
 *
 * `replace` 로 가야 뒤로가기가 지워진 글로 돌아가지 않는다.
 *
 * 실패 code : `FORBIDDEN_ACCESS`(403) · `POST_NOT_FOUND`(404, 이미 지워짐 — 목록으로 보내면 된다)
 */
export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePost,
    retry: 0,
    onSuccess: (_result, postId) => forgetPost(postId),
    onError: (error, postId) => {
      // 다른 탭에서 이미 지웠다. 결과는 성공과 같으니 캐시도 똑같이 정리한다
      if (hasErrorCode(error, 'POST_NOT_FOUND')) {
        forgetPost(postId)
      }
    },
  })

  function forgetPost(postId: number) {
    // 앞부분 일치라 댓글(`[..., 'detail', id, 'comments']`)도 같이 지워진다
    queryClient.removeQueries({ queryKey: postKeys.detail(postId) })
    void queryClient.invalidateQueries({ queryKey: postKeys.lists() })
  }
}
