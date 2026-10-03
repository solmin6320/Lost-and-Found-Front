import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { useBlocker, useLocation, type Blocker } from 'react-router-dom'

/**
 * 쓰던 칸 등록부 — "지금 이 화면에 쓰던 글자가 있나"를 한곳에서 안다(디자인 회의 2026-10-01 AR2-3 · SE-5 · SE2-10).
 *
 * 왜 하나인가
 * - React Router 의 `useBlocker` 는 **한 번에 하나만** 동작한다. 칸마다(설정의 닉네임 · 비밀번호, 상세의 댓글 · 댓글 수정)
 *   막는 곳을 따로 두면 서로 덮어써 어떤 화면은 묻고 어떤 화면은 안 묻는다
 * - 그래서 칸은 **"쓰던 글자가 있다"만 알리고**(`useDirtyField`), 막는 곳은 레이아웃에 하나(`useDirtyLeaveGuard`)다.
 *   로그아웃 확인(SE-5) · 다른 창 로그아웃(SE2-10)도 같은 판정을 읽는다
 *
 * 무엇을 담나
 * - 칸마다 `dirty` 와, 막을 때 띄울 문장(없으면 공통 문장). **글자 자체는 담지 않는다** — 메모리에만 있고 저장소에 쓰지 않는다
 *   (새 저장소 키 없음, 보안명세서 3장 "직접 로그아웃하면 남기지 않는다" 그대로)
 *
 * React 를 모르는 부분(등록 · 판정)과 훅을 한 파일에 둔다. 시험은 React 없이 앞부분만 부른다.
 */

/** 막을 때 띄우는 문장. 칸이 정하지 않으면 공통 문장 */
export interface LeaveCopy {
  title: string
  body: string
}

export const DEFAULT_LEAVE_COPY: LeaveCopy = {
  title: '쓰던 글을 두고 나갈까요?',
  body: '나가면 쓰던 내용은 저장되지 않아요.',
}

interface Entry {
  dirty: boolean
  copy?: LeaveCopy
  /** 등록한 순서. 여러 칸이 쓰던 중이면 먼저 등록한(화면 위쪽) 칸의 문장을 쓴다 */
  order: number
}

const entries = new Map<string, Entry>()
let order = 0
/** 이번 한 번은 떠나도 된다(저장 끝 · "나가기"를 고름 · 로그아웃을 고름). 경로가 바뀌면 다시 막는다 */
let released = false
/** 이 탭에서 사용자가 로그아웃을 골랐다 — 다른 창 로그아웃(SE2-10)과 가른다. 경로가 바뀌면 지운다 */
let selfLogout = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

/** 칸의 상태를 적는다. 같은 값이면 알리지 않는다 */
export function setDirtyField(id: string, dirty: boolean, copy?: LeaveCopy): void {
  const prev = entries.get(id)
  if (prev && prev.dirty === dirty && prev.copy === copy) return
  entries.set(id, { dirty, copy, order: prev?.order ?? (order += 1) })
  emit()
}

/** 칸이 화면에서 사라졌다 */
export function removeDirtyField(id: string): void {
  if (entries.delete(id)) emit()
}

/** 지금 쓰던 글자가 있나 — 떠나도 된다고 풀어 둔 동안은 없다고 본다 */
export function hasDirtyFields(): boolean {
  if (released) return false
  for (const entry of entries.values()) if (entry.dirty) return true
  return false
}

/** 막을 때 띄울 문장 — 쓰던 칸 가운데 먼저 등록한 칸의 것. 없으면 공통 문장 */
export function leaveCopy(): LeaveCopy {
  let first: Entry | undefined
  for (const entry of entries.values()) {
    if (entry.dirty && (!first || entry.order < first.order)) first = entry
  }
  return first?.copy ?? DEFAULT_LEAVE_COPY
}

/** 이번 이동은 막지 않는다. 다음에 경로가 바뀌면(`resetLeaveRelease`) 다시 막는다 */
export function allowLeave(): void {
  if (released) return
  released = true
  emit()
}

