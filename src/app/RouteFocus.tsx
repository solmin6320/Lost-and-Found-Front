import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

import { isScrollRestoring } from './scrollRestore'

/** 새 화면의 제목(`h1`)이 그려지기를 기다리는 최대 시간. 상세처럼 불러온 뒤에 제목이 생기는 화면이 있다 */
const HEADING_WAIT_MS = 1500
/** 뒤로가기로 돌아왔을 때 떠날 때 누른 링크를 기다리는 최대 시간. 목록은 캐시에서 바로 그려져 보통 첫 프레임에 있다 */
const ORIGIN_WAIT_MS = 600
/** 같은 경로의 뒤로 · 앞으로에서 스크롤 되돌리기(ScrollMemory)가 끝나기를 기다리는 최대 시간(ScrollMemory 의 1.2초 + 여유) */
const RESTORE_WAIT_MS = 1500

/**
 * 페이지를 넘긴 뒤 포커스가 가는 자리(목록 · 내가 쓴 글의 결과 제목)에 다는 표시. 같은 경로의 뒤로 · 앞으로에서
 * 고른 자리가 모두 화면 밖이면 여기로 — 그 기록의 스크롤은 대개 넘긴 직후의 자리(결과 제목 줄)다
 */
export const PAGE_TURN_FOCUS_ATTR = 'data-page-turn-focus'

/** 떠날 때의 포커스를 다시 찾는 단서. 링크는 `href`, 그 밖에는 `id` — 다시 그려져도 같은 것을 찾는다 */
interface FocusMark {
  href?: string
  id?: string
}

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
 * - **경로가 바뀔 때만 제목으로.** 첫 화면 · 같은 화면 안에서 주소만 바뀌는 것(목록의 필터 · 페이지)은 그 화면이 스스로 옮긴다
 * - **같은 경로의 뒤로 · 앞으로도 떠날 때 누른 링크로**(QA-P-16, 2026-10-17). 목록 2페이지 → 뒤로 하면 스크롤은 누르던 번호 줄(ScrollMemory)인데
 *   포커스는 넘길 때 옮긴 결과 제목(화면 밖 2,600px 위)에 남아, 다음 Tab 에서 화면이 맨 위로 튀었다. 누른 링크(페이지 번호 · 화살표)를
 *   모르면 — 지금 포커스가 화면에 보이면 그대로, 화면 밖이면 보이는 지금 페이지 번호(`aria-current="page"`)로. 스크롤은 밀지 않는다
 * - **고르는 것은 스크롤을 되돌린 뒤, 화면 안의 것만**(QA-P-24 · D-21 · D-22, 2026-10-18). 되돌리기 전에 재면 아직 옮기기 전의 화면으로 재서
 *   되돌린 뒤 화면 밖인 링크에 포커스가 남았다(목록 3페이지 → 뒤로 → Tab → 앞으로 하면 포커스가 3,218px 아래 `4페이지` — 다음 Tab 에 화면이 튀었다).
 *   차례 : 떠날 때 누른 링크 → **떠날 때 포커스가 있던 것**(뒤로가기 단추로 떠나 누른 링크가 없는 기록도 돌아올 자리가 있다) →
 *   지금 포커스 → 지금 페이지 번호 → 페이지를 넘긴 뒤 자리(결과 제목, `data-page-turn-focus`). 이 가운데 화면 안의 첫 것
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
  /** 기록 항목마다 거기서 마지막으로 포커스가 있던 본문 요소(떠날 때의 포커스). 뒤로가기 단추처럼 링크 없이 떠난 기록에도 남는다 */
  const departed = useRef(new Map<string, FocusMark>())
  /** 포커스를 옮기려고 기다리는 프레임. 같은 화면 안에서 주소만 바뀌어도(필터 정리 · replace) 끊지 않고, 경로가 또 바뀔 때만 끊는다 */
  const frame = useRef(0)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // 지금 기록의 키는 그리는 즉시(레이아웃 단계) 바꾼다 — 화면이 effect 에서 옮기는 포커스(페이지 넘김의 결과 제목)가 새 기록의 것으로 적힌다
  useLayoutEffect(() => {
    currentKey.current = key
  }, [key])

  useEffect(() => {
    // 본문 안에서 포커스가 옮겨 갈 때마다 그 기록의 "떠날 때의 포커스"를 새로 적는다
    function track(event: FocusEvent) {
      const mark = markOf(event.target)
      if (!mark) return
      const store = departed.current
      store.delete(currentKey.current)
      store.set(currentKey.current, mark)
      if (store.size > 50) store.delete(store.keys().next().value as string)
    }
    document.addEventListener('focusin', track)
    return () => document.removeEventListener('focusin', track)
  }, [])

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
    if (previous.current === pathname) {
      if (navigationType === 'POP') returnToOrigin(origins.current.get(key), departed.current.get(key), frame)
      return
    }
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

