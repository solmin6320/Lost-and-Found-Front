import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Button } from './Button'
import { LoadingDots } from './LoadingDots'

/*
 * 기다리는 동안의 점 셋(본인 피드백 2026-10-14). 0.3초 뒤에 나타나는 것 · 움직임은 브라우저에서 잰다(round6).
 * 여기서는 첫 그림(0.3초 전)과 바로 보이는 경우(delay 0)의 구조 · 읽기를 본다
 *
 * vitest 는 CSS 를 비워서 들여오므로 노드 fs 로 원본을 읽는다(tokens.test.ts 와 같은 방법)
 */
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const css = fs
  .readFileSync(new URL('./LoadingDots.module.css', import.meta.url), 'utf8')
  .split('\r\n')
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

describe('LoadingDots', () => {
  it('0.3초 전(첫 그림)에는 점이 없다 — 알림 영역만 비어 있는 채로 둔다', () => {
    const html = renderToStaticMarkup(<LoadingDots />)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain('data-loading-dots')
  })

  it('보이면 점 셋(읽기에서 숨김) + 읽는 말', () => {
    const html = renderToStaticMarkup(<LoadingDots delay={0} label="찾는 중" />)
    expect(html.match(/<span class="[^"]*dot[^"]*"><\/span>/g)).toHaveLength(3)
    expect(html).toMatch(/aria-hidden="true" data-loading-dots=""/)
    expect(html).toContain('<span class="sr-only">찾는 중</span>')
  })

  it('기다리지 않으면 아무것도 그리지 않는다', () => {
    expect(renderToStaticMarkup(<LoadingDots active={false} delay={0} />)).not.toContain('data-loading-dots')
  })

  it('announce={false} 면 알림 영역이 아니다(둘러싼 쪽이 이름으로 알린다)', () => {
    expect(renderToStaticMarkup(<LoadingDots announce={false} delay={0} />)).not.toContain('role="status"')
  })

  it('CSS : 움직임은 투명도뿐이고, 모션 줄이기면 애니메이션을 끈다', () => {
    const keyframes = /@keyframes dot-pulse\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    expect(keyframes).toContain('opacity')
    expect(keyframes).not.toMatch(/transform|scale|translate/)
    const reduce = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    expect(reduce).toMatch(/animation:\s*none/)
  })

  it('reserve : 기다리지 않을 때도 점 자리를 그려 두되 보이지 않는다(보이는 점 표지는 없다)', () => {
    const html = renderToStaticMarkup(<LoadingDots active={false} reserve variant="inline" announce={false} />)
    expect(html).toContain('data-idle')
    expect(html).not.toContain('data-loading-dots')
    expect(css).toMatch(/\.dots\[data-idle\]\s*\{[^}]*visibility:\s*hidden/)
  })

  it('reserve : 보일 때는 자리 표지 없이 보이는 점', () => {
    const html = renderToStaticMarkup(<LoadingDots reserve delay={0} variant="inline" announce={false} />)
    expect(html).toContain('data-loading-dots')
    expect(html).not.toContain('data-idle')
  })
})

describe('Button pending — 버튼 글자 자리의 점 셋', () => {
  it('요청 중이면 누름을 막고(aria-disabled · aria-busy) 이름은 pendingLabel', () => {
    const html = renderToStaticMarkup(
      <Button type="submit" pending pendingLabel="가입하는 중">
        가입하기
      </Button>,
    )
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('<span class="sr-only">가입하는 중</span>')
    // 원래 글자는 자리만 남긴다(버튼 폭 유지) — 읽기에서는 숨긴다
    expect(html).toMatch(/aria-hidden="true">가입하기<\/span>/)
  })

  it('요청 중이 아니면 글자 그대로', () => {
    const html = renderToStaticMarkup(<Button>가입하기</Button>)
    expect(html).toContain('>가입하기</button>')
    expect(html).not.toContain('aria-busy')
  })
})
