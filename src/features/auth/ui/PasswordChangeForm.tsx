import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/features/members'
import { useDirtyField } from '@/shared/lib/dirtyRegistry'
import { getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { FormAlert } from '@/shared/ui/FormAlert'
import { Eye, EyeSlash } from '@/shared/ui/icons'
import { TextField } from '@/shared/ui/TextField'

import { useUpdatePassword } from '../model/useUpdatePassword'
import styles from './PasswordChangeForm.module.css'

/** 결과 고지 — 누르기 전에, 한 번(화면정의서 1.6). [바꾸기] 바로 위에 상시, 버튼의 설명으로도 읽힌다 */
const LOGOUT_NOTICE = '비밀번호를 바꾸면 이 기기를 포함해 로그인된 모든 기기에서 로그아웃돼요.'

/**
 * 보내기 전 검사 문장 — 프론트가 짓는 문장이라 해요체(회의 RV-7). 서버가 같은 이유로 막으면 서버 문장(합니다체)이 그대로 온다.
 * 첫 낱말은 칸 이름으로 시작한다
 */
const MESSAGES = {
  currentRequired: '현재 비밀번호를 적어 주세요',
  nextRequired: '새 비밀번호를 적어 주세요',
  nextLength: '새 비밀번호는 8~20자로 적어 주세요',
} as const

interface PasswordChangeFormProps {
  /** 비밀번호 관리자가 어느 계정의 비밀번호인지 알도록 숨긴 아이디 칸에 넣는다 */
  email: string
  /** 성공 — 이 기기의 세션은 이미 끝났다. 로그인 화면으로 보내는 일은 부른 쪽이 한다 */
  onChanged: () => void
}

interface Errors {
  current?: string
  next?: string
  /** 어느 입력의 문제인지 모를 때(네트워크 · 서버 오류) — [바꾸기] 위 한 줄 */
  form?: string
}

function checkNext(value: string): string | undefined {
  if (!value) return MESSAGES.nextRequired
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) return MESSAGES.nextLength
  return undefined
}

/**
 * [3.6] 비밀번호 바꾸기 — 현재 · 새(8~20자) 두 칸, 각각 보기/숨기기.
 * 400 `PASSWORD_MISMATCH` 는 현재 비밀번호 아래에 붙인다. 401 이 아니라 로그아웃도 재발급도 일어나지 않는다.
 * 비밀번호는 앞뒤 공백을 자르지 않는다 — 공백도 비밀번호의 일부일 수 있다.
 */
