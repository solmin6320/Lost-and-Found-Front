import { useCallback, useMemo } from 'react'
import { useSearchParams, type To } from 'react-router-dom'

import { useCanonicalPageParam } from '@/shared/lib/pageParam'

import {
  conditionNavigation,
  pageNavigation,
  parsePostListSearch,
  toSearchParams,
  type PostListNavigation,
  type PostListSearch,
} from './postListSearch'

/**
 * 목록 검색 조건을 URL 과 맞물린다.
 *
 * - **조건을 바꾸면 기록을 쌓는다**(`apply`). 필터를 잘못 걸었을 때 뒤로가기 한 번이 직전 조건으로 돌아가는 가장 빠른 길이다
 * - **페이지를 넘겨도 기록을 쌓는다**(`hrefForPage` — 링크). 뒤로가기가 보던 페이지로 돌아온다(본인 요청 2026-10-16).
 *   경로가 그대로라 화면 포커스(RouteFocus)는 건드리지 않고, 목록이 결과 제목으로 데려간다
 */
export function usePostListSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useMemo(() => parsePostListSearch(searchParams), [searchParams])
  // ?page=0 · abc · 1 처럼 고쳐 읽은 값이 주소와 다르면 주소를 바꿔 쓴다(QA-P-21)
  useCanonicalPageParam(search.page)

  const go = useCallback(
    ({ search: next, replace }: PostListNavigation) => {
      const nextParams = toSearchParams(next)
      // 같은 주소로 다시 이동하면 뒤로가기에 같은 화면이 두 번 쌓인다
      if (nextParams.toString() !== searchParams.toString()) {
        setSearchParams(nextParams, { replace })
      }
    },
    [searchParams, setSearchParams],
  )

  /** 조건을 바꾼다. 1페이지로 돌아가고 기록을 쌓는다 */
  const apply = useCallback((next: PostListSearch) => go(conditionNavigation(next)), [go])

  /** 일부만 바꾼다 */
  const update = useCallback((patch: Partial<PostListSearch>) => apply({ ...search, ...patch }), [apply, search])

  /** 페이지 번호 → 주소(조건은 그대로). 링크라 새 탭 열기 · 주소 복사가 된다 */
  const hrefForPage = useCallback(
    (page: number): To => {
      const query = toSearchParams(pageNavigation(search, page).search).toString()
      return { search: query ? `?${query}` : '' }
    },
    [search],
  )

  /**
   * 일부만 바꾼 조건의 주소. 1페이지다.
   * 이동을 링크로 두면 새 탭 열기 · 주소 복사가 된다(의도 선택)
   */
  const hrefWith = useCallback(
    (patch: Partial<PostListSearch>): To => {
      const query = toSearchParams(conditionNavigation({ ...search, ...patch }).search).toString()
      return { search: query ? `?${query}` : '' }
    },
    [search],
  )

  return { search, apply, update, hrefForPage, hrefWith }
}
