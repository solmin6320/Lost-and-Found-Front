import { readFileSync, readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { DEFAULT_IMAGE_ORIGINS } from '../build/csp.ts'

/**
 * 워크플로의 고정 사항(docs/배포.md 9장 · 보안명세서 9.1). YAML 파서를 의존성으로 들이지 않고 줄 단위로 본다 —
 * 사람이 고치는 짧은 파일이고, 여기서 보는 것은 모양이 정해진 몇 줄뿐이다.
 */
const workflowsDir = new URL('../.github/workflows/', import.meta.url)
const readWorkflow = (name: string) => readFileSync(new URL(name, workflowsDir), 'utf8').replace(/\r\n/g, '\n')
const workflowFiles = readdirSync(workflowsDir).filter((name) => /\.ya?ml$/.test(name))
const deploy = readWorkflow('deploy.yml')

/** 들여쓰기 `indent` 칸의 `head` 한 줄(`deploy:` · `if: >-`)부터, 같거나 얕은 들여쓰기의 다음 줄 앞까지 */
function block(text: string, head: string, indent: number): string {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line === `${' '.repeat(indent)}${head}`)
  if (start < 0) throw new Error(`${head} 를 찾지 못했습니다`)
  const end = lines.findIndex((line, i) => i > start && line.trim() !== '' && line.search(/\S/) <= indent)
  return lines.slice(start, end < 0 ? undefined : end).join('\n')
}

/** `run:` 의 셸 본문(한 줄 · `|` 블록 모두). 같은 단계의 `env:` 는 들어가지 않는다 */
function runScripts(text: string): string[] {
  const lines = text.split('\n')
  const scripts: string[] = []
  lines.forEach((line, i) => {
    const match = /^\s*(?:-\s+)?run:\s*(.*)$/.exec(line)
    if (!match) return
    const keyIndent = line.indexOf('run:')
    const body = [match[1]]
    for (const next of lines.slice(i + 1)) {
      if (next.trim() !== '' && next.search(/\S/) <= keyIndent) break
      body.push(next)
    }
    scripts.push(body.join('\n'))
  })
  return scripts
}

const deployJob = block(deploy, 'deploy:', 2)
const mainOnlyJob = block(deploy, 'main-only:', 2)

describe('모든 워크플로 — 공급망', () => {
  it('워크플로 파일이 있다(deploy.yml 포함)', () => {
    expect(workflowFiles).toContain('deploy.yml')
  })

  it.each(workflowFiles)('%s — uses: 는 40자 커밋 SHA + # vX.Y.Z (태그는 옮길 수 있다)', (file) => {
    const uses = [...readWorkflow(file).matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/gm)]
    expect(uses.length).toBeGreaterThan(0)
    for (const [, ref, rest] of uses) {
      expect(ref).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/)
      expect(rest).toMatch(/^\s+# v\d+\.\d+\.\d+\s*$/)
    }
  })

  it.each(workflowFiles)('%s — checkout 은 모두 persist-credentials: false', (file) => {
    const text = readWorkflow(file)
    const checkouts = text.match(/uses:\s*actions\/checkout@/g) ?? []
    expect(text.match(/^\s+persist-credentials: false$/gm) ?? []).toHaveLength(checkouts.length)
  })

  it.each(workflowFiles)('%s — run: 본문에 ${{ }} 를 직접 끼우지 않는다(스크립트 주입 — env: 로 넘긴다)', (file) => {
    const scripts = runScripts(readWorkflow(file))
    for (const script of scripts) expect(script).not.toContain('${{')
  })
})

