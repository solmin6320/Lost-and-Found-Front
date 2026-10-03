import { describe, expect, it } from 'vitest'

/*
 * tokens.css 의 색 원값을 직접 읽어 대비를 다시 잰다(WCAG 2.x 상대 휘도).
 * 주석에 적힌 대비가 값과 어긋나지 않게, 그리고 어둡게 두 벌(`[data-theme='dark']` · `prefers-color-scheme`)이 같게.
 *
 * 원본 파일을 그대로 읽는다. vitest 는 CSS 를 비워서 들여오므로(`?raw` 도 빈 문자열) 노드 fs 로 읽는다.
 * 앱 타입(tsconfig.app)에는 노드 타입이 없어 이름을 이어 붙인 동적 import 로 부른다(시험에서만 돈다)
 */
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
// 체크아웃 설정에 따라 줄 끝이 CRLF 일 수 있다
const tokensCss = fs.readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').split('\r\n').join('\n')

/** `선택자 {` 로 시작하는 블록 안의 `--이름: 값;` 들 */
function readBlock(opener: string): Map<string, string> {
  const start = tokensCss.indexOf(opener)
  if (start < 0) throw new Error(`블록을 찾지 못함 : ${opener}`)
  const open = tokensCss.indexOf('{', start)
  let depth = 0
  let end = open
  for (let i = open; i < tokensCss.length; i += 1) {
    if (tokensCss[i] === '{') depth += 1
    if (tokensCss[i] === '}') depth -= 1
    if (depth === 0) {
      end = i
      break
    }
  }
  const body = tokensCss.slice(open + 1, end)
  const values = new Map<string, string>()
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) values.set(match[1], match[2].trim().toLowerCase())
  return values
}

function luminance(hex: string): number {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const light = readBlock(":root,\n[data-theme='light'] {")
const dark = readBlock("[data-theme='dark'] {")
const darkBySystem = readBlock(":root:not([data-theme='light']) {")

function value(block: Map<string, string>, name: string): string {
  const found = block.get(name)
  if (!found) throw new Error(`${name} 이 없음`)
  return found
}

describe('색 토큰', () => {
  it('오류 글자는 회의 결정 값이다(밝게 #A62018 · 어둡게 #FF8F85)', () => {
    expect(value(light, '--error-ink')).toBe('#a62018')
    expect(value(dark, '--error-ink')).toBe('#ff8f85')
  })

  it('오류 글자는 종이 위에서 7:1 을 넘는다 — 두 모드 다, 떠 있는 면 위에서도 본문 대비', () => {
    expect(contrast(value(light, '--error-ink'), value(light, '--paper'))).toBeGreaterThanOrEqual(7)
    expect(contrast(value(dark, '--error-ink'), value(dark, '--paper'))).toBeGreaterThanOrEqual(7)
    expect(contrast(value(dark, '--error-ink'), value(dark, '--paper-raised'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(value(light, '--error-ink'), value(light, '--ink-050'))).toBeGreaterThanOrEqual(4.5)
  })

  it('어둡게 주 버튼은 글자색보다 한 단계 낮고, 버튼 글자와 12:1 을 넘는다(UI-13)', () => {
    const fill = value(dark, '--action-fill')
    expect(fill).toBe('#d5d8dd')
    expect(luminance(fill)).toBeLessThan(luminance(value(dark, '--ink-900')))
    // 버튼 글자는 --on-action = --paper
    expect(contrast(fill, value(dark, '--paper'))).toBeGreaterThanOrEqual(12)
    // hover(ink-700 #C4C7CD)는 한 단계 더 어둡다
    expect(value(dark, '--ink-700')).toBe('#c4c7cd')
    expect(luminance(value(dark, '--ink-700'))).toBeLessThan(luminance(fill))
  })

  it('밝게 주 버튼은 잉크 그대로다', () => {
    expect(value(light, '--action-fill')).toBe(value(light, '--ink-900'))
  })

  it('어둡게 두 벌(고른 경우 · 기기 설정)은 값이 같다 — 하나만 고치면 어긋난다', () => {
    expect([...darkBySystem.entries()]).toEqual([...dark.entries()])
  })
})
