import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'

/**
 * `spa-rewrite.js` 는 CloudFront 콘솔에 그대로 붙여 넣는 파일이라 모듈이 아니다(export 없음).
 * 소스를 읽어 빈 전역(`vm` 새 컨텍스트)에서 평가한다 — Node 의 `require` · `process` 에 기대면 여기서 먼저 깨진다.
 */
const source = readFileSync(new URL('./spa-rewrite.js', import.meta.url), 'utf8')

interface CloudFrontRequest {
  uri: string
  method: string
  querystring: Record<string, { value: string }>
  headers: Record<string, { value: string }>
}

const handler = runInNewContext(`${source}\n;handler`) as (event: { request: CloudFrontRequest }) => CloudFrontRequest

function rewrite(uri: string, querystring: CloudFrontRequest['querystring'] = {}) {
  return handler({ request: { uri, method: 'GET', querystring, headers: {} } })
}

describe('spa-rewrite — CloudFront 런타임에 올릴 수 있는 모양', () => {
  it('export · import · require 가 없다(cloudfront-js-2.0 은 모듈이 아니다)', () => {
    expect(source).not.toMatch(/^\s*(export|import)\s/m)
    expect(source).not.toMatch(/\brequire\(/)
    expect(source).toMatch(/^function handler\(event\)/m)
  })

  it('함수 크기 한도(10KB)보다 한참 작다', () => {
    expect(Buffer.byteLength(source, 'utf8')).toBeLessThan(10 * 1024)
  })
})

describe('spa-rewrite — 앱 주소는 index.html 로', () => {
  it.each([
    '/',
    '/posts/new',
    '/posts/3',
    '/posts/3/edit',
    '/login',
    '/signup',
    '/me',
    '/settings',
    // 없는 주소도 앱으로 — React Router 가 SCR-09 를 그린다
    '/post/12',
    '/posts/12/edits',
    '/assets',
  ])('%s', (uri) => {
    expect(rewrite(uri).uri).toBe('/index.html')
  })

  it.each(['/posts/3/', '/settings/', '/assets/'])('끝 슬래시 %s', (uri) => {
    expect(rewrite(uri).uri).toBe('/index.html')
  })

  it('한글이 인코딩된 주소', () => {
    expect(rewrite('/%EC%A7%80%EA%B0%91').uri).toBe('/index.html')
    expect(rewrite('/posts/%EC%A7%80%EA%B0%91').uri).toBe('/index.html')
  })

  it.each(['/posts/1.5', '/posts/1.0e5', '/posts/3.'])('숫자 뒤 점(%s)은 확장자가 아니다 — 앱이 "없는 글"을 보여 준다', (uri) => {
    expect(rewrite(uri).uri).toBe('/index.html')
  })

  it('/api 와 이름만 비슷한 주소는 앱 주소다', () => {
    expect(rewrite('/apis').uri).toBe('/index.html')
    expect(rewrite('/apidocs/x').uri).toBe('/index.html')
  })
})

describe('spa-rewrite — 파일은 그대로(없으면 S3 의 403 이 간다)', () => {
  it.each([
    '/index.html',
    '/theme-init.js',
    '/favicon.svg',
    '/assets/index-abc123.js',
    '/assets/index-D4f_x-9Q.css',
    '/assets/PostDetailPage-CSCL3eht.js',
    '/assets/PretendardVariable.subset.10-DzSWztS8.woff2',
    // 배포 뒤 옛 청크 — index.html 로 덮지 않는다
    '/assets/PostEditPage-OLDHASH.js',
    '/robots.txt',
  ])('%s', (uri) => {
    expect(rewrite(uri).uri).toBe(uri)
  })

  it.each(['/.well-known/security.txt', '/.well-known/', '/.env', '/.git/config'])('점으로 시작하는 조각 %s', (uri) => {
    expect(rewrite(uri).uri).toBe(uri)
  })
})

describe('spa-rewrite — API 는 손대지 않는다', () => {
  it.each(['/api', '/api/', '/api/posts', '/api/posts/3', '/api/auth/reissue', '/api/posts/3/comments'])('%s', (uri) => {
    expect(rewrite(uri).uri).toBe(uri)
  })
})

/*
 * 경로 우회 입력(2026-09-29 보안 검수). 이 함수는 방어선이 아니다 — 버킷에는 빌드 결과(공개 파일)만 있고 OAC 로만 열린다.
 * 지키는 것은 둘 : ① `/api` 처럼 보이는 변형이 "API 라서 그대로" 통과하지 않는다(대소문자 · 이중 슬래시 · 인코딩은 앱 주소)
 * ② 점 조각을 인코딩해도(`%2e`) S3 의 다른 키로 가지 않는다 — 전부 `/index.html` 이 된다. uri 를 풀어 읽지 않는다(풀면 이 둘이 깨진다)
 */
describe('spa-rewrite — 우회 입력은 index.html 이거나 받은 그대로다', () => {
  it.each(['/API/posts', '/Api', '//api/posts', '/%61pi/posts', '/api%2Fposts', '/%2e%2e/api/x'])(
    '%s — API 처럼 보여도 앱 주소다(CloudFront 경로 패턴도 대소문자를 가린다)',
    (uri) => {
      expect(rewrite(uri).uri).toBe('/index.html')
    },
  )

  it.each(['/%2eenv', '/%2Egit/config', '/posts/3%2Ejs', '/index.html%00', '/index.html.'])(
    '%s — 인코딩 · 끝 점은 파일로 보지 않는다',
    (uri) => {
      expect(rewrite(uri).uri).toBe('/index.html')
    },
  )

  it.each(['/assets/../.env', '/..', '/.'])('%s — 점 조각은 받은 그대로(없는 키라 S3 가 403)', (uri) => {
    expect(rewrite(uri).uri).toBe(uri)
  })
})

describe('spa-rewrite — uri 만 바꾼다', () => {
  it('쿼리스트링 · 메서드 · 헤더는 그대로 넘긴다', () => {
    const querystring = { keyword: { value: '지갑' }, type: { value: 'LOST' }, page: { value: '2' } }
    const request = rewrite('/', querystring)
    expect(request.uri).toBe('/index.html')
    expect(request.querystring).toEqual(querystring)
    expect(request.method).toBe('GET')
  })

  it('받은 요청 객체를 돌려준다(응답을 새로 만들지 않는다)', () => {
    const request: CloudFrontRequest = { uri: '/posts/3', method: 'GET', querystring: {}, headers: {} }
    expect(handler({ request })).toBe(request)
  })
})
