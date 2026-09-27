import { useEffect } from 'react'

import { dismissFlash, useFlash } from '@/shared/lib/flash'

import styles from './Flash.module.css'
import { CheckCircle } from './icons'

const SHOW_MS = 4000

/**
 * 짧은 알림을 그리는 곳. 레이아웃에 한 번만 둔다 — 화면이 바뀌어도 남는 알림 영역이라 스크린리더가 읽는다.
 * 4초 뒤 사라진다. 누를 것을 담지 않는다 — 사라지는 곳에 버튼을 두면 못 누르는 사람이 생긴다.
 * 알림을 띄우는 쪽은 `shared/lib/flash` 의 `showFlash()`
 */
export function FlashViewport() {
  const message = useFlash()

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => dismissFlash(message.id), SHOW_MS)
    return () => window.clearTimeout(timer)
  }, [message])

  return (
    <div className={styles.viewport} role="status" aria-live="polite" aria-atomic="true">
      {message ? (
        <p key={message.id} className={styles.flash}>
          <CheckCircle />
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
