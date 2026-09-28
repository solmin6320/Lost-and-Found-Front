import { paths } from './paths'

/**
 * 로그인 · 가입 뒤 돌아갈 곳(`?redirect=`). 화면정의서 1.5 · 보안명세서 2장.
 *
 * 쿼리스트링은 누구나 만들 수 있다. `/login?redirect=https://피싱사이트` 링크를 받은 사람이
 * 우리 로그인 화면에서 로그인한 뒤 남의 사이트로 넘어가면 안 된다(열린 리다이렉트).
 * 그래서 **우리 앱 안의 경로만** 따르고, 나머지는 전부 목록(`/`)으로 보낸다.
 *
 *   따른다   `/posts/new?type=LOST` · `/settings` · `/posts/12`
 *   버린다   `https://…` · `//evil.com`(프로토콜 상대) · `/\evil.com`(브라우저가 `//` 로 읽는다)
 *            · 제어 문자가 섞인 값(브라우저가 지우고 다시 읽는다) · `/login` · `/signup`(되돌아오는 고리)
 */
export function safeRedirectPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || hasControlChar(raw)) {
    return paths.postList
  }

  const url = new URL(raw, window.location.origin)
  // 앞 검사는 원문만 본다. `/..//evil.com` 은 `new URL()` 이 점 구간을 정리한 뒤에야 `//evil.com` 이 된다 —
  // 오리진은 같게 나오지만 이 값을 그대로 넘기면 브라우저가 프로토콜 상대 주소로 읽는다. 정리된 경로로 한 번 더 막는다
  if (url.origin !== window.location.origin || url.pathname.startsWith('//')) {
    return paths.postList
  }
  if (url.pathname === paths.login || url.pathname === paths.signup) {
    return paths.postList
  }
  return `${url.pathname}${url.search}${url.hash}`
}

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/** 로그인 화면 주소. 돌아갈 곳이 목록이면 `?redirect=` 를 붙이지 않는다 */
export function loginPath(redirect: string): string {
  return redirect === paths.postList ? paths.login : paths.loginThenReturn(redirect)
}

/** 가입 화면 주소. 돌아갈 곳이 목록이면 `?redirect=` 를 붙이지 않는다 */
export function signupPath(redirect: string): string {
  return redirect === paths.postList ? paths.signup : paths.signupThenReturn(redirect)
}

export interface ReturnTarget {
  /** 화면 이름 — "로그인하면 {label}(으)로 돌아갑니다" */
  label: string
  /** 한쪽 개념에 묶인 곳이면 그 색을 입힌다(분실 글 올리기 → 마리골드). 색은 개념에 붙는다(화면정의서 1.2) */
  concept?: 'LOST' | 'FOUND'
}

const POST_PATH = /^\/posts\/\d+$/
const POST_EDIT_PATH = /^\/posts\/\d+\/edit$/

/**
 * 돌아갈 곳을 사람이 읽는 이름으로. 이름을 모르는 곳이면 `null` — 안내 줄을 띄우지 않는다.
 * `safeRedirectPath` 를 거친 값만 넣는다.
 */
export function describeReturnTarget(path: string): ReturnTarget | null {
  const url = new URL(path, window.location.origin)

  if (url.pathname === paths.postCreate) {
    const type = url.searchParams.get('type')
    if (type === 'LOST') return { label: '분실 글 올리기', concept: 'LOST' }
    if (type === 'FOUND') return { label: '습득 글 올리기', concept: 'FOUND' }
    return { label: '글 올리기' }
  }
  if (POST_EDIT_PATH.test(url.pathname)) return { label: '글 수정' }
  if (POST_PATH.test(url.pathname)) return { label: '보던 글' }
  if (url.pathname === paths.settings) return { label: '설정' }
  if (url.pathname === paths.myPage) return { label: '내가 쓴 글' }
  if (url.pathname === paths.postList && url.search) return { label: '보던 목록' }
  return null
}
