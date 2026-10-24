import { openStream, request } from '@/shared/lib/http'
import type { PagedModel } from '@/shared/types/api'

import type { NotificationResponse, UnreadCountResponse } from './types'

/** 한 번에 받는 알림 수 — 펼침 칸 첫 화면. 더 있으면 `[지난 알림 더 보기]` */
export const NOTIFICATION_PAGE_SIZE = 20

/** `GET /api/notifications?page=&size=` — 내 알림, 최근 것부터(id 내림차순). `page` 는 0부터 */
export function getNotifications(page: number, signal?: AbortSignal): Promise<PagedModel<NotificationResponse>> {
  return request<PagedModel<NotificationResponse>>('/api/notifications', {
    query: { page, size: NOTIFICATION_PAGE_SIZE },
    signal,
  })
}

/** `GET /api/notifications/unread-count` — 안 읽은 알림 수(대화는 들어 있지 않다 — 배지 합은 화면이 더한다) */
export function getUnreadNotificationCount(signal?: AbortSignal): Promise<UnreadCountResponse> {
  return request<UnreadCountResponse>('/api/notifications/unread-count', { signal })
}

/**
 * `PATCH /api/notifications/{id}/read` — 204. 이미 읽은 것은 그대로(멱등).
 * 남의 알림 · 없는 알림이면 404 `NOTIFICATION_NOT_FOUND`
 */
export function markNotificationRead(id: number): Promise<void> {
  return request<void>(`/api/notifications/${id}/read`, { method: 'PATCH' })
}

/** `PATCH /api/notifications/read-all` — 204 */
export function markAllNotificationsRead(): Promise<void> {
  return request<void>('/api/notifications/read-all', { method: 'PATCH' })
}

/**
 * `GET /api/notifications/stream` — 실시간 알림(SSE). 열린 응답을 준다(본문은 `model/notificationStream` 이 흘려 읽는다).
 * 서버 : 연결 직후 `event: connected`, 알림마다 `id: <알림 id>` · `event: notification` · `data: <NotificationResponse JSON>`,
 * 15초마다 주석 줄, 30분이면 서버가 끝낸다. `Last-Event-ID` 를 실으면 그 id 뒤의 알림을 다시 보낸다
 */
export function openNotificationStream(lastEventId: string | undefined, signal: AbortSignal): Promise<Response> {
  return openStream('/api/notifications/stream', {
    signal,
    headers: lastEventId ? { 'Last-Event-ID': lastEventId } : undefined,
  })
}
