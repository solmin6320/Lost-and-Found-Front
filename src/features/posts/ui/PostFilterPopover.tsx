import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from 'react'

import styles from './PostFilterPopover.module.css'

interface PostFilterPopoverProps {
  /** 연 칩. 그 바로 아래에 펼친다. 닫히면 Esc 로 닫았을 때 여기로 포커스를 돌린다 */
  anchor: HTMLElement | null
  /** 바깥 누름 · Esc · 포커스가 밖으로 나감 */
  onClose: () => void
  /** 펼친 칸의 이름(스크린리더). 칩 이름과 같다 */
  label: string
  /** 칸 안의 일이 고르기 하나면 `menu` 가 이미 역할을 말한다. 입력칸 묶음이면 `dialog`(모달 아님) */
  role?: 'dialog'
  /** 열리자마자 포커스를 줄 곳 — 고른 칸, 또는 누른 칩이 맡은 입력칸 */
  initialFocus: (panel: HTMLElement) => HTMLElement | null
  /** 칸 폭. 고르기 목록은 좁게, 장소 · 기간은 넓게 */
  size?: 'menu' | 'form'
  children: ReactNode
}

/**
 * 넓은 화면(48rem 이상)에서 칩이 여는 칸 — **누른 칩 바로 아래에 붙어 펼친다**(2026-10-03 회의 ③).
 * 가운데 다이얼로그는 화면 전체를 어둡게 가리고 시선을 칩에서 떼어 놓는다. 가로막을 필요가 없는 일이다.
 *
 * 모달이 아니다 — 뒤의 목록은 그대로 보이고 스크롤도 된다(칩 줄이 붙어 있으면 같이 붙어 간다).
 * 닫히는 때 : 바깥 누름 · Esc(칩으로 포커스 복귀) · Tab 으로 칸 밖으로 나감. 칩을 다시 눌러도 닫힌다(칩 쪽이 처리).
 * 칩 줄은 휴대폰 · 태블릿에서 옆으로 넘기는 칸이라 그 안에 두면 잘린다 — 칩 줄 바깥(같은 묶음 안)에 그리고 칩 위치로 옮긴다.
 */
export function PostFilterPopover({
  anchor,
  onClose,
  label,
  role,
  initialFocus,
  size = 'menu',
  children,
}: PostFilterPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  const measure = useCallback(() => {
    const panel = panelRef.current
    const parent = panel?.offsetParent
    if (!panel || !anchor || !(parent instanceof HTMLElement)) return
    const box = parent.getBoundingClientRect()
    const chip = anchor.getBoundingClientRect()
    // 칩 줄의 오른쪽 끝(페이지 폭)과 화면 끝을 넘지 않게 안쪽으로 민다
    const edge = 16
    const maxLeft = Math.min(window.innerWidth - edge, box.right) - panel.offsetWidth
    const left = Math.max(edge, Math.min(chip.left, maxLeft))
    setPlace({ left: left - box.left, top: chip.bottom - box.top + 6 })
  }, [anchor])

  useLayoutEffect(() => {
    measure()
  }, [measure])

  // 자리를 잡아 보이게 된 뒤(숨긴 칸에는 포커스가 가지 않는다) 한 번만. 내용이 바뀌어도(입력) 포커스를 다시 빼앗지 않는다
  const initialFocusRef = useRef(initialFocus)
  const focused = useRef(false)
  useEffect(() => {
    const panel = panelRef.current
    if (!place || !panel || focused.current) return
    focused.current = true
    initialFocusRef.current(panel)?.focus({ preventScroll: true })
  }, [place])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchor?.contains(target)) return
      onCloseRef.current()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCloseRef.current()
      anchor?.focus()
    }
    window.addEventListener('resize', measure)
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('resize', measure)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchor, measure])

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget
    // 칩으로 돌아가는 것(Shift+Tab)도 밖이다. 칩을 누른 것이면 칩이 닫는다
    if (next instanceof Node && !event.currentTarget.contains(next)) onCloseRef.current()
  }

  return (
    <div
      ref={panelRef}
      className={styles.popover}
      data-size={size}
      role={role}
      aria-label={label}
      // 자리를 재기 전에는 보이지 않게(한 프레임 엉뚱한 자리에서 깜빡이지 않게)
      style={place ? { left: place.left, top: place.top } : { visibility: 'hidden' }}
      onBlur={handleBlur}
    >
      {children}
    </div>
  )
}
