import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { cx } from '@/shared/lib/cx'
import { Button } from '@/shared/ui/Button'
import { ArrowClockwise, ArrowDown, LockSimple, ShieldCheck, Trash } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { ChatMessageResponse } from '../api/types'
import {
  MASK_LABEL,
  dayLabel,
  isSystemMessage,
  maskNote,
  messageSegments,
  messageTime,
  sameDay,
} from '../model/chatView'
import type { PendingMessage } from '../model/useChatRoom'
import styles from './chat.module.css'

/** 맨 아래에서 이만큼 안이면 "맨 아래에 있다"로 본다 — 새 메시지가 오면 따라 내려간다 */
const STICK_PX = 80

/** 대화 맨 앞(더 옛날 것이 없을 때) 한 번 서는 안전 안내 — 만날 때의 말(화면정의서 SCR-13 · SCR-12 C1 다시 봄) */
export const CHAT_MEETING_SAFETY = '물건을 건네기 전에 확인 질문의 답을 다시 맞춰 보세요. 만날 곳은 역 고객센터처럼 사람이 많은 곳이 안전해요.'

interface ChatMessagesProps {
  messages: ChatMessageResponse[]
  pending: PendingMessage[]
  myId: number | null
  partner: string
  hasOlder: boolean
  loadingOlder: boolean
  /** 지난 메시지 받기가 실패했다(서버 문장) */
  olderError: string | null
  onLoadOlder: () => void
  onResend: (key: string) => void
  onDiscard: (key: string) => void
  /** 빈 대화(사람이 쓴 말이 없음)의 권유 — 말할 수 있는 방에서만 */
  emptyHint: boolean
}

/**
 * 말풍선 목록 — 내 말 오른쪽 잉크 · 상대 말 왼쪽 옅은 면 · 안내 메시지 가운데 흐린 글자 · 날이 바뀌면 날짜 줄.
 * 이어지는 같은 사람의 말은 붙은 쪽 모서리만 4px(누가 말했는지 묶음으로 보인다 — 근접성).
 *
 * - 처음 · 새 메시지 : 맨 아래에 있었으면(80px 안) 따라 내려간다. 위를 읽던 중이면 그대로 두고 `[새 메시지]` 단추
 * - 위로 올리면 지난 메시지(맨 위 `[지난 대화 더 보기]`가 화면에 들어오면 저절로, 키보드는 그 단추로). 받은 뒤 보던 줄이 그 자리에 남는다
 * - 낭독 : 목록 자체는 알림 영역이 아니다(지난 메시지를 받을 때 읽지 않게). 새로 온 말만 숨은 `role="log"` 가 한 번 읽는다(부른 쪽)
 * - 본문은 텍스트로만(서버가 가린 그대로, HTML 해석 없음). 가린 조각은 자물쇠 + 이름표 + 낭독 `(전화번호 가려짐)`
 */
