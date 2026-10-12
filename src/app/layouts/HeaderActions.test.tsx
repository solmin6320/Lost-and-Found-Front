import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AuthContext, type AuthContextValue } from '@/features/auth/model/AuthContext'

import { HeaderActions } from './RootLayout'

/*
 * 헤더 오른쪽 묶음 — 로그인 · 가입 화면에서도 자리는 그대로다(본인 결정 2026-10-11, 화면정의서 1.10).
 * [글 올리기] · [로그인]을 숨기되 같은 글자 · 같은 자리로 남겨 [홈] · 설정이 목록과 같은 x 에 선다.
 * 실제 x 는 브라우저에서 잰다(화면정의서 1.10). 여기서는 그 바탕 — 칸의 수 · 순서 · 숨김 방식 · CSS 두 줄 — 이 다시 깨지지 않게 본다.
 *
 * vitest 는 CSS 를 비워서 들여오므로 노드 fs 로 원본을 읽는다(tokens.test.ts 와 같은 방법)
 */
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const readCss = (relative: string) =>
  fs
    .readFileSync(new URL(relative, import.meta.url), 'utf8')
    .split('\r\n')
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')

const noop = async () => {}

function render(path: string, status: 'unknown' | 'anonymous'): string {
  const auth = { status, me: null, login: noop, logout: noop, updatePassword: noop } as unknown as AuthContextValue
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth}>
        <HeaderActions />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

/** 묶음 안 칸을 순서대로 — 무엇이고(글 올리기 · 홈 · 설정 · 로그인) 숨긴 자리인지 */
function slots(markup: string): string[] {
  const order: Array<[number, string]> = []
  const find = (label: string, pattern: RegExp) => {
    const match = pattern.exec(markup)
    if (!match) return
    const away = /data-away=""/.test(match[0]) ? ' (자리만)' : ''
    order.push([match.index, label + away])
  }
  find('글 올리기', /<a[^>]*>(?:(?!<\/a>).)*글 올리기(?:(?!<\/a>).)*<\/a>/)
  find('홈', /<a[^>]*>(?:(?!<\/a>).)*<span>홈<\/span><\/a>/)
  find('설정', /<a[^>]*aria-label="설정"[^>]*>/)
  find('로그인', /<(?:a|span)[^>]*>로그인<\/(?:a|span)>/)
  return order.sort((a, b) => a[0] - b[0]).map(([, label]) => label)
}

describe('헤더 오른쪽 묶음 — 로그인 · 가입 화면에서도 자리 유지', () => {
  it('조건 없는 목록(비로그인) : 글 올리기 · 홈 · 설정 · 로그인 네 칸이 다 보인다', () => {
    expect(slots(render('/', 'anonymous'))).toEqual(['글 올리기', '홈', '설정', '로그인'])
  })

  it.each([
    ['/login', 'anonymous'],
    ['/signup', 'anonymous'],
    ['/login', 'unknown'],
    ['/signup?redirect=%2Fposts%2Fnew', 'unknown'],
  ] as const)('%s (%s) : 같은 네 칸 · 같은 순서, 글 올리기 · 로그인은 자리만', (path, status) => {
    expect(slots(render(path, status))).toEqual(['글 올리기 (자리만)', '홈', '설정', '로그인 (자리만)'])
  })

  it('자리만 남긴 칸은 누를 수도, Tab 으로 닿을 수도, 읽힐 수도 없다', () => {
    const markup = render('/login', 'anonymous')
    const away = [...markup.matchAll(/<(a|span)\b[^>]*data-away=""[^>]*>/g)].map((match) => match[0])
    expect(away).toHaveLength(2)
    for (const tag of away) expect(tag).toContain('aria-hidden="true"')
    // 링크 모양으로 남은 [글 올리기]는 inert + tabindex -1 — 목록과 같은 폭을 그대로 갖는다
    const create = away.find((tag) => tag.startsWith('<a'))
    expect(create).toContain('inert=""')
    expect(create).toContain('tabindex="-1"')
    // [로그인] 자리는 링크가 아니다(가는 곳이 없다)
    expect(markup).not.toMatch(/<a[^>]*>로그인<\/a>/)
  })

  it('CSS : 자리만 남긴 칸은 visibility: hidden(자리는 차지한다 — display: none 이 아니다)', () => {
    const css = readCss('./RootLayout.module.css')
    const rule = /\.actions \[data-away\]\s*\{([^}]*)\}/.exec(css)
    expect(rule?.[1]).toMatch(/visibility:\s*hidden;/)
    expect(rule?.[1]).not.toMatch(/display:\s*none/)
  })

  it('CSS : 헤더 폭 갈림은 그릇(.shell) 폭을 rem 으로 재는 컨테이너 질의다 — 글자를 키우면 같은 화면도 좁은 헤더가 된다', () => {
    const css = readCss('./RootLayout.module.css')
    expect(css).toMatch(/\.shell\s*\{[^}]*container:\s*shell\s*\/\s*inline-size;/)
    // 미디어 질의의 rem 은 루트 글자를 따르지 않는다(QA 3차 — 375 · 200%에서 헤더가 560px 로 넘쳤다)
    expect(css).not.toMatch(/@media\s*\(min-width/)
    expect(readCss('./AccountMenu.module.css')).not.toMatch(/@media\s*\(min-width/)
  })

  it('CSS : 더 좁으면 모든 화면이 같은 두 단계 — ① [홈] 글자 숨김 ② 고정을 풀고 오른쪽 묶음을 둘째 줄로', () => {
    const css = readCss('./RootLayout.module.css')
    const first = /@container shell \(width < 19rem\)\s*\{([\s\S]*?)\n\}/.exec(css)
    expect(first?.[1]).toMatch(/\.home span\s*\{[^}]*clip-path:\s*inset\(50%\)/)
    const second = /@container shell \(width < 18\.5rem\)\s*\{([\s\S]*?)\n\}/.exec(css)
    expect(second?.[1]).toMatch(/\.header\s*\{[^}]*position:\s*static;/)
    expect(second?.[1]).toMatch(/\.headerInner\s*\{[^}]*flex-wrap:\s*wrap;/)
    // 빈자리는 폭을 남긴다(높이만 접는다) — 목록과 같은 자리에서 줄이 바뀌어 [홈] · 설정의 x 가 같다
    expect(second?.[1]).toMatch(/\.actions \[data-away\]\s*\{[^}]*height:\s*0;/)
    expect(second?.[1]).not.toMatch(/display:\s*none/)
  })

  it('CSS : 스크롤바 자리를 늘 비워 둔다 — 로그인(짧음) ↔ 가입(김)에서 헤더가 밀리지 않게', () => {
    const css = readCss('../../shared/styles/reset.css')
    const html = /(?:^|\n)html\s*\{([^}]*)\}/.exec(css)
    expect(html?.[1]).toMatch(/scrollbar-gutter:\s*stable;/)
  })
})
