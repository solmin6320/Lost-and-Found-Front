import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

function render(path: string, status: 'unknown' | 'anonymous' | 'authenticated'): string {
  const me = status === 'authenticated' ? { id: 1, email: 'a@b.c', nickname: '민수', createdAt: '2026-09-01T10:00:00' } : null
  const auth = { status, me, login: noop, logout: noop, updatePassword: noop } as unknown as AuthContextValue
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AuthContext.Provider value={auth}>
          <HeaderActions />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
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
  find('알림', /<button[^>]*aria-haspopup="dialog"[^>]*>/)
  find('계정', /<button[^>]*aria-label="[^"]*계정 메뉴"[^>]*>/)
  return order.sort((a, b) => a[0] - b[0]).map(([, label]) => label)
}

describe('헤더 오른쪽 묶음 — 로그인 · 가입 화면에서도 자리 유지', () => {
  it('조건 없는 목록(비로그인) : 글 올리기 · 홈 · 설정 · 로그인 네 칸이 다 보인다', () => {
    expect(slots(render('/', 'anonymous'))).toEqual(['글 올리기', '홈', '설정', '로그인'])
  })

  it('로그인 : 글 올리기 · 홈 · 알림(종) · 계정 — 종은 [홈] 뒤 · 계정 앞(SCR-10), 설정 톱니 · [로그인] 없음', () => {
    const markup = render('/', 'authenticated')
    expect(slots(markup)).toEqual(['글 올리기', '홈', '알림', '계정'])
    // 수가 오기 전에는 배지를 그리지 않고 이름은 "알림"
    expect(markup).toMatch(/<button[^>]*aria-label="알림"[^>]*aria-haspopup="dialog"/)
  })

  it('비로그인 · 세션 복구 중에는 종이 없다', () => {
    expect(render('/', 'anonymous')).not.toMatch(/aria-haspopup="dialog"/)
    expect(render('/', 'unknown')).not.toMatch(/aria-haspopup="dialog"/)
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
    // 화면 폭 미디어 질의만으로 헤더를 넓히지 않는다(QA 3차 — 루트 글자를 키운 375 · 200%에서 헤더가 560px 로 넘쳤다).
    // 화면 폭 질의는 그릇 질의를 감쌀 때만 쓴다(아래 넓은 헤더)
    const media = [...css.matchAll(/@media[^{]*\(min-width[^{]*\{\s*(\S+)/g)].map((m) => m[1])
    expect(media.length).toBeGreaterThan(0)
    expect(media.every((first) => first === '@container')).toBe(true)
    expect(readCss('./AccountMenu.module.css')).not.toMatch(/@media\s*\(min-width/)
  })

  it('CSS : 넓은 헤더는 화면 48rem 그리고 그릇 47rem — 스크롤바가 겹쳐 뜨는 752 ~ 767 창에서 본문과 엇갈리지 않게(QA-D-22)', () => {
    const css = readCss('./RootLayout.module.css')
    expect(css).toMatch(/@media \(min-width: 48rem\) \{\s*@container shell \(width >= 47rem\) \{\s*\.actions \.create \{/)
    expect(css).toMatch(/@media \(hover: hover\) and \(min-width: 48rem\) \{\s*@container shell \(width >= 47rem\)/)
    // 넓은 헤더 규칙이 화면 폭 조건 없이 따로 서 있지 않다
    expect(css).not.toMatch(/(?:^|\n)@container shell \(width >= 47rem\)/)
  })

  it('CSS : 더 좁으면 모든 화면이 같은 한 단계 — 고정을 풀고 로고 줄 오른쪽부터 채운 뒤 남는 버튼만 다음 줄로(두 줄)', () => {
    const css = readCss('./RootLayout.module.css')
    // [홈] 글자는 어느 폭에서도 숨기지 않는다(QA-D-25 — 두 줄 배치에서는 글자를 남겨도 헤더 높이가 늘지 않았다)
    expect(css).not.toMatch(/\.home span\s*\{[^}]*clip-path/)
    const narrow = /@container shell \(width < 18\.5rem\)\s*\{([\s\S]*?)\n\}/.exec(css)
    expect(narrow?.[1]).toMatch(/\.header\s*\{[^}]*position:\s*static;/)
    expect(narrow?.[1]).toMatch(/\.headerInner\s*\{[^}]*flex-wrap:\s*wrap;[^}]*justify-content:\s*flex-end;/)
    // 오른쪽 묶음을 풀어 버튼이 로고와 같은 줄에서 흐른다 — 묶음째 둘째 줄로 보내면 로고 혼자 한 줄이 된다(QA-D-23)
    expect(narrow?.[1]).toMatch(/\.actions\s*\{[^}]*display:\s*contents;/)
    expect(narrow?.[1]).toMatch(/\.wordmark\s*\{[^}]*margin-right:\s*auto;/)
    // 빈자리는 폭을 남긴다(높이만 접는다) — 목록과 같은 자리에서 줄이 바뀌어 [홈] · 설정의 x 가 같다
    expect(narrow?.[1]).toMatch(/\.actions \[data-away\]\s*\{[^}]*height:\s*0;/)
    expect(narrow?.[1]).not.toMatch(/display:\s*none/)
  })

  it('CSS : 스크롤바 자리를 늘 비워 둔다 — 로그인(짧음) ↔ 가입(김)에서 헤더가 밀리지 않게', () => {
    const css = readCss('../../shared/styles/reset.css')
    const html = /(?:^|\n)html\s*\{([^}]*)\}/.exec(css)
    expect(html?.[1]).toMatch(/scrollbar-gutter:\s*stable;/)
    // 짧은 화면에도 빈 스크롤바를 세운다 — 헤더 아래 선이 빈 띠 앞에서 끊기지 않고 긴 화면처럼 막대 앞에서 끝난다(QA D-17)
    expect(html?.[1]).toMatch(/overflow-y:\s*scroll;/)
  })
})
