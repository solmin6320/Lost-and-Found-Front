import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { FormAlert } from '@/shared/ui/FormAlert'
import { LockSimple } from '@/shared/ui/icons'
import { TextField } from '@/shared/ui/TextField'

import { EMAIL_MAX_LENGTH } from '../api/types'
import { useLogin } from '../model/useLogin'
import { checkEmail, checkPassword, fieldOfMessage } from '../model/validation'
import styles from './AuthForm.module.css'
import { PasswordInput } from './PasswordChangeForm'

interface LoginFormProps {
  /** 이메일 칸을 미리 채운다(가입 직후 로그인 화면으로 넘어왔을 때) */
  initialEmail?: string
  /** 잠금 안내 안의 나가는 길 — "로그인 없이 목록 보기" 링크. 경로는 부른 쪽이 정한다 */
  lockedExit?: ReactNode
}

interface Errors {
  email?: string
  password?: string
  /** 어느 칸의 문제인지 모를 때(자격 증명 불일치 · 네트워크) — 폼 맨 위 한 줄 */
  form?: string
}

/** 423 — 서버가 잠근 이메일과 그 문장. 잠금은 이메일 단위라 다른 이메일로 바꾸면 풀린다 */
interface Lock {
  email: string
  message: string
}

/**
 * [3.2] 로그인 폼 — 이메일 · 비밀번호(보기/숨기기).
 *
 * 성공하면 로그인 상태가 바뀌고, 화면(LoginPage)이 그것을 보고 돌아갈 곳으로 보낸다. 여기서는 이동하지 않는다.
 *   401 `INVALID_CREDENTIALS` 폼 위 한 줄. 입력은 지우지 않고, 비밀번호 칸으로 가서 전체 선택(바로 다시 친다)
 *   423 `ACCOUNT_LOCKED`      폼 위 잠금 안내 + 비밀번호 · 로그인 버튼 잠금. 남은 시간은 세지 않는다(서버가 주지 않는다)
 *   400 `INVALID_INPUT`       문구가 가리키는 칸 아래
 * 로그인의 401 은 재발급을 타지 않는다(`authApi.login` 이 `skipAuth`).
 */
export function LoginForm({ initialEmail = '', lockedExit }: LoginFormProps) {
  const mutation = useLogin()
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [lock, setLock] = useState<Lock | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const lockId = useId()

  // 방금 나타난 안내(잠금 · 폼 오류)로 포커스를 옮긴다. 그리기 전에는 옮길 요소가 없다
  const focusAfterRender = useRef<(() => void) | null>(null)
  useEffect(() => {
    focusAfterRender.current?.()
    focusAfterRender.current = null
  })

  const locked = lock !== null && lock.email === email.trim()
  // 성공한 뒤에도 잠가 둔다 — 화면이 넘어가기 전 한 번 더 눌리지 않게
  const busy = mutation.isPending || mutation.isSuccess

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || locked) return

    const found: Errors = { email: checkEmail(email), password: checkPassword(password) }
    if (found.email || found.password) {
      setErrors(found)
      const firstInvalid = found.email ? emailRef : passwordRef
      firstInvalid.current?.focus()
      return
    }

    setErrors({})
    const credentials = { email: email.trim(), password }
    mutation.mutate(credentials, {
      onError: (failure) => {
        const message = getErrorMessage(failure)

        if (hasErrorCode(failure, 'ACCOUNT_LOCKED')) {
          setLock({ email: credentials.email, message })
          focusAfterRender.current = () => alertRef.current?.focus()
          return
        }
        if (hasErrorCode(failure, 'INVALID_CREDENTIALS')) {
          setErrors({ form: message })
          passwordRef.current?.focus()
          passwordRef.current?.select()
          return
        }
        const field = hasErrorCode(failure, 'INVALID_INPUT') ? fieldOfMessage(message) : null
        if (field === 'email' || field === 'password') {
          setErrors({ [field]: message })
          const target = field === 'email' ? emailRef : passwordRef
          target.current?.focus()
          return
        }
        setErrors({ form: message })
        focusAfterRender.current = () => alertRef.current?.focus()
      },
    })
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate aria-label="이메일로 로그인">
      {locked ? (
        <div id={lockId} ref={alertRef} className={styles.lock} role="alert" tabIndex={-1}>
          <LockSimple className={styles.lockIcon} />
          <div className={styles.lockBody}>
            <p className={styles.lockMessage}>{lock.message}</p>
            <p className={styles.lockHint}>다른 계정은 이메일을 바꿔 로그인할 수 있어요.</p>
            {lockedExit}
          </div>
        </div>
      ) : errors.form ? (
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
        value={email}
        readOnly={busy}
        error={errors.email}
        onChange={(event) => {
          setEmail(event.target.value)
          if (errors.email || errors.form) setErrors((prev) => ({ ...prev, email: undefined, form: undefined }))
        }}
        // 벗어날 때 검사한다. 비어 있으면 탭으로 지나가는 중일 수 있어 제출 때까지 기다린다
        onBlur={(event) => {
          const value = event.currentTarget.value
          if (value.trim()) setErrors((prev) => ({ ...prev, email: checkEmail(value) }))
        }}
      />

      <PasswordInput
        ref={passwordRef}
        label="비밀번호"
        name="password"
        autoComplete="current-password"
        value={password}
        readOnly={busy}
        disabled={locked}
        error={errors.password}
        onChange={(value) => {
          setPassword(value)
          if (errors.password || errors.form) setErrors((prev) => ({ ...prev, password: undefined, form: undefined }))
        }}
      />

      {/* 잠그지 않고 누름만 무시한다(disabled 는 누르던 버튼에서 포커스를 뺀다). 잠김은 흐리게, 확인 중은 글자로 알린다 */}
      <Button
        type="submit"
        variant="primary"
        block
        className={styles.submit}
        unavailable={locked}
        aria-disabled={busy || undefined}
        aria-describedby={locked ? lockId : undefined}
      >
        {busy ? '확인 중…' : '로그인'}
      </Button>
    </form>
  )
}
