import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** 새 화면의 제목(`h1`)이 그려지기를 기다리는 최대 시간. 상세처럼 불러온 뒤에 제목이 생기는 화면이 있다 */
const HEADING_WAIT_MS = 1500

/**
 * 화면을 옮기면 포커스를 새 화면의 제목(`#main h1`)으로 옮긴다.
 *
 * SPA 는 화면이 바뀌어도 브라우저가 "새 페이지"라고 알리지 않는다. 누른 링크는 사라지고 포커스는 문서 맨 앞(body)으로 빠진다 —
 * 키보드 사용자는 헤더부터 다시 Tab 을 눌러 내려와야 하고, 스크린리더는 화면이 바뀐 것을 모른다.
 * 제목에 포커스를 두면 새 화면의 이름이 바로 읽히고, 거기서 Tab 한 번이면 본문이다.
 *
 * - **경로가 바뀔 때만.** 첫 화면 · 같은 화면 안에서 주소만 바뀌는 것(목록의 필터 · 페이지)은 그 화면이 스스로 옮긴다
 * - **스크롤을 밀지 않는다**(`preventScroll`). 뒤로가기로 목록을 되돌린 위치(ScrollMemory)가 그대로 남는다
 * - **화면이 먼저 옮겼으면 두고 본다.** 이어 쓰기 묻기 · 폼 오류처럼 화면이 고른 자리가 더 정확하다.
 *   사용자가 기다리는 사이 Tab 을 눌렀어도 그대로 둔다
 * - 제목이 불러온 뒤에 생기면 잠깐 기다린다. 끝내 없으면(불러오기 실패) 탭 제목을 알림 영역으로 읽어 준다
 *
 * 제목은 `tabIndex={-1}` 이어야 포커스를 받는다. 붙어 있지 않으면 여기서 붙인다(탭 순서에는 들어가지 않는다).
 */
export function RouteFocus() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    setAnnouncement('')

    const main = document.getElementById('main')
    if (!main) return
    const origin = document.activeElement
    const started = performance.now()

    function focusMovedElsewhere() {
      const now = document.activeElement
      if (!now || now === document.body) return false
      return now !== origin || main?.contains(now) === true
    }

    let frame = requestAnimationFrame(function move() {
      if (focusMovedElsewhere()) return
      const heading = main.querySelector('h1')
      if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
        heading.focus({ preventScroll: true })
        return
      }
      if (performance.now() - started < HEADING_WAIT_MS) {
        frame = requestAnimationFrame(move)
        return
      }
      setAnnouncement(document.title)
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </p>
  )
}
