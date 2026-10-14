import { useEffect, useRef, useState, type FormEvent } from 'react'

import { NICKNAME_MAX_LENGTH } from '@/features/members'
import { useDirtyField, type LeaveCopy } from '@/shared/lib/dirtyRegistry'
import { getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { FormAlert } from '@/shared/ui/FormAlert'
import { TextField } from '@/shared/ui/TextField'

import { EMAIL_MAX_LENGTH } from '../api/types'
import type { useSignup } from '../model/useSignup'
import {
  checkEmail,
  checkNickname,
  checkPassword,
  checkPasswordConfirm,
  fieldOfMessage,
  type SignupField,
} from '../model/validation'
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

type Errors = Partial<Record<SignupField | 'form', string>>

/** 쓴 것이 있는데 떠나려 할 때(헤더 · 로고 · 뒤로가기 · 로그인으로 건너가기 · 새로고침). "글"이 아니라 가입 칸이다 */
const SIGNUP_LEAVE_COPY: LeaveCopy = {
  title: '가입을 그만두고 나갈까요?',
  body: '나가면 입력한 내용은 저장되지 않아요.',
}

/**
 * [3.1] 회원가입 폼 — 이메일 · 비밀번호(8~20자, 보기/숨기기) · 비밀번호 확인(보기/숨기기) · 닉네임(20자, 글자 수).
 * 비밀번호 확인 칸은 본인 피드백(2026-10-14)으로 더했다 — 같은 값을 한 번 더 쳐서 오타 난 비밀번호로 가입하지 않게 한다.
 * 서버로는 보내지 않는다(백엔드 `SignupRequest` 는 그대로). 다르면 그 칸 아래 오류, 같아야 보낸다(화면정의서 SCR-06).
 *
 * 칸을 벗어날 때 검사하고 오류는 그 칸 아래에 둔다. 제출이 실패하면 첫 번째로 틀린 칸으로 간다.
 *   409 `DUPLICATE_EMAIL` → 이메일 아래 · 409 `DUPLICATE_NICKNAME` → 닉네임 아래 · 400 → 문구가 가리키는 칸 아래
 * 중복은 보내 봐야 안다(실시간 중복 확인 엔드포인트가 없다).
 *
 * 칸에 글자가 있으면 쓰던 칸 등록부에 알린다(QA P-5) — 떠나기 전에 한 번 묻는다(설정의 비밀번호 칸과 같다, 글자는 넣지 않는다).
 * 보내는 중 · 성공한 뒤에는 알리지 않는다 — 가입이 끝나 화면이 스스로 떠나는 이동을 막지 않고, 이미 서버에 닿은 가입을
 * "저장되지 않아요"라고 말하지 않는다. 실패하면 다시 알린다
 */
export function SignupForm({ signup, onSignedUpWithoutLogin }: SignupFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  /** 칸을 벗어나며 생긴 오류만 바로 읽어 준다. 제출 때 한꺼번에 붙은 것은 포커스가 간 첫 칸이 읽는다(회의 UI2-9) */
  const [liveField, setLiveField] = useState<SignupField | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const passwordConfirmRef = useRef<HTMLInputElement>(null)
  const nicknameRef = useRef<HTMLInputElement>(null)
  // 제출이 막혀 첫 칸으로 포커스를 옮기는 동안 생기는 blur 는 "칸을 벗어난 것"이 아니다 — 그 칸 오류를 따로 읽어 주지 않는다
  // (iOS 처럼 버튼이 포커스를 받지 않거나 Enter 로 제출하면, 쓰던 칸의 blur 가 제출 뒤에 온다)
  const movingFocus = useRef(false)
  const focusField = (field: SignupField) => {
    const refs = { email: emailRef, password: passwordRef, passwordConfirm: passwordConfirmRef, nickname: nicknameRef }
    movingFocus.current = true
    try {
      refs[field].current?.focus()
    } finally {
      movingFocus.current = false
    }
  }
  const alertRef = useRef<HTMLDivElement>(null)

  const focusAfterRender = useRef<(() => void) | null>(null)
  useEffect(() => {
    focusAfterRender.current?.()
    focusAfterRender.current = null
  })

  // 성공한 뒤에도 잠가 둔다 — 화면이 넘어가기 전 한 번 더 눌려 DUPLICATE_EMAIL 을 받지 않게
  const busy = signup.isPending || signup.isSuccess
  useDirtyField(
    !busy && (email.length > 0 || password.length > 0 || passwordConfirm.length > 0 || nickname.length > 0),
    SIGNUP_LEAVE_COPY,
  )

  function clear(field: SignupField) {
    if (errors[field] || errors.form) setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const found: Errors = {
      email: checkEmail(email, { signup: true }),
      password: checkPassword(password, { signup: true }),
      passwordConfirm: checkPasswordConfirm(password, passwordConfirm),
      nickname: checkNickname(nickname),
    }
    const firstInvalid = (['email', 'password', 'passwordConfirm', 'nickname'] as const).find((field) => found[field])
    setLiveField(null)
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
        hint="로그인할 때 써요. 다른 사람에게는 보이지 않아요."
        value={email}
        readOnly={busy}
        error={errors.email}
        announceError={liveField === 'email'}
        onChange={(event) => {
          setEmail(event.target.value)
          clear('email')
        }}
        onBlur={(event) => {
          const value = event.currentTarget.value
          if (!value.trim()) return
          const message = checkEmail(value, { signup: true })
          setErrors((prev) => ({ ...prev, email: message }))
          if (message && !movingFocus.current) setLiveField('email')
        }}
      />

      {/* maxLength 를 두지 않는다 — 붙여 넣은 긴 비밀번호가 조용히 잘리면 가입한 비밀번호를 본인도 모른다. 넘치면 알린다 */}
      <PasswordInput
        ref={passwordRef}
        label="비밀번호"
        name="new-password"
        autoComplete="new-password"
        // 오류가 떠 있는 동안 도움말은 칸이 알아서 거둔다(TextField)
        hint="8~20자"
        value={password}
        readOnly={busy}
        error={errors.password}
        announceError={liveField === 'password'}
        onChange={(value) => {
          setPassword(value)
          clear('password')
        }}
        onBlur={(value) => {
          if (!value) return
          const message = checkPassword(value, { signup: true })
          // 확인 칸을 이미 채웠으면 함께 다시 견준다 — 위 칸을 고쳐 같아졌으면 확인 칸 오류도 걷힌다.
          // 새로 생긴 확인 칸 오류는 읽어 주지 않는다(벗어난 칸은 비밀번호다 — 알림은 한 번만)
          const confirmMessage = passwordConfirm ? checkPasswordConfirm(value, passwordConfirm) : undefined
          setErrors((prev) => ({ ...prev, password: message, passwordConfirm: confirmMessage }))
          if (message && !movingFocus.current) setLiveField('password')
        }}
      />

      {/* 위 칸과 같은 모양(보기 버튼 · maxLength 없음). 비밀번호 관리자가 새 비밀번호를 두 칸에 함께 채운다 */}
      <PasswordInput
        ref={passwordConfirmRef}
        label="비밀번호 확인"
        name="new-password-confirm"
        autoComplete="new-password"
        value={passwordConfirm}
        readOnly={busy}
        error={errors.passwordConfirm}
        announceError={liveField === 'passwordConfirm'}
        onChange={(value) => {
          setPasswordConfirm(value)
          clear('passwordConfirm')
        }}
        onBlur={(value) => {
          if (!value) return
          const message = checkPasswordConfirm(password, value)
          setErrors((prev) => ({ ...prev, passwordConfirm: message }))
          if (message && !movingFocus.current) setLiveField('passwordConfirm')
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
        announceError={liveField === 'nickname'}
        onChange={(event) => {
          setNickname(event.target.value)
          clear('nickname')
        }}
        onBlur={(event) => {
          const value = event.currentTarget.value
          if (!value) return
          const message = checkNickname(value)
          setErrors((prev) => ({ ...prev, nickname: message }))
          if (message && !movingFocus.current) setLiveField('nickname')
        }}
      />

      {/* 잠그지 않고 누름만 무시한다 — 누르던 버튼에서 포커스가 빠지지 않게 */}
      <Button type="submit" variant="primary" block className={styles.submit} aria-disabled={busy || undefined}>
        {busy ? '가입하는 중…' : '가입하기'}
      </Button>
    </form>
  )
}
