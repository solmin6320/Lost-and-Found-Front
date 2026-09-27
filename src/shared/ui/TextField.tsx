import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'

import { cx } from '@/shared/lib/cx'

import styles from './TextField.module.css'
import { WarningCircle } from './icons'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className' | 'children'> {
  /** 입력 위에 늘 보이는 이름. placeholder 로 대신하지 않는다 */
  label: string
  /** 입력 아래 도움말 · 결과 고지(상시). 오류가 있으면 오류 아래로 밀린다 */
  hint?: ReactNode
  /** 입력 바로 아래 오류 문장. 서버 `message` 는 그대로 넣는다 */
  error?: string | null
  /** 이름 오른쪽의 글자 수 `3/20`. 넘치면 굵어진다(`maxLength` 로 자르지 않는 칸) */
  count?: { value: number; max: number }
  /** 입력칸 안 오른쪽의 버튼(비밀번호 보기 등). 44px 정사각 자리를 비워 둔다 */
  trailing?: ReactNode
  /** 입력 요소 id 를 밖에서 정할 때. 도움말 id 는 `${inputId}-hint` 다(버튼의 aria-describedby 에 쓴다) */
  inputId?: string
  /** 입력 요소. 제출이 실패하면 그 입력으로 포커스를 옮긴다 */
  ref?: Ref<HTMLInputElement>
}

/**
 * 한 줄 입력 — 이름은 위, 오류는 아래(디자인품질기준 7장 · 화면정의서 1.7).
 * 도움말 · 글자 수 · 오류를 `aria-describedby` 로 묶어 스크린리더가 입력과 함께 읽는다.
 * 검증 시점(벗어날 때)은 쓰는 쪽이 `onBlur` 로 정한다.
 */
export function TextField({
  label,
  hint,
  error,
  count,
  trailing,
  inputId,
  ref,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId()
  const id = inputId ?? autoId
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const countId = `${id}-count`
  const describedBy = [error ? errorId : null, hint ? hintId : null, count ? countId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {count ? (
          <span
            id={countId}
            className={styles.count}
            data-over={count.value > count.max || undefined}
            data-numeric
          >
            <span className="sr-only">글자 수 </span>
            {count.value}/{count.max}
          </span>
        ) : null}
      </div>

      <div className={cx(styles.control, trailing ? styles.withTrailing : undefined)}>
        <input
          ref={ref}
          id={id}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...inputProps}
        />
        {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      </div>

      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          <WarningCircle />
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