export function ChatMessages({
  messages,
  pending,
  myId,
  partner,
  hasOlder,
  loadingOlder,
  olderError,
  onLoadOlder,
  onResend,
  onDiscard,
  emptyHint,
}: ChatMessagesProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const keepFromBottom = useRef<number | null>(null)
  const [unseen, setUnseen] = useState(0)

  const oldestId = messages[0]?.id ?? null
  const newestId = messages[messages.length - 1]?.id ?? null
  const lastSeenNewest = useRef<number | null>(null)
  const lastOldest = useRef<number | null>(null)

  // 지난 메시지가 위에 붙었다 — 보던 줄이 그 자리에 남게(아래에서 잰 거리를 지킨다)
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    if (lastOldest.current !== null && oldestId !== null && oldestId < lastOldest.current && keepFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - keepFromBottom.current
    }
    keepFromBottom.current = null
    lastOldest.current = oldestId
  }, [oldestId])

  // 새 메시지 · 내 말풍선 — 맨 아래에 있었으면 따라 내려간다
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const first = lastSeenNewest.current === null
    const grew = newestId !== null && lastSeenNewest.current !== null && newestId > lastSeenNewest.current
    const newestMessage = messages[messages.length - 1]
    const mine = newestMessage ? myId !== null && newestMessage.senderId === myId : false
    if (first || atBottom.current || mine) {
      el.scrollTop = el.scrollHeight
      atBottom.current = true
      setUnseen(0)
    } else if (grew) {
      setUnseen((n) => n + 1)
    }
    if (newestId !== null) lastSeenNewest.current = newestId
  }, [newestId, messages, myId])

  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (el && atBottom.current) el.scrollTop = el.scrollHeight
  }, [pending.length])

  // 맨 위가 보이면 지난 메시지를 받는다
  useEffect(() => {
    const target = topRef.current
    const root = scrollerRef.current
    if (!target || !root || !hasOlder || loadingOlder || olderError || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadOlderRef.current()
      },
      { root, rootMargin: '120px 0px 0px 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasOlder, loadingOlder, olderError, oldestId])

  const loadOlderRef = useRef(loadOlder)
  useEffect(() => {
    loadOlderRef.current = loadOlder
  })

  function loadOlder() {
    const el = scrollerRef.current
    if (el) keepFromBottom.current = el.scrollHeight - el.scrollTop
    onLoadOlder()
  }

  function handleScroll() {
    const el = scrollerRef.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX
    if (atBottom.current && unseen > 0) setUnseen(0)
  }

  function jumpToBottom() {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    setUnseen(0)
  }

  const userCount = messages.filter((m) => !isSystemMessage(m)).length + pending.length

  return (
    <div className={styles.scrollWrap}>
      <div ref={scrollerRef} className={styles.scroll} onScroll={handleScroll} tabIndex={0} aria-label="대화 내용">
        <div ref={topRef} className={styles.top}>
          {hasOlder ? (
            <>
              <Button size="sm" variant="ghost" onClick={loadOlder} pending={loadingOlder} pendingLabel="지난 대화를 불러오는 중">
                지난 대화 더 보기
              </Button>
              {olderError ? (
                <p className={styles.olderError} role="alert">
                  {olderError}
                </p>
              ) : null}
            </>
          ) : (
            <p className={styles.start}>
              <ShieldCheck />
              <span>
                <b>두 분만 보는 대화예요.</b> {CHAT_MEETING_SAFETY}
              </span>
            </p>
          )}
        </div>

        <ol role="list" className={styles.messages}>
          {messages.map((m, i) => (
            <MessageItem key={m.id} message={m} prev={messages[i - 1]} myId={myId} partner={partner} />
          ))}
          {pending.map((p) => (
            <li key={p.key} className={styles.message} data-mine="" data-pending={p.state}>
              <div className={styles.bubbleRow}>
                <p className={styles.bubble}>
                  <span className="sr-only">내 메시지: </span>
                  {p.content}
                </p>
                <span className={styles.stamp}>{p.state === 'sending' ? '보내는 중' : null}</span>
              </div>
              {p.state === 'failed' ? (
                <div className={styles.failed}>
                  <p className={styles.failedText} role="alert">
                    {p.error ?? '보내지 못했어요.'}
                  </p>
                  <div className={styles.failedActions}>
                    <Button size="sm" variant="ghost" onClick={() => onResend(p.key)}>
                      <ArrowClockwise />
                      다시 보내기
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDiscard(p.key)}>
                      <Trash />
                      지우기
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        {emptyHint && userCount === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>먼저 인사해 보세요.</p>
            <p className={styles.emptyText}>만날 시간과 장소를 정할 수 있어요.</p>
          </div>
        ) : null}
      </div>

      {unseen > 0 ? (
        <button type="button" className={styles.jump} onClick={jumpToBottom}>
          <ArrowDown />
          새 메시지 {unseen > 99 ? '99+' : unseen}
        </button>
      ) : null}
    </div>
  )
}

function MessageItem({
  message: m,
  prev,
  myId,
  partner,
}: {
  message: ChatMessageResponse
  prev: ChatMessageResponse | undefined
  myId: number | null
  partner: string
}) {
  const newDay = !prev || !sameDay(prev.createdAt, m.createdAt)
  const day = newDay ? (
    <li className={styles.day}>
      <span>{dayLabel(m.createdAt)}</span>
    </li>
  ) : null

  if (isSystemMessage(m)) {
    return (
      <Fragment>
        {day}
        <li className={styles.system}>
          <span className="sr-only">안내: </span>
          {m.content}
        </li>
      </Fragment>
    )
  }

  const mine = myId !== null && m.senderId === myId
  const run = Boolean(prev && !newDay && !isSystemMessage(prev) && prev.senderId === m.senderId)
  const segments = messageSegments(m.content, m.masked)
  const note = maskNote(segments, mine)
  return (
    <Fragment>
      {day}
      <li className={styles.message} data-mine={mine || undefined} data-run={run || undefined}>
        <div className={styles.bubbleRow}>
          <p className={styles.bubble}>
            <span className="sr-only">{mine ? '내 메시지: ' : `${partner} 님: `}</span>
            <MessageText segments={segments} />
          </p>
          <time className={styles.stamp} dateTime={m.createdAt}>
            {messageTime(m.createdAt)}
          </time>
        </div>
        {note ? <p className={styles.maskNote}>{note}</p> : null}
      </li>
    </Fragment>
  )
}

/** 서버가 가린 자리 — 자물쇠 + 무엇을 가렸는지 이름. 낭독은 `(전화번호 가려짐)` */
function MessageText({ segments }: { segments: ReturnType<typeof messageSegments> }) {
  const parts: ReactNode[] = segments.map((s, i) =>
    s.mask ? (
      <span key={i} className={cx(styles.masked)}>
        <LockSimple />
        <span aria-hidden="true">{MASK_LABEL[s.mask]}</span>
        <span className="sr-only">({MASK_LABEL[s.mask]} 가려짐)</span>
      </span>
    ) : (
      <Fragment key={i}>{s.text}</Fragment>
    ),
  )
  return <>{parts}</>
}

/** 받은 화면과 같은 틀 — 말풍선 자리 넷(좌우 번갈아) */
export function ChatMessagesSkeleton() {
  return (
    <div className={styles.scrollWrap}>
      <div className={styles.scroll} aria-busy="true">
        <ol role="list" className={styles.messages} aria-hidden="true">
          {(
            [
              [false, '70%'],
              [true, '55%'],
              [false, '45%'],
              [true, '62%'],
            ] as const
          ).map(([mine, width], i) => (
            <li key={i} className={styles.message} data-mine={mine || undefined}>
              <div className={styles.bubbleRow} style={{ width }}>
                <Skeleton className={styles.bubbleSkeleton} height="2.75rem" />
              </div>
            </li>
          ))}
        </ol>
        <p className="sr-only">대화를 불러오는 중이에요.</p>
      </div>
    </div>
  )
}
