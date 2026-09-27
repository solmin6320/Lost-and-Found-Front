import type { Ref } from 'react'

import { cx } from '@/shared/lib/cx'

import styles from './FormAlert.module.css'
import { WarningCircle } from './icons'

interface FormAlertProps {
  /** 서버 `message` 그대로(`getErrorMessage`). 프론트가 문장을 새로 짓지 않는다 */
  message: string
  /** 실패하면 부른 쪽이 여기로 포커스를 옮긴다 — 누른 버튼 근처가 아니라 무엇이 잘못됐는지부터 읽힌다 */
  ref?: Ref<HTMLDivElement>
  className?: string
}

/**
 * 폼 전체 문제 한 줄 — 어느 칸의 문제인지 모를 때만 쓴다. 칸의 문제는 그 칸 아래에 붙인다.
 * `role="alert"` 라 나타나면 바로 읽히고, `tabIndex={-1}` 이라 포커스를 받을 수 있다(탭 순서에는 없다).
 */
export function FormAlert({ message, ref, className }: FormAlertProps) {
  return (
    <div ref={ref} className={cx(styles.alert, className)} role="alert" tabIndex={-1}>
      <WarningCircle />
      <p>{message}</p>
    </div>
  )
}
