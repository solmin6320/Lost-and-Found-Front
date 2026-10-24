import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'

import { trapTab } from '@/shared/lib/focusTrap'
import { getErrorMessage } from '@/shared/lib/http'
import { coverPaint, lockPageScroll, unlockPageScroll } from '@/shared/lib/pageScrollLock'
import { useMediaQuery } from '@/shared/lib/useMediaQuery'
import { Button } from '@/shared/ui/Button'
import { X } from '@/shared/ui/icons'

import { useMarkAllNotificationsRead } from '../model/notificationQueries'
import styles from './NotificationPanel.module.css'

/** 넓은 화면(펼침 칸)이 되는 폭 — CSS `@media (min-width: 40rem)` 와 같은 값 */
export const PANEL_WIDE_QUERY = '(min-width: 40rem)'

/**
 * 탭 하나 — `알림` · (채팅 단계) `대화`. **탭이 하나뿐이면 탭 줄을 그리지 않는다**(빈 탭 금지, SCR-10 "구현 시점").
 * 대화가 생기면 `{ id: 'rooms', label: '대화', count, content: <RoomList /> }` 를 더하면 탭 줄 · 탭마다 수가 선다
 */
export interface PanelTab {
  id: 'notes' | 'rooms'
  label: string
  count: number
  content: ReactNode
}

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
  /** 종 — 펼침 칸이 그 아래에 서고, 닫으면 그리로 포커스가 돌아온다 */
  anchorRef: RefObject<HTMLButtonElement | null>
  tabs: PanelTab[]
  /** 안 읽은 알림 수(`[모두 읽음]`을 보일지) */
  unread: number
}

/**
 * 알림 펼침 칸 — 넓은 화면은 종 아래 펼침 칸, 휴대폰(40rem 미만)은 바텀 시트(SCR-10 확정안 a + c의 탭).
 *
 * 둘 다 **네이티브 `<dialog>` 의 `showModal()`**(이미 있는 `Sheet` 와 같은 방식) — 뒤가 inert 가 되어 포커스가 갇히고, Esc 로 닫히고,
 * 바깥을 누르면 닫히고, 닫으면 종으로 포커스가 돌아온다. 넓은 화면의 덮개는 투명이라 펼침 칸처럼 보인다(뒤를 어둡게 가리지 않는다).
 * 스크롤 잠금은 휴대폰 시트에서만(넓은 화면 헤더는 붙어 있어 종 아래 칸이 떨어지지 않는다).
 *
 * **칸의 높이는 정해져 있다** — 스켈레톤 → 받은 목록 · 빈 상태로 바뀌어도 칸의 머리(제목 · `[모두 읽음]` · 닫기)가 움직이지 않는다
 * (바텀 시트는 아래에 붙어 있어 높이가 바뀌면 머리가 위아래로 튄다)
 */
export function NotificationPanel({ open, onClose, anchorRef, tabs, unread }: NotificationPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const pressedOnBackdrop = useRef(false)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const tabsId = useId()
  const wide = useMediaQuery(PANEL_WIDE_QUERY)
  const [tabId, setTabId] = useState<PanelTab['id']>('notes')
  const markAll = useMarkAllNotificationsRead()
  const current = tabs.find((t) => t.id === tabId) ?? tabs[0]
  const locked = useRef(false)

  function release() {
    if (!locked.current) return
    locked.current = false
    unlockPageScroll()
  }

  useEffect(() => {
    onCloseRef.current = onClose
  })

  // 펼침 칸 자리 — 종의 아래 끝 + 8px, 오른쪽 끝을 종의 오른쪽 끝에 맞춘다(화면 밖으로 나가지 않게 CSS 가 폭을 줄인다)
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const anchor = anchorRef.current
    if (!open || !wide || !dialog || !anchor) return
    function place() {
      if (!dialog || !anchor) return
      const rect = anchor.getBoundingClientRect()
      const right = document.documentElement.clientWidth - rect.right
      dialog.style.setProperty('--panel-top', `${Math.round(rect.bottom + 8)}px`)
      dialog.style.setProperty('--panel-right', `${Math.max(0, Math.round(right))}px`)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, wide, anchorRef])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // 제목에 포커스 — 스크린리더가 "알림, 대화 상자"를 읽고, 다음 Tab 이 [모두 읽음] · 닫기 · 첫 알림으로 간다
      titleRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
    // 잠금은 다른 시트와 같이 쓰는 것이라 **이 칸이 건 것만** 푼다
    if (open && dialog.open && !wide) {
      lockPageScroll(coverPaint(dialog, '::backdrop'))
      locked.current = true
    } else {
      release()
    }
  }, [open, wide])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function handleClose() {
      release()
      anchorRef.current?.focus({ preventScroll: true })
      onCloseRef.current()
    }
    dialog.addEventListener('close', handleClose)
    return () => {
      dialog.removeEventListener('close', handleClose)
      release()
    }
  }, [anchorRef])

  // 안에서 누르고 바깥에서 뗀 드래그(글자 선택)로는 닫지 않는다(Sheet 와 같다)
  function handlePointerDown(event: PointerEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget
  }

  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (pressedOnBackdrop.current && event.target === event.currentTarget) event.currentTarget.close()
    pressedOnBackdrop.current = false
  }

  const showMarkAll = current.id === 'notes' && (unread > 0 || markAll.isPending)

  return (
    <dialog
      ref={dialogRef}
      className={styles.panel}
      data-wide={wide || undefined}
      aria-labelledby={titleId}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={(event) => trapTab(event, event.currentTarget)}
    >
      <div className={styles.head}>
        <h2 ref={titleRef} id={titleId} className={styles.title} tabIndex={-1}>
          알림
        </h2>
        {showMarkAll ? (
          <Button
            size="sm"
            variant="ghost"
            className={styles.markAll}
            // 다 읽으면 이 버튼이 사라진다 — 누르던 포커스가 문서 맨 앞으로 빠지지 않게 칸 제목으로 옮긴다
            onClick={() => markAll.mutate(undefined, { onSuccess: () => titleRef.current?.focus() })}
            pending={markAll.isPending}
            pendingLabel="모두 읽음으로 바꾸는 중"
          >
            모두 읽음
          </Button>
        ) : null}
        <button type="button" className={styles.close} aria-label="닫기" onClick={() => dialogRef.current?.close()}>
          <X />
        </button>
      </div>

      {markAll.isError ? (
        <p className={styles.headError} role="alert">
          {getErrorMessage(markAll.error)}
        </p>
      ) : null}

      {tabs.length > 1 ? (
        <div className={styles.tabs} role="tablist" aria-label="소식 종류">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${tabsId}-${tab.id}`}
              aria-selected={tab.id === current.id}
              aria-controls={`${tabsId}-panel`}
              tabIndex={tab.id === current.id ? 0 : -1}
              onClick={() => setTabId(tab.id)}
            >
              {tab.label}
              {tab.count > 0 ? <span className={styles.tabCount}>{tab.count}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={styles.scroll}
        id={`${tabsId}-panel`}
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        aria-labelledby={tabs.length > 1 ? `${tabsId}-${current.id}` : undefined}
      >
        {open ? current.content : null}
      </div>
    </dialog>
  )
}
