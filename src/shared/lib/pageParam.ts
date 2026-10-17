import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * 주소의 `page` 를 고쳐 읽은 값과 맞춘다(QA-P-21, 2026-10-17).
 *
 * `?page=0` · `-1` · `abc` · `2.5` 는 1페이지로 읽는데 주소는 그대로 남아, 그 주소를 복사해 보내면 받는 사람도 엉뚱한 값을 본다.
 * `?page=1` 은 `/` 와 같은 화면인데 기록 · 주소가 달라진다(1은 주소에 쓰지 않는 규칙). 다르면 **바꿔 쓴다**(`replace` — 기록을 늘리지 않는다).
 * 다른 값(검색어 · 필터 · 알 수 없는 값)은 손대지 않는다. 끝을 넘은 번호(`?page=99`)는 그대로 둔다 — 화면이 "이 페이지에는 글이 없어요"로 말한다.
 *
 * 돌려주는 값이 `null` 이면 그대로 둔다, 문자열이면 그 값으로, `''` 이면 `page` 를 지운다. 순수 판정 — 시험용으로 꺼내 둔다
 */
export function canonicalPageParam(raw: string | null, page: number): string | null {
  // 1페이지는 주소에 쓰지 않는다 — 값이 무엇이든(`?page=` 빈 값까지) 있으면 지운다
  if (page <= 1) return raw === null ? null : ''
  const want = String(page)
  return raw === want ? null : want
}

/** 목록 · 내가 쓴 글이 쓴다. `page` 는 그 화면이 고쳐 읽은 값(1부터) */
export function useCanonicalPageParam(page: number): void {
  const [params, setParams] = useSearchParams()
  const raw = params.get('page')
  useEffect(() => {
    const next = canonicalPageParam(raw, page)
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
  }, [raw, page, setParams])
}
