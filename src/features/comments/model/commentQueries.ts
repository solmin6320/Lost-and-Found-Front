import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'

import { postKeys, type PostDetailResponse } from '@/features/posts'

import { getComments } from '../api/commentApi'
import type { CommentResponse } from '../api/types'
import { firstPageFromDetail, nextCommentPage, type CommentPages } from './commentCache'

/**
 * 댓글 쿼리 키. 게시글 상세 키 **아래**에 둔다.
 * 글을 지우거나(`removeQueries(postKeys.detail(id))`) 닉네임을 바꿔 게시글 캐시를 무효화하면
 * 댓글도 따라 정리된다. posts 가 comments 를 import 하지 않아도 된다.
 */
export const commentKeys = {
  post: (postId: number) => [...postKeys.detail(postId), 'comments'] as const,
}

/** 화면에 그릴 댓글 목록. 페이지를 이어 붙이고 id 가 겹치면 하나만 남긴다 */
export interface CommentThread {
  comments: CommentResponse[]
  /** 전체 댓글 수. 받아 둔 개수가 아니다 */
  totalCount: number
}

function toThread(data: CommentPages): CommentThread {
  const seen = new Set<number>()
  const comments: CommentResponse[] = []
  for (const page of data.pages) {
    for (const comment of page.content) {
      if (seen.has(comment.id)) continue
      seen.add(comment.id)
      comments.push(comment)
    }
  }
  return { comments, totalCount: data.pages.at(-1)?.page.totalElements ?? comments.length }
}

/**
 * [5.1] 게시글의 댓글 목록 + "더 보기".
 *
 * `useInfiniteQuery` 의 0 페이지를 **상세 응답의 첫 20건으로 채운다**(`initialData`). 그래서
 * - 화면에 처음 들어올 때 댓글 요청이 따로 나가지 않는다
 * - `fetchNextPage()` 가 부르는 첫 페이지가 `page=1` 이다. 상세의 20건과 겹치지 않는다
 * - 페이지 경계를 쿼리가 들고 있어서, 다시 받을 때(삭제 뒤) 받아 둔 페이지 전체를 같은 경계로 다시 받는다.
 *   이때 0 페이지는 댓글 API 로 받는다 — 상세(조회수 집계)를 다시 부르지 않는다
 *
 * 상세가 아직 없으면 멈춰 있다. 상세가 오면 그 20건으로 바로 채워진다.
 *
 * ```ts
 * const detail = usePostDetail(postId)
 * const thread = usePostComments(postId, detail.data)
 * thread.data?.comments          // 그릴 댓글
 * thread.data?.totalCount        // "댓글 23"
 * thread.hasNextPage             // "더 보기" 버튼
 * thread.fetchNextPage()         // page=1, 2, …
 * thread.isFetchingNextPage      // 버튼 로딩
 * ```
 *
 * 실패 code : `POST_NOT_FOUND`(404). "더 보기" 실패는 `isFetchNextPageError` 로 받아 버튼 옆에 보여준다
 */
export function usePostComments(postId: number, detail: PostDetailResponse | undefined) {
  const queryClient = useQueryClient()
  const seed = detail?.id === postId ? detail : undefined

  return useInfiniteQuery({
    queryKey: commentKeys.post(postId),
    queryFn: ({ pageParam, signal }) => getComments(postId, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: nextCommentPage,
    initialData: seed ? { pages: [firstPageFromDetail(seed)], pageParams: [0] } : undefined,
    // 0 페이지의 신선도는 그것을 받아 온 상세 요청의 시각이다
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(postKeys.detail(postId))?.dataUpdatedAt,
    enabled: seed !== undefined,
    select: toThread,
  })
}
