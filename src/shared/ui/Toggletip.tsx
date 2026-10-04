import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type ReactNode } from 'react'

import { cx } from '@/shared/lib/cx'

import { Info } from './icons'
import styles from './Toggletip.module.css'
import tip from './Tooltip.module.css'

interface ToggletipProps {
  /** 버튼의 이름. 좁은 화면에서는 아이콘만 보이고 이 글자는 이름(aria-label) · 이름표로 남는다(`showLabel` 이면 늘 보인다) */
  label: string
  /**
   * 모든 폭에서 아이콘 + 글자. 기본은 30rem 미만에서 아이콘만이다.
   * 터치에서는 이름표가 뜨지 않아 글자 없는 (i)가 무엇인지 모르는 자리에 켠다(목록 결과 줄의 이름표 안내 — 회의 UI-8)
   */
  showLabel?: boolean
  /** 펼친 설명 */
  children: ReactNode
  /** 설명이 버튼의 어느 쪽 끝에 맞춰 펼쳐지나. 버튼이 줄 오른쪽 끝이면 `end` */
  align?: 'start' | 'end'
  className?: string
  /**
   * 밖에서 여닫을 때(제어). 헤더 `서비스 안내`가 상세 화면의 이름표 안내를 여는 경우다.
   * 주지 않으면 스스로 여닫는다
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * 누르면 펼치는 설명(toggletip). **사용자가 직접 연다** — 저절로 떠서 화면을 가리지 않는다(온보딩 2층).
 * 마우스를 올려서 뜨는 툴팁과 달리 터치에서도 된다.
 *
 * 펼침 버튼 + 설명(disclosure). 포커스는 버튼에 그대로 두고, 설명은 스크린리더가 바로 읽게 알림 영역에 넣는다.
 * 닫히는 때 : 다시 누름 · Esc(버튼으로 포커스 복귀) · 바깥 누름 · 포커스가 밖으로 나감
 */
export function Toggletip({
  label,
  children,
  align = 'start',
  showLabel = false,
  className,
  open: openProp,
  onOpenChange,
}: ToggletipProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = openProp ?? ownOpen
  const onOpenChangeRef = useRef(onOpenChange)

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  })

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOwnOpen(next)
      onOpenChangeRef.current?.(next)
    },
    [openProp],
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, setOpen])

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && !event.currentTarget.contains(next)) setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className={cx(styles.root, className)}
      data-label={showLabel ? 'always' : undefined}
      onBlur={handleBlur}
    >
      <button
        ref={buttonRef}
        type="button"
        className={cx(styles.trigger, tip.host, align === 'end' && tip.end)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <Info />
        <span className={styles.label}>{label}</span>
        <span className={cx(tip.tip, styles.tip)} aria-hidden="true">
          {label}
        </span>
      </button>
      {/* 비어 있어도 자리는 늘 있다 — 알림 영역은 처음부터 있어야 바뀐 내용을 읽는다 */}
      <div id={panelId} aria-live="polite">
        {open ? (
          <div className={styles.panel} data-align={align}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}
