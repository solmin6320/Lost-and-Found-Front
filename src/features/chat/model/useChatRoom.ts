import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { claimKeys } from '@/features/claims'
import { postKeys } from '@/features/posts'

import { getChatMessages } from '../api/chatApi'
import type { ChatMessageResponse } from '../api/types'
import { chatKeys } from './chatQueries'
import { insertLiveMessage, isSystemMessage, mergeNewestPage, parseChatError, parseChatMessage, type MessagePages } from './chatView'
import { useChatConnection } from './useChatConnection'

/** 내가 보낸 뒤 서버가 방에 되돌려 줄 때까지의 말풍선 */
export interface PendingMessage {
  key: string
  content: string
  state: 'sending' | 'failed'
  /** 못 보낸 까닭(서버 문장 그대로 · 연결 끊김) */
  error?: string
}

/** 보낸 말이 이만큼 지나도 방에 돌아오지 않으면 못 보낸 것으로 본다 */
export const SEND_CONFIRM_MS = 10_000

const DISCONNECTED_SEND = '연결이 끊겨 보내지 못했어요.'
const UNCONFIRMED_SEND = '보냈는지 확인하지 못했어요. 대화를 다시 받아 확인한 뒤 다시 보내 주세요.'

interface UseChatRoomOptions {
  roomId: number | null
  /** 나(회원 id) — 되돌아온 내 말을 알아본다 */
  myId: number | null
  /** 로그인했을 때만 */
  enabled: boolean
  /** 기록을 받았다(=당사자다). 남의 방을 구독하면 서버가 연결째 끊으니 그 전에는 구독하지 않는다 */
  canSubscribe: boolean
  /** 그 글(방 상태가 바뀌면 상세 · 확인 요청도 다시 받는다) */
  postId: number | null
  /** 실시간 메시지가 왔다(읽음 처리 · 새 메시지 알림말 · 스크롤) */
  onArrive?: (message: ChatMessageResponse, mine: boolean) => void
}

/**
 * 방 하나의 실시간 — 구독 · 받은 메시지를 기록 캐시에 더하기 · 보내기(내 말풍선은 서버가 되돌려 줄 때까지 "보내는 중") ·
 * 다시 붙으면 끊긴 동안의 것을 기록 API 로 메우기 · 보낸 연결에만 오는 실패를 그 말풍선에.
 *
 * 안내 메시지(받았어요 · 승인 취소 · 차단)가 오면 방 상태가 바뀐 것이라 방 목록 · 그 글 상세 · 확인 요청을 다시 받는다
 */
