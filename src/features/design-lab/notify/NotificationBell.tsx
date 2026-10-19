import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { paths } from '@/app/paths'
import { useAuth } from '@/features/auth'
import { cx } from '@/shared/lib/cx'
import { useMediaQuery } from '@/shared/lib/useMediaQuery'
import { Button } from '@/shared/ui/Button'
import { Bell, X } from '@/shared/ui/icons'
import { Sheet } from '@/shared/ui/Sheet'
import tip from '@/shared/ui/Tooltip.module.css'

import type { LabState, LabVariant } from '../labSwitch'
import { mockNotifications, mockRooms, type LabNotification } from '../mock'
import { useLabResource, type LabResource } from '../useLabResource'
import { NotificationList } from './NotificationList'
import { RoomList } from './RoomList'
import styles from './notify.module.css'

/**
 * (라) 헤더 종 + 안 읽은 수. 로그인했을 때만(알림은 내 것이다). 설정 · 계정 메뉴 바로 앞.
 *   a 가벼운 펼침 : 넓은 화면은 종 아래 펼침 칸(가로막지 않음), 휴대폰은 바텀 시트. 알림만
 *   b 받은함 화면 : 종은 링크 — `알림 · 대화` 두 탭이 있는 화면으로 간다(채팅 목록도 거기)
 *   c 오른쪽 서랍 : 화면 오른쪽에서 나오는 서랍에 `알림 · 대화` 탭(휴대폰은 화면 전체)
 * 실제로는 SSE(`GET /api/notifications/stream`)로 새 알림이 오면 수가 바로 는다. 시안은 목 데이터 3건
 */
export function NotificationBell({ variant, state }: { variant: LabVariant; state?: LabState }) {
  const auth = useAuth()
  const [readIds, setReadIds] = useState<number[]>([])
  const notes = useLabResource(mockNotifications, () => [], state, { delay: 500 })
  const unread = notes.status === 'ready' ? notes.data.filter((n) => !n.read && !readIds.includes(n.id)).length : 0

  if (auth.status !== 'authenticated') return null

  const markAll = () => notes.status === 'ready' && setReadIds(notes.data.map((n) => n.id))
  const onOpen = (id: number) => setReadIds((ids) => [...ids, id])
  const label = unread > 0 ? `알림, 안 읽은 알림 ${unread}개` : '알림'

  // 새 알림이 오면(SSE) 수를 문장으로 한 번 알린다 — 버튼 안 숫자 배지를 알림 영역으로 만들지 않는다(ui-ux-pro-max: Contextual Live Badge Updates)
  const live = (
    <span className="sr-only" role="status" aria-atomic="true">
      {unread > 0 ? `안 읽은 알림 ${unread}개` : ''}
    </span>
  )

  if (variant === 'b') {
    return (
      <>
        <Link to={paths.lab.notifications('b')} className={cx(styles.bell, tip.host)} aria-label={label}>
          <BellFace unread={unread} />
        </Link>
        {live}
      </>
    )
  }
  return (
    <>
      {variant === 'a' ? (
        <PopoverBell label={label} unread={unread} notes={notes} readIds={readIds} onOpen={onOpen} onMarkAll={markAll} />
      ) : (
        <DrawerBell label={label} unread={unread} notes={notes} readIds={readIds} onOpen={onOpen} onMarkAll={markAll} state={state} />
      )}
      {live}
    </>
  )
}

