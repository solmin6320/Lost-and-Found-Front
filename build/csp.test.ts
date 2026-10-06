import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { DEFAULT_IMAGE_ORIGINS, FORBIDDEN_CSP_TOKENS, buildHeaderCsp, buildMetaCsp, parseOriginList } from './csp.ts'

describe('parseOriginList — 환경변수가 정책 문자열에 그대로 들어가지 않게', () => {
  it('비어 있으면 빈 목록', () => {
    expect(parseOriginList(undefined, 'X')).toEqual([])
    expect(parseOriginList('   ', 'X')).toEqual([])
  })

  it('https 출처를 origin 모양으로 맞춘다(끝의 / 제거 · 공백 · 쉼표로 가름)', () => {
    expect(parseOriginList('https://d111.cloudfront.net/ , https://a.example.com:8443', 'X')).toEqual([
      'https://d111.cloudfront.net',
      'https://a.example.com:8443',
    ])
  })

  it('http 는 내 컴퓨터만', () => {
    expect(parseOriginList('http://localhost:8091', 'X')).toEqual(['http://localhost:8091'])
    expect(() => parseOriginList('http://images.example.com', 'X')).toThrow()
  })

  it.each([
    [`'unsafe-inline'`],
    ['*'],
    ['https://*.amazonaws.com'],
    ['data:'],
    ['https://a.example.com/path'],
    ['https://a.example.com?x=1'],
    ['https://user:pw@a.example.com'],
    ['https://a.example.com;script-src'],
    ['javascript:alert(1)'],
  ])('%s 는 빌드를 멈춘다', (value) => {
    expect(() => parseOriginList(value, 'X')).toThrow()
  })
})

describe('기본 사진 출처', () => {
  it('운영 사진 CloudFront 하나이고 S3 주소가 아니다(버킷은 퍼블릭 읽기를 닫아 S3 주소의 사진은 403)', () => {
    expect(DEFAULT_IMAGE_ORIGINS).toEqual(['https://d1xmzetvs0f1oh.cloudfront.net'])
    expect(parseOriginList(DEFAULT_IMAGE_ORIGINS.join(' '), 'X')).toEqual([...DEFAULT_IMAGE_ORIGINS])
    for (const origin of DEFAULT_IMAGE_ORIGINS) expect(origin).not.toContain('amazonaws.com')
  })

  it('업로드 스크립트의 PHOTO_ORIGIN 과 같다 — 한쪽만 바꾸면 배포가 멈추거나 옛 출처를 통과시킨다', () => {
    const script = readFileSync(new URL('../deploy/s3-upload.sh', import.meta.url), 'utf8')
    const escaped = DEFAULT_IMAGE_ORIGINS[0].replace(/[.]/g, '\\.')
    expect(script).toMatch(new RegExp(`^PHOTO_ORIGIN=${escaped}\\r?$`, 'm'))
  })
})

describe('정책 문자열', () => {
  const meta = buildMetaCsp({ imageOrigins: DEFAULT_IMAGE_ORIGINS })

  it('인라인 · eval · data: 를 허용하지 않는다', () => {
    for (const token of FORBIDDEN_CSP_TOKENS) expect(meta).not.toContain(token)
  })

  it('meta 에는 frame-ancestors 를 넣지 않는다(브라우저가 무시하고 경고한다)', () => {
    expect(meta).not.toContain('frame-ancestors')
    expect(buildHeaderCsp({ imageOrigins: DEFAULT_IMAGE_ORIGINS })).toContain(`frame-ancestors 'none'`)
  })

  it('다른 출처 API 로 빌드하면 connect-src 에 그 출처가 붙는다', () => {
    expect(buildMetaCsp({ imageOrigins: [], connectOrigins: ['http://localhost:8080'] })).toContain(
      `connect-src 'self' http://localhost:8080`,
    )
  })

  it('CloudFront 헤더 정책 초안(docs)의 CSP 와 같다 — 한쪽만 고치면 교집합이 되어 사진이 깨진다', () => {
    const policy = JSON.parse(
      readFileSync(new URL('../docs/cloudfront-response-headers-policy.json', import.meta.url), 'utf8'),
    ) as { SecurityHeadersConfig: { ContentSecurityPolicy: { ContentSecurityPolicy: string } } }
    expect(policy.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy).toBe(
      buildHeaderCsp({ imageOrigins: DEFAULT_IMAGE_ORIGINS }),
    )
  })
})
