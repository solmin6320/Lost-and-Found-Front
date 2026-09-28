import { describe, expect, it } from 'vitest'

import { safeImageUrl } from './url'

const BASE = 'https://app.example.com'

describe('safeImageUrl — <img src> 에는 http(s) 만', () => {
  it.each([
    'https://lostfound-images-solmin-seoul.s3.ap-northeast-2.amazonaws.com/posts/1/a.jpg',
    'https://d111.cloudfront.net/posts/1/a.png?v=2',
    'http://localhost:8091/__mock/img/a.svg',
    '/assets/fallback.png',
  ])('%s 는 그대로', (url) => {
    expect(safeImageUrl(url, BASE)).toBe(url)
  })

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'data:text/html;base64,PHNjcmlwdD4=',
    'blob:https://app.example.com/uuid',
    'file:///etc/passwd',
    'vbscript:msgbox',
    '',
    '   ',
  ])('%j 는 버린다', (url) => {
    expect(safeImageUrl(url, BASE)).toBeNull()
  })

  it('문자열이 아니면 버린다(서버가 모양을 바꿨을 때)', () => {
    expect(safeImageUrl(null, BASE)).toBeNull()
    expect(safeImageUrl(undefined, BASE)).toBeNull()
    expect(safeImageUrl({ href: 'https://x' }, BASE)).toBeNull()
  })
})
