import { useEffect, useId, useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

import { trapTab } from '@/shared/lib/focusTrap'

import { X } from './icons'
import styles from './Sheet.module.css'

interface SheetProps {
  open: boolean
  /** Esc · 바깥 누름 · 닫기 버튼 모두 이것을 부른다 */
  onClose: () => void
  title: string
  children: ReactNode
  /** 아래에 붙는 결정 버튼 자리 */
  footer?: ReactNode
  /** 열릴 때 포커스를 줄 요소. 없으면 브라우저가 첫 조작 요소(닫기 버튼)에 준다 */
  initialFocus?: () => HTMLElement | null
}

/**
 * 모달 시트. 좁은 화면은 바텀 시트, 넓은 화면은 가운데 다이얼로그 모양이다(CSS 만 다르다).
 * 네이티브 `<dialog>` 의 `showModal()` 을 쓴다 —
 * 바깥이 inert 가 되어 포커스가 갇히고, Esc 로 닫힌다. 닫으면 열었던 버튼으로 포커스를 돌려준다.
 * Tab 은 시트 안에서 돈다(마지막 → 닫기 버튼). 확인 다이얼로그 · 사진 크게 보기와 같은 방식이다.
 */
export function Sheet({ open, onClose, title, children, footer, initialFocus }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const pressedOnBackdrop = useRef(false)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
      initialFocus?.()?.focus()
      // 시트 뒤의 목록이 같이 스크롤되지 않게
      document.documentElement.style.overflow = 'hidden'
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initialFocus])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    function handleClose() {
      document.documentElement.style.overflow = ''
      returnFocusRef.current?.focus()
      returnFocusRef.current = null
      onCloseRef.current()
    }
    dialog.addEventListener('close', handleClose)
    return () => {
      dialog.removeEventListener('close', handleClose)
      // 열린 채로 사라지면(다른 화면으로 이동 등) 잠근 스크롤을 풀어 둔다
      document.documentElement.style.overflow = ''
    }
  }, [])

  // 안에서 누르고 바깥에서 뗀 드래그(글자 선택)로는 닫지 않는다
  function handlePointerDown(event: PointerEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (pressedOnBackdrop.current && event.target === event.currentTarget) {
      event.currentTarget.close()
    }
    pressedOnBackdrop.current = false
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby={titleId}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={(event) => trapTab(event, event.currentTarget)}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button
          type="button"
          className={styles.close}
          aria-label="닫기"
          onClick={() => dialogRef.current?.close()}
        >
          <X />
        </button>
      </div>
      <div className={styles.body}>{children}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </dialog>
  )
}
