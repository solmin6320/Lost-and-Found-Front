import { useId, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react'

import styles from './TextArea.module.css'
import { WarningCircle } from './icons'

interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className' | 'value' | 'children'> {
  /** 입력 위에 늘 보이는 이름. placeholder 로 대신하지 않는다 */
  label: ReactNode
  value: string
  /** 글자 수 상한. 이름 오른쪽에 `12/5000`, 넘치면 굵어진다 */
  max: number
  /** 입력 아래 도움말(상시). 여러 줄이면 ReactNode 로 */
  hint?: ReactNode
  /** 서버 `message` 또는 검사 문장 */
  error?: string | null
  ref?: Ref<HTMLTextAreaElement>
}

/**
 * 여러 줄 입력 — 한 줄 입력(`TextField`)과 같은 틀 : 이름 위 · 글자 수 오른쪽 · 오류와 도움말 아래.
 * `maxLength` 로 자르지 않는다. 붙여 넣은 글이 소리 없이 잘리면 무엇이 빠졌는지 모른다(댓글 칸과 같은 규칙).
 * 줄이 늘면 칸도 따라 늘어난다(`field-sizing`, 없는 브라우저는 최소 높이 + 손잡이).
 */
export function TextArea({ label, value, max, hint, error, ref, ...rest }: TextAreaProps) {
  const id = useId()
  const countId = `${id}-count`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const over = value.length > max
  const describedBy = [error ? errorId : null, hint ? hintId : null, countId].filter(Boolean).join(' ')

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        <span id={countId} className={styles.count} data-over={over || undefined} data-numeric>
          <span className="sr-only">글자 수 </span>
          {value.length.toLocaleString('ko-KR')}/{max.toLocaleString('ko-KR')}
        </span>
      </div>
      <textarea
        ref={ref}
        id={id}
        className={styles.input}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          <WarningCircle />
          {error}
        </p>
      ) : null}
      {hint ? (
        <div id={hintId} className={styles.hint}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}