export function useChatRoom({ roomId, myId, enabled, canSubscribe, postId, onArrive }: UseChatRoomOptions) {
  const queryClient = useQueryClient()
  const { connection, status } = useChatConnection(enabled && roomId !== null)
  const [pending, setPending] = useState<PendingMessage[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pendingRef = useRef(pending)
  useEffect(() => {
    pendingRef.current = pending
  })
  const onArriveRef = useRef(onArrive)
  useEffect(() => {
    onArriveRef.current = onArrive
  })

  const fail = useCallback((key: string | null, error: string) => {
    setPending((list) => {
      const target = key ?? list.find((p) => p.state === 'sending')?.key
      return list.map((p) => (p.key === target ? { ...p, state: 'failed', error } : p))
    })
  }, [])

  // 끊긴 동안 온 것 메우기 — 최신 한 페이지를 받아 합치고, 사이가 비었으면 기록 전체를 다시
  const catchUp = useCallback(async () => {
    if (roomId === null) return
    try {
      const newest = await getChatMessages(roomId, undefined)
      const key = chatKeys.messages(roomId)
      const { data, gap } = mergeNewestPage(queryClient.getQueryData<MessagePages>(key), newest)
      if (gap) void queryClient.invalidateQueries({ queryKey: key })
      else if (data) queryClient.setQueryData(key, data)
      void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() })
    } catch {
      // 다음 연결 · 다음 진입에 다시 메운다
    }
  }, [queryClient, roomId])

  useEffect(() => {
    if (!connection || !canSubscribe || roomId === null) return
    const key = chatKeys.messages(roomId)
    const off = connection.subscribe(`/topic/rooms/${roomId}`, (body) => {
      const message = parseChatMessage(body)
      if (!message || message.roomId !== roomId) return
      queryClient.setQueryData<MessagePages>(key, (data) => insertLiveMessage(data, message))
      const mine = myId !== null && message.senderId === myId
      if (mine) {
        // 되돌아온 내 말 — 가장 먼저 보낸 "보내는 중" 하나를 거둔다(서버가 가려 바꾼 글자라 본문으로 맞추지 않는다)
        setPending((list) => {
          const first = list.find((p) => p.state === 'sending')
          if (!first) return list
          const timer = timers.current.get(first.key)
          if (timer) clearTimeout(timer)
          timers.current.delete(first.key)
          return list.filter((p) => p !== first)
        })
      }
      if (isSystemMessage(message)) {
        void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() })
        if (postId !== null) void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId), exact: true })
        void queryClient.invalidateQueries({ queryKey: claimKeys.all })
      }
      onArriveRef.current?.(message, mine)
    })
    // 처음 붙을 때 · 다시 붙을 때 모두 — 구독이 서기 전에 온 것을 메운다
    const offConnected = connection.onConnected(() => void catchUp())
    const offError = connection.onServerError((body) => {
      const error = parseChatError(body)
      fail(null, error?.message ?? UNCONFIRMED_SEND)
      if (error?.code === 'CHAT_ROOM_NOT_OPEN') void queryClient.invalidateQueries({ queryKey: chatKeys.rooms() })
    })
    // 이미 열린 연결에 구독을 더했다 — 기록을 받은 뒤 구독이 서기까지의 틈을 메운다
    const gapTimer = connection.status === 'open' ? setTimeout(() => void catchUp(), 300) : null
    return () => {
      off()
      offConnected()
      offError()
      if (gapTimer) clearTimeout(gapTimer)
    }
  }, [connection, canSubscribe, roomId, myId, postId, queryClient, catchUp, fail])

  // 화면을 떠나면 남은 확인 시계를 지운다
  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((timer) => clearTimeout(timer))
      map.clear()
    }
  }, [])

  const transmit = useCallback(
    (key: string, content: string) => {
      if (roomId === null) return
      const sent = connection?.send(`/app/rooms/${roomId}`, JSON.stringify({ content })) ?? false
      if (!sent) {
        fail(key, DISCONNECTED_SEND)
        return
      }
      const timer = setTimeout(() => {
        timers.current.delete(key)
        fail(key, UNCONFIRMED_SEND)
        void catchUp()
      }, SEND_CONFIRM_MS)
      timers.current.set(key, timer)
    },
    [connection, roomId, fail, catchUp],
  )

  /** 보낸다 — 말풍선이 바로 "보내는 중"으로 선다 */
  const send = useCallback(
    (content: string) => {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setPending((list) => [...list, { key, content, state: 'sending' }])
      transmit(key, content)
    },
    [transmit],
  )

  /** 못 보낸 말을 다시 보낸다(맨 뒤로 옮긴다 — 되돌아오는 차례와 맞게) */
  const resend = useCallback(
    (key: string) => {
      const target = pendingRef.current.find((p) => p.key === key)
      if (!target || target.state !== 'failed') return
      setPending((list) => [...list.filter((p) => p.key !== key), { key, content: target.content, state: 'sending' }])
      transmit(key, target.content)
    },
    [transmit],
  )

  /** 못 보낸 말을 지운다 */
  const discard = useCallback((key: string) => {
    setPending((list) => list.filter((p) => p.key !== key))
  }, [])

  /** 멈춘 연결(다시 붙기를 그만둠)을 다시 연다 · 기다리는 중이면 바로 */
  const reconnect = useCallback(() => {
    if (!connection) return
    if (connection.status === 'stopped' || connection.status === 'idle') connection.start()
    else connection.retryNow()
  }, [connection])

  return { status, pending, send, resend, discard, catchUp, reconnect }
}
