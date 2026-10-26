import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import type { NotificationResponse } from '../api/types'
import { arrivalAnnouncement, badgeText, bellLabel, unreadTotal, type UnreadPart } from '../model/notificationCopy'
import { notificationKeys, useMarkNotificationRead, useUnreadNotificationCount } from '../model/notificationQueries'
import { useNotificationStream } from '../model/useNotificationStream'
import { NotificationCenterContext, type NotificationCenterValue } from './notificationCenterContext'
import { NotificationList } from './NotificationList'
import { NotificationPanel, type PanelTab } from './NotificationPanel'

/** 새 알림 알림말을 비우기까지 — 같은 말이 다시 와도 다시 읽히게 비워 둔다 */
const ANNOUNCE_CLEAR_MS = 4_000


/**
 * 알림 한 벌 — 안 읽은 수 · 실시간 연결 · 칸(펼침 칸 · 시트)을 **하나만** 붙들고, 여는 입구 둘이 나눠 쓴다(SCR-10).
 *   - 헤더 종(`NotificationBell`) — 보통
 *   - 계정 메뉴의 `알림` 줄 — 헤더가 아주 좁을 때만(그릇 10.5rem 미만, 320 × 글자 200%). 종을 두면 헤더가 세 줄(321px)이 되어
 *     그 폭에서만 종을 계정 메뉴로 옮긴다(본인 결정 2026-10-25 — 안 c). 계정 단추에 같은 배지 · 이름에 같은 수
 * 어느 입구로 열든 같은 칸이고, 닫으면 연 단추로 포커스가 돌아온다.
 *
 * **로그인했을 때만 그린다**(부르는 쪽 `HeaderActions`). 사라질 때(로그아웃 · 세션 만료 · 다른 탭 로그아웃) 실시간 연결을 끊고
 * 알림 캐시를 지운다(개인 데이터, 보안명세서 8장).
 *
 * - **열기만으로는 읽음 처리하지 않는다** — 줄을 누르면 그 알림만, 나머지는 `[모두 읽음]`
 * - 새 알림이 와서 수가 **늘었을 때만** 스크린리더에 수를 한 번(`role="status"`) — 배지 숫자를 알림 영역으로 만들지 않는다
 */
export function NotificationCenter({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const anchorRef = useRef<HTMLElement | null>(null)
  const location = useLocation()
  const unread = useUnreadNotificationCount(true)
  const markRead = useMarkNotificationRead()

  const countNow = unread.data
  const parts = useMemo<UnreadPart[]>(() => [{ name: '알림', count: countNow ?? 0 }], [countNow])
  const total = countNow === undefined ? undefined : unreadTotal(parts)

  // 새 알림이 오면 수를 새로 받은 뒤, 그 수가 늘었을 때만 한 번 읽어 준다(다시 붙으며 다시 온 옛 알림에는 말하지 않는다)
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

  // 사라지면 알림 캐시를 지운다 — 같은 기기의 다음 사람이 보지 않게
  useEffect(() => () => queryClient.removeQueries({ queryKey: notificationKeys.all }), [queryClient])

  // 다른 화면으로 가면 닫는다(줄을 누른 경우 · 뒤로가기)
  const [path, setPath] = useState(location.pathname)
  if (path !== location.pathname) {
    setPath(location.pathname)
    setOpen(false)
  }

  const toggle = useCallback((from: HTMLElement | null) => {
    anchorRef.current = from
    setOpen((value) => !value)
  }, [])

  function handleOpen(notification: NotificationResponse, event: MouseEvent<HTMLAnchorElement>) {
    if (!notification.read) markRead.mutate(notification)
    // 새 탭 · 새 창으로 열면 이 칸은 그대로 둔다
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    setOpen(false)
  }

  const tabs: PanelTab[] = [
    { id: 'notes', label: '알림', count: countNow ?? 0, content: <NotificationList onOpen={handleOpen} /> },
  ]

  const value = useMemo<NotificationCenterValue>(
    () => ({ parts, total, badge: total === undefined ? null : badgeText(total), label: bellLabel(parts), isOpen: open, toggle }),
    [parts, total, open, toggle],
  )

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
      <span className="sr-only" role="status" aria-atomic="true">
        {announcement}
      </span>
      <NotificationPanel open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} tabs={tabs} unread={countNow ?? 0} />
    </NotificationCenterContext.Provider>
  )
}