/** 경로가 바뀌었다 — 풀어 둔 것 · 로그아웃 표시를 거둔다(레이아웃의 막는 곳이 부른다) */
export function resetLeaveRelease(): void {
  selfLogout = false
  if (!released) return
  released = false
  emit()
}

/**
 * 사용자가 이 탭에서 로그아웃을 골랐다(SE-5 확인을 거쳤거나 쓰던 글자가 없었다).
 * 쓰던 칸은 이것을 보고 "다른 창에서 로그아웃당한 것"(SE2-10)과 가른다
 */
export function markSelfLogout(): void {
  selfLogout = true
}

/**
 * 방금 끝난 로그아웃이 이 탭에서 고른 것이었나. 여러 칸(글 폼 · 댓글)이 같이 읽어도 같은 답이다 —
 * 읽는다고 지우지 않고, 경로가 바뀔 때 지운다(로그아웃하면 대개 로그인 화면으로 옮겨진다)
 */
export function isSelfLogout(): boolean {
  return selfLogout
}

/** 시험용 — 등록부를 처음 상태로 */
export function resetDirtyRegistry(): void {
  entries.clear()
  released = false
  selfLogout = false
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/* ── 훅 ─────────────────────────────────────────────────────────── */

/**
 * 쓰던 칸이 등록부에 알린다. `dirty` 는 "쓰던 글자가 있다"(처음 값과 다르다)만. 사라지면 지운다.
 * `copy` 는 렌더마다 새로 만들지 않는다(상수로 둔다) — 바뀌면 다시 알린다
 */
export function useDirtyField(dirty: boolean, copy?: LeaveCopy): void {
  const id = useId()
  useEffect(() => {
    setDirtyField(id, dirty, copy)
  }, [id, dirty, copy])
  useEffect(() => () => removeDirtyField(id), [id])
}

/** 지금 쓰던 글자가 있나(그리기용). 로그아웃 확인 · 다른 창 로그아웃 처리가 읽는다 */
export function useHasDirtyFields(): boolean {
  return useSyncExternalStore(subscribe, hasDirtyFields, hasDirtyFields)
}

export interface DirtyLeaveGuard {
  /** 앱 안 이동이 막혔을 때 `state === 'blocked'`. 확인 창을 띄우고 `proceed()` · `reset()` 중 하나를 부른다 */
  blocker: Blocker
  /** 막을 때 띄울 문장 */
  copy: LeaveCopy
}

/**
 * 막는 곳 — **레이아웃에 하나만** 둔다(화면정의서 1.7).
 * - 앱 안 이동(링크 · 뒤로가기 · `navigate`) : 경로가 바뀌는 이동만 막는다. `?` 뒤만 바뀌면 쓰던 칸이 그대로다
 * - 새로고침 · 탭 닫기 : `beforeunload`(문장은 브라우저가 정한다)
 * 막을지는 **이동하는 그 순간** 등록부를 읽어 정한다 — 저장이 끝나 `allowLeave()` 한 바로 다음 이동이 막히지 않는다
 */
export function useDirtyLeaveGuard(): DirtyLeaveGuard {
  const location = useLocation()
  const dirtyNow = useSyncExternalStore(subscribe, hasDirtyFields, hasDirtyFields)
  const copy = useSyncExternalStore(subscribe, leaveCopy, leaveCopy)

  // 경로가 바뀌었다 — 풀어 둔 것을 거둔다(다음 화면의 쓰던 칸은 다시 지킨다)
  const lastPath = useRef(location.pathname)
  useEffect(() => {
    if (lastPath.current === location.pathname) return
    lastPath.current = location.pathname
    resetLeaveRelease()
  }, [location.pathname])

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        currentLocation.pathname !== nextLocation.pathname && hasDirtyFields(),
      [],
    ),
  )

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasDirtyFields()) return
      event.preventDefault()
      // 옛 브라우저는 이 값이 있어야 묻는다
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // 막힌 채로 더 막을 이유가 없어지면(저장이 끝나 화면이 스스로 떠난다) 막힌 이동은 거둔다 — 두 이동이 겹치지 않게
  useEffect(() => {
    if (blocker.state === 'blocked' && !dirtyNow) blocker.reset()
  }, [blocker, dirtyNow])

  return { blocker, copy }
}
