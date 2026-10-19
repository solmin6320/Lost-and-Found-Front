import { useState } from 'react'
import { Link, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'

import { paths } from '@/app/paths'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'

import { ChatScreen } from '../chat/ChatScreen'
import { readLab, type LabVariant } from '../labSwitch'
import { LocationPicker } from '../map/LocationPicker'
import { mockNotifications, mockRooms } from '../mock'
import { NotificationList } from '../notify/NotificationList'
import { RoomList } from '../notify/RoomList'
import { useLabResource } from '../useLabResource'
import styles from './LabRoutes.module.css'

/** 시안 화면 묶음(개발 모드 전용 라우트 `/__lab/*`). 본인이 고르면 확정 경로로 옮긴다 */
export function LabRoutes() {
  return (
    <Routes>
      <Route index element={<LabIndex />} />
      <Route path="notifications" element={<Inbox />} />
      <Route path="chat" element={<Chat />} />
      <Route path="location" element={<Location />} />
    </Routes>
  )
}

function useVariant(): LabVariant {
  const [params] = useSearchParams()
  const v = params.get('v')
  return v === 'b' || v === 'c' ? v : 'a'
}

function useLabState() {
  return readLab(useLocation().search).state
}

/* ── 시안 목록 — 본인이 눌러 보며 고르는 곳 ── */

function LabIndex() {
  useDocumentTitle('시안 모음')
  const rows: { title: string; links: [string, string][] }[] = [
    { title: '(가) 지금 서비스 현황 띠', links: ['a', 'b', 'c'].map((v) => [`시안 ${v}`, `/?lab=strip-${v}`]) },
    { title: '(나) 주변 분실물 지도', links: [...['a', 'b', 'c'].map((v): [string, string] => [`시안 ${v}`, `/?lab=map-${v}`]), ['위치 찍기', paths.lab.location]] },
    { title: "(다) '이거 아닐까요?' 추천", links: ['a', 'b', 'c'].map((v) => [`시안 ${v}`, `/posts/25?lab=match-${v}`]) },
    {
      title: '(라) 알림 · 채팅',
      links: [
        ...['a', 'b', 'c'].map((v): [string, string] => [`종 ${v}`, `/?lab=bell-${v}`]),
        ...['a', 'b', 'c'].map((v): [string, string] => [`대화 ${v}`, `${paths.lab.chat(v)}&lab=bell-${v}`]),
        ['닫힌 대화', `${paths.lab.chat('a', 6)}&lab=bell-a`],
      ],
    },
  ]
  return (
    <div className={styles.index}>
      <h1 className={styles.title}>시안 모음</h1>
      <p className={styles.lead}>
        개발 모드 전용이에요. 주소에 <code>?lab=요소-시안</code>을 붙이면 그 시안이 실제 화면에 나와요. <code>,state-loading</code> · <code>,state-empty</code> · <code>,state-error</code>를 더하면 그 상태로, <code>?lab=off</code>로 꺼요. 알림 · 추천 시안은 로그인한 상태에서 보여요.
      </p>
      <dl className={styles.rows}>
        {rows.map((row) => (
          <div key={row.title} className={styles.row}>
            <dt>{row.title}</dt>
            <dd>
              {row.links.map(([label, to]) => (
                <Link key={to} to={to} className={styles.chip}>
                  {label}
                </Link>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ── 받은함(종 b의 목적지 · 대화 목록) ── */

function Inbox() {
  useDocumentTitle('알림')
  const variant = useVariant()
  const state = useLabState()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'rooms' ? 'rooms' : 'notes'
  const notes = useLabResource(mockNotifications, () => [], state, { delay: 500 })
  const rooms = useLabResource(mockRooms, () => [], state, { delay: 500 })
  const [readIds, setReadIds] = useState<number[]>([])
  const unread = notes.status === 'ready' ? notes.data.filter((n) => !n.read && !readIds.includes(n.id)).length : 0
  const roomUnread = rooms.status === 'ready' ? rooms.data.reduce((n, r) => n + r.unread, 0) : 0
  const go = (next: 'notes' | 'rooms') => {
    const p = new URLSearchParams(params)
    p.set('tab', next)
    setParams(p, { replace: true })
  }

  return (
    <div className={styles.inbox}>
      <div className={styles.inboxHead}>
        <h1 className={styles.title}>알림</h1>
        {tab === 'notes' && unread > 0 ? (
          <button type="button" className={styles.textButton} onClick={() => notes.status === 'ready' && setReadIds(notes.data.map((n) => n.id))}>
            모두 읽음
          </button>
        ) : null}
      </div>
      <div className={styles.tabs} role="tablist" aria-label="소식 종류">
        <button type="button" role="tab" aria-selected={tab === 'notes'} onClick={() => go('notes')}>
          알림 {unread > 0 ? <span className={styles.count}>{unread}</span> : null}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'rooms'} onClick={() => go('rooms')}>
          대화 {roomUnread > 0 ? <span className={styles.count}>{roomUnread}</span> : null}
        </button>
      </div>
      <div role="tabpanel">
        {tab === 'notes' ? (
          <NotificationList resource={notes} variant={variant} readIds={readIds} onOpen={(id) => setReadIds((ids) => [...ids, id])} roomy />
        ) : (
          <RoomList resource={rooms} variant={variant} roomy />
        )}
      </div>
    </div>
  )
}

function Chat() {
  const variant = useVariant()
  const state = useLabState()
  const [params] = useSearchParams()
  const roomId = Number(params.get('room') ?? 7)
  useDocumentTitle('대화')
  return <ChatScreen variant={variant} state={state} roomId={roomId} />
}

function Location() {
  useDocumentTitle('위치 찍기')
  return <LocationPicker state={useLabState()} />
}
