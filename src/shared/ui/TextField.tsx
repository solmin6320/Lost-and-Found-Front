import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'

import { cx } from '@/shared/lib/cx'

import { countVisible } from './TextField.count'
import styles from './TextField.module.css'
import { WarningCircle } from './icons'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className' | 'children'> {
  /** 입력 위에 늘 보이는 이름. placeholder 로 대신하지 않는다(예시는 placeholder 로 둘 수 있다 — 이름은 위에 그대로) */
  label: string
  /** 입력 아래 도움말. **오류가 떠 있는 동안은 숨긴다** — 칸 아래에는 오류 한 줄만 남는다 */
  hint?: ReactNode
  /** 결과 고지 · 개인정보 줄. 오류가 있어도 숨기지 않는다(누르기 전에 읽혀야 한다) */
  note?: ReactNode
  /** 입력 바로 아래 오류 문장. 서버 `message` 는 그대로 넣는다 */
  error?: string | null
  /**
   * 오류가 나타나면 바로 읽어 줄까(`role="alert"`). 칸을 벗어날 때 생긴 오류 하나는 읽어 준다.
   * 제출이 막혀 여러 칸에 한꺼번에 붙을 때는 끈다 — 포커스가 간 첫 칸이 `aria-describedby` 로 읽고,
   * 남은 수는 제출 줄 한 줄이 알린다(알림 다섯 겹 방지, 회의 UI2-9)
   */
  announceError?: boolean
  /**
   * 오류 아래 · 도움말 위의 한 줄 — 쓰는 칸이 기기 안에서 알아본 것(연락처가 들어 있음 등, 회의 SE-3).
   * 막지 않는다. 오류와 함께 둘 다 보인다. 주기만 하면(속이 비는 조각이라도) 줄은 알림 영역으로 늘 있다 —
   * 비어 있는 동안은 화면에서 빠지고, 글자가 들어오면 스크린리더가 한 번 읽는다
   */
  detected?: ReactNode
  /** `detected` 줄이 뜰 자리를 미리 비워 둔다 — 나타날 때 아래 버튼이 밀리지 않게 */
  reserveDetected?: boolean
  /**
   * 글자 수 `3/20`. 한도의 80% 부터 보인다(그 전에는 화면에서 숨기고 "최대 N자"만 읽힌다). 넘치면 굵어진다
   */
  count?: { value: number; max: number }
  /** 입력칸 안 오른쪽의 버튼(비밀번호 보기 등). 44px 정사각 자리를 비워 둔다 */
  trailing?: ReactNode
  /** 입력 요소 id 를 밖에서 정할 때. 도움말 id 는 `${inputId}-hint`, 결과 고지 id 는 `${inputId}-note` 다 */
  inputId?: string
  /** 입력 요소. 제출이 실패하면 그 입력으로 포커스를 옮긴다 */
  ref?: Ref<HTMLInputElement>
}

/**
 * 한 줄 입력 — 이름은 위, 오류는 아래(디자인품질기준 7장 · 화면정의서 1.7).
 * 도움말 · 결과 고지 · 글자 수 · 오류를 `aria-describedby` 로 묶어 스크린리더가 입력과 함께 읽는다.
 * 검증 시점(벗어날 때)은 쓰는 쪽이 `onBlur` 로 정한다.
 *
 * 오류는 빨강 글자 + `!` 아이콘(`--error-text`). 틀린 칸 테두리는 잉크 두 겹 그대로 — 빨강은 문장과 아이콘에만(회의 ⑤).
 */
export function TextField({
  label,
  hint,
  note,
  error,
  announceError = true,
  detected,
  reserveDetected = false,
  count,
  trailing,
  inputId,
  ref,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId()
  const id = inputId ?? autoId
  const hintId = `${id}-hint`
  const noteId = `${id}-note`
  const errorId = `${id}-error`
  const detectedId = `${id}-detected`
  const countId = `${id}-count`
  const showHint = Boolean(hint) && !error
  const describedBy = [
    error ? errorId : null,
    detected ? detectedId : null,
    showHint ? hintId : null,
    note ? noteId : null,
    count ? countId : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {count ? <FieldCount id={countId} value={count.value} max={count.max} /> : null}
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
        <p id={errorId} className={styles.error} role={announceError ? 'alert' : undefined}>
          <WarningCircle />
          {error}
        </p>
      ) : null}
      {detected || reserveDetected ? (
        <p id={detectedId} className={styles.detected} data-reserved={reserveDetected || undefined} aria-live="polite">
          {detected}
        </p>
      ) : null}
      {showHint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {note ? (
        <p id={noteId} className={styles.note}>
          {note}
        </p>
      ) : null}
    </div>
  )
}

/**
 * 이름 오른쪽의 글자 수. 80% 전에는 화면에서 숨기고 "최대 N자"만 읽힌다 —
 * 스크린리더는 한도를 미리 알고, 눈으로는 늘 떠 있는 `0/100` 을 읽지 않는다
 */
export function FieldCount({ id, value, max }: { id: string; value: number; max: number }) {
  const shown = countVisible(value, max)
  const maxText = max.toLocaleString('ko-KR')
  if (!shown) {
    return (
      <span id={id} className="sr-only">
        최대 {maxText}자
      </span>
    )
  }
  return (
    <span id={id} className={styles.count} data-over={value > max || undefined} data-numeric>
      <span className="sr-only">글자 수 </span>
      {value.toLocaleString('ko-KR')}/{maxText}
    </span>
  )
}
