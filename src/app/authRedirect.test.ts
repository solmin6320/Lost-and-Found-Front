import { beforeAll, describe, expect, it, vi } from 'vitest'

import { safeRedirectPath } from './authRedirect'

// 순수 함수 테스트라 jsdom 을 쓰지 않는다. `window.location.origin` 만 흉내 낸다
beforeAll(() => {
  vi.stubGlobal('window', { location: { origin: 'https://lost.example' } })
})

describe('safeRedirectPath — 열린 리다이렉트 방지', () => {
  it.each([
    ['/posts/new?type=LOST'],
    ['/posts/12'],
    ['/posts/12#comments'],
    ['/settings'],
    ['/?keyword=%EC%A7%80%EA%B0%91&page=2'],
  ])('앱 안 경로 %s 는 그대로 따른다', (path) => {
    expect(safeRedirectPath(path)).toBe(path)
  })

  it.each([[null], [undefined], ['']])('값이 없으면(%s) 목록으로 보낸다', (raw) => {
    expect(safeRedirectPath(raw)).toBe('/')
  })

  it.each([
    ['https://evil.com'],
    ['javascript:alert(1)'],
    ['evil.com/posts'],
    ['//evil.com'],
    ['//evil.com/posts/1'],
    ['/\\evil.com'],
    ['/\\/evil.com'],
  ])('바깥 주소 %s 는 버린다', (raw) => {
    expect(safeRedirectPath(raw)).toBe('/')
  })

  it.each([
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['/\r/evil.com'],
    ['/posts\u0000/1'],
    ['/posts\u007f'],
  ])('제어 문자가 섞인 값 %j 는 버린다', (raw) => {
    expect(safeRedirectPath(raw)).toBe('/')
  })

  it.each([['/login'], ['/login?redirect=/settings'], ['/signup'], ['/signup#x'], ['/./login']])(
    '로그인 · 가입으로 되돌아오는 값 %s 는 목록으로 바꾼다',
    (raw) => {
      expect(safeRedirectPath(raw)).toBe('/')
    },
  )

  // `/..//evil.com` 은 원문 검사를 모두 통과하고 `new URL()` 이 점 구간을 정리한 뒤에야 `//evil.com` 이 된다.
  // 단위 테스트가 찾은 우회(2026-09-28) — 정리된 pathname 으로 한 번 더 막는다
  it.each([['/..//evil.com'], ['/.//evil.com'], ['/a/..//evil.com'], ['/%2e%2e//evil.com']])(
    '점 구간을 거쳐 // 가 되는 %s 는 목록으로 보낸다',
    (raw) => {
      expect(safeRedirectPath(raw)).toBe('/')
    },
  )
})
