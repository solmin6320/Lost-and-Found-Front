import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AuthContext, type AuthContextValue } from '../model/AuthContext'
import { PasswordChangeForm } from './PasswordChangeForm'

/*
 * 설정 비밀번호 바꾸기 — "새 비밀번호 확인" 칸(본인 결정 2026-10-14, QA-P-3). 판정은 가입과 같은 `checkPasswordConfirm`
 * (validation.test.ts). 다르면 요청이 나가지 않고 확인 칸으로 포커스가 가는 것은 브라우저에서 잰다(round6 qa6p)
 */
function render(): string {
  const auth = { updatePassword: async () => {} } as unknown as AuthContextValue
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={auth}>
        <PasswordChangeForm email="me@example.com" onChanged={() => {}} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('PasswordChangeForm — 새 비밀번호 확인 칸', () => {
  it('현재 · 새 · 새 비밀번호 확인 순서', () => {
    const labels = [...render().matchAll(/<label[^>]*>([^<]+)<\/label>/g)].map((match) => match[1])
    expect(labels).toEqual(['현재 비밀번호', '새 비밀번호', '새 비밀번호 확인'])
  })

  it('가입과 같은 모양 — 가린 칸 · 새 비밀번호 자동 완성 · 보기 버튼 · maxLength 없음', () => {
    const html = render()
    const confirm = /<input[^>]*name="new-password-confirm"[^>]*>/.exec(html)?.[0] ?? ''
    expect(confirm).toContain('type="password"')
    expect(confirm).toContain('autoComplete="new-password"')
    expect(confirm).not.toContain('maxLength')
    expect(html).toContain('aria-label="새 비밀번호 확인 보기"')
  })
})
