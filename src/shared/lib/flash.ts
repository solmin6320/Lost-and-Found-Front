import { useSyncExternalStore } from 'react'

/**
 * 짧은 알림의 저장소 — 화면을 옮긴 뒤 "무엇이 끝났는지" 한 줄(글 삭제 → 목록).
 * 누르기 **전** 고지를 대신하지 않는다. 결과 고지는 다이얼로그 · 인라인이 맡고, 이건 끝났다는 확인뿐이다.
 * 그리는 곳은 `shared/ui/Flash` 의 `FlashViewport`(레이아웃에 하나)
 */

export interface FlashMessage {
  id: number
  text: string
  /** `done` 끝났다(체크) · `info` 하려던 일이 안 됐고 그 이유(권한 없음 · 이미 지워진 글) */
  tone: 'done' | 'info'
}

let current: FlashMessage | null = null
let seq = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function showFlash(text: string, tone: FlashMessage['tone'] = 'done') {
  seq += 1
  current = { id: seq, text, tone }
  emit()
}

export function dismissFlash(id: number) {
  if (current?.id !== id) return
  current = null
  emit()
}

export function useFlash(): FlashMessage | null {
  return useSyncExternalStore(subscribe, () => current)
}
