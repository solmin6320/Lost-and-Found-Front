import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { memberKeys } from '@/features/members'

import { blockChatRoom, getChatMessages, getChatRooms, markChatRoomRead } from '../api/chatApi'
import type { ChatRoomResponse } from '../api/types'
import { nextBefore } from './chatView'

/**
 * 채팅 쿼리 키 — **회원 키(`memberKeys.all`) 아래에** 둔다. 대화는 두 사람만 보는 개인 데이터라 로그아웃 · 세션 만료 ·
 * 다른 탭 로그아웃 때 `AuthProvider` 가 `memberKeys.all` 을 지우며 같이 지워진다(보안명세서 8장, 확인 요청 키와 같은 까닭)
 */
export const chatKeys = {
  all: [...memberKeys.all, 'chat'] as const,
  rooms: () => [...chatKeys.all, 'rooms'] as const,
  messages: (roomId: number) => [...chatKeys.all, 'messages', roomId] as const,
}

/**
 * 내 대화방 목록 — 헤더 종(배지의 `메시지` 수 · 대화 탭) · 채팅 화면 머리 · 상세의 `[대화하기]`가 같은 캐시를 쓴다.
 * 로그인했을 때만 켠다. 새 메시지 알림(SSE `CHAT_MESSAGE`) · 승인 · 거절 알림 · 읽음 · 차단 뒤에 다시 받는다
 */
export function useChatRooms(enabled: boolean) {
  return useQuery({
    queryKey: chatKeys.rooms(),
    queryFn: ({ signal }) => getChatRooms(signal),
    enabled,
    staleTime: 10_000,
  })
}

/**
 * 한 방의 기록 — 페이지마다 최신 순 30개, 다음 페이지는 더 옛날(`before` = 받은 것 중 가장 작은 id).
 * 실시간 메시지는 맨 앞 페이지에 더한다(`insertLiveMessage`). 방에 다시 들어오면 새로 받는다(그사이 온 것)
 */
export function useChatMessages(roomId: number | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(roomId ?? 0),
    queryFn: ({ pageParam, signal }) => getChatMessages(roomId ?? 0, pageParam, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => nextBefore(last),
    enabled: enabled && roomId !== null,
    staleTime: 0,
    gcTime: 60_000,
  })
}

/**
 * 읽음 — 방에 들어왔을 때 · 보고 있는 동안 상대 메시지가 왔을 때. 기다리지 않는다(화면 먼저 — 그 방 안 읽은 수 0).
 * 서버가 그 방의 `CHAT_MESSAGE` 알림도 읽음으로 바꾼다 — 종의 알림 수는 대화 수가 줄 때 종 쪽이 다시 받는다(`NotificationCenter`)
 */
export function useMarkRoomRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roomId: number) => markChatRoomRead(roomId),
    onMutate: (roomId) => {
      queryClient.setQueryData<ChatRoomResponse[]>(chatKeys.rooms(), (rooms) =>
        rooms?.map((room) => (room.roomId === roomId && room.unreadCount !== 0 ? { ...room, unreadCount: 0 } : room)),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chatKeys.rooms() }),
  })
}

/** 차단 — 되돌릴 수 없다(확인 창). 끝나면 방 상태 · 기록(안내 메시지)을 다시 받는다 */
export function useBlockRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roomId: number) => blockChatRoom(roomId),
    onSettled: (_data, _error, roomId) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() })
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(roomId) })
    },
  })
}
