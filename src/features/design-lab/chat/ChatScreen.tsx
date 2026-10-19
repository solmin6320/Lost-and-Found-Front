import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { paths } from '@/app/paths'
import { TypeBadge } from '@/features/posts'
import { cx } from '@/shared/lib/cx'
import { detectPersonalInfo } from '@/shared/lib/personalInfo'
import { Button } from '@/shared/ui/Button'
import { ArrowLeft, Check, LockSimple, PaperPlaneRight, ShieldCheck } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { LabState, LabVariant } from '../labSwitch'
import { mockMessages, mockRooms, type LabChatRoom, type LabMessage } from '../mock'
import { RoomList } from '../notify/RoomList'
import { useLabResource, type LabResource } from '../useLabResource'
import styles from './ChatScreen.module.css'

interface ChatScreenProps {
  variant: LabVariant
  state?: LabState
  roomId: number
}

/**
 * (라) 1:1 안전 채팅 — 주인 확인이 승인된 두 사람만. 실제로는 WebSocket/STOMP, 서버가 전화번호 · 계좌를 가려서 보낸다.
 *   a 말풍선 : 익숙한 대화 화면. 내 말 오른쪽 잉크 · 상대 말 왼쪽 옅은 면. 위에 글 한 줄
 *   b 진행 카드 : 위에 붙은 "확인 → 약속 → 건네받기" 세 단계 카드. 지금 할 일이 늘 보인다
 *   c 두 칸 : 넓은 화면은 왼쪽 대화 목록 + 오른쪽 대화(기록처럼 이름 · 시간이 위에), 휴대폰은 대화만
 * 방 7 = 열린 방, 방 6 = 닫힌 방(수령 끝)
 */
export function ChatScreen({ variant, state, roomId }: ChatScreenProps) {
  const rooms = useLabResource(mockRooms, () => [], state === 'error' ? undefined : state, { delay: 400 })
  const room = rooms.status === 'ready' ? rooms.data.find((r) => r.id === roomId) : undefined
  const closed = room?.closed ?? false
  const messages = useLabResource(
    () => mockMessages(closed),
    () => [],
    state,
    { delay: 600, key: `${roomId}:${closed}` },
  )

  const conversation = <Conversation variant={variant} room={room} roomsLoading={rooms.status === 'loading'} messages={messages} />

  if (variant !== 'c') return <div className={styles.page} data-variant={variant}>{conversation}</div>
  return (
    <div className={cx(styles.page, styles.twoPane)} data-variant="c">
      <aside className={styles.paneList} aria-label="대화 목록">
        <h1 className={styles.paneTitle}>대화</h1>
        <RoomList resource={rooms} variant="c" activeId={roomId} />
      </aside>
      {conversation}
    </div>
  )
}

function Conversation({ variant, room, roomsLoading, messages }: { variant: LabVariant; room?: LabChatRoom; roomsLoading: boolean; messages: LabResource<LabMessage[]> }) {
  const closed = room?.closed ?? false
  const [sent, setSent] = useState<LabMessage[]>([])
  const scroller = useRef<HTMLDivElement>(null)
  const list = messages.status === 'ready' ? [...messages.data, ...sent] : []

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [list.length])

  return (
    <section className={styles.conversation} aria-label={room ? `${room.partner} 님과 대화` : '대화'}>
      <header className={styles.top}>
        <Link to={paths.lab.notifications(variant)} className={styles.back} aria-label="대화 목록으로">
          <ArrowLeft />
        </Link>
        {room ? (
          <div className={styles.who}>
            <h1 className={styles.partner}>{room.partner}</h1>
            <p className={styles.about}>
              <TypeBadge type={room.postType} />
              <Link to={paths.postDetail(room.postId)} className={styles.aboutLink}>
                {room.postTitle}
              </Link>
            </p>
          </div>
        ) : (
          <div className={styles.who}>
            {roomsLoading ? <Skeleton shape="text" width="6rem" /> : <h1 className={styles.partner}>대화</h1>}
            <Skeleton shape="text" width="12rem" />
          </div>
        )}
      </header>

      {variant === 'b' ? <Progress closed={closed} /> : null}

      <div ref={scroller} className={styles.scroll} aria-busy={messages.status === 'loading'}>
        {messages.status === 'loading' ? (
          <MessagesSkeleton />
        ) : messages.status === 'error' ? (
          <div className={styles.state}>
            <p className={styles.stateTitle}>대화를 불러오지 못했어요.</p>
            <p className={styles.stateText}>{messages.message}</p>
            <Button size="sm" onClick={messages.retry} pending={messages.retrying} pendingLabel="다시 불러오는 중">
              다시 시도
            </Button>
          </div>
        ) : list.length === 0 ? (
          <div className={styles.state}>
            <ShieldCheck className={styles.stateIcon} />
            <p className={styles.stateTitle}>첫 메시지를 보내 보세요.</p>
            <p className={styles.stateText}>물건의 특징을 물어보고, 만날 시간과 장소를 정해요. 전화번호 · 계좌는 자동으로 가려져요.</p>
          </div>
        ) : (
          <ol role="list" className={styles.messages} data-variant={variant}>
            {list.map((m, i) => (
              <MessageItem key={m.id} message={m} variant={variant} partner={room?.partner ?? ''} prev={list[i - 1]} />
            ))}
          </ol>
        )}
      </div>

      {closed ? (
        <p className={styles.closed}>
          <LockSimple />
          <span>
            <b>대화가 닫혔어요.</b> 물건을 건네받아 글이 완료됐어요. 지난 대화는 30일 동안 볼 수 있어요.
          </span>
        </p>
      ) : (
        <Composer disabled={messages.status !== 'ready'} onSend={(text) => setSent((s) => [...s, { id: Date.now(), mine: true, text, sentAt: new Date().toISOString(), read: false }])} />
      )}
    </section>
  )
}