export function PasswordChangeForm({ email, onChanged }: PasswordChangeFormProps) {
  const mutation = useUpdatePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const currentRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLInputElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const noticeId = useId()
  /** 칸을 벗어나며 생긴 오류만 바로 읽어 준다. 제출 때 한꺼번에 붙은 것은 포커스가 간 칸이 읽는다(회의 UI2-9) */
  const [liveNext, setLiveNext] = useState(false)
  // 제출이 막혀 첫 칸으로 포커스를 옮기는 동안 생기는 blur 는 "칸을 벗어난 것"이 아니다 — 그 칸 오류를 따로 읽어 주지 않는다
  // (iOS 처럼 버튼이 포커스를 받지 않거나 Enter 로 제출하면, 쓰던 칸의 blur 가 제출 뒤에 온다)
  const movingFocus = useRef(false)

  // 비밀번호 칸 중 하나라도 글자가 있으면 쓰던 중이다 — 떠나거나 로그아웃할 때 묻는다(회의 AR2-3).
  // 글자는 등록부에 넣지 않는다(있다/없다만)
  useDirtyField(current.length > 0 || next.length > 0)

  // 방금 나타난 폼 오류로 포커스를 옮긴다. 그리기 전에는 옮길 요소가 없다
  const focusAfterRender = useRef<(() => void) | null>(null)
  useEffect(() => {
    focusAfterRender.current?.()
    focusAfterRender.current = null
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return

    const found: Errors = {
      current: current ? undefined : MESSAGES.currentRequired,
      next: checkNext(next),
    }
    if (found.current || found.next) {
      setErrors(found)
      setLiveNext(false)
      const firstInvalid = found.current ? currentRef : nextRef
      movingFocus.current = true
      firstInvalid.current?.focus()
      movingFocus.current = false
      return
    }

    setErrors({})
    mutation.mutate(
      { currentPassword: current, password: next },
      {
        onSuccess: onChanged,
        onError: (failure) => {
          if (hasErrorCode(failure, 'PASSWORD_MISMATCH')) {
            setErrors({ current: getErrorMessage(failure) })
            currentRef.current?.focus()
          } else {
            // 어느 칸의 문제인지 모른다(연결 실패 · 서버 오류). [바꾸기] 위의 한 줄부터 읽게 한다
            setErrors({ form: getErrorMessage(failure) })
            focusAfterRender.current = () => alertRef.current?.focus()
          }
        },
      },
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* 비밀번호 관리자가 계정을 알아보게 하는 아이디 칸. 화면 · 탭 순서에는 나오지 않는다 */}
      <input
        className="sr-only"
        type="text"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />

      <PasswordInput
        ref={currentRef}
        label="현재 비밀번호"
        name="current-password"
        autoComplete="current-password"
        value={current}
        readOnly={mutation.isPending}
        error={errors.current}
        announceError={false}
        onChange={(value) => {
          setCurrent(value)
          if (errors.current || errors.form) setErrors((prev) => ({ ...prev, current: undefined, form: undefined }))
        }}
      />

      <PasswordInput
        ref={nextRef}
        label="새 비밀번호"
        name="new-password"
        autoComplete="new-password"
        value={next}
        // maxLength 를 두지 않는다(가입 폼과 같다) — 붙여 넣은 긴 비밀번호가 조용히 잘리면 바꾼 비밀번호를 본인도 모른다.
        // 넘치면 벗어날 때 알린다. 오류 문장이 같은 규칙을 말할 때는 도움말을 거둔다
        hint={errors.next ? undefined : '8~20자'}
        readOnly={mutation.isPending}
        error={errors.next}
        announceError={liveNext}
        onChange={(value) => {
          setNext(value)
          if (errors.next || errors.form) setErrors((prev) => ({ ...prev, next: undefined, form: undefined }))
        }}
        // 벗어날 때 검증한다. 아직 비어 있으면 탭으로 지나가는 중일 수 있어 제출 때까지 기다린다
        onBlur={(value) => {
          if (!value) return
          const message = checkNext(value)
          setErrors((prev) => ({ ...prev, next: message }))
          setLiveNext(Boolean(message) && !movingFocus.current)
        }}
      />

      <p id={noticeId} className={styles.notice}>
        {LOGOUT_NOTICE}
      </p>

      {errors.form ? <FormAlert ref={alertRef} message={errors.form} /> : null}

      <div>
        {/* 잠그지 않고 누름만 무시한다 — 누르던 버튼에서 포커스가 빠지지 않게 */}
        <Button type="submit" variant="primary" aria-disabled={mutation.isPending || undefined} aria-describedby={noticeId}>
          {mutation.isPending ? '바꾸는 중…' : '비밀번호 바꾸기'}
        </Button>
      </div>
    </form>
  )
}

export interface PasswordInputProps {
  label: string
  name: string
  autoComplete: 'current-password' | 'new-password'
  value: string
  onChange: (value: string) => void
  /** 벗어날 때의 값 */
  onBlur?: (value: string) => void
  error?: string
  /** 오류를 바로 읽어 줄까(`TextField` 의 `announceError`) */
  announceError?: boolean
  hint?: string
  maxLength?: number
  readOnly?: boolean
  disabled?: boolean
  ref?: Ref<HTMLInputElement>
}

/**
 * 비밀번호 한 칸 + 보기/숨기기. 불안한 상태에서 한 손으로 치다 보면 오타가 난다.
 * 로그인 · 가입 폼도 같은 칸을 쓴다(보기 버튼 모양이 화면마다 달라지지 않게)
 */
export function PasswordInput({ label, onChange, onBlur, ref, ...rest }: PasswordInputProps) {
  const [shown, setShown] = useState(false)

  return (
    <TextField
      ref={ref}
      label={label}
      type={shown ? 'text' : 'password'}
      spellCheck={false}
      autoCapitalize="none"
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => onBlur?.(event.currentTarget.value)}
      trailing={
        <button
          type="button"
          className={styles.reveal}
          aria-label={`${label} 보기`}
          aria-pressed={shown}
          disabled={rest.disabled}
          onClick={() => setShown((value) => !value)}
        >
          {shown ? <EyeSlash /> : <Eye />}
        </button>
      }
      {...rest}
    />
  )
}
