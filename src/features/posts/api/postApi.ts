import { request } from '@/shared/lib/http'
import type { PagedModel } from '@/shared/types/api'

import {
  isPostCategory,
  isPostStatus,
  isPostType,
  type PostDetailResponse,
  type PostListParams,
  type PostListResponse,
  type PostStatusResponse,
  type PostStatusUpdateRequest,
} from './types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 검색 조건을 서버에 보낼 모양으로 다듬는다. 요청과 쿼리 키가 같은 결과를 쓴다.
 *
 * - 문자열은 앞뒤 공백을 자르고, 비면 뺀다
 * - Enum·날짜가 형식에 맞지 않으면 뺀다. URL 에서 온 값은 사용자 입력이다.
 *   그대로 보내면 400 이 나고 메시지에 서버 내부 문구가 섞일 수 있다
 * - `page` 0 은 기본값이라 뺀다. `{}` 와 `{ page: 0 }` 이 서로 다른 캐시가 되지 않게 한다
 */
export function normalizePostListParams(params: PostListParams): PostListParams {
  const result: PostListParams = {}

  const keyword = params.keyword?.trim()
  if (keyword) result.keyword = keyword

  if (isPostType(params.type)) result.type = params.type
  if (isPostCategory(params.category)) result.category = params.category
  if (isPostStatus(params.status)) result.status = params.status

  const location = params.location?.trim()
  if (location) result.location = location

  if (params.from && ISO_DATE.test(params.from)) result.from = params.from
  if (params.to && ISO_DATE.test(params.to)) result.to = params.to

  if (isPositiveInteger(params.page)) result.page = params.page
  if (isPositiveInteger(params.size)) result.size = params.size

  return result
}

function isPositiveInteger(value: number | undefined): value is number {
  return Number.isInteger(value) && (value as number) > 0
}

/**
 * [4.2] `GET /api/posts` — 비로그인 가능. 등록일 내림차순 고정.
 * 만료된 토큰을 실어 보내도 401 이 아니라 비로그인 기준의 200 이 온다.
 * `from > to` 면 400 `INVALID_INPUT`("시작일이 종료일보다 늦을 수 없습니다").
 */
export function getPosts(
  params: PostListParams = {},
  signal?: AbortSignal,
): Promise<PagedModel<PostListResponse>> {
  return request<PagedModel<PostListResponse>>('/api/posts', {
    query: { ...normalizePostListParams(params) },
    signal,
  })
}

/**
 * [4.3] `GET /api/posts/{id}` — 비로그인 가능.
 *
 * 조회수는 서버가 올린다. 로그인 회원이 이 글을 **하루에 처음** 볼 때만 +1 이고(Redis 1일),
 * 비로그인 · 만료된 토큰은 집계하지 않는다. 다시 불러도 조회수가 부풀지는 않지만
 * 요청마다 서버에서 쓰기 트랜잭션이 돈다. 그래서 캐시를 고칠 때 이 요청을 다시 부르지 않는다.
 *
 * 실패 code : `POST_NOT_FOUND`(404) · `INVALID_INPUT`(400, id 가 숫자가 아님)
 */
export function getPost(postId: number, signal?: AbortSignal): Promise<PostDetailResponse> {
  return request<PostDetailResponse>(`/api/posts/${postId}`, { signal })
}

/**
 * [4.6] `PATCH /api/posts/{id}/status` — 작성자 본인만. JSON 본문.
 *
 * 전이 규칙(백엔드 `Post.changeStatus`)
 * - `OPEN` · `IN_PROGRESS` 에서는 나머지 어느 상태로든 바꿀 수 있다(`OPEN → DONE` 도 된다)
 * - `DONE` 에서 다른 상태로 → 409 `INVALID_STATUS_TRANSITION`. 완료는 되돌릴 수 없다
 * - 지금과 같은 상태 → 아무것도 바꾸지 않고 200(`DONE → DONE` 도 200)
 *
 * 실패 code : `INVALID_STATUS_TRANSITION`(409) · `FORBIDDEN_ACCESS`(403) · `POST_NOT_FOUND`(404) ·
 * `INVALID_INPUT`(400)
 *
 * 화면에서는 캐시까지 맞추는 `useChangePostStatus()` 를 쓴다.
 */
export function changePostStatus(
  postId: number,
  body: PostStatusUpdateRequest,
): Promise<PostStatusResponse> {
  return request<PostStatusResponse>(`/api/posts/${postId}/status`, { method: 'PATCH', body })
}

/**
 * [4.4] `DELETE /api/posts/{id}` — 작성자 본인만. 성공하면 204(`undefined`).
 * 댓글과 사진도 함께 지워진다. 되돌릴 수 없다.
 *
 * 실패 code : `FORBIDDEN_ACCESS`(403) · `POST_NOT_FOUND`(404)
 *
 * 화면에서는 캐시까지 정리하는 `useDeletePost()` 를 쓴다.
 */
export function deletePost(postId: number): Promise<void> {
  return request<void>(`/api/posts/${postId}`, { method: 'DELETE' })
}
