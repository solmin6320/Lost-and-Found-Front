import { readFileSync, statSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { DEFAULT_SITE_URL, SITE_URL_TOKEN, fillSiteUrl, resolveSiteOrigin } from './linkPreview.ts'

const root = new URL('../', import.meta.url)
const indexHtml = readFileSync(new URL('index.html', root), 'utf8')

/** `<meta property|name="key" content="…">` 의 content */
function meta(html: string, key: string): string | undefined {
  const pattern = new RegExp(`<meta\\s+(?:property|name)="${key.replace(/[.:]/g, '\\$&')}"\\s+content="([^"]*)"`)
  return pattern.exec(html)?.[1]
}

/** PNG 머리(IHDR)의 가로 · 세로 */
function pngSize(file: string): [number, number] {
  const bytes = readFileSync(new URL(file, root))
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
}

describe('SITE_URL — 링크 미리보기의 사이트 주소', () => {
  it('비우면 지금 운영 주소', () => {
    expect(resolveSiteOrigin(undefined)).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteOrigin('  ')).toBe(DEFAULT_SITE_URL)
  })

  it('끝 / 는 떼고 출처만 남긴다(배포 변수 SITE_URL 은 끝 / 를 허용한다)', () => {
    expect(resolveSiteOrigin('https://lost.example.com/')).toBe('https://lost.example.com')
  })

  it.each([
    'http://lost.example.com',
    'https://lost.example.com/app',
    'https://lost.example.com/?a=1',
    'https://lost.example.com"onload="x',
    'https://a.example.com https://b.example.com',
  ])('%s → 빌드를 멈춘다', (raw) => {
    expect(() => resolveSiteOrigin(raw)).toThrow(/SITE_URL/)
  })

  it('자리를 모두 채운다 · 자리가 없으면 멈춘다', () => {
    expect(fillSiteUrl(`a ${SITE_URL_TOKEN}/x ${SITE_URL_TOKEN}/`, 'https://s.example')).toBe('a https://s.example/x https://s.example/')
    expect(() => fillSiteUrl('<head></head>', 'https://s.example')).toThrow()
  })
})

describe('index.html — 링크 미리보기 메타', () => {
  const filled = fillSiteUrl(indexHtml, DEFAULT_SITE_URL)

  it('그림 · 주소는 채운 뒤 절대 주소다', () => {
    expect(meta(filled, 'og:url')).toBe(`${DEFAULT_SITE_URL}/`)
    expect(meta(filled, 'og:image')).toBe(`${DEFAULT_SITE_URL}/og-image.png`)
    expect(meta(filled, 'twitter:image')).toBe(`${DEFAULT_SITE_URL}/og-image.png`)
    expect(filled).not.toContain(SITE_URL_TOKEN)
  })

  it('제목 · 설명이 검색 · 미리보기 모두 같다', () => {
    const title = meta(indexHtml, 'og:title')
    const description = meta(indexHtml, 'og:description')
    expect(title).toMatch(/^분실물 찾기 - /)
    expect(indexHtml).toContain(`<title>${title}</title>`)
    expect(meta(indexHtml, 'twitter:title')).toBe(title)
    expect(meta(indexHtml, 'description')).toBe(description)
    expect(meta(indexHtml, 'twitter:description')).toBe(description)
  })

  it('디스코드 · 슬랙이 오른쪽 작은 썸네일로 두도록 twitter:card 는 summary', () => {
    expect(meta(indexHtml, 'twitter:card')).toBe('summary')
    expect(meta(indexHtml, 'og:locale')).toBe('ko_KR')
    expect(meta(indexHtml, 'og:type')).toBe('website')
  })

  it('theme-color(디스코드 막대)는 코발트 — 빨강은 삭제 · 오류 자리뿐', () => {
    const tokens = readFileSync(new URL('src/shared/styles/tokens.css', root), 'utf8')
    const cobalt = /--found-500:\s*(#[0-9a-f]{6})/i.exec(tokens)?.[1]
    expect(meta(indexHtml, 'theme-color')).toBe(cobalt)
  })

  it('theme-color 는 theme-init.js 보다 먼저 온다(스크립트가 화면 모드 색으로 바꾼다)', () => {
    expect(indexHtml.indexOf('name="theme-color"')).toBeLessThan(indexHtml.indexOf('src="/theme-init.js"'))
  })
})

describe('public/ — 미리보기 그림 · 홈 화면 아이콘', () => {
  it('og-image.png 는 1200×630 · 300KB 이하이고 메타의 크기와 같다', () => {
    const [width, height] = pngSize('public/og-image.png')
    expect([width, height]).toEqual([1200, 630])
    expect(meta(indexHtml, 'og:image:width')).toBe(String(width))
    expect(meta(indexHtml, 'og:image:height')).toBe(String(height))
    expect(statSync(new URL('public/og-image.png', root)).size).toBeLessThan(300 * 1024)
  })

  it('apple-touch-icon.png 는 180×180', () => {
    expect(pngSize('public/apple-touch-icon.png')).toEqual([180, 180])
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
  })
})
