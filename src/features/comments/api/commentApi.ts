import { request } from '@/shared/lib/http'
import type { PagedModel } from '@/shared/types/api'

import type { CommentRequest, CommentResponse } from './types'

/**
 * [5.1] `GET /api/posts/{postId}/comments?page=` — 비로그인 가능. 등록 오래된 순(같으면 id 순), 20건 고정.
 * `page` 는 **0부터**. 0 페이지는 상세 응답의 `comments` 와 같으므로 "더 보기"는 1 부터 부른다.
 * `size` 는 보내지 않는다(서버가 무시한다). 범위 밖 페이지는 빈 `content` 로 200 이다.
 *
 * 실패 code : `POST_NOT_FOUND`(404)
 */
export function getComments(
  postId: number,
  page: number,
  signal?: AbortSignal,
): Promise<PagedModel<CommentResponse>> {
  return request<PagedModel<CommentResponse>>(`/api/posts/${postId}/comments`, {
    query: { page: page > 0 ? page : undefined },
    signal,
  })
}

/**
 * [5.1] `POST /api/posts/{postId}/comments` — 로그인 필요. 성공하면 201 + 만든 댓글.
 * 완료(`DONE`)된 글에도 달 수 있다.
 *
 * 실패 code : `POST_NOT_FOUND`(404) · `INVALID_INPUT`(400, 빈 내용 · 300자 초과)
 */
export function createComment(postId: number, body: CommentRequest): Promise<CommentResponse> {
  return request<CommentResponse>(`/api/posts/${postId}/comments`, { method: 'POST', body })
}

/**
 * [5.1] `PUT /api/comments/{commentId}` — 작성자 본인만. 성공하면 200 + 고친 댓글(`updatedAt` 이 찬다).
 * 경로에 게시글 id 가 없다.
 *
 * 실패 code : `COMMENT_NOT_FOUND`(404) · `FORBIDDEN_ACCESS`(403) · `INVALID_INPUT`(400)
 */
export function updateComment(commentId: number, body: CommentRequest): Promise<CommentResponse> {
  return request<CommentResponse>(`/api/comments/${commentId}`, { method: 'PUT', body })
}

/**
 * [5.1] `DELETE /api/comments/{commentId}` — 작성자 본인만. 성공하면 204(`undefined`). 되돌릴 수 없다.
 *
 * 실패 code : `COMMENT_NOT_FOUND`(404) · `FORBIDDEN_ACCESS`(403)
 */
export function deleteComment(commentId: number): Promise<void> {
  return request<void>(`/api/comments/${commentId}`, { method: 'DELETE' })
}
