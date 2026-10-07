import type { ReactNode } from 'react'

import { cx } from '@/shared/lib/cx'

import { Warning } from './icons'
import styles from './SafetyNote.module.css'

interface SafetyNoteProps {
  children: ReactNode
  /** 방금 생긴 줄(연락처 감지 · 연락중 안내)이면 위에서 4px 내려오며 나타난다. 처음부터 있는 줄은 움직이지 않는다 */
  appear?: boolean
  /** 한 단계 더 굵게 — 카드 · 지갑 사진처럼 개인정보가 찍히기 쉬운 때(회의 SE-2) */
  strong?: boolean
  className?: string
}

/**
 * 개인정보 · 안전 경고 한 줄 — 빨간 글자(`--error-text`) + 경고 세모(`Warning`).
 * 본인 피드백(2026-10-07) "개인정보 경고는 더 강조해서 빨간색으로". 색만으로 알리지 않게 세모를 늘 함께 둔다(적색약에게 빨강은 1.74:1뿐).
 *
 * **오류와 모양으로 갈린다** — 오류는 동그라미 `!`(`WarningCircle`)이고 칸이 틀렸을 때만 뜨며 그 칸 테두리가 두 겹이 된다.
 * 이 줄은 막지 않는다(올리기 · 댓글 남기기는 그대로 된다). 그래서 칸을 틀린 칸처럼 칠하지 않고, `role="alert"` 도 두지 않는다 —
 * 뜰 때 읽는 일은 부른 쪽의 알림 영역(`aria-live="polite"`)이나 칸 설명(`aria-describedby`)이 맡는다.
 *
 * 부른 쪽의 `<p>` 안에 놓는 조각이다(`<span>`). 글자 크기 · 행간은 부른 쪽을 따른다
 */
export function SafetyNote({ children, appear = false, strong = false, className }: SafetyNoteProps) {
  return (
    <span className={cx(styles.note, appear ? styles.appear : undefined, className)} data-strong={strong || undefined}>
      <Warning className={styles.icon} />
      <span>{children}</span>
    </span>
  )
}
