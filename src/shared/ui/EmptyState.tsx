import type { ReactNode } from 'react'

import { cx } from '@/shared/lib/cx'

import styles from './StatePanel.module.css'

interface EmptyStateProps {
  /** 무엇이 없는지. "데이터 없음" 이 아니라 사용자의 말로 */
  title: string
  /** 제목 바로 아래 한 줄 — 무엇에 대한 빈 상태인지(없는 화면의 주소처럼). 설명보다 먼저 읽힌다 */
  detail?: ReactNode
  /** 다음에 할 일 */
  description?: string
  /** 막다른 길을 만들지 않는다 — 조건을 넓히거나 첫 행동을 하는 버튼 */
  action?: ReactNode
  /** 장식. 스크린리더에는 숨긴다 */
  icon?: ReactNode
  /** 제목 태그. 화면의 제목 구조에 맞춘다 */
  titleAs?: 'h1' | 'h2' | 'h3' | 'p'
  className?: string
}

/** 비어 있는 상태. 빈 화면은 오류처럼 보이므로 화면이 먼저 말한다 */
export function EmptyState({
  title,
  detail,
  description,
  action,
  icon,
  titleAs: Title = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div className={cx(styles.panel, className)}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <Title className={styles.title}>{title}</Title>
      {detail ? <div className={styles.detail}>{detail}</div> : null}
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