/** 서버가 가린 자리를 자물쇠 조각으로. 가린 글자 자체는 서버가 이미 별표로 바꿔 보낸다 */
function MessageText({ message }: { message: LabMessage }) {
  if (!message.masked?.length) return <>{message.text}</>
  const parts: ReactNode[] = []
  let at = 0
  for (const mask of message.masked) {
    if (mask.start > at) parts.push(message.text.slice(at, mask.start))
    parts.push(
      <span key={mask.start} className={styles.masked}>
        <LockSimple />
        <span>{message.text.slice(mask.start, mask.end)}</span>
        <span className="sr-only">{mask.kind === 'PHONE' ? '(전화번호 가려짐)' : '(계좌번호 가려짐)'}</span>
      </span>,
    )
    at = mask.end
  }
  if (at < message.text.length) parts.push(message.text.slice(at))
  return <>{parts}</>
}

function hm(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`
}

function MessageItem({ message: m, variant, partner, prev }: { message: LabMessage; variant: LabVariant; partner: string; prev?: LabMessage }) {
  const newDay = !prev || prev.sentAt.slice(0, 10) !== m.sentAt.slice(0, 10)
  const sameRun = prev && !prev.system && !m.system && prev.mine === m.mine && !newDay
  return (
    <>
      {newDay ? (
        <li className={styles.day} aria-hidden="false">
          <span>{dayLabel(m.sentAt)}</span>
        </li>
      ) : null}
      {m.system ? (
        <li className={styles.system}>{m.text}</li>
      ) : (
        <li className={styles.message} data-mine={m.mine || undefined} data-run={sameRun || undefined}>
          {variant === 'c' && !sameRun ? (
            <p className={styles.sender}>
              <b>{m.mine ? '나' : partner}</b> <time dateTime={m.sentAt}>{hm(m.sentAt)}</time>
            </p>
          ) : null}
          <div className={styles.bubbleRow}>
            <p className={styles.bubble}>
              <span className="sr-only">{m.mine ? '내 메시지: ' : `${partner} 님: `}</span>
              <MessageText message={m} />
            </p>
            {variant !== 'c' ? (
              <span className={styles.stamp}>
                {m.mine && m.read ? <span className={styles.read}>읽음</span> : null}
                <time dateTime={m.sentAt}>{hm(m.sentAt)}</time>
              </span>
            ) : null}
          </div>
          {m.masked?.length ? <p className={styles.maskNote}>개인정보라 자동으로 가렸어요. 상대에게도 이렇게 보여요.</p> : null}
        </li>
      )}
    </>
  )
}

/** b 진행 카드 — 확인 승인 → 만날 약속 → 건네받기. 완료 단계는 동그라미 체크(완료 전용 표시) */
function Progress({ closed }: { closed: boolean }) {
  const steps = [
    { label: '주인 확인', done: true },
    { label: '만날 약속', done: closed },
    { label: '건네받기', done: closed },
  ]
  const current = steps.findIndex((s) => !s.done)
  return (
    <div className={styles.progress}>
      <ol role="list" className={styles.steps} aria-label="진행 단계">
        {steps.map((s, i) => (
          <li key={s.label} data-done={s.done || undefined} data-current={i === current || undefined} aria-current={i === current ? 'step' : undefined}>
            <span className={styles.stepMark}>{s.done ? <Check /> : i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>
      <p className={styles.progressHint}>
        {closed ? '건네받기까지 끝났어요.' : '만날 시간과 장소를 정해 보세요. 사람이 많은 곳이 안전해요.'}
      </p>
    </div>
  )
}

function Composer({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const id = useId()
  const hit = detectPersonalInfo(text)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!text.trim() || sending || disabled) return
    setSending(true)
    // 시안 — 보내는 0.4초 동안 버튼을 잠근다(같은 말이 두 번 가지 않게)
    window.setTimeout(() => {
      onSend(text.trim())
      setText('')
      setSending(false)
    }, 400)
  }

  return (
    <form className={styles.composer} onSubmit={submit}>
      <p className={styles.composerNote} id={`${id}-note`} data-hit={hit ? '' : undefined}>
        <ShieldCheck />
        {hit ? '보내면 이 번호는 상대에게 별표로 가려져 보여요.' : '전화번호 · 계좌번호는 자동으로 가려져요.'}
      </p>
      <div className={styles.composerRow}>
        <label className="sr-only" htmlFor={id}>
          메시지
        </label>
        <textarea
          id={id}
          className={styles.input}
          rows={1}
          value={text}
          placeholder="메시지를 적어 주세요"
          aria-describedby={`${id}-note`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e)
          }}
          maxLength={1000}
        />
        <Button type="submit" variant="primary" className={styles.send} pending={sending} pendingLabel="보내는 중" aria-label="보내기" unavailable={disabled || !text.trim()}>
          <PaperPlaneRight />
        </Button>
      </div>
    </form>
  )
}

function MessagesSkeleton() {
  return (
    <ol role="list" className={styles.messages} aria-hidden="true">
      {[
        [false, '70%'],
        [true, '55%'],
        [false, '45%'],
        [true, '62%'],
      ].map(([mine, w], i) => (
        <li key={i} className={styles.message} data-mine={mine || undefined}>
          <div className={styles.bubbleRow}>
            <Skeleton className={styles.bubbleSkeleton} width={w as string} height="2.75rem" />
          </div>
        </li>
      ))}
      <li className="sr-only">대화를 불러오는 중이에요</li>
    </ol>
  )
}
