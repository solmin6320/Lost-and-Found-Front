import { useCallback, useMemo } from 'react'
import { useSearchParams, type To } from 'react-router-dom'

import { parsePageParam, useCanonicalPageParam } from '@/shared/lib/pageParam'

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

/**
 * 한 쪽의 글 수 · 번호 묶음 — 목록과 같다(20건, 다섯 개씩 · 6페이지부터 ‹ ›, 본인 결정 2026-10-17, QA-D-20).
 * 예전 24건은 2 · 3 · 4열이 딱 떨어지는 수였지만, 목록과 페이지 모양이 달라 같은 서비스 안에서 번호가 다르게 읽혔다
 */
export const MY_POSTS_PAGE_SIZE = 20
export const MY_POSTS_PAGE_GROUP = 5

/**
 * 카드 자리표시 수 — 이번 방문에 받은 그 탭의 건수(`known`)가 있으면 그 쪽에 남은 글 수(20장까지), 없으면 한 쪽(20장)(본인 결정 2026-10-18).
 * 글이 3건인 탭에 20장을 그렸다가 3장으로 줄면 문서가 한 번 크게 줄었다. 그 쪽에 글이 없을 것 같아도(0건 · 끝을 넘은 쪽) 한 장은 둔다 — 기다리는 표시가 사라지지 않게
 */
export function myPostsSkeletonCount(known: number | undefined, page: number): number {
  if (known === undefined) return MY_POSTS_PAGE_SIZE
  const remaining = known - (page - 1) * MY_POSTS_PAGE_SIZE
  return Math.min(MY_POSTS_PAGE_SIZE, Math.max(remaining, 1))
}

export function parseMyPostsSearch(params: URLSearchParams): MyPostsSearch {
  const status = params.get('status')
  return {
    status: isPostStatus(status) ? status : undefined,
    page: parsePageParam(params.get('page')),
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
  // ?page=0 · abc · 1 처럼 고쳐 읽은 값이 주소와 다르면 주소를 바꿔 쓴다(QA-P-21, 목록과 같다)
  useCanonicalPageParam(search.page)

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
