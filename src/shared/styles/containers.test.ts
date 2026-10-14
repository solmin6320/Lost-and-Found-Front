import { describe, expect, it } from 'vitest'

/*
 * 그릇(컨테이너) 질의가 **의도한 그릇**을 재는지 — QA-D-21(2026-10-13) 재발 방지.
 *
 * 이름 없는 `@container (min-width: …)` 는 "가장 가까운 조상 그릇"을 잰다. 칸 자신은 자기의 그릇이 될 수 없어서
 * `.choice { container-type }` 와 `@container (…) { .choice { padding } }` 를 한 파일에 두면 .choice 는 바깥 그릇을 잰다.
 * 바깥 그릇이 없을 때는 꺼져 있던 규칙이, 헤더 그릇(`RootLayout` .shell — 앱 전체를 감싼다)이 생기자 글자 100%에서도 켜져
 * 글 올리기 유형 칸이 100 → 107px 로 커졌다. 그래서
 *   1. 그릇은 모두 이름이 있다(`container: 이름 / inline-size`) — `container-type` 만 쓰지 않는다
 *   2. 질의는 모두 이름으로 잰다 — 이름 없는 `@container (` 가 없다
 *   3. 이름은 한 곳에서만 짓는다. `shell` 말고는 그 그릇을 지은 파일 안에서만 잰다(그 파일의 칸이 그 그릇 안에 있다)
 *   4. 질의 안의 규칙이 그릇을 지은 칸 자신을 고치지 않는다(자기 자신은 재지 못한다)
 *
 * vitest 는 CSS 를 비워서 들여오므로 노드 fs 로 원본을 읽는다(tokens.test.ts 와 같은 방법)
 */
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
  readdirSync: (path: URL, options: { recursive: true }) => string[]
}

const SRC = new URL('../../', import.meta.url)
const files = fs
  .readdirSync(SRC, { recursive: true })
  .map((name) => name.split('\\').join('/'))
  .filter((name) => name.endsWith('.css'))
  .map((name) => ({
    name,
    css: fs
      .readFileSync(new URL(name, SRC), 'utf8')
      .split('\r\n')
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, ''),
  }))

/** `{` 위치에서 짝이 맞는 `}` 까지의 안쪽 */
function blockAt(css: string, open: number): string {
  let depth = 0
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    if (css[i] === '}') depth -= 1
    if (depth === 0) return css.slice(open + 1, i)
  }
  throw new Error('괄호 짝이 맞지 않음')
}

/** 블록 바로 안쪽 규칙들의 선택자(쉼표로 나눈 것) */
function selectorsIn(block: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < block.length; i += 1) {
    if (block[i] === '{') {
      if (depth === 0) out.push(...block.slice(start, i).split(',').map((s) => s.trim()))
      depth += 1
    } else if (block[i] === '}') {
      depth -= 1
      if (depth === 0) start = i + 1
    } else if (block[i] === ';' && depth === 0) {
      start = i + 1
    }
  }
  return out.filter(Boolean)
}

const declarations = files.flatMap(({ name, css }) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*?)\bcontainer:\s*([a-z][\w-]*)\s*\/\s*inline-size\s*;/g)].map((m) => ({
    file: name,
    selector: m[1].trim(),
    container: m[3],
  })),
)

const queries = files.flatMap(({ name, css }) =>
  [...css.matchAll(/@container\s+([a-z][\w-]*)\s*\([^)]*\)\s*\{/g)].map((m) => ({
    file: name,
    container: m[1],
    selectors: selectorsIn(blockAt(css, (m.index ?? 0) + m[0].length - 1)),
  })),
)

describe('그릇 질의는 이름으로 의도한 그릇을 잰다(QA-D-21)', () => {
  it('CSS 파일을 실제로 읽었다', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(declarations.map((d) => d.container)).toContain('shell')
    expect(queries.length).toBeGreaterThan(30)
  })

  it('1. 그릇은 모두 이름이 있다 — container-type 만 쓰지 않는다', () => {
    const unnamed = files.filter(({ css }) => /\bcontainer-type\s*:/.test(css)).map(({ name }) => name)
    expect(unnamed).toEqual([])
  })

  it('2. 질의는 모두 이름으로 잰다 — 이름 없는 @container 가 없다', () => {
    const unnamed = files.filter(({ css }) => /@container\s*\(/.test(css)).map(({ name }) => name)
    expect(unnamed).toEqual([])
  })

  it('3. 이름은 한 곳에서 짓고, shell 말고는 지은 파일 안에서만 잰다', () => {
    const names = declarations.map((d) => d.container)
    expect(new Set(names).size).toBe(names.length)
    const owner = new Map(declarations.map((d) => [d.container, d.file]))
    const stray = queries
      .filter((q) => !owner.has(q.container) || (q.container !== 'shell' && owner.get(q.container) !== q.file))
      .map((q) => `${q.file} @container ${q.container}`)
    expect(stray).toEqual([])
  })

  it('4. 질의 안의 규칙이 그릇을 지은 칸 자신을 고치지 않는다', () => {
    const owners = new Map(declarations.map((d) => [d.container, d]))
    const selfQueries = queries.flatMap((q) => {
      const owner = owners.get(q.container)
      if (!owner) return []
      // 지은 칸의 첫 조각(`.choice`) — 질의 안 선택자의 마지막 조각이 그 칸이면(뒤에 [ · : 만 붙은 것 포함) 자기 자신을 고친다
      const host = /^[^\s[:]+/.exec(owner.selector)?.[0] ?? owner.selector
      return q.selectors
        .filter((selector) => {
          const last = selector.split(/\s+|>|\+|~/).filter(Boolean).at(-1) ?? ''
          return last === host || last.startsWith(`${host}[`) || last.startsWith(`${host}:`)
        })
        .map((selector) => `${q.file} @container ${q.container} { ${selector} }`)
    })
    expect(selfQueries).toEqual([])
  })
})
