import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { PostType } from '../api/types'
import { PostIntentPicker } from './PostIntentPicker'

/*
 * 고른 의도 칸 — 칸 면은 처음 목록(`/`), [×]는 분실 · 습득 선택만 푼다(본인 결정 2026-10-14, QA-P-6).
 * 칸 바깥 누름 · 터치 끌어당김 · 맨 위로 · 검색칸 비우기 · 뒤로가기는 브라우저에서 잰다(round6 qa6p)
 */
function render(selected: PostType | undefined, showCounts = false): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PostIntentPicker
          selected={selected}
          hrefFor={(type) => ({ search: type ? `?type=${type}&keyword=x` : '?keyword=x' })}
          resetTo="/"
          showCounts={showCounts}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const anchors = (html: string) => [...html.matchAll(/<a [^>]*>/g)].map((match) => match[0])

describe('PostIntentPicker — 고른 칸은 처음 목록, [×]는 선택만', () => {
  it('아무것도 고르지 않았으면 두 칸 모두 그 종류로 간다(검색어 · 필터는 연 쪽이 그대로 싣는다)', () => {
    const links = anchors(render(undefined))
    expect(links).toHaveLength(2)
    expect(links[0]).toContain('href="/?type=LOST&amp;keyword=x"')
    expect(links[1]).toContain('href="/?type=FOUND&amp;keyword=x"')
    expect(links.join('')).not.toContain('aria-current')
  })

  it('고른 칸 면은 `/` 로 가고, 검색어 · 조건이 걸려 있으면 둘째 줄과 설명이 그것도 풀린다고 말한다', () => {
    const html = render('LOST')
    const card = anchors(html).find((link) => link.includes('aria-current="true"')) ?? ''
    expect(card).toContain('href="/"')
    expect(html).toContain('누르면 처음 목록으로')
    const describedBy = /aria-describedby="([^"]+)"/.exec(card)?.[1]
    expect(html).toContain(`id="${describedBy}" hidden="">누르면 선택을 풀고 처음 목록으로 돌아가요. 검색어와 조건도 풀려요.`)
  })

  it('검색어 · 조건이 없으면 둘째 줄은 원래 말(건수), 설명에 "검색어와 조건"이 없다', () => {
    const html = render('LOST', true)
    expect(html).not.toContain('누르면 처음 목록으로')
    expect(html).not.toContain('검색어와 조건도 풀려요')
  })

  it('[×]는 분실 · 습득 선택만 푼다 — 검색어는 그대로', () => {
    const reset = anchors(render('FOUND')).find((link) => link.includes('aria-label="선택 풀고 분실 글과 습득 글 모두 보기"')) ?? ''
    expect(reset).toContain('href="/?keyword=x"')
  })

  it('고르지 않은 쪽은 그대로 갈아타는 링크', () => {
    const other = anchors(render('LOST')).find((link) => link.includes('type=FOUND'))
    expect(other).toBeDefined()
  })
})
