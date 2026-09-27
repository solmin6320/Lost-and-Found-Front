import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/** 새 화면의 제목(`h1`)이 그려지기를 기다리는 최대 시간. 상세처럼 불러온 뒤에 제목이 생기는 화면이 있다 */
const HEADING_WAIT_MS = 1500
/** 뒤로가기로 돌아왔을 때 떠날 때 누른 링크를 기다리는 최대 시간. 목록은 캐시에서 바로 그려져 보통 첫 프레임에 있다 */
const ORIGIN_WAIT_MS = 600

/**
 * 화면을 옮기면 포커스를 새 화면의 제목(`#main h1`)으로 옮긴다.
 *
 * SPA 는 화면이 바뀌어도 브라우저가 "새 페이지"라고 알리지 않는다. 누른 링크는 사라지고 포커스는 문서 맨 앞(body)으로 빠진다 —
 * 키보드 사용자는 헤더부터 다시 Tab 을 눌러 내려와야 하고, 스크린리더는 화면이 바뀐 것을 모른다.
 * 제목에 포커스를 두면 새 화면의 이름이 바로 읽히고, 거기서 Tab 한 번이면 본문이다.
 *
 * - **뒤로 · 앞으로(POP)는 떠날 때 누른 링크로 돌아간다.** 목록 → 상세 → 뒤로 하면 보던 카드에 포커스가 있다.
 *   제목으로 보내면 스크롤은 카드 앞(ScrollMemory)인데 포커스는 맨 위라, 다음 Tab 에서 화면이 맨 위로 튄다.
 *   누른 링크는 스크롤 위치와 같은 키(`location.key`)로 기억한다. 링크가 없으면(지워진 글 · 다른 쪽) 제목으로 간다
 * - **경로가 바뀔 때만.** 첫 화면 · 같은 화면 안에서 주소만 바뀌는 것(목록의 필터 · 페이지)은 그 화면이 스스로 옮긴다
 * - **스크롤을 밀지 않는다**(`preventScroll`). 뒤로가기로 목록을 되돌린 위치(ScrollMemory)가 그대로 남는다
 * - **화면이 먼저 옮겼으면 두고 본다.** 이어 쓰기 묻기 · 폼 오류처럼 화면이 고른 자리가 더 정확하다.
 *   사용자가 기다리는 사이 Tab 을 눌렀어도 그대로 둔다
 * - 제목이 불러온 뒤에 생기면 잠깐 기다린다. 끝내 없으면(불러오기 실패) 탭 제목을 알림 영역으로 읽어 준다
 *
 * 제목은 `tabIndex={-1}` 이어야 포커스를 받는다. 붙어 있지 않으면 여기서 붙인다(탭 순서에는 들어가지 않는다).
 * 누른 링크는 이 탭의 메모리에만 둔다. 새로고침하면 잊고 제목으로 간다.
 */
export function RouteFocus() {
  const { pathname, key } = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef(pathname)
  const currentKey = useRef(key)
  /** 기록 항목(`location.key`)마다 거기서 마지막으로 누른 본문 링크의 `href` */
  const origins = useRef(new Map<string, string>())
  /** 포커스를 옮기려고 기다리는 프레임. 같은 화면 안에서 주소만 바뀌어도(필터 정리 · replace) 끊지 않고, 경로가 또 바뀔 때만 끊는다 */
  const frame = useRef(0)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  useEffect(() => {
    // 캡처 단계에서 적는다 — 링크의 이동(React Router)보다 먼저, 아직 떠나기 전의 키로. Enter 로 누른 링크도 click 이 온다
    function remember(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null
      const link = target?.closest<HTMLAnchorElement>('#main a[href]')
      const href = link?.getAttribute('href')
      if (!href) return
      const store = origins.current
      store.delete(currentKey.current)
      store.set(currentKey.current, href)
      // 오래된 것부터 버린다. 기록 항목은 끝없이 늘어난다
      if (store.size > 50) store.delete(store.keys().next().value as string)
    }
    document.addEventListener('click', remember, true)
    return () => document.removeEventListener('click', remember, true)
  }, [])

  useEffect(() => {
    currentKey.current = key
    if (previous.current === pathname) return
    previous.current = pathname
    cancelAnimationFrame(frame.current)
    setAnnouncement('')

    const main = document.getElementById('main')
    if (!main) return
    const origin = document.activeElement
    const started = performance.now()
    const originHref = navigationType === 'POP' ? origins.current.get(key) : undefined

    function focusMovedElsewhere() {
      const now = document.activeElement
      if (!now || now === document.body) return false
      return now !== origin || main?.contains(now) === true
    }

    function findOriginLink() {
      if (!originHref || performance.now() - started > ORIGIN_WAIT_MS) return null
      for (const link of main?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? []) {
        if (link.getAttribute('href') === originHref) return link
      }
      return undefined
    }

    frame.current = requestAnimationFrame(function move() {
      if (focusMovedElsewhere()) return
      const link = findOriginLink()
      if (link) {
        link.focus({ preventScroll: true })
        return
      }
      // 아직 그려지는 중일 수 있다 — 링크를 잠깐 더 기다린다
      if (link === undefined) {
        frame.current = requestAnimationFrame(move)
        return
      }
      const heading = main.querySelector('h1')
      if (heading) {
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
        heading.focus({ preventScroll: true })
        return
      }
      if (performance.now() - started < HEADING_WAIT_MS) {
        frame.current = requestAnimationFrame(move)
        return
      }
      setAnnouncement(document.title)
    })
  }, [pathname, key, navigationType])

  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </p>
  )
}