describe('deploy.yml — main 에서만 배포한다', () => {
  it('트리거는 CI 완료(workflow_run, branches 정확히 [main])와 수동 실행 둘뿐', () => {
    const on = block(deploy, 'on:', 0)
    const triggers = [...on.matchAll(/^ {2}([a-z_]+):/gm)].map(([, name]) => name)
    expect(triggers).toEqual(['workflow_run', 'workflow_dispatch'])

    const workflowRun = block(on, 'workflow_run:', 2)
    expect(workflowRun).toMatch(/^ {4}workflows: \[CI\]$/m)
    expect(workflowRun).toMatch(/^ {4}types: \[completed\]$/m)
    expect(workflowRun).toMatch(/^ {4}branches: \[main\]$/m)
  })

  it('작업 조건 — 자동은 main push · CI 성공 · 같은 리포, 수동은 refs/heads/main', () => {
    const condition = block(deployJob, 'if: >-', 4)
    expect(condition).toContain(`(github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main')`)
    for (const clause of [
      `github.event_name == 'workflow_run'`,
      `github.event.workflow_run.conclusion == 'success'`,
      `github.event.workflow_run.event == 'push'`,
      `github.event.workflow_run.head_branch == 'main'`,
      `github.event.workflow_run.head_repository.full_name == github.repository`,
    ]) {
      expect(condition).toContain(clause)
    }
  })

  it('다른 브랜치에서 수동 실행하면 main-only 가 이유를 남기고 실패한다', () => {
    expect(mainOnlyJob).toContain(`if: github.event_name == 'workflow_dispatch' && github.ref != 'refs/heads/main'`)
    expect(mainOnlyJob).toContain('::error::')
    expect(mainOnlyJob).toMatch(/^\s+exit 1$/m)
    expect(mainOnlyJob).not.toContain('permissions:')
    expect(mainOnlyJob).not.toContain('uses:')
  })

  it('CI 가 통과한 바로 그 커밋(workflow_run.head_sha)을 체크아웃한다', () => {
    expect(deployJob).toMatch(/^ {6}DEPLOY_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.sha \}\}$/m)
    expect(deployJob).toMatch(/^ {10}ref: \$\{\{ env\.DEPLOY_SHA \}\}$/m)
  })

  it('environment production — 문서의 IAM 신뢰 정책 sub 는 고정 ID 형식이고 같은 환경 이름이다', () => {
    const name = /^ {4}environment:\n {6}name: (\S+)$/m.exec(deployJob)?.[1]
    expect(name).toBe('production')
    const docs = readFileSync(new URL('../docs/배포.md', import.meta.url), 'utf8')
    // 이 리포는 GitHub OIDC 고정 ID 주체를 쓴다 — repo:<계정>@<번호>/<리포>@<번호>:… (2026-10-08 첫 배포에서 옛 모양이 거절됐다)
    const subLines = docs.match(/"token\.actions\.githubusercontent\.com:sub": "[^"]*"/g) ?? []
    expect(subLines).toEqual([
      `"token.actions.githubusercontent.com:sub": "repo:solmin6320@282091421/Lost-and-Found-Front@1380027425:environment:${name}"`,
    ])
    expect(subLines[0]).toMatch(/"repo:[\w.-]+@\d+\/[\w.-]+@\d+:environment:[\w.-]+"$/)
  })
})

describe('deploy.yml — 권한 · 동시 실행', () => {
  it('최상위 권한은 비어 있고 id-token: write 는 deploy 작업에만 한 번', () => {
    expect(deploy).toMatch(/^permissions: \{\}$/m)
    expect(deploy.match(/id-token: write/g) ?? []).toHaveLength(1)
    const permissions = block(deployJob, 'permissions:', 4)
    expect(permissions).toMatch(/^ {6}id-token: write\b/m)
    expect(permissions).toMatch(/^ {6}contents: read$/m)
  })

  it('배포 도중에 끊지 않는다(cancel-in-progress: false)', () => {
    const concurrency = block(deployJob, 'concurrency:', 4)
    expect(concurrency).toMatch(/^ {6}group: deploy-production$/m)
    expect(concurrency).toMatch(/^ {6}cancel-in-progress: false$/m)
  })

  it('액세스 키를 쓰지 않는다 — OIDC 역할만', () => {
    expect(deploy).not.toMatch(/aws-access-key-id|aws-secret-access-key|secrets\./)
    expect(deployJob).toMatch(/^ {10}role-to-assume: \$\{\{ vars\.AWS_DEPLOY_ROLE_ARN \}\}$/m)
  })
})

describe('deploy.yml — 빌드', () => {
  it('CSP_IMAGE_ORIGINS 가 build/csp.ts 의 기본 사진 출처와 같다 — 사진 도메인을 바꾸면 여기도', () => {
    expect(/^\s+CSP_IMAGE_ORIGINS: (\S+)$/m.exec(deploy)?.[1]).toBe(DEFAULT_IMAGE_ORIGINS.join(' '))
  })
})
