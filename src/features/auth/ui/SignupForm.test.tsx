import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { useSignup } from '../model/useSignup'
import { SignupForm } from './SignupForm'

/*
 * 가입 폼 — 비밀번호 확인 칸(본인 피드백 2026-10-14). 칸을 벗어날 때 · 제출 때의 판정은 `checkPasswordConfirm`(validation.test.ts),
 * 실제 누름 · 입력은 브라우저에서 잰다. 여기서는 칸의 자리와 속성을 본다
 */
const signup = { isPending: false, isSuccess: false, mutate: () => {} } as unknown as ReturnType<typeof useSignup>

function render(): string {
  return renderToStaticMarkup(<SignupForm signup={signup} onSignedUpWithoutLogin={() => {}} />)
}

describe('SignupForm — 비밀번호 확인 칸', () => {
  it('비밀번호 바로 아래, 닉네임 위에 "비밀번호 확인" 칸이 있다', () => {
    const html = render()
    const labels = [...html.matchAll(/<label[^>]*>([^<]+)<\/label>/g)].map((match) => match[1])
    expect(labels).toEqual(['이메일', '비밀번호', '비밀번호 확인', '닉네임'])
  })

  it('비밀번호 칸과 같은 모양 — 가린 칸 · 새 비밀번호 자동 완성 · 보기 버튼', () => {
    const html = render()
    const confirm = /<input[^>]*name="new-password-confirm"[^>]*>/.exec(html)?.[0] ?? ''
    expect(confirm).toContain('type="password"')
    expect(confirm).toContain('autoComplete="new-password"')
    expect(confirm).not.toContain('maxLength')
    expect(html).toContain('aria-label="비밀번호 확인 보기"')
  })
})
