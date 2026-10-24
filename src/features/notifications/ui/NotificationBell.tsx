import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { useLocation } from 'react-router-dom'

import { cx } from '@/shared/lib/cx'
import { Bell } from '@/shared/ui/icons'
import tip from '@/shared/ui/Tooltip.module.css'

import type { NotificationResponse } from '../api/types'
import { arrivalAnnouncement, badgeText, bellLabel, unreadTotal, type UnreadPart } from '../model/notificationCopy'
import { notificationKeys, useMarkNotificationRead, useUnreadNotificationCount } from '../model/notificationQueries'
import { useNotificationStream } from '../model/useNotificationStream'
import { NotificationList } from './NotificationList'
import { NotificationPanel, type PanelTab } from './NotificationPanel'
import styles from './NotificationPanel.module.css'

/** 새 알림 알림말을 비우기까지 — 같은 말이 다시 와도 다시 읽히게 비워 둔다 */
const ANNOUNCE_CLEAR_MS = 4_000

/**
 * 헤더 종 — **로그인했을 때만** 그린다(부르는 쪽 `HeaderActions`). 자리는 `[홈]` 뒤 · 계정 메뉴 앞(SCR-10).
 *
 * - 배지 = 안 읽은 수의 합(지금은 알림뿐 — 채팅이 생기면 `메시지` 를 `parts` 에 더한다). 잉크 알약, 12px. 수가 오기 전엔 그리지 않는다
 * - 종 이름도 같은 수(`알림, 안 읽은 알림 3개`) — 배지 · 이름 · 탭 수가 한 묶음(`parts`)에서 나온다
 * - 누르면 펼침 칸(넓은 화면) · 바텀 시트(휴대폰). 둘 다 모달 — 포커스 가두기 · Esc · 바깥 누름 · 닫으면 종으로
 * - **열기만으로는 읽음 처리하지 않는다** — 화면정의서 SCR-10에 자동 읽음이 없고 `[모두 읽음]`을 따로 둔다. 열어서 훑어만 본 것을
 *   다 읽었다고 치면 다시 볼 표시(점 · 굵은 글자)가 사라진다. 줄을 누르면 그 알림만 읽음
 * - 새 알림이 오면 스크린리더에 수만 한 번(`role="status"`) — 배지 숫자를 알림 영역으로 만들지 않는다
 * - 사라질 때(로그아웃 · 세션 만료) 실시간 연결을 끊고 알림 캐시를 지운다(개인 데이터, 보안명세서 8장)
 */
export function NotificationBell() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const bellRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const unread = useUnreadNotificationCount(true)
  const markRead = useMarkNotificationRead()

  // 안 읽은 수의 묶음 — 탭마다 하나. 채팅 단계에서 { name: '메시지', count: 대화 안 읽음 } 을 더한다
  const parts: UnreadPart[] = [{ name: '알림', count: unread.data ?? 0 }]
  const total = unreadTotal(parts)
  const badge = unread.data === undefined ? null : badgeText(total)

  // 새 알림이 오면 수를 새로 받은 뒤, 그 수가 **늘었을 때만** 한 번 읽어 준다(다시 붙으며 다시 온 옛 알림에는 말하지 않는다)
  const countNow = unread.data
  const latestCount = useRef(countNow)
  const countBeforeArrival = useRef<number | null>(null)
  useEffect(() => {
    latestCount.current = countNow
  })
  const onArrive = useCallback(() => {
    countBeforeArrival.current ??= latestCount.current ?? 0
  }, [])
  useNotificationStream(true, onArrive)

  useEffect(() => {
    const before = countBeforeArrival.current
    if (before === null || countNow === undefined || unread.isFetching) return
    countBeforeArrival.current = null
    if (countNow <= before) return
    setAnnouncement(arrivalAnnouncement([{ name: '알림', count: countNow }]))
    const timer = setTimeout(() => setAnnouncement(''), ANNOUNCE_CLEAR_MS)
    return () => clearTimeout(timer)
  }, [countNow, unread.isFetching])

  // 종이 사라지면(로그아웃 · 세션 만료) 알림 캐시를 지운다 — 같은 기기의 다음 사람이 보지 않게
  useEffect(() => () => queryClient.removeQueries({ queryKey: notificationKeys.all }), [queryClient])

  // 다른 화면으로 가면 닫는다(줄을 누른 경우 · 뒤로가기)
  const [path, setPath] = useState(location.pathname)
  if (path !== location.pathname) {
    setPath(location.pathname)
    setOpen(false)
  }

  function handleOpen(notification: NotificationResponse, event: MouseEvent<HTMLAnchorElement>) {
    if (!notification.read) markRead.mutate(notification)
    // 새 탭 · 새 창으로 열면 이 칸은 그대로 둔다
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    setOpen(false)
  }

  const tabs: PanelTab[] = [
    { id: 'notes', label: '알림', count: unread.data ?? 0, content: <NotificationList onOpen={handleOpen} /> },
  ]

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        className={cx(styles.bell, tip.host)}
        aria-label={bellLabel(parts)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell />
        {badge ? (
          <span className={styles.badge} aria-hidden="true">
            {badge}
          </span>
        ) : null}
        <span className={cx(tip.tip, styles.bellTip)} aria-hidden="true">
          알림
        </span>
      </button>
      <span className="sr-only" role="status" aria-atomic="true">
        {announcement}
      </span>
      <NotificationPanel open={open} onClose={() => setOpen(false)} anchorRef={bellRef} tabs={tabs} unread={unread.data ?? 0} />
    </>
  )
}