/**
 * 같은 경로 안의 뒤로 · 앞으로 — 스크롤을 되돌린 뒤(ScrollMemory), 화면 안에 보이는 것 가운데
 * 떠날 때 누른 링크 → 떠날 때의 포커스 → 지금 포커스 → 지금 페이지 번호 → 페이지를 넘긴 뒤 자리(결과 제목) 차례로 고른다(스크롤은 그대로).
 * 기다리는 동안 사용자가 포커스를 옮겼으면(Tab · 누름) 손대지 않는다. 다 화면 밖이면 두고 본다
 */
function returnToOrigin(originHref: string | undefined, left: FocusMark | undefined, frame: { current: number }) {
  cancelAnimationFrame(frame.current)
  const main = document.getElementById('main')
  if (!main) return
  const before = document.activeElement
  const started = performance.now()

  frame.current = requestAnimationFrame(function move() {
    if (document.activeElement !== before) return
    const waited = performance.now() - started
    const origin = originHref ? findLink(main, originHref) : null
    // 스크롤이 아직 제자리가 아니다 · 누른 링크가 아직 그려지는 중일 수 있다(캐시가 없으면 받은 뒤에 그린다) — 잠깐 더 기다린다
    if ((isScrollRestoring() && waited < RESTORE_WAIT_MS) || (originHref && !origin && waited < ORIGIN_WAIT_MS)) {
      frame.current = requestAnimationFrame(move)
      return
    }
    const candidates: (Element | null)[] = [
      origin,
      left ? findMark(main, left) : null,
      document.activeElement,
      main.querySelector('nav[aria-label="페이지 이동"] a[aria-current="page"]'),
      main.querySelector(`[${PAGE_TURN_FOCUS_ATTR}]`),
    ]
    const target = candidates.find(inView)
    if (target instanceof HTMLElement && target !== document.activeElement) target.focus({ preventScroll: true })
  })
}

function findLink(main: HTMLElement, href: string): HTMLAnchorElement | null {
  for (const link of main.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (link.getAttribute('href') === href) return link
  }
  return null
}

function findMark(main: HTMLElement, mark: FocusMark): Element | null {
  if (mark.href) return findLink(main, mark.href)
  if (mark.id) {
    const element = document.getElementById(mark.id)
    return element && main.contains(element) ? element : null
  }
  return null
}

/** 본문 안의 포커스 받은 요소 → 다시 찾을 단서. 링크는 href, 아니면 id. 둘 다 없으면 적지 않는다 */
function markOf(target: EventTarget | null): FocusMark | null {
  if (!(target instanceof HTMLElement) || !target.closest('#main')) return null
  const href = target instanceof HTMLAnchorElement ? target.getAttribute('href') : null
  if (href) return { href }
  if (target.id) return { id: target.id }
  return null
}

function inView(element: Element | null): boolean {
  if (!element || element === document.body) return false
  const rect = element.getBoundingClientRect()
  return rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
}
