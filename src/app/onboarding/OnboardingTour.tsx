import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'

import { TypeBadge } from '@/features/posts'
import { usePressGuard } from '@/shared/lib/pressGuard'
import { Button } from '@/shared/ui/Button'

import { GUIDE_STEPS, guideFallbackControl, guideTargetElement, type GuideTarget } from './guideSteps'
import { markOnboardingDone } from './onboardingState'
import styles from './OnboardingTour.module.css'

interface OnboardingTourProps {
  open: boolean
  /** 끝까지 봤든 · 건너뛰었든 · Esc · 바깥을 눌렀든 닫힐 때 한 번 */
  onClose: () => void
  /**
   * 닫은 뒤 포커스를 둘 곳. 연 버튼(헤더 `서비스 안내`)이 있으면 그리로 돌아가고,
   * 가입 직후처럼 연 버튼이 없으면(누른 버튼이 이미 사라졌다) 이것을 쓴다
   */
  fallbackFocus?: () => HTMLElement | null
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

interface Placement {
  /** 대상을 두르는 테 */
  ring: Box
  /** 넓은 화면 카드의 자리. 좁은 화면(바텀 시트)은 아래에 붙어 자리를 계산하지 않는다 */
  card: { top: number; left: number } | null
}

/** 테 안을 눌러 닫았다 — 닫힌 뒤 그 자리의 동작을 대신 누른다 */
interface PendingAction {
  x: number
  y: number
  target: GuideTarget
}

/** 테 안에서 누를 수 있는 것 — 누른 점에서 가장 가까운 것을 고른다 */
const CONTROL =
  'a[href], button:not(:disabled), input:not([type="hidden"]):not(:disabled), select, textarea, label, [role="button"], [role="radio"], [role="tab"]'

/** 대상과 테 사이 */
const RING_GAP = 4
/** 테와 카드 사이 · 화면 가장자리와 카드 사이 */
const CARD_GAP = 12
const EDGE = 16
/** 이 폭부터 대상 옆에 작은 카드로 띄운다. 그보다 좁으면 바텀 시트 */
const WIDE = '(min-width: 48rem)'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * 온보딩 1층 — 가입 직후 한 번, 그리고 헤더 `서비스 안내`로 언제든 다시(docs/온보딩설계.md 3장).
 *
 * 가리키는 대상을 **테 하나로만** 두른다. 화면을 어둡게 덮지 않는다 — 뒤의 화면이 그대로 보여야
 * "이게 그 자리구나" 가 이어진다. 좁은 화면은 바텀 시트, 넓은 화면은 대상 근처의 작은 카드.
 *
 * 네이티브 `<dialog>` 의 `showModal()` — 바깥이 inert 가 되어 포커스가 갇히고, Esc 로 닫힌다.
 * 막(backdrop)은 투명이다. 카드 바깥을 누르면 닫힌다(건너뛰기와 같다).
 * **테 안을 누르면** 안내를 닫고 그 자리의 동작을 바로 한다(회의 RV-10) — 가리킨 것을 누르는 게 가장 자연스러운 다음 동작이다.
 * 의도 칸이면 그 의도를, 칩이면 그 칩을, [글 올리기]면 글쓰기를. 칸 사이 틈이면 그 대상의 대표 동작(검색칸에 포커스 등).
 * 테가 막 나타난 0.5초 안에 시작된 누름은 무시한다(`usePressGuard`, SE-1) — [다음]을 두 번 누른 둘째 누름이 테에 떨어져도 실행되지 않게.
 * 어떻게 닫든 "봤음" 으로 저장한다 — 다시 보는 길은 헤더에 늘 있다.
 *
 * 대상이 화면 밖이면 부드럽게 스크롤해 데려온다(모션 줄이기면 바로). 스크롤이 끝난 뒤 테와 카드가 나타난다.
 */
export function OnboardingTour({ open, onClose, fallbackFocus }: OnboardingTourProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const pressedOutside = useRef(false)
  const pressedRing = useRef(false)
  const pendingAction = useRef<PendingAction | null>(null)
  const ringGuard = usePressGuard()
  const onCloseRef = useRef(onClose)
  const fallbackRef = useRef(fallbackFocus)
  const titleId = useId()
  const bodyId = useId()

  const [step, setStep] = useState(0)
  const [placement, setPlacement] = useState<Placement | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
    fallbackRef.current = fallbackFocus
  })

  const current = GUIDE_STEPS[step]
  const last = step === GUIDE_STEPS.length - 1

  const focusPrimary = useCallback(() => {
    cardRef.current?.querySelector<HTMLElement>('[data-guide-primary]')?.focus()
  }, [])

  // 열고 닫기. 자리 잡기(아래 layout effect)보다 먼저 열어야 카드 높이를 잴 수 있다
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
      focusPrimary()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, focusPrimary])

  // 열려 있는 동안 뒤의 목록이 같이 스크롤되지 않게. 대상까지 데려가는 스크롤은 코드가 한다
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = ''
    }
  }, [open])

  // 닫힘 — 어떤 길로 닫혀도 여기로 온다(Esc 는 브라우저가 close 를 부른다). 다음에 열면 첫 단계부터
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function handleClose() {
      markOnboardingDone()
      setStep(0)
      setPlacement(null)
      const back = returnFocusRef.current
      returnFocusRef.current = null
      const action = pendingAction.current
      pendingAction.current = null
      const target = back && back.isConnected && back !== document.body ? back : fallbackRef.current?.()
      target?.focus({ preventScroll: true })
      onCloseRef.current()
      // 테 안을 눌러 닫았다 — 화면이 안내를 걷어 낸 다음(스크롤 잠금이 풀린 뒤) 그 자리를 누른다.
      // 누른 것이 시트를 열면 시트가 포커스를 가져간다. 누를 것이 없었으면 위에서 돌려 둔 포커스 그대로
      if (action) requestAnimationFrame(() => runGuideAction(action))
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [])

  // 단계마다 : 대상을 보이는 곳으로 데려온 뒤 테와 카드 자리를 잡는다. 창 크기가 바뀌면 다시 잡는다
  useLayoutEffect(() => {
    if (!open) return
    const target = guideTargetElement(current.target)
    const card = cardRef.current
    if (!target || !card) return

    let active = true
    setPlacement(null)

    const place = () => {
      if (active) setPlacement(measure(target, card))
    }
    const wide = window.matchMedia(WIDE).matches
    void reveal(target, wide ? 0 : card.offsetHeight).then(place)

    const observer = new ResizeObserver(place)
    observer.observe(target)
    window.addEventListener('resize', place)
    return () => {
      active = false
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [open, current.target])

  // 자리가 잡히면 부드럽게 나타난다 — 테는 투명도만, 넓은 화면 카드는 6px 떠오르며. 좁은 화면은 글만 바뀐다
  const placedStep = placement ? step : -1
  useEffect(() => {
    if (placedStep < 0) return
    // 테가 (새 자리에) 막 나타났다 — 지금부터 0.5초 안에 시작된 누름은 테 안 동작으로 받지 않는다
    ringGuard.arm()
    if (prefersReducedMotion()) return
    const timing = { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' }
    ringRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], timing)
    if (window.matchMedia(WIDE).matches) {
      cardRef.current?.animate(
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'none' },
        ],
        timing,
      )
    } else if (placedStep > 0) {
      textRef.current?.animate(
        [
          { opacity: 0, transform: 'translateY(4px)' },
          { opacity: 1, transform: 'none' },
        ],
        timing,
      )
    }
  }, [placedStep, ringGuard])

  function go(next: number) {
    setStep(next)
    // [이전]은 첫 단계에서 사라진다. 누른 버튼이 없어지면 [다음]으로 옮긴다
    requestAnimationFrame(() => {
      if (!cardRef.current?.contains(document.activeElement)) focusPrimary()
    })
  }

  const close = () => dialogRef.current?.close()

  // 카드 바깥을 누르면 닫는다. 안에서 누르고 밖에서 뗀 드래그(글자 선택)로는 닫지 않는다.
  // 테 안 누름은 따로 적는다 — 닫기가 아니라 그 자리의 동작이다
  function handlePointerDown(event: PointerEvent<HTMLDialogElement>) {
    const target = event.target as Node
    pressedRing.current = Boolean(ringRef.current?.contains(target))
    pressedOutside.current = !pressedRing.current && !cardRef.current?.contains(target)
    if (pressedRing.current) ringGuard.pointerDown()
  }

  // 포커스를 카드 안에서 돌린다. 네이티브 모달은 마지막 버튼에서 Tab 을 누르면 주소창으로 빠진다
  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const buttons = [...(cardRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])]
    const first = buttons[0]
    const lastButton = buttons[buttons.length - 1]
    if (!first || !lastButton) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      lastButton.focus()
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault()
      first.focus()
    }
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    const target = event.target as Node
    const inRing = pressedRing.current && Boolean(ringRef.current?.contains(target))
    const outside = pressedOutside.current && !cardRef.current?.contains(target)
    pressedRing.current = false
    pressedOutside.current = false
    if (inRing) {
      // 테가 막 나타난 바로 그때 시작된 누름 — 원래 [다음] 같은 다른 것을 노린 누름이다. 아무 일도 하지 않는다
      if (!ringGuard.allows(event)) return
      pendingAction.current = { x: event.clientX, y: event.clientY, target: current.target }
      close()
      return
    }
    if (outside) close()
  }

  const ringStyle: CSSProperties | undefined = placement ? { ...placement.ring } : undefined
  const cardStyle: CSSProperties | undefined = placement?.card ? { ...placement.card } : undefined

  return (
    <dialog
      ref={dialogRef}
      className={styles.tour}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* 테 — 누르면 안내를 닫고 그 자리를 누른다. 키보드로는 카드의 버튼으로 닫고 대상에서 이어 간다(같은 길이 이미 있다) */}
      <div ref={ringRef} className={styles.ring} style={ringStyle} hidden={!placement} aria-hidden="true" />

      <div ref={cardRef} className={styles.card} style={cardStyle} data-placed={placement ? '' : undefined}>
        <p className={styles.progress}>
          <span className="sr-only">
            {GUIDE_STEPS.length}단계 중 {step + 1}단계
          </span>
          {GUIDE_STEPS.map((guide, index) => (
            <span
              key={guide.target}
              className={styles.segment}
              data-on={index <= step ? '' : undefined}
              aria-hidden="true"
            />
          ))}
        </p>

        {/* 단계가 바뀌면 스크린리더가 새 문장을 읽는다. 포커스는 [다음]에 그대로 둔다 */}
        <div ref={textRef} className={styles.text} aria-live="polite">
          <h2 id={titleId} className={styles.title}>
            {current.title}
          </h2>
          <p id={bodyId} className={styles.body}>
            {current.body}
          </p>
          {current.typeLegend ? (
            <ul className={styles.legend} role="list" aria-label="카드의 이름표">
              <li>
                <TypeBadge type="LOST" />
                잃어버린 물건
              </li>
              <li>
                <TypeBadge type="FOUND" />
                주운 물건
              </li>
            </ul>
          ) : null}
        </div>

        <div className={styles.actions}>
          {last ? null : (
            <Button variant="secondary" className={styles.skip} onClick={close}>
              건너뛰기
            </Button>
          )}
          {step > 0 ? <Button onClick={() => go(step - 1)}>이전</Button> : null}
          <Button variant="primary" data-guide-primary="" onClick={() => (last ? close() : go(step + 1))}>
            {last ? '시작하기' : '다음'}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

