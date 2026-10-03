import { NICKNAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/features/members'

import { EMAIL_MAX_LENGTH } from '../api/types'

/**
 * 로그인 · 가입 입력 검사 — 보내기 전 검사 문장은 프론트가 짓는 문장이라 **해요체**다(2026-10-03 회의 RV-7 · ⑦).
 * 서버(`LoginRequest` · `SignupRequest`)가 같은 이유로 막으면 서버 문장(합니다체)이 그대로 온다 — 바꾸려면 백엔드 `ErrorCode`.
 * 첫 낱말은 칸 이름("이메일 · 비밀번호 · 닉네임")으로 시작한다 — 서버 문장을 칸에 붙이는 `fieldOfMessage` 와 같은 규칙.
 * 보내기 전에 화면이 먼저 막을 뿐, 판정은 서버가 한다 — 통과해도 `INVALID_INPUT` 이 올 수 있다.
 */
export const AUTH_MESSAGES = {
  emailRequired: '이메일을 적어 주세요',
  emailFormat: '이메일 형식이 맞지 않아요. 예: name@example.com',
  emailLength: '이메일은 100자까지 쓸 수 있어요',
  passwordRequired: '비밀번호를 적어 주세요',
  passwordLength: '비밀번호는 8~20자로 적어 주세요',
  nicknameRequired: '닉네임을 적어 주세요',
  nicknameLength: '닉네임은 20자까지 쓸 수 있어요',
} as const

/**
 * `이름@도메인.끝` — 점 없는 도메인(`a@gmail`)도 여기서 막는다.
 * 서버 `@Email` 은 점 없는 도메인을 받아 주지만, 사람이 쓰는 주소에 그런 건 없고 대개 `.com` 을 빠뜨린 오타다.
 * 가입한 뒤에야 틀린 줄 알면 그 계정으로 다시 로그인할 수 없다.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export function checkEmail(value: string, { signup = false } = {}): string | undefined {
  const email = value.trim()
  if (!email) return AUTH_MESSAGES.emailRequired
  if (!EMAIL_PATTERN.test(email)) return AUTH_MESSAGES.emailFormat
  if (signup && email.length > EMAIL_MAX_LENGTH) return AUTH_MESSAGES.emailLength
  return undefined
}

/** 로그인은 비었는지만 본다(서버도 길이 규칙을 두지 않는다). 가입은 8~20자. 공백도 비밀번호의 일부라 자르지 않는다 */
export function checkPassword(value: string, { signup = false } = {}): string | undefined {
  if (!value.trim()) return AUTH_MESSAGES.passwordRequired
  if (signup && (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH)) {
    return AUTH_MESSAGES.passwordLength
  }
  return undefined
}

/** 앞뒤 공백을 잘라 낸 값으로 본다(보낼 때도 자른다) */
export function checkNickname(value: string): string | undefined {
  const nickname = value.trim()
  if (!nickname) return AUTH_MESSAGES.nicknameRequired
  if (nickname.length > NICKNAME_MAX_LENGTH) return AUTH_MESSAGES.nicknameLength
  return undefined
}

export type AuthField = 'email' | 'password' | 'nickname'

/**
 * 400 `INVALID_INPUT` 이 어느 칸의 문제인지. 서버는 첫 번째 필드 오류의 문구만 준다(`GlobalExceptionHandler`) —
 * 문구가 필드 이름으로 시작하니 그것으로 가른다. 모르면 `null`(폼 위 한 줄)
 */
export function fieldOfMessage(message: string): AuthField | null {
  if (message.startsWith('이메일')) return 'email'
  if (message.startsWith('비밀번호')) return 'password'
  if (message.startsWith('닉네임')) return 'nickname'
  return null
}
