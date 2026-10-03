import { useId, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react'

import styles from './TextArea.module.css'
import { FieldCount } from './TextField'
import { WarningCircle } from './icons'

interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className' | 'value' | 'children'> {
  /** 입력 위에 늘 보이는 이름. placeholder 로 대신하지 않는다 */
  label: ReactNode
  value: string
  /** 글자 수 상한. 한도의 80% 부터 이름 오른쪽에 `4,012/5,000`, 넘치면 굵어진다 */
  max: number
  /** 입력 아래 도움말. 여러 줄이면 ReactNode 로. **오류가 떠 있는 동안은 숨긴다** */
  hint?: ReactNode
  /** 결과 고지 · 개인정보 줄. 오류가 있어도 남는다 */
  note?: ReactNode
  /** 서버 `message` 또는 검사 문장 */
  error?: string | null
  /** 오류가 나타나면 바로 읽어 줄까 — 제출이 막혀 여러 칸에 한꺼번에 붙을 때는 끈다(`TextField` 와 같다) */
  announceError?: boolean
  /** 오류 아래 · 도움말 위의 한 줄 — 칸이 알아본 것(연락처 등) */
  detected?: ReactNode
  /** `detected` 줄 자리를 미리 비워 둔다 */
  reserveDetected?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

/**
 * 여러 줄 입력 — 한 줄 입력(`TextField`)과 같은 틀 : 이름 위 · 글자 수 오른쪽 · 오류와 도움말 아래.
 * `maxLength` 로 자르지 않는다. 붙여 넣은 글이 소리 없이 잘리면 무엇이 빠졌는지 모른다(댓글 칸과 같은 규칙).
 * 줄이 늘면 칸도 따라 늘어난다(`field-sizing`, 없는 브라우저는 최소 높이 + 손잡이).
 */
export function TextArea({
  label,
  value,
  max,
  hint,
  note,
  error,
  announceError = true,
  detected,
  reserveDetected = false,
  ref,
  ...rest
}: TextAreaProps) {
  const id = useId()
  const countId = `${id}-count`
  const hintId = `${id}-hint`
  const noteId = `${id}-note`
  const errorId = `${id}-error`
  const detectedId = `${id}-detected`
  const showHint = Boolean(hint) && !error
  const describedBy = [
    error ? errorId : null,
    detected ? detectedId : null,
    showHint ? hintId : null,
    note ? noteId : null,
    countId,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        <FieldCount id={countId} value={value.length} max={max} />
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
        <p id={errorId} className={styles.error} role={announceError ? 'alert' : undefined}>
          <WarningCircle />
          {error}
        </p>
      ) : null}
      {detected || reserveDetected ? (
        <p id={detectedId} className={styles.detected} data-reserved={reserveDetected || undefined}>
          {detected}
        </p>
      ) : null}
      {showHint ? (
        <div id={hintId} className={styles.hint}>
          {hint}
        </div>
      ) : null}
      {note ? (
        <p id={noteId} className={styles.note}>
          {note}
        </p>
      ) : null}
    </div>
  )
}
