import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'

import type { PagedModel } from '@/shared/types/api'

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notificationApi'
import type { NotificationResponse, UnreadCountResponse } from '../api/types'

/**
 * 알림 쿼리 키. **회원 개인 데이터**다 — 로그아웃 · 세션 만료면 지운다(종이 사라질 때 `NotificationBell` 이 지운다, 보안명세서 8장).
 * 새 알림이 오면(SSE) `all` 을 무효화한다 — 열린 목록 · 안 읽은 수가 다시 온다
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
}

type NotificationPages = InfiniteData<PagedModel<NotificationResponse>, number>

/** 안 읽은 알림 수. 로그인했을 때만 켠다(비로그인으로 부르면 401 → 재발급 헛걸음) */
export function useUnreadNotificationCount(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: ({ signal }) => getUnreadNotificationCount(signal),
    enabled,
    select: (data: UnreadCountResponse) => data.count,
  })
}

/**
 * 알림 목록(펼침 칸). 칸을 열 때만 켠다. 열 때마다 새로 받는다(`staleTime 0`) — 실시간 연결이 끊겨 있던 동안의 것도 맞춘다.
 * 받은 것이 있으면 그것을 먼저 그리고 뒤에서 바꾼다(스켈레톤은 처음 한 번만)
 */
export function useNotificationList(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(),
    queryFn: ({ pageParam, signal }) => getNotifications(pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page.number + 1 < last.page.totalPages ? last.page.number + 1 : undefined),
    enabled,
    staleTime: 0,
  })
}

/** 목록 캐시 안의 알림 하나(또는 전부)를 읽음으로 바꾼다 */
function markCachedRead(queryClient: QueryClient, id: number | 'all') {
  queryClient.setQueryData<NotificationPages>(notificationKeys.list(), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            content: page.content.map((n) => (id === 'all' || n.id === id ? { ...n, read: true } : n)),
          })),
        }
      : data,
  )
}

/**
 * 알림 하나 읽음 — 줄을 누르는 순간. 기다리지 않는다(누르면 바로 그 글로 간다) — 화면은 먼저 읽음으로 그리고(점 · 수),
 * 실패하면 서버 값으로 되돌린다. 남의 · 없는 알림(404 `NOTIFICATION_NOT_FOUND`)도 서버 값을 다시 받는 것으로 끝낸다(알릴 것이 없다)
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notification: NotificationResponse) => markNotificationRead(notification.id),
    onMutate: async (notification) => {
      if (notification.read) return
      await queryClient.cancelQueries({ queryKey: notificationKeys.unread() })
      markCachedRead(queryClient, notification.id)
      queryClient.setQueryData<UnreadCountResponse>(notificationKeys.unread(), (data) =>
        data ? { count: Math.max(0, data.count - 1) } : data,
      )
    },
    // 실패(404 `NOTIFICATION_NOT_FOUND` 포함)는 서버 값으로 맞추는 것으로 끝난다 — 사용자는 이미 그 글로 갔고, 알릴 다음 행동이 없다
    onError: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.unread() }),
  })
}

/** 모두 읽음 — `[모두 읽음]`. 끝날 때까지 버튼이 "읽음으로 바꾸는 중"이고, 실패하면 서버 `message` 를 칸 위에 한 줄 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      markCachedRead(queryClient, 'all')
      queryClient.setQueryData<UnreadCountResponse>(notificationKeys.unread(), { count: 0 })
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}
