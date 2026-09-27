import { useEffect, useRef, useState, type FormEvent } from 'react'

import { NICKNAME_MAX_LENGTH } from '@/features/members'
import { getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { FormAlert } from '@/shared/ui/FormAlert'
import { TextField } from '@/shared/ui/TextField'

import { EMAIL_MAX_LENGTH } from '../api/types'
import type { useSignup } from '../model/useSignup'
import { checkEmail, checkNickname, checkPassword, fieldOfMessage, type AuthField } from '../model/validation'
import styles from './AuthForm.module.css'
import { PasswordInput } from './PasswordChangeForm'

interface SignupFormProps {
  /**
   * `useSignup()` — 화면(SignupPage)이 가진다. 가입 직후 로그인 상태가 바뀌는 순간
   * "막 가입한 것"인지 "원래 로그인돼 있던 것"인지를 화면이 이 상태로 가른다
   */
  signup: ReturnType<typeof useSignup>
  /** 가입은 됐는데 이어진 로그인만 실패했다. 로그인 화면으로 보내는 일은 부른 쪽이 한다 */
  onSignedUpWithoutLogin: (email: string) => void
}

type Errors = Partial<Record<AuthField | 'form', string>>

/**
 * [3.1] 회원가입 폼 — 이메일 · 비밀번호(8~20자, 보기/숨기기) · 닉네임(20자, 글자 수). 세 칸뿐이다.
 * 비밀번호 확인 칸은 두지 않는다 — 보기 버튼이 같은 일을 하고, 필수 입력을 늘리지 않는다(화면정의서 SCR-06).
 *
 * 칸을 벗어날 때 검사하고 오류는 그 칸 아래에 둔다. 제출이 실패하면 첫 번째로 틀린 칸으로 간다.
 *   409 `DUPLICATE_EMAIL` → 이메일 아래 · 409 `DUPLICATE_NICKNAME` → 닉네임 아래 · 400 → 문구가 가리키는 칸 아래
 * 중복은 보내 봐야 안다(실시간 중복 확인 엔드포인트가 없다).
 */
export function SignupForm({ signup, onSignedUpWithoutLogin }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const nicknameRef = useRef<HTMLInputElement>(null)
  const focusField = (field: AuthField) =>
    ({ email: emailRef, password: passwordRef, nickname: nicknameRef })[field].current?.focus()
  const alertRef = useRef<HTMLDivElement>(null)

  const focusAfterRender = useRef<(() => void) | null>(null)
  useEffect(() => {
    focusAfterRender.current?.()
    focusAfterRender.current = null
  })

  // 성공한 뒤에도 잠가 둔다 — 화면이 넘어가기 전 한 번 더 눌려 DUPLICATE_EMAIL 을 받지 않게
  const busy = signup.isPending || signup.isSuccess

  function clear(field: AuthField) {
    if (errors[field] || errors.form) setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const found: Errors = {
      email: checkEmail(email, { signup: true }),
      password: checkPassword(password, { signup: true }),
      nickname: checkNickname(nickname),
    }
    const firstInvalid = (['email', 'password', 'nickname'] as const).find((field) => found[field])
    if (firstInvalid) {
      setErrors(found)
      focusField(firstInvalid)
      return
    }

    setErrors({})
    const body = { email: email.trim(), password, nickname: nickname.trim() }
    signup.mutate(body, {
      onSuccess: (result) => {
        if (!result.signedIn) onSignedUpWithoutLogin(body.email)
      },
      onError: (failure) => {
        const message = getErrorMessage(failure)
        const field = hasErrorCode(failure, 'DUPLICATE_EMAIL')
          ? 'email'
          : hasErrorCode(failure, 'DUPLICATE_NICKNAME')
            ? 'nickname'
            : hasErrorCode(failure, 'INVALID_INPUT')
              ? fieldOfMessage(message)
              : null

        if (field) {
          setErrors({ [field]: message })
          focusField(field)
          return
        }
        setErrors({ form: message })
        focusAfterRender.current = () => alertRef.current?.focus()
      },
    })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-label="이메일로 가입">
      {errors.form ? (
        <FormAlert ref={alertRef} message={errors.form} />
      ) : null}

      <TextField
        ref={emailRef}
        label="이메일"
        type="email"
        inputMode="email"
        name="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        maxLength={EMAIL_MAX_LENGTH}
        hint="로그인할 때 씁니다. 다른 사람에게는 보이지 않아요."
        value={email}
        readOnly={busy}
        error={errors.email}
        onChange={(event) => {
          setEmail(event.target.value)
          clear('email')
        }}
        onBlur={(event) => {
          const value = event.currentTarget.value
          if (value.trim()) setErrors((prev) => ({ ...prev, email: checkEmail(value, { signup: true }) }))
        }}
      />

      {/* maxLength 를 두지 않는다 — 붙여 넣은 긴 비밀번호가 조용히 잘리면 가입한 비밀번호를 본인도 모른다. 넘치면 알린다 */}
      <PasswordInput
        ref={passwordRef}
        label="비밀번호"
        name="new-password"
        autoComplete="new-password"
        // 오류 문장이 같은 규칙을 말할 때는 도움말을 거둔다(같은 말 두 번)
        hint={errors.password ? undefined : '8~20자'}
        value={password}
        readOnly={busy}
        error={errors.password}
        onChange={(value) => {
          setPassword(value)
          clear('password')
        }}
        onBlur={(value) => {
          if (value) setErrors((prev) => ({ ...prev, password: checkPassword(value, { signup: true }) }))
        }}
      />

      <TextField
        ref={nicknameRef}
        label="닉네임"
        name="nickname"
        autoComplete="nickname"
        enterKeyHint="done"
        maxLength={NICKNAME_MAX_LENGTH}
        count={{ value: nickname.length, max: NICKNAME_MAX_LENGTH }}
        hint="글과 댓글에 이 이름이 보여요. 가입한 뒤 설정에서 바꿀 수 있어요."
        value={nickname}
        readOnly={busy}
        error={errors.nickname}
        onChange={(event) => {
          setNickname(event.target.value)
          clear('nickname')
        }}
        onBlur={(event) => {
          const value = event.currentTarget.value
          if (value) setErrors((prev) => ({ ...prev, nickname: checkNickname(value) }))
        }}
      />

      {/* 잠그지 않고 누름만 무시한다 — 누르던 버튼에서 포커스가 빠지지 않게 */}
      <Button type="submit" variant="primary" block className={styles.submit} aria-disabled={busy || undefined}>
        {busy ? '가입하는 중…' : '가입하기'}
      </Button>
    </form>
  )
}
