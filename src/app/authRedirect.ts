import { paths, POST_COMMENTS_HASH } from './paths'

/**
 * 로그인 · 가입 뒤 돌아갈 곳(`?redirect=`). 화면정의서 1.5 · 보안명세서 2장.
 *
 * 쿼리스트링은 누구나 만들 수 있다. `/login?redirect=https://피싱사이트` 링크를 받은 사람이
 * 우리 로그인 화면에서 로그인한 뒤 남의 사이트로 넘어가면 안 된다(열린 리다이렉트).
 * 그래서 **우리 앱 안의 경로만** 따르고, 나머지는 전부 목록(`/`)으로 보낸다.
 *
 *   따른다   `/posts/new?type=LOST` · `/settings` · `/posts/12`
 *   버린다   `https://…` · `//evil.com`(프로토콜 상대) · `/\evil.com`(브라우저가 `//` 로 읽는다)
 *            · 제어 문자가 섞인 값(브라우저가 지우고 다시 읽는다) · `/login` · `/signup`(되돌아오는 고리 —
 *            `/LOGIN` · `/login/` 처럼 라우터가 같은 화면으로 읽는 값까지)
 *   떼어 낸다 조각(`#…`)은 상세의 `#comments` 하나만 남긴다(문자열 비교). 다른 조각은 경로만 따른다 —
 *            돌아온 화면이 조각을 보고 하는 일이 그것 하나라, 남이 만든 조각으로 화면을 움직이지 못하게
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
  if (AUTH_SCREENS.has(routeKey(url.pathname))) {
    return paths.postList
  }
  const hash = url.hash === POST_COMMENTS_HASH ? url.hash : ''
  return `${url.pathname}${url.search}${hash}`
}

/** 로그인 뒤 다시 가면 되돌아오는 고리가 되는 화면 */
const AUTH_SCREENS: ReadonlySet<string> = new Set([paths.login, paths.signup])

/**
 * React Router 가 경로를 맞춰 보는 방식대로 다듬은 값. 되돌아오는 고리 검사를 **라우터가 보는 값**으로 하려는 것이다.
 *
 * 라우터(v7 `matchRoutes`)는 대소문자를 가리지 않고(`caseSensitive` 기본 거짓), 끝의 `/` 를 몇 개든 무시하고,
 * 구간마다 `%xx` 를 풀어서 맞춘다(`/` 로 풀리는 `%2F` 만 그대로 둔다). 그래서 `/LOGIN` · `/login/` · `/Signup` ·
 * `/%6Cogin` 이 모두 로그인 · 가입 화면을 연다 — 원문(`url.pathname`) 비교로는 통과했다(2026-09-29 검수 L3)
 */
function routeKey(pathname: string): string {
  let decoded = pathname
  try {
    decoded = pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment).replace(/\//g, '%2F'))
      .join('/')
  } catch {
    // 잘못된 `%` — 라우터도 풀지 않고 원문으로 맞춘다
  }
  return decoded.toLowerCase().replace(/\/+$/, '') || '/'
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

/** 돌아갈 곳이 글 상세인가. 상세로 돌아갈 때만 상세의 진입 상태(`returnEntry`)를 싣는다. `safeRedirectPath` 를 거친 값만 넣는다 */
export function isPostDetailPath(path: string): boolean {
  return POST_PATH.test(new URL(path, window.location.origin).pathname)
}
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
