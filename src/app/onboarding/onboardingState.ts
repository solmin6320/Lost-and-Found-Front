import { useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * 온보딩 1층(docs/온보딩설계.md 3장)의 두 가지 상태.
 *
 * 1. 완료 여부 — localStorage `onboarding:v1:done` = '1'. 비밀이 아니다(보안명세서 3장의 토큰 금지와 무관).
 *    기기를 바꾸면 다시 뜬다. 내용을 바꾸면 키를 `v2` 로 올려 다시 보여 준다.
 *    저장소가 막힌 브라우저(사생활 보호 모드 · 차단 설정)에서도 던지지 않는다 — 그때는 "안 봤음" 으로 둔다.
 *    가입 직후 신호는 기록에서 지우므로(목록이 읽자마자 지운다) 새로고침해도 다시 뜨지 않는다.
 *
 * 2. 다시 보기 요청 — 헤더의 `서비스 안내`. 헤더는 어느 화면에나 있고 안내는 목록에서 뜬다.
 *    다른 화면에서 누르면 요청을 남기고 목록으로 간다. 목록이 요청을 가져가며 안내를 연다.
 */

const DONE_KEY = 'onboarding:v1:done'

export function isOnboardingDone(): boolean {
  try {
    return window.localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}

export function markOnboardingDone() {
  try {
    window.localStorage.setItem(DONE_KEY, '1')
  } catch {
    // 이 탭에서는 이미 닫혔다. 다음 가입 때만 다시 뜬다
  }
}

let requested = false
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 헤더 `서비스 안내` — 안내를 열어 달라고 남긴다 */
export function requestGuide() {
  requested = true
  notify()
}

/** 남은 요청을 가져간다. 있었으면 `true` — 한 번만 `true` 를 돌려준다 */
export function takeGuideRequest(): boolean {
  if (!requested) return false
  requested = false
  notify()
  return true
}

export function useGuideRequested(): boolean {
  return useSyncExternalStore(subscribe, () => requested)
}

/*
 * 3. 화면별 안내 — 목록이 아닌 화면에도 그 화면의 2층 안내(docs/온보딩설계.md 4장)가 있으면
 *    헤더 `서비스 안내`가 목록으로 떠나지 않고 **그 안내를 연다.** 보던 글을 잃지 않는다.
 *    지금은 상세(SCR-03)의 `이름표 안내` 하나다. 한 번에 한 화면만 등록한다(마지막에 그린 화면).
 */
let pageGuide: (() => void) | null = null

/** 화면이 자기 안내를 여는 방법을 헤더에 알려 둔다. 화면을 떠나면 저절로 지워진다 */
export function usePageGuide(open: () => void) {
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
  })

  useEffect(() => {
    const handler = () => openRef.current()
    pageGuide = handler
    return () => {
      if (pageGuide === handler) pageGuide = null
    }
  }, [])
}

/** 헤더 `서비스 안내` — 화면별 안내가 있으면 열고 `true` */
export function openPageGuide(): boolean {
  if (!pageGuide) return false
  pageGuide()
  return true
}
