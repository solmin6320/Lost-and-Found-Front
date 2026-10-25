import { createContext, useContext } from 'react'

import type { UnreadPart } from '../model/notificationCopy'

export interface NotificationCenterValue {
  /** 안 읽은 수의 묶음(지금은 알림 하나 — 채팅 단계에서 `메시지`) */
  parts: UnreadPart[]
  /** 합. 수가 아직 안 왔으면(첫 요청 · 실패) `undefined` — 배지를 그리지 않는다 */
  total: number | undefined
  /** 배지 글자(`3` · `99+`) — 없으면 `null` */
  badge: string | null
  /** 종의 이름 — `알림, 안 읽은 알림 3개` */
  label: string
  isOpen: boolean
  /** 칸을 연다 · 닫는다. `from` 은 연 단추 — 펼침 칸이 그 아래 서고, 닫으면 그리로 포커스가 돌아온다 */
  toggle: (from: HTMLElement | null) => void
}

export const NotificationCenterContext = createContext<NotificationCenterValue | null>(null)

/** 로그인했을 때만 값이 있다(비로그인 · 세션 복구 중은 `null` — `NotificationCenter` 밖) */
export function useNotificationCenter(): NotificationCenterValue | null {
  return useContext(NotificationCenterContext)
}
