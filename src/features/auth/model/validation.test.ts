import { describe, expect, it } from 'vitest'

import { AUTH_MESSAGES, checkPasswordConfirm, fieldOfMessage } from './validation'

describe('checkPasswordConfirm — 가입의 비밀번호 확인 칸', () => {
  it('같으면 통과', () => {
    expect(checkPasswordConfirm('lost-and-found1', 'lost-and-found1')).toBeUndefined()
  })

  it('다르면 "서로 달라요" — 칸 이름(비밀번호)으로 시작한다', () => {
    const message = checkPasswordConfirm('lost-and-found1', 'lost-and-found2')
    expect(message).toBe(AUTH_MESSAGES.passwordConfirmMismatch)
    expect(message?.startsWith('비밀번호')).toBe(true)
  })

  it('비밀번호를 쳤는데 확인 칸이 비었으면 한 번 더 적어 달라고 한다', () => {
    expect(checkPasswordConfirm('lost-and-found1', '')).toBe(AUTH_MESSAGES.passwordConfirmRequired)
  })

  it('비밀번호 칸이 비었으면 따지지 않는다 — 그 칸 오류 하나로 충분하다', () => {
    expect(checkPasswordConfirm('', '')).toBeUndefined()
    expect(checkPasswordConfirm('', 'abc')).toBeUndefined()
  })

  it('공백도 비밀번호의 일부 — 자르지 않고 그대로 견준다', () => {
    expect(checkPasswordConfirm('pass word1', 'pass word1 ')).toBe(AUTH_MESSAGES.passwordConfirmMismatch)
  })

  it('대소문자를 가린다', () => {
    expect(checkPasswordConfirm('Password1', 'password1')).toBe(AUTH_MESSAGES.passwordConfirmMismatch)
  })

  it('프론트 문장은 해요체', () => {
    expect(AUTH_MESSAGES.passwordConfirmRequired).toMatch(/요$/)
    expect(AUTH_MESSAGES.passwordConfirmMismatch).toMatch(/요$/)
  })
})

describe('fieldOfMessage — 서버 문장은 확인 칸을 가리키지 않는다', () => {
  it('"비밀번호…"는 비밀번호 칸(확인 칸은 서버에 없다)', () => {
    expect(fieldOfMessage('비밀번호는 8자 이상 20자 이하여야 합니다')).toBe('password')
  })
})
