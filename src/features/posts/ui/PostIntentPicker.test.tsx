import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { PostType } from '../api/types'
import { PostIntentPicker } from './PostIntentPicker'

/*
 * 고른 의도 칸 — 칸 면과 [×] 둘 다 처음 목록(`/`)으로 간다(본인 피드백 2026-10-14).
 * 칸 바깥 누름이 아무것도 하지 않는 것 · 맨 위로 · 검색칸 비우기는 브라우저에서 잰다(round6 item6)
 */
function render(selected: PostType | undefined): string {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PostIntentPicker
          selected={selected}
          hrefFor={(type) => ({ search: `?type=${type}&keyword=x` })}
          resetTo="/"
          showCounts={false}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const anchors = (html: string) => [...html.matchAll(/<a [^>]*>/g)].map((match) => match[0])

describe('PostIntentPicker — 고른 칸은 처음 목록으로', () => {
  it('아무것도 고르지 않았으면 두 칸 모두 그 종류로 간다(검색어 · 필터는 연 쪽이 그대로 싣는다)', () => {
    const links = anchors(render(undefined))
    expect(links).toHaveLength(2)
    expect(links[0]).toContain('href="/?type=LOST&amp;keyword=x"')
    expect(links[1]).toContain('href="/?type=FOUND&amp;keyword=x"')
    expect(links.join('')).not.toContain('aria-current')
  })

  it('고른 칸 면은 `/` 로 가고, 현재임과 누르면 무엇이 되는지를 알린다', () => {
    const html = render('LOST')
    const card = anchors(html).find((link) => link.includes('aria-current="true"')) ?? ''
    expect(card).toContain('href="/"')
    const describedBy = /aria-describedby="([^"]+)"/.exec(card)?.[1]
    expect(describedBy).toBeTruthy()
    expect(html).toContain(`id="${describedBy}" hidden="">누르면 선택을 풀고 처음 목록으로 돌아가요`)
  })

  it('[×]도 `/` 로 간다(이름 : 선택 풀고 처음 목록 보기)', () => {
    const reset = anchors(render('FOUND')).find((link) => link.includes('aria-label="선택 풀고 처음 목록 보기"')) ?? ''
    expect(reset).toContain('href="/"')
  })

  it('고르지 않은 쪽은 그대로 갈아타는 링크', () => {
    const other = anchors(render('LOST')).find((link) => link.includes('type=FOUND'))
    expect(other).toBeDefined()
  })
})