/**
 * 테 안을 눌러 닫은 뒤 — 누른 점 아래의 조작을 누른다. 글자 칸이면 포커스만(휴대폰 키보드가 뜬다).
 * 누른 점이 조작 사이 틈이면 그 대상의 대표 동작(`guideFallbackControl`)을, 그것도 없으면 아무것도 하지 않는다.
 * 포커스를 먼저 옮기고 누른다 — 누른 것이 시트를 열면 시트가 포커스를 가져가고, 닫히면 이 조작으로 돌아온다
 */
function runGuideAction({ x, y, target }: PendingAction) {
  const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>(CONTROL)
  const control = hit && !hit.closest('dialog') ? hit : guideFallbackControl(target)
  if (!control) return
  control.focus({ preventScroll: true })
  if (isTextEntry(control)) return
  control.click()
}

function isTextEntry(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement) return true
  if (!(element instanceof HTMLInputElement)) return false
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'image', 'color', 'range'].includes(element.type)
}

/**
 * 대상이 보이는 곳(헤더 아래 ~ 시트 위)에 다 들어와 있으면 그대로 두고, 아니면 헤더 바로 아래로 데려온다.
 * 헤더 안의 대상([글 올리기])은 늘 보이므로 스크롤하지 않는다.
 */
function reveal(target: HTMLElement, bottomInset: number): Promise<void> {
  if (target.closest('header')) return Promise.resolve()
  const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
  const top = headerBottom + EDGE
  const bottom = window.innerHeight - bottomInset - EDGE
  const rect = target.getBoundingClientRect()
  if (rect.top >= top && rect.bottom <= bottom) return Promise.resolve()

  const reduced = prefersReducedMotion()
  window.scrollTo({ top: window.scrollY + rect.top - top, behavior: reduced ? 'instant' : 'smooth' })
  if (reduced) return Promise.resolve()

  // 스크롤이 끝나면(scrollend) 자리를 잡는다. 더 내려갈 곳이 없어 스크롤이 안 일어나도 넘어가게 시간으로 받친다
  return new Promise((resolve) => {
    const done = () => {
      document.removeEventListener('scrollend', done)
      window.clearTimeout(timer)
      resolve()
    }
    const timer = window.setTimeout(done, 700)
    document.addEventListener('scrollend', done)
  })
}

function measure(target: HTMLElement, card: HTMLElement): Placement {
  const rect = target.getBoundingClientRect()
  const ring: Box = {
    top: rect.top - RING_GAP,
    left: rect.left - RING_GAP,
    width: rect.width + RING_GAP * 2,
    height: rect.height + RING_GAP * 2,
  }
  if (!window.matchMedia(WIDE).matches) return { ring, card: null }

  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = window.innerHeight
  const width = card.offsetWidth
  const height = card.offsetHeight

  // 아래가 먼저, 모자라면 위. 둘 다 모자라면 화면 안에 들어오게만 한다
  let top = ring.top + ring.height + CARD_GAP
  const above = ring.top - CARD_GAP - height
  if (top + height > viewportHeight - EDGE && above >= EDGE) top = above
  top = clamp(top, EDGE, viewportHeight - EDGE - height)

  // 대상이 오른쪽에 있으면(헤더의 [글 올리기]) 오른쪽 끝을, 아니면 왼쪽 끝을 맞춘다
  const onRight = rect.left + rect.width / 2 > viewportWidth / 2
  const left = clamp(onRight ? ring.left + ring.width - width : ring.left, EDGE, viewportWidth - EDGE - width)

  return { ring, card: { top, left } }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}
