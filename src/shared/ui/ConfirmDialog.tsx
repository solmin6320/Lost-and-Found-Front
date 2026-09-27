import { useEffect, useId, useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

import { trapTab } from '@/shared/lib/focusTrap'

import { Button } from './Button'
import styles from './ConfirmDialog.module.css'
import { WarningCircle } from './icons'

interface ConfirmDialogProps {
  open: boolean
  /** 묻는 문장. "정말 …하시겠습니까?" 가 아니라 무엇을 할지 — "이 글을 삭제할까요?" */
  title: string
  /** 결과를 문장으로. 무엇이 함께 사라지는지 숫자까지 */
  children: ReactNode
  /** 무슨 일이 일어나는지 동사로 — "삭제하기", "완료로 바꾸기" */
  confirmLabel: string
  /** 요청이 나가는 동안의 확인 버튼 글자 */
  pendingLabel?: string
  /**
   * 물러나는 버튼 글자. 기본 "취소". "작성 취소"를 묻는 창처럼 "취소"가 두 뜻으로 읽힐 때
   * 무엇을 하는지로 바꾼다 — "계속 쓰기"
   */
  cancelLabel?: string
  /** `danger` 는 되돌릴 수 없는 삭제. 그 밖의 되돌릴 수 없는 변경은 `primary` */
  tone?: 'danger' | 'primary'
  /** 요청이 나가는 동안. 두 버튼을 잠그고 Esc · 바깥 누름으로도 닫히지 않는다 */
  pending?: boolean
  /** 요청이 실패했을 때 서버 `message`. 다이얼로그를 닫지 않고 그 자리에서 보여 준다 */
  error?: string | null
  onConfirm: () => void
  /** 취소 · Esc · 바깥 누름 */
  onClose: () => void
  /** 닫힌 뒤 연 버튼이 사라졌으면(완료로 바뀌어 상태 버튼이 없어짐) 포커스를 줄 곳 */
  fallbackFocus?: () => HTMLElement | null
}

/**
 * 되돌릴 수 없는 동작의 확인(화면정의서 1.6). 네이티브 `<dialog>` 의 `showModal()` —
 * 바깥이 inert 가 되어 포커스가 갇히고, Esc 로 닫힌다.
 *
 * - 열리면 **[취소]에 포커스**. Enter 를 연달아 눌러도 삭제되지 않는다
 * - 닫히면 연 버튼으로 포커스가 돌아간다. 그 버튼이 사라졌으면 `fallbackFocus`
 * - 요청 중에는 닫지 못한다. 이미 서버에 닿은 요청은 닫아도 처리되므로, 닫히는 척하지 않는다
 * - Tab 은 다이얼로그 안에서 돈다(마지막 → 첫 버튼)
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = '취소',
  tone = 'primary',
  pending = false,
  error,
  onConfirm,
  onClose,
  fallbackFocus,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const pressedOnBackdrop = useRef(false)
  const latest = useRef({ onClose, fallbackFocus, pending })
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    latest.current = { onClose, fallbackFocus, pending }
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
      cancelRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleCancel(event: Event) {
      // Esc — 요청 중이면 막는다
      if (latest.current.pending) event.preventDefault()
    }
    function handleClose() {
      const opener = returnFocusRef.current
      returnFocusRef.current = null
      // 연 버튼이 그대로 있고 누를 수 있으면 그리로. 아니면 대신 정한 곳
      requestAnimationFrame(() => {
        if (opener?.isConnected && !opener.matches(':disabled')) opener.focus()
        else latest.current.fallbackFocus?.()?.focus()
      })
      latest.current.onClose()
    }
    dialog.addEventListener('cancel', handleCancel)
    dialog.addEventListener('close', handleClose)
    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      dialog.removeEventListener('close', handleClose)
    }
  }, [])

  function handlePointerDown(event: PointerEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (pressedOnBackdrop.current && event.target === event.currentTarget && !pending) {
      event.currentTarget.close()
    }
    pressedOnBackdrop.current = false
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={(event) => trapTab(event, event.currentTarget)}
    >
      <div className={styles.inner} aria-busy={pending || undefined}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            <WarningCircle />
            {error}
          </p>
        ) : null}
        <div className={styles.footer}>
          {/* 요청 중에는 누름만 무시한다(aria-disabled). disabled 로 잠그면 누르던 버튼에서 포커스가 빠진다 */}
          <Button
            ref={cancelRef}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) dialogRef.current?.close()
            }}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) onConfirm()
            }}
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
