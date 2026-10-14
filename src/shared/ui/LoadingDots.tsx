import { cx } from '@/shared/lib/cx'
import { LATE_FLAG_MIN_SHOW_MS, LATE_FLAG_MS, useLateFlag } from '@/shared/lib/useLateFlag'

import styles from './LoadingDots.module.css'

interface LoadingDotsProps {
  /** 기다리는 중인가. 거짓이면 알림 영역만 비워 둔다(영역이 글자와 함께 생기면 스크린리더가 처음 한 번을 놓친다) */
  active?: boolean
  /** 스크린리더가 읽는 말. "불러오는 중" · "찾는 중" — 무엇을 기다리는지로 */
  label?: string
  /** 이만큼 지나야 보인다. 0 이면 바로 */
  delay?: number
  /**
   * `bubble` — 둥근 면 안의 점 셋(따로 서는 표시 : 목록 · 검색 추천).
   * `inline` — 면 없이 글자색 점 셋(버튼 글자 자리 · 단계 줄). 둘러싼 쪽이 이미 알리면 `announce={false}`
   */
  variant?: 'bubble' | 'inline'
  /** 알림 영역(`role="status"`)으로 둘까. 버튼 안처럼 둘러싼 쪽이 이름으로 알리면 끈다 */
  announce?: boolean
  /** 기다림을 처음부터 다시 잴 열쇠(찾는 말이 바뀌면 0.3초를 새로 센다) */
  resetKey?: unknown
  className?: string
}

/**
 * 기다리는 동안의 점 셋(본인 피드백 2026-10-14 — "입력 중" 점처럼 로딩이 짧게 느껴지게).
 *
 * - **0.3초 안에 끝나는 기다림에는 아무것도 띄우지 않는다.** 그 뒤에 점 셋이 나타나고, 한 번 나타나면 적어도 0.45초는 둔다
 *   (0.3초를 갓 넘긴 응답에서 수십 ms 깜빡이지 않게 — QA-D-2)
 * - 점이 차례로 옅어졌다 짙어진다(투명도만, 1.2초 한 바퀴). 크기 · 자리는 움직이지 않는다 — 옆 글자가 흔들리지 않는다
 * - 모션 줄이기면 움직이지 않는 점 셋(짙기 차례로 고정)
 * - 이미 보던 내용은 지우지 않는다 — 이 표시는 그 위 · 옆에 작게 선다(쓰는 쪽이 자리를 정한다)
 * - 색은 둘러싼 글자색(`currentColor`)을 따른다. 새 색을 만들지 않는다
 */
export function LoadingDots({
  active = true,
  label = '불러오는 중',
  delay = LATE_FLAG_MS,
  variant = 'bubble',
  announce = true,
  resetKey,
  className,
}: LoadingDotsProps) {
  const shown = useLateFlag(active, delay, { minShow: LATE_FLAG_MIN_SHOW_MS, resetKey })
  const dots = shown ? (
    <span className={cx(styles.dots, variant === 'bubble' && styles.bubble)} aria-hidden="true" data-loading-dots="">
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </span>
  ) : null

  if (!announce) {
    return <span className={cx(styles.root, className)}>{dots}</span>
  }
  return (
    <span className={cx(styles.root, className)} role="status" aria-live="polite">
      {dots}
      {shown ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
