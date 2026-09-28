import { useCallback, useMemo } from 'react'
import { useSearchParams, type To } from 'react-router-dom'

import { isPostStatus, type MyPostsParams, type PostStatus } from '../api/types'

/*
 * 내가 쓴 글(SCR-07)의 조건 — 상태 탭과 쪽. 주소(`/me?status=IN_PROGRESS&page=2`)에 싣는다.
 * 뒤로가기 한 번이 직전 탭으로 돌아가고, 새로고침해도 같은 탭이 열린다.
 * 목록(`postListSearch`)과 같은 규칙 : `page` 는 **1부터** 센다(주소의 2쪽 = 화면의 2쪽). 서버로 보낼 때 1을 뺀다.
 */

export interface MyPostsSearch {
  /** 없으면 전체 */
  status?: PostStatus
  page: number
}

/** 한 쪽의 글 수. 목록과 같다 — 2 · 3 · 4열 어디서든 줄이 빈 채 끝나지 않는다 */
export const MY_POSTS_PAGE_SIZE = 24

export function parseMyPostsSearch(params: URLSearchParams): MyPostsSearch {
  const status = params.get('status')
  const page = Number(params.get('page'))
  return {
    status: isPostStatus(status) ? status : undefined,
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  }
}

/** 기본값(전체 · 1쪽)은 주소에 쓰지 않는다 — `/me` 와 `/me?page=1` 이 서로 다른 기록이 되지 않게 */
export function myPostsSearchParams(search: MyPostsSearch): URLSearchParams {
  const params = new URLSearchParams()
  if (search.status) params.set('status', search.status)
  if (search.page > 1) params.set('page', String(search.page))
  return params
}

/** 조건 → 서버 요청. 여기서만 page 를 0부터로 바꾼다 */
export function toMyPostsParams(search: MyPostsSearch): MyPostsParams {
  return { status: search.status, page: search.page - 1, size: MY_POSTS_PAGE_SIZE }
}

/**
 * 주소와 맞물린 조건. 탭 · 쪽 이동은 링크라서 새 탭 열기 · 주소 복사가 된다.
 * `hrefWith` 는 `page` 를 주지 않으면 1쪽이다 — 탭을 바꾸면 결과가 달라진다
 */
export function useMyPostsSearch() {
  const [searchParams] = useSearchParams()
  const search = useMemo(() => parseMyPostsSearch(searchParams), [searchParams])

  const hrefWith = useCallback(
    (patch: Partial<MyPostsSearch>): To => {
      const query = myPostsSearchParams({ ...search, page: 1, ...patch }).toString()
      return { search: query ? `?${query}` : '' }
    },
    [search],
  )

  const hrefForPage = useCallback((page: number): To => hrefWith({ page }), [hrefWith])

  /** 탭 이동 주소. `undefined` 면 전체 */
  const hrefForStatus = useCallback(
    (status: PostStatus | undefined): To => hrefWith({ status, page: 1 }),
    [hrefWith],
  )

  return { search, hrefWith, hrefForPage, hrefForStatus }
}