function BellFace({ unread }: { unread: number }) {
  return (
    <>
      <Bell />
      {/* 안 읽은 수 — 잉크 알약(빨강 아님 : 빨강은 오류 · 삭제 전용). 10 이상은 9+ */}
      {unread > 0 ? (
        <span className={styles.badge} aria-hidden="true">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
      <span className={cx(tip.tip, styles.bellTip)} aria-hidden="true">
        알림
      </span>
    </>
  )
}

type PanelProps = {
  label: string
  unread: number
  notes: LabResource<LabNotification[]>
  readIds: number[]
  onOpen: (id: number) => void
  onMarkAll: () => void
}

/* ── a 펼침 칸 / 바텀 시트 ── */

function PopoverBell({ label, unread, notes, readIds, onOpen, onMarkAll }: PanelProps) {
  const [open, setOpen] = useState(false)
  const wide = useMediaQuery('(min-width: 40rem)')
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const location = useLocation()

  // 다른 화면으로 가면 닫는다
  const [path, setPath] = useState(location.pathname)
  if (path !== location.pathname) {
    setPath(location.pathname)
    setOpen(false)
  }

  // 넓은 화면 펼침 칸 : 바깥 누름 · Esc 로 닫고 종으로 포커스를 돌려준다
  useEffect(() => {
    if (!open || !wide) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, wide])

  const head = (
    <div className={styles.panelHead}>
      <h2 className={styles.panelTitle}>
        알림 {unread > 0 ? <span className={styles.panelCount}>새 알림 {unread}</span> : null}
      </h2>
      {unread > 0 ? (
        <Button size="sm" variant="ghost" onClick={onMarkAll}>
          모두 읽음
        </Button>
      ) : null}
    </div>
  )

  return (
    <div ref={wrap} className={styles.bellWrap}>
      <button
        ref={button}
        type="button"
        className={cx(styles.bell, tip.host)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={wide ? panelId : undefined}
        aria-haspopup={wide ? undefined : 'dialog'}
        onClick={() => setOpen((v) => !v)}
        data-open={open || undefined}
      >
        <BellFace unread={unread} />
      </button>
      {wide ? (
        open ? (
          <div id={panelId} className={styles.popover} role="region" aria-label="알림">
            {head}
            <div className={styles.panelScroll}>
              <NotificationList resource={notes} variant="a" readIds={readIds} onOpen={onOpen} />
            </div>
          </div>
        ) : null
      ) : (
        <Sheet open={open} onClose={() => setOpen(false)} title={unread > 0 ? `알림 · 새 알림 ${unread}` : '알림'}>
          {unread > 0 ? (
            <div className={styles.sheetTools}>
              <Button size="sm" variant="ghost" onClick={onMarkAll}>
                모두 읽음
              </Button>
            </div>
          ) : null}
          <NotificationList resource={notes} variant="a" readIds={readIds} onOpen={onOpen} />
        </Sheet>
      )}
    </div>
  )
}

/* ── c 오른쪽 서랍 ── */

function DrawerBell({ label, unread, notes, readIds, onOpen, onMarkAll, state }: PanelProps & { state?: LabState }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const [tab, setTab] = useState<'notes' | 'rooms'>('notes')
  const rooms = useLabResource(mockRooms, () => [], state, { delay: 500 })
  const titleId = useId()
  const location = useLocation()
  const roomUnread = rooms.status === 'ready' ? rooms.data.reduce((n, r) => n + r.unread, 0) : 0

  useEffect(() => {
    dialog.current?.close()
  }, [location.pathname])

  return (
    <>
      <button ref={button} type="button" className={cx(styles.bell, tip.host)} aria-label={label} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <BellFace unread={unread + roomUnread} />
      </button>
      <dialog ref={dialog} className={styles.drawer} aria-labelledby={titleId} onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}>
        <div className={styles.drawerInner}>
          <div className={styles.drawerHead}>
            <h2 id={titleId} className={styles.panelTitle}>
              소식
            </h2>
            <button type="button" className={styles.drawerClose} onClick={() => dialog.current?.close()} aria-label="닫기">
              <X />
            </button>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="소식 종류">
            <button type="button" role="tab" aria-selected={tab === 'notes'} onClick={() => setTab('notes')}>
              알림 {unread > 0 ? <span className={styles.tabCount}>{unread}</span> : null}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'rooms'} onClick={() => setTab('rooms')}>
              대화 {roomUnread > 0 ? <span className={styles.tabCount}>{roomUnread}</span> : null}
            </button>
            {tab === 'notes' && unread > 0 ? (
              <Button size="sm" variant="ghost" className={styles.tabTool} onClick={onMarkAll}>
                모두 읽음
              </Button>
            ) : null}
          </div>
          <div className={styles.panelScroll} role="tabpanel">
            {tab === 'notes' ? <NotificationList resource={notes} variant="c" readIds={readIds} onOpen={onOpen} /> : <RoomList resource={rooms} variant="c" />}
          </div>
        </div>
      </dialog>
    </>
  )
}
