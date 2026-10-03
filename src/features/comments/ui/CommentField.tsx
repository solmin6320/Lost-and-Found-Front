import { useId, type Ref, type TextareaHTMLAttributes } from 'react'

import { WarningCircle } from '@/shared/ui/icons'

import { COMMENT_MAX_LENGTH } from '../api/types'
import styles from './CommentField.module.css'

interface CommentFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className' | 'value' | 'children'> {
  /** 입력 위에 늘 보이는 이름 */
  label: string
  /** 수정 칸처럼 이름이 이미 맥락으로 분명하면 화면에서만 숨긴다(스크린리더는 읽는다) */
  hideLabel?: boolean
  value: string
  /** 입력 아래 한 줄 도움말 */
  hint?: string
  /**
   * 칸 밖(제출 줄)에 있는 개인정보 감지 한 줄의 id(`PersonalInfoNotice`). 읽을 때 이 칸의 설명으로 이어 읽힌다
   */
  noticeId?: string
  /** 서버 `message` 또는 글자 수 초과 */
  error?: string | null
  ref?: Ref<HTMLTextAreaElement>
}

/**
 * 댓글 입력 — 이름 위 · 글자 수 오른쪽 · 오류와 도움말 아래(화면정의서 1.7).
 * 300자(DB `VARCHAR(300)`)를 넘기면 글자 수가 굵어지고 오류 문장이 나온다. `maxLength` 로 자르지 않는다 —
 * 붙여 넣은 글이 소리 없이 잘리면 무엇이 빠졌는지 모른다.
 * 줄이 늘면 칸도 따라 늘어난다(`field-sizing`, 없는 브라우저는 세 줄 + 손잡이).
 */
export function CommentField({ label, hideLabel = false, value, hint, noticeId, error, ref, ...rest }: CommentFieldProps) {
  const id = useId()
  const countId = `${id}-count`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const over = value.length > COMMENT_MAX_LENGTH
  const describedBy = [error ? errorId : null, hint ? hintId : null, noticeId ?? null, countId].filter(Boolean).join(' ')

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={hideLabel ? 'sr-only' : styles.label} htmlFor={id}>
          {label}
        </label>
        <span id={countId} className={styles.count} data-over={over || undefined} data-numeric>
          <span className="sr-only">글자 수 </span>
          {value.length}/{COMMENT_MAX_LENGTH}
        </span>
      </div>
      <textarea
        ref={ref}
        id={id}
        className={styles.input}
        value={value}
        rows={3}
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
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
