import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { Pagination } from './Pagination'

/*
 * 목록 페이지 번호 — 다섯 개씩 묶고, 전체 다섯 페이지 이상이면 이전 · 다음 묶음 화살표(본인 결정 2026-10-16).
 * 누르는 면 · 줄바꿈 · 넘침은 브라우저에서 잰다(round6/r8)
 */
function render(page: number, totalPages: number): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <Pagination page={page} totalPages={totalPages} hrefFor={(n) => `/?page=${n}`} groupSize={5} />
    </MemoryRouter>,
  )
}

/** 이름이 `label` 인 링크의 href */
const hrefOf = (html: string, label: string) =>
  [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]).find((a) => a.includes(`aria-label="${label}"`))?.match(/href="([^"]+)"/)?.[1]

const numbers = (html: string) => [...html.matchAll(/aria-label="(\d+)페이지"/g)].map((m) => Number(m[1]))

describe('Pagination(groupSize=5) — 목록 페이지 번호', () => {
  it('한 페이지뿐이면 그리지 않는다', () => {
    expect(render(1, 1)).toBe('')
  })

  it('1~4페이지면 번호만, 화살표 없음', () => {
    const html = render(2, 4)
    expect(numbers(html)).toEqual([1, 2, 3, 4])
    expect(html).not.toContain('페이지 묶음')
    expect(html).toMatch(/aria-label="2페이지" aria-current="page"/)
  })

  it('다섯 페이지면 화살표를 보이되 앞 · 뒤 묶음이 없어 둘 다 누를 수 없다', () => {
    const html = render(5, 5)
    expect(numbers(html)).toEqual([1, 2, 3, 4, 5])
    expect(html).toContain('이전 페이지 묶음 없음')
    expect(html).toContain('다음 페이지 묶음 없음')
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2)
  })

  it('첫 묶음 : ‹ 는 누를 수 없고 › 는 6페이지로', () => {
    const html = render(3, 12)
    expect(numbers(html)).toEqual([1, 2, 3, 4, 5])
    expect(html).toContain('이전 페이지 묶음 없음')
    expect(hrefOf(html, '다음 페이지 묶음, 6~10페이지')).toBe('/?page=6')
  })

  it('가운데 묶음 : 6~10, ‹ 는 5페이지로 · › 는 11페이지로', () => {
    const html = render(7, 12)
    expect(numbers(html)).toEqual([6, 7, 8, 9, 10])
    expect(hrefOf(html, '이전 페이지 묶음, 1~5페이지')).toBe('/?page=5')
    expect(hrefOf(html, '다음 페이지 묶음, 11~12페이지')).toBe('/?page=11')
  })

  it('마지막 묶음 : 남은 번호만, › 는 누를 수 없다', () => {
    const html = render(12, 12)
    expect(numbers(html)).toEqual([11, 12])
    expect(html).toContain('다음 페이지 묶음 없음')
  })
})
