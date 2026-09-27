import { cx } from '@/shared/lib/cx'

import { Button } from './Button'
import { ArrowClockwise, WarningCircle } from './icons'
import styles from './StatePanel.module.css'

interface ErrorStateProps {
  /**
   * 서버 `message` 그대로. `getErrorMessage(error)` 로 얻는다.
   * 프론트가 문구를 새로 짓지 않는다 — 같은 상황에 문장이 두 개 생긴다.
   */
  message: string
  /** 있으면 `[다시 시도]` 를 둔다. 오류 화면에는 나갈 문이 있어야 한다 */
  onRetry?: () => void
  /** 다시 불러오는 중. 버튼을 잠가 요청이 겹치지 않게 한다 */
  retrying?: boolean
  /** 제목 태그. 빈 상태(`EmptyState`)와 같은 단계로 맞춘다 */
  titleAs?: 'h1' | 'h2' | 'h3' | 'p'
  className?: string
}

/**
 * 불러오기 실패. 콘텐츠가 있던 자리를 대신한다.
 * 문장을 제목으로 둔다 — 제목으로 훑는 스크린리더 사용자가 빈 상태와 같은 자리에서 찾는다.
 * `role="alert"` 는 감싼 칸에 둔다. 제목 태그에 직접 달면 제목이라는 뜻이 지워진다.
 */
export function ErrorState({
  message,
  onRetry,
  retrying = false,
  titleAs: Title = 'h2',
  className,
}: ErrorStateProps) {
  return (
    <div className={cx(styles.panel, className)}>
      <span className={styles.icon}>
        <WarningCircle />
      </span>
      <div role="alert">
        <Title className={styles.title}>{message}</Title>
      </div>
      {onRetry ? (
        <div className={styles.action}>
          <Button onClick={onRetry} disabled={retrying}>
            <ArrowClockwise />
            {retrying ? '다시 불러오는 중…' : '다시 시도'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
