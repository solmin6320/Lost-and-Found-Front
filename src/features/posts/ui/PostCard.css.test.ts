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

  it('제목 링크의 덮개가 카드 전체(윤곽까지)를 덮고, 사진 · 포스터보다 위에 있다', () => {
    const after = declarations('.link::after')
    expect(after.get('content')).toBe("''")
    expect(after.get('position')).toBe('absolute')
    // 윤곽 굵기만큼 바깥으로 — 윤곽 위를 눌러도 글이 열린다(덮개의 기준은 윤곽 안쪽 칸이다)
    expect(after.get('inset')).toBe('calc(var(--outline-width) * -1)')
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

/*
 * 카드 한 장(사진 + 글 칸)을 잉크 윤곽이 두른다 — 본인 피드백(2026-10-08) "게시글 테두리에 약간의 검은색 윤곽(3 ~ 5px)".
 * 색은 tokens.css 의 `--card-outline`(밝게 잉크 · 어둡게 중간 잉크, tokens.test.ts 가 잰다)
 */
describe('목록 카드 — 윤곽', () => {
  const card = declarations('.card')
  const width = Number(/^(\d+(?:\.\d+)?)px$/.exec(card.get('--outline-width') ?? '')?.[1])

  it('굵기는 3 ~ 5px 이고, 카드 테두리가 그 굵기 · 윤곽 색을 쓴다', () => {
    expect(width).toBeGreaterThanOrEqual(3)
    expect(width).toBeLessThanOrEqual(5)
    expect(card.get('border')).toBe('var(--outline-width) solid var(--card-outline)')
    expect(card.get('border-radius')).toBe('var(--radius-md)')
  })

  it('그림자는 없다 — 떠 있는 것이 아니다', () => {
    expect(card.has('box-shadow')).toBe(false)
  })

  it('같은 줄 카드는 같은 높이 — 윤곽 아래 끝이 맞는다', () => {
    expect(card.get('height')).toBe('100%')
  })

  it('사진은 위 두 모서리만 안쪽 반경(카드 반경 − 윤곽 굵기)이고, 사진 · 포스터 · 스켈레톤이 그 모서리를 받는다', () => {
    const inner = 'calc(var(--radius-md) - var(--outline-width))'
    expect(declarations('.media').get('border-radius')).toBe(`${inner} ${inner} 0 0`)
    expect(declarations('.media .visual').get('border-radius')).toBe('inherit')
    expect(declarations('.media .skeletonMedia').get('border-radius')).toBe('inherit')
  })

  it('사진의 옅은 테는 아래 한 줄만 — 윤곽과 겹쳐 선이 두꺼워지지 않는다', () => {
    expect(declarations('.media:has(img)::after').get('box-shadow')).toBe('inset 0 -1px 0 var(--media-edge)')
  })

  it('포커스 링은 윤곽에서 떨어져 한 줄 더 — 굵어진 윤곽처럼 보이지 않는다', () => {
    const focus = declarations('.card:has(.link:focus-visible)')
    expect(focus.get('outline')).toBe('2px solid var(--focus-ring)')
    expect(Number.parseFloat(focus.get('outline-offset') ?? '0')).toBeGreaterThanOrEqual(2)
  })

  it('스켈레톤 카드는 같은 굵기(자리가 튀지 않게) · 옅은 색이다', () => {
    const skeleton = declarations('.skeletonCard')
    expect(skeleton.get('border-color')).toBe('var(--skeleton)')
    expect([...skeleton.keys()].filter((name) => name.includes('width') || name === 'border')).toEqual([])
  })
})
