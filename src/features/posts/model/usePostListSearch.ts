import { useCallback, useMemo } from 'react'
import { useSearchParams, type To } from 'react-router-dom'

import {
  conditionNavigation,
  expandNavigation,
  parsePostListSearch,
  toSearchParams,
  type PostListNavigation,
  type PostListSearch,
} from './postListSearch'

/**
 * 목록 검색 조건을 URL 과 맞물린다.
 *
 * - **조건을 바꾸면 기록을 쌓는다**(`apply`). 필터를 잘못 걸었을 때 뒤로가기 한 번이 직전 조건으로 돌아가는 가장 빠른 길이다
 * - **[더 보기]는 바꿔 쓴다**(`expand`). 펼칠 때마다 기록이 쌓이면 뒤로가기가 "덜 펼친 목록"을 하나씩 되감는다.
 *   경로가 그대로라 스크롤 기억(ScrollMemory) · 화면 포커스(RouteFocus)도 건드리지 않는다
 */
export function usePostListSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useMemo(() => parsePostListSearch(searchParams), [searchParams])

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

  /** 조건을 바꾼다. 첫 묶음으로 돌아가고 기록을 쌓는다 */
  const apply = useCallback((next: PostListSearch) => go(conditionNavigation(next)), [go])

  /** 일부만 바꾼다 */
  const update = useCallback((patch: Partial<PostListSearch>) => apply({ ...search, ...patch }), [apply, search])

  /** [더 보기] — 묶음 하나를 더 펼친다. 기록을 쌓지 않는다 */
  const expand = useCallback(() => go(expandNavigation(search)), [go, search])

  /**
   * 일부만 바꾼 조건의 주소. 첫 묶음이다.
   * 이동을 링크로 두면 새 탭 열기 · 주소 복사가 된다(의도 선택)
   */
  const hrefWith = useCallback(
    (patch: Partial<PostListSearch>): To => {
      const query = toSearchParams(conditionNavigation({ ...search, ...patch }).search).toString()
      return { search: query ? `?${query}` : '' }
    },
    [search],
  )

  return { search, apply, update, expand, hrefWith }
}
