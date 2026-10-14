import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AuthLayout, AuthReturnNote } from './AuthLayout'

/*
 * 로그인 · 가입 틀 — 돌아갈 곳 줄이 있으면 넓은 화면 위 여백을 24px 로 줄인다(QA D-20, 2026-10-12).
 * 두 화면이 같은 조건(돌아갈 곳이 있다)을 쓰니 머리 y 가 같다. 실제 y · [가입하기] 아래 끝은 브라우저에서 잰다(화면정의서 SCR-05)
 *
 * vitest 는 CSS 를 비워서 들여오므로 노드 fs 로 원본을 읽는다(tokens.test.ts 와 같은 방법)
 */
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const css = fs
  .readFileSync(new URL('./AuthLayout.module.css', import.meta.url), 'utf8')
  .split('\r\n')
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

function render(withReturn: boolean): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <AuthLayout
        mark={null}
        title="회원가입"
        lead="분실물 찾기 계정으로 …"
        returnNote={withReturn ? <AuthReturnNote lead="끝나면" label="분실 글 올리기" concept="LOST" /> : null}
        footer={null}
      >
        <form />
      </AuthLayout>
    </MemoryRouter>,
  )
}

describe('AuthLayout — 돌아갈 곳 줄과 위 여백', () => {
  it('돌아갈 곳 줄이 있을 때만 틀에 data-return 이 붙는다', () => {
    expect(render(true)).toMatch(/<div class="[^"]*" data-return="">/)
    expect(render(false)).not.toContain('data-return')
  })

  it('CSS : 넓은 화면에서 data-return 이면 위 여백 24px(--space-6)', () => {
    const wide = /@media \(min-width: 48rem\)\s*\{([\s\S]*?)\n\}/.exec(css)
    expect(wide?.[1]).toMatch(/\.page\[data-return\]\s*\{\s*padding-top:\s*var\(--space-6\);\s*\}/)
  })
})
