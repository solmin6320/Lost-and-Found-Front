import { describe, expect, it } from 'vitest'

/*
 * 관리자 화면의 색 규칙이 다시 깨지지 않게(화면정의서 1.2 · 6장 "모든 새 요소 공통").
 *   - 새 색을 만들지 않는다 — 컴포넌트 CSS 에 16진 색 0개, 의미 토큰만
 *   - 빨강은 오류 · 되돌릴 수 없는 삭제 전용 — 매니저 해임은 다시 임명할 수 있어 빨강이 아니다(버튼 · 확인 버튼 · 이름표 모두)
 *   - 분실 · 습득 두 색은 글의 개념에만 — 역할 이름표 · 탭에 쓰지 않는다
 *
 * vitest 는 CSS 를 비워서 들여오므로 노드 fs 로 원본을 읽는다(tokens.test.ts 와 같은 방법)
 */
const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
  readdirSync: (path: URL) => string[]
}

const roots = [new URL('./', import.meta.url), new URL('../../../pages/admin/', import.meta.url)]
const files = roots.flatMap((root) =>
  fs
    .readdirSync(root)
    .filter((name) => /\.(css|tsx)$/.test(name) && !name.includes('.test.'))
    .map((name) => ({ name, text: fs.readFileSync(new URL(name, root), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') })),
)

describe('관리자 화면 — 색 규칙', () => {
  it('파일을 읽었다', () => {
    expect(files.map((file) => file.name)).toEqual(
      expect.arrayContaining(['AdminMemberList.module.css', 'RoleBadge.module.css', 'Admin.module.css', 'ManagersPage.tsx']),
    )
  })

  it.each(files.filter((file) => file.name.endsWith('.css')).map((file) => [file.name, file.text]))(
    '%s : 16진 색 · 빨강 토큰 · 분실 · 습득 토큰을 쓰지 않는다',
    (_, css) => {
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(css).not.toMatch(/--(danger|error)/)
      expect(css).not.toMatch(/--(lost|found)-/)
    },
  )

  it('임명 · 해임 · 확인 버튼에 빨간 변형(danger · dangerQuiet)을 쓰지 않는다', () => {
    for (const file of files.filter((f) => f.name.endsWith('.tsx'))) {
      expect(file.text, file.name).not.toMatch(/variant="danger|tone="danger/)
    }
    const dialog = files.find((file) => file.name === 'ManagerChangeDialog.tsx')
    expect(dialog?.text).toContain('tone="primary"')
  })
})
