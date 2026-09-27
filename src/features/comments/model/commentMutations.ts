import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { postKeys, type PostDetailResponse } from '@/features/posts'
import { hasErrorCode } from '@/shared/lib/http'

import { createComment, deleteComment, updateComment } from '../api/commentApi'
import type { CommentRequest, CommentResponse } from '../api/types'
import {
  appendToDetail,
  appendToPages,
  removeFromDetail,
  removeFromPages,
  replaceInDetail,
  replaceInPages,
  type CommentPages,
} from './commentCache'
import { commentKeys } from './commentQueries'

/*
 * 댓글 쓰기 공통
 *
 * - 자동 재시도하지 않는다(`retry: 0`). 등록을 다시 보내면 댓글이 두 개 생긴다
 * - **낙관적 업데이트를 하지 않는다.** 새 댓글은 id · 작성 시각을 서버가 정하고, 실패(글 삭제됨 ·
 *   남의 댓글 · 300자 초과)면 보였던 댓글이 사라져야 한다. 대신 성공 응답으로 캐시를 바로 고친다.
 *   입력칸 · 버튼은 `isPending` 동안 잠근다
 * - 성공하면 상세(`totalCommentCount` · 첫 20건)와 댓글 캐시를 **함께** 고친다.
 *   상세를 다시 받지 않는다 — 상세 요청은 조회수 집계를 탄다
 */

function patchComments(
  queryClient: QueryClient,
  postId: number,
  updatePages: (data: CommentPages) => CommentPages,
  updateDetail: (detail: PostDetailResponse) => PostDetailResponse,
) {
  queryClient.setQueryData<CommentPages>(commentKeys.post(postId), (data) =>
    data ? updatePages(data) : data,
  )
  queryClient.setQueryData<PostDetailResponse>(postKeys.detail(postId), (detail) =>
    detail ? updateDetail(detail) : detail,
  )
}

/** 캐시가 서버와 어긋났다(남이 지웠다 등). 받아 둔 페이지를 같은 경계로 다시 받는다 */
function refetchComments(queryClient: QueryClient, postId: number) {
  void queryClient.invalidateQueries({ queryKey: commentKeys.post(postId) })
}

/**
 * 글이 사라졌다. 상세를 다시 받아 화면이 "없는 글"로 바뀌게 한다.
 * 앞부분 일치라 댓글도 함께 무효화된다
 */
function refetchPost(queryClient: QueryClient, postId: number) {
  void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) })
}

/**
 * [5.1] 댓글 등록. `mutate({ content })`. 로그인 필요.
 *
 * 정렬이 오래된 순이라 새 댓글은 맨 끝이다. 마지막 페이지까지 펼쳐 둔 상태면 목록 끝에 바로 보이고,
 * 아니면 개수만 늘고 "더 보기" 끝에서 나온다. 방금 쓴 댓글을 바로 보여줘야 하면
 * 부른 쪽 `onSuccess` 의 응답(`CommentResponse`)을 쓴다.
 *
 * 실패 code : `POST_NOT_FOUND`(404, 상세를 다시 받는다) · `INVALID_INPUT`(400)
 */
export function useCreateComment(postId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: CommentRequest) => createComment(postId, body),
    retry: 0,
    onSuccess: (comment) => {
      patchComments(
        queryClient,
        postId,
        (data) => appendToPages(data, comment),
        (detail) => appendToDetail(detail, comment),
      )
    },
    onError: (error) => {
      if (hasErrorCode(error, 'POST_NOT_FOUND')) refetchPost(queryClient, postId)
    },
  })
}

export interface UpdateCommentVariables extends CommentRequest {
  commentId: number
}

/**
 * [5.1] 댓글 수정. `mutate({ commentId, content })`. 작성자 본인만.
 * 성공하면 그 댓글을 응답(`updatedAt` 이 찬 값)으로 바꿔 끼운다. 순서 · 개수는 그대로다.
 *
 * 실패 code : `COMMENT_NOT_FOUND`(404, 댓글을 다시 받는다) · `FORBIDDEN_ACCESS`(403) · `INVALID_INPUT`(400)
 */
export function useUpdateComment(postId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ commentId, content }: UpdateCommentVariables) =>
      updateComment(commentId, { content }),
    retry: 0,
    onSuccess: (comment: CommentResponse) => {
      patchComments(
        queryClient,
        postId,
        (data) => replaceInPages(data, comment),
        (detail) => replaceInDetail(detail, comment),
      )
    },
    onError: (error) => {
      if (hasErrorCode(error, 'COMMENT_NOT_FOUND')) refetchComments(queryClient, postId)
    },
  })
}

/**
 * [5.1] 댓글 삭제. `mutate(commentId)`. 작성자 본인만. 되돌릴 수 없으니 부르기 전에 확인을 받는다.
 *
 * 성공하면 캐시에서 바로 빼고(화면이 즉시 바뀐다), 받아 둔 댓글 페이지를 다시 받는다.
 * 뒤 댓글이 한 칸씩 당겨져 페이지 경계가 바뀌기 때문이다 — 안 그러면 다음 "더 보기"에서 한 건을 건너뛴다.
 *
 * 실패 code : `COMMENT_NOT_FOUND`(404, 이미 지워짐 — 성공과 똑같이 정리한다) · `FORBIDDEN_ACCESS`(403)
 */
export function useDeleteComment(postId: number) {
  const queryClient = useQueryClient()

  function forgetComment(commentId: number) {
    patchComments(
      queryClient,
      postId,
      (data) => removeFromPages(data, commentId),
      (detail) => removeFromDetail(detail, commentId),
    )
    refetchComments(queryClient, postId)
  }

  return useMutation({
    mutationFn: deleteComment,
    retry: 0,
    onSuccess: (_result, commentId) => forgetComment(commentId),
    onError: (error, commentId) => {
      if (hasErrorCode(error, 'COMMENT_NOT_FOUND')) forgetComment(commentId)
    },
  })
}
