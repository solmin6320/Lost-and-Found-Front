import { describe, expect, it } from 'vitest'

/*
 * 목록 카드는 제목 링크 하나가 카드 전체(사진 포함)를 덮는다(`.link::after`). 사진을 눌러도 글이 열려야 한다(본인 피드백 2026-10-07).
 * 덮개를 품은 칸(제목 · 링크)에 `overflow` 를 걸면 브라우저에 따라 덮개가 제목 줄 밖에서 잘려 사진 누름이 빗나간다 —
 * 두 줄 자르기는 링크 안쪽 글자 칸(`.titleText`)에만 둔다. 이 규칙이 다시 깨지지 않게 CSS 원본을 읽어 확인한다.
 *
 * vitest 는 CSS 를 비워서 들여오므로 노드 fs 로 원본을 읽는다(tokens.test.ts 와 같은 방법)
 */
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const css = fs
  .readFileSync(new URL('./PostCard.module.css', import.meta.url), 'utf8')
  .split('\r\n')
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** 선택자 하나(정확히 같은 것)를 가진 규칙들의 본문. `@container` 안의 규칙도 포함한다 */
function bodiesOf(selector: string): string[] {
  const bodies: string[] = []
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((part) => part.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }
  return bodies
}

function declarations(selector: string): Map<string, string> {
  const values = new Map<string, string>()
  for (const body of bodiesOf(selector)) {
    for (const match of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) values.set(match[1], match[2].trim())
  }
  return values
}

describe('목록 카드 — 사진을 눌러도 글이 열린다', () => {
  it('카드가 덮개의 기준이다', () => {
    expect(declarations('.card').get('position')).toBe('relative')
  })

  it('제목 링크의 덮개가 카드 전체를 덮고, 사진 · 포스터보다 위에 있다', () => {
    const after = declarations('.link::after')
    expect(after.get('content')).toBe("''")
    expect(after.get('position')).toBe('absolute')
    expect(after.get('inset')).toBe('0')
    expect(Number(after.get('z-index'))).toBeGreaterThanOrEqual(1)
  })

  it('카드와 덮개 사이의 칸(글 칸 · 제목 · 링크)은 자르지도, 새 기준이 되지도 않는다', () => {
    for (const selector of ['.body', '.title', '.link']) {
      const values = declarations(selector)
      expect([...values.keys()].filter((name) => name.startsWith('overflow') || name === 'contain')).toEqual([])
      expect(values.get('position') ?? 'static').toBe('static')
      expect(values.has('transform')).toBe(false)
      expect(values.has('container-type')).toBe(false)
    }
  })

  it('두 줄 자르기는 링크 안쪽 글자 칸에만 건다', () => {
    const text = declarations('.titleText')
    expect(text.get('overflow')).toBe('hidden')
    expect(text.get('-webkit-line-clamp')).toBe('2')
  })
})
