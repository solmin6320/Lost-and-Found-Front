import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { matchKeys } from '@/features/matches'
import { postKeys } from '@/features/posts'

import { openNotificationStream } from '../api/notificationApi'
import type { NotificationResponse } from '../api/types'
import { createNotificationStream } from './notificationStream'
import { notificationKeys } from './notificationQueries'

/**
 * 로그인한 동안 실시간 알림 연결을 하나 붙들고 있는다(헤더 종이 부른다 — 종은 로그인했을 때만 있다).
 *
 * - 알림이 오면 **안 읽은 수 · 알림 목록 · 그 글 상세**(추천 알림이면 그 글의 추천 후보도)를 무효화한다. 상세는 그 글 자체만(`exact` — 댓글은 건드리지 않는다).
 *   상세를 다시 받아도 조회수는 회원마다 하루 한 번이라 늘지 않는다. 보고 있지 않은 상세는 표시만 해 두고 다음에 열 때 받는다
 * - 다시 붙으면(`connected`) 안 읽은 수를 맞춘다 — `Last-Event-ID` 로 다시 온 알림 말고도, 첫 연결 전 틈 · id 를 모르던 연결의 틈을 메운다
 * - 탭이 숨으면 끊고, 다시 보이면 붙는다. 브라우저가 다시 온라인이 되면 기다리지 않고 붙는다
 * - 로그아웃 · 세션 만료면 종이 사라지며 끊는다(이 훅이 내려간다)
 *
 * `onArrive` — 안 읽은 새 알림이 왔다(스크린리더에 수를 한 번 알리는 데 쓴다)
 */
export function useNotificationStream(enabled: boolean, onArrive: (notification: NotificationResponse) => void) {
  const queryClient = useQueryClient()
  const onArriveRef = useRef(onArrive)

  useEffect(() => {
    onArriveRef.current = onArrive
  })

  useEffect(() => {
    if (!enabled) return

    const stream = createNotificationStream({
      open: openNotificationStream,
      onNotification: (notification) => {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
        if (notification.postId !== null) {
          void queryClient.invalidateQueries({ queryKey: postKeys.detail(notification.postId), exact: true })
          // 내 글에 새 후보 — 보고 있는 추천 묶음도 다시 받는다(보고 있지 않으면 다음에 열 때)
          if (notification.type === 'MATCH_SUGGESTED') {
            void queryClient.invalidateQueries({ queryKey: matchKeys.post(notification.postId) })
          }
        }
        if (!notification.read) onArriveRef.current(notification)
      },
      onConnected: ({ reconnect }) => {
        if (reconnect) void queryClient.invalidateQueries({ queryKey: notificationKeys.unread() })
      },
    })

    const syncVisibility = () => {
      if (document.visibilityState === 'hidden') stream.pause()
      else stream.resume()
    }
    const onOnline = () => stream.retryNow()

    if (document.visibilityState === 'hidden') {
      // 숨은 탭에서 로그인이 풀려 다시 된 경우 — 보일 때 붙는다
      stream.start()
      stream.pause()
    } else {
      stream.start()
    }
    document.addEventListener('visibilitychange', syncVisibility)
    window.addEventListener('online', onOnline)

    return () => {
      document.removeEventListener('visibilitychange', syncVisibility)
      window.removeEventListener('online', onOnline)
      stream.stop()
    }
  }, [enabled, queryClient])
}
