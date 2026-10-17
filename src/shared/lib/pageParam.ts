import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * 주소의 `page` 를 읽는다(1부터). **숫자만으로 된 값**(`/^\d+$/`)만 인정하고 나머지는 1페이지(QA-P-28, 2026-10-18).
 * 예전엔 `Number()` 로 읽어 `1e1` → 10 · `0x10` → 16 · ` 3` · `+3` → 3 이 됐다 — 사람이 쓴 적 없는 번호로 데려갔다.
 * `03` 은 3(앞자리 0 은 숫자다 — 주소는 `3` 으로 고쳐 쓴다). 같은 이름이 여럿이면 부른 쪽이 첫 값을 준다(`params.get`)
 */
export function parsePageParam(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 1
  const page = Number(raw)
  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}

/**
 * 주소의 `page` 를 고쳐 읽은 값과 맞춘다(QA-P-21, 2026-10-17).
 *
 * `?page=0` · `-1` · `abc` · `2.5` 는 1페이지로 읽는데 주소는 그대로 남아, 그 주소를 복사해 보내면 받는 사람도 엉뚱한 값을 본다.
 * `?page=1` 은 `/` 와 같은 화면인데 기록 · 주소가 달라진다(1은 주소에 쓰지 않는 규칙). 다르면 **바꿔 쓴다**(`replace` — 기록을 늘리지 않는다).
 * 다른 값(검색어 · 필터 · 알 수 없는 값)은 손대지 않는다. 끝을 넘은 번호(`?page=99`)는 그대로 둔다 — 화면이 "이 페이지에는 글이 없어요"로 말한다.
 *
 * `page` 가 여럿(`?page=3&page=4`)이면 첫 값으로 읽고 주소도 그 하나로 정리한다(QA-P-28).
 *
 * 돌려주는 값이 `null` 이면 그대로 둔다, 문자열이면 그 값으로, `''` 이면 `page` 를 지운다. 순수 판정 — 시험용으로 꺼내 둔다
 */
export function canonicalPageParam(raw: string | null, page: number, duplicated = false): string | null {
  // 1페이지는 주소에 쓰지 않는다 — 값이 무엇이든(`?page=` 빈 값까지) 있으면 지운다
  if (page <= 1) return raw === null ? null : ''
  const want = String(page)
  return raw === want && !duplicated ? null : want
}

/** 목록 · 내가 쓴 글이 쓴다. `page` 는 그 화면이 고쳐 읽은 값(1부터) */
export function useCanonicalPageParam(page: number): void {
  const [params, setParams] = useSearchParams()
  const raw = params.get('page')
  const duplicated = params.getAll('page').length > 1
  useEffect(() => {
    const next = canonicalPageParam(raw, page, duplicated)
    if (next === null) return
    setParams(
      (current) => {
        const fixed = new URLSearchParams(current)
        if (next === '') fixed.delete('page')
        else fixed.set('page', next)
        return fixed
      },
      { replace: true, preventScrollReset: true },
    )
  }, [raw, page, duplicated, setParams])
}

/**
 * 글이 0건으로 확정됐는데 주소에 `page` 가 남아 있으면 지운다(`replace`, QA-P-28). 0건이면 페이지가 하나도 없어
 * `[n페이지로]`(끝을 넘은 페이지에서 마지막 페이지로)가 갈 곳이 없다 — 화면은 1페이지의 빈 상태와 같으니 주소도 같게 둔다.
 * `total` 은 확정된 건수(다시 받는 중의 직전 값이 아닌 것). 모르면 `undefined`
 */
export function useDropPageWhenEmpty(total: number | undefined): void {
  const [params, setParams] = useSearchParams()
  const hasPage = params.has('page')
  useEffect(() => {
    if (total !== 0 || !hasPage) return
    setParams(
      (current) => {
        const fixed = new URLSearchParams(current)
        fixed.delete('page')
        return fixed
      },
      { replace: true, preventScrollReset: true },
    )
  }, [total, hasPage, setParams])
}
