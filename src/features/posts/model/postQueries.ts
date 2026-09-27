import { queryOptions, useQuery } from '@tanstack/react-query'

import { getPost, getPosts, normalizePostListParams } from '../api/postApi'
import type { PostListParams } from '../api/types'

/**
 * 게시글 쿼리 키. 무효화할 때 범위를 고른다.
 *   글 등록·삭제·상태 변경 후 목록 전체 → `postKeys.lists()`
 *   글 하나의 상세 → `postKeys.detail(id)`
 *
 * `detail(id)` 는 그 글의 댓글 키(`@/features/comments` 의 `commentKeys.post(id)`)의 앞부분이다.
 * 그래서 `detail(id)` 로 지우거나 무효화하면 댓글 캐시까지 같이 걸린다(글 삭제 · 닉네임 변경).
 * 상세만 건드리려면 `exact: true` 를 준다.
 */
export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  /** 검색 조건과 페이지가 키에 들어간다. 조건이 바뀌면 다른 캐시다 */
  list: (params: PostListParams) => [...postKeys.lists(), normalizePostListParams(params)] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (postId: number) => [...postKeys.details(), postId] as const,
}

/**
 * 목록 쿼리 설정. 옵션을 덧붙여야 하면 훅 대신 이것을 펼쳐 쓴다.
 *
 * ```ts
 * useQuery({ ...postListQueryOptions(params), placeholderData: keepPreviousData })
 * ```
 */
export function postListQueryOptions(params: PostListParams = {}) {
  return queryOptions({
    queryKey: postKeys.list(params),
    queryFn: ({ signal }) => getPosts(params, signal),
  })
}

/** [4.2] 게시글 목록. `page` 는 0부터 센다 */
export function usePostList(params: PostListParams = {}) {
  return useQuery(postListQueryOptions(params))
}

/**
 * 상세를 신선하다고 보는 시간. 전역 기본값(30초)보다 길다.
 *
 * - 상세 요청은 서버에서 조회수 집계(쓰기 트랜잭션 + Redis)를 탄다. 같은 사람이 다시 불러도
 *   숫자는 안 오르지만 공짜가 아니다
 * - 이 글을 바꿀 수 있는 사람은 작성자뿐이고, 작성자의 변경(상태 · 댓글)은 응답으로 캐시를 직접 고친다.
 *   그래서 같은 화면에서 다시 받을 일이 없다
 * - 남이 바꾼 상태 · 새 댓글은 1분 안에 따라온다. 분실물 글의 상태는 그보다 느리게 바뀐다
 */
const POST_DETAIL_STALE_TIME = 60_000

/** 상세 쿼리 설정. 옵션을 덧붙여야 하면 훅 대신 이것을 펼쳐 쓴다 */
export function postDetailQueryOptions(postId: number) {
  return queryOptions({
    queryKey: postKeys.detail(postId),
    queryFn: ({ signal }) => getPost(postId, signal),
    staleTime: POST_DETAIL_STALE_TIME,
  })
}

/**
 * [4.3] 게시글 상세.
 *
 * `postId` 는 URL 에서 온 값이라 `toPostId()` 로 거른 뒤 넘긴다. `null` 이면 요청하지 않는다
 * (숫자가 아닌 id 를 보내면 400 이 난다 — 화면은 "없는 글"로 보여준다).
 *
 * ```ts
 * const postId = toPostId(useParams().postId)
 * const detail = usePostDetail(postId)
 * ```
 *
 * 실패 code : `POST_NOT_FOUND`(404). 4xx 는 재시도하지 않는다(queryClient 기본값)
 */
export function usePostDetail(postId: number | null) {
  return useQuery({
    ...postDetailQueryOptions(postId ?? 0),
    enabled: postId !== null,
  })
}
