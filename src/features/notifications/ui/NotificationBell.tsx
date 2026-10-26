import { useRef } from 'react'

import { cx } from '@/shared/lib/cx'
import { Bell } from '@/shared/ui/icons'
import tip from '@/shared/ui/Tooltip.module.css'

import { useNotificationCenter } from './notificationCenterContext'
import styles from './NotificationPanel.module.css'

/**
 * 헤더 종 — `NotificationCenter` 안에서만(로그인했을 때만). 자리는 `[홈]` 뒤 · 계정 메뉴 앞(SCR-10).
 * 배지 = 안 읽은 수의 합(잉크 알약, 12px — 수가 오기 전엔 없음), 이름도 같은 수(`알림, 안 읽은 알림 3개`).
 * **헤더가 아주 좁으면(그릇 10.5rem 미만) 숨는다** — 그 폭에서는 계정 메뉴의 `알림` 줄이 입구다(CSS `.bell`, 본인 결정 2026-10-25)
 */
export function NotificationBell() {
  const center = useNotificationCenter()
  const bellRef = useRef<HTMLButtonElement>(null)
  if (!center) return null

  return (
    <button
      ref={bellRef}
      type="button"
      className={cx(styles.bell, tip.host)}
      aria-label={center.label}
      aria-haspopup="dialog"
      aria-expanded={center.isOpen}
      data-open={center.isOpen || undefined}
      onClick={() => center.toggle(bellRef.current)}
    >
      <Bell />
      {center.badge ? (
        <span className={styles.badge} aria-hidden="true">
          {center.badge}
        </span>
      ) : null}
      <span className={cx(tip.tip, styles.bellTip)} aria-hidden="true">
        알림
      </span>
    </button>
  )
}
