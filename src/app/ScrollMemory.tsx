import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

import { setScrollRestoring } from './scrollRestore'

/**
 * 화면을 오갈 때의 스크롤 위치. 데이터 라우터의 `<ScrollRestoration>` 대신 직접 둔다(새 화면 · 뒤로가기 규칙과 새로고침 뒤 이어 두기가 이 앱에 맞춰져 있다).
 *
 * - **새 화면으로 가면(PUSH · REPLACE) 맨 위에서 시작한다.** 목록을 한참 내린 채 글을 누르면
 *   상세가 중간부터 열리던 것을 막는다. 같은 화면 안에서 주소만 바뀌는 것(목록의 필터 · 페이지)은 건드리지 않는다 —
 *   목록이 스스로 결과 제목으로 데려간다
 * - **뒤로 · 앞으로(POP)는 떠날 때의 위치로 돌아간다.** 목록 → 상세 → 뒤로 하면 보던 카드 앞으로 온다.
 *   목록은 캐시(5분)에서 바로 그려져 높이가 같다. 아직 짧으면(불러오는 중) 잠깐 기다렸다가 맞춘다
 *
 * 위치는 기록 항목(`location.key`)마다 적어 둔다. 스크롤을 따라 적되 프레임당 한 번, 상태로 올리지 않는다(다시 그리지 않음).
 * 새로고침 뒤에도 같은 탭이면 이어지도록 떠날 때 sessionStorage 에 넣는다. 비밀이 아니다. 이어 두는 것은 새로고침 · 브라우저 뒤로 · 앞으로로
 * 연 문서뿐 — 주소를 새로 열면 맨 위에서 시작한다(QA-P-33).
 * 브라우저의 자동 복원은 끈다(`manual`) — 둘이 겹치면 React 가 그리기 전에 브라우저가 먼저 옮겨 어긋난다.
 * 되돌리는 동안은 `scrollRestore` 에 알린다 — 포커스(RouteFocus)는 다 되돌린 뒤의 화면을 보고 자리를 고른다(QA-P-24).
 */

const STORAGE_KEY = 'scroll:v1'
/** 목적지 높이가 모자랄 때 기다리는 최대 시간. 그 뒤에는 닿는 데까지만 */
const RESTORE_WAIT_MS = 1200

function loadPositions(): Map<string, number> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    const entries = raw ? (JSON.parse(raw) as [string, number][]) : []
    return new Map(Array.isArray(entries) ? entries : [])
  } catch {
    return new Map()
  }
}

function savePositions(positions: Map<string, number>) {
  try {
    // 오래된 것부터 버린다. 기록 항목은 끝없이 늘어난다
    const entries = [...positions].slice(-50)
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // 저장소가 막힌 브라우저 — 이 탭 안에서만 기억한다
  }
}

/** 이 문서를 새로고침 · 브라우저 뒤로 · 앞으로로 열었나. 모르는 브라우저는 새로 연 것으로 본다(맨 위가 덜 놀랍다) */
function isReturningDocument(): boolean {
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  return entry?.type === 'reload' || entry?.type === 'back_forward'
}

export function ScrollMemory() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const currentKey = useRef(location.key)
  const previousPath = useRef(location.pathname)

  // 주소를 새로 열었으면(주소창 · 링크 · 북마크) 맨 위에서 시작한다 — 새로고침 · 브라우저 뒤로 · 앞으로로 돌아온 문서만 이어 둔다(QA-P-33).
  // 새로 연 문서도 첫 기록의 키가 같아(`default`) 지난번 그 탭에서 보던 자리(/me 1,007px)로 데려갔다. 지운 뒤 이번 방문의 스크롤을 새로 적는다
  const [positions] = useState(() => {
    const loaded = loadPositions()
    if (!isReturningDocument()) loaded.delete(location.key)
    return loaded
  })

  useEffect(() => {
    const store = positions
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    let frame = 0
    function record() {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        store.set(currentKey.current, window.scrollY)
      })
    }
    function persist() {
      savePositions(store)
    }

    window.addEventListener('scroll', record, { passive: true })
    window.addEventListener('pagehide', persist)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', record)
      window.removeEventListener('pagehide', persist)
      window.history.scrollRestoration = previous
    }
  }, [positions])

  useLayoutEffect(() => {
    const key = location.key
    const pathChanged = previousPath.current !== location.pathname
    currentKey.current = key
    previousPath.current = location.pathname

    if (navigationType !== 'POP') {
      if (pathChanged) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      return
    }

    const target = positions.get(key)
    if (target === undefined) return

    // 목적지가 아직 짧으면(불러오는 중) 높이가 찰 때까지 몇 프레임 기다린다
    const started = performance.now()
    let frame = 0
    setScrollRestoring(true)
    function restore() {
      const reachable = document.documentElement.scrollHeight - window.innerHeight
      if (reachable >= (target ?? 0) || performance.now() - started > RESTORE_WAIT_MS) {
        window.scrollTo({ top: target, left: 0, behavior: 'instant' })
        setScrollRestoring(false)
        return
      }
      frame = requestAnimationFrame(restore)
    }
    restore()
    return () => {
      cancelAnimationFrame(frame)
      setScrollRestoring(false)
    }
  }, [location.key, location.pathname, navigationType, positions])

  return null
}
