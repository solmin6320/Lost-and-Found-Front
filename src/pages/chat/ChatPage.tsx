import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'

import { loginPath } from '@/app/authRedirect'
import { paths, type LoginNoticeState } from '@/app/paths'
import { subscribeSignedOutElsewhere, useAuth } from '@/features/auth'
import {
  ChatComposer,
  ChatMessages,
  ChatMessagesSkeleton,
  chatStatusLine,
  flattenMessages,
  isReceiverSide,
  isSystemMessage,
  useBlockRoom,
  useChatMessages,
  useChatRoom,
  useChatRooms,
  useMarkRoomRead,
  type ChatMessageResponse,
  type ChatRoomResponse,
} from '@/features/chat'
import { CLAIM_STALE_CODES, useDecideClaim } from '@/features/claims'
import { TypeBadge, postDetailQueryOptions, toPostId } from '@/features/posts'
import { getErrorMessage, hasErrorCode, subscribeSessionExpired } from '@/shared/lib/http'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { useLateFlag } from '@/shared/lib/useLateFlag'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import {
  ArrowClockwise,
  ArrowLeft,
  Check,
  DotsThreeVertical,
  HandHeart,
  LockSimple,
  Prohibit,
  WarningCircle,
  WifiSlash,
} from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import { NotFoundPage } from '../not-found/NotFoundPage'
import styles from './ChatPage.module.css'

/** 연결이 이만큼 넘게 끊겨 있어야 끊김 줄을 띄운다 — 처음 붙는 0.몇 초 · 짧은 다시 붙기에 줄이 깜빡이지 않게 */
const OFFLINE_NOTICE_MS = 1_500
/** 보고 있는 동안 상대 말이 연달아 오면 읽음을 한 번에 */
const READ_DEBOUNCE_MS = 800

/** 되돌릴 수 없는 결과(화면정의서 SCR-13 — 확인 창 + 결과 고지, 1.6) */
const RECEIVE_CONSEQUENCE = '받았어요를 누르면 글이 완료되고 대화가 닫혀요. 되돌릴 수 없어요.'
const BLOCK_CONSEQUENCE = '차단하면 이 대화가 닫히고, 두 분 사이에 새 대화가 열리지 않아요. 되돌릴 수 없어요.'

/**
 * SCR-13 1:1 채팅 · `/chat/:roomId` — 승인된 확인 요청의 두 사람만.
 *
 * 로그인이 필요하다. 처음부터 비로그인이면 로그인을 거쳐 이 방으로 돌아온다(`?redirect=`). 보는 도중 로그인이 끊기면 로그인 화면으로 가며 까닭 한 줄
 * (쓰던 메시지는 이탈 확인이 지킨다 — 로그아웃 확인이 쓰던 칸 등록부를 읽는다). 당사자가 아니거나 없는 방이면 **없는 화면과 같은 면**(방이 있는지 알리지 않는다)
 */
export function ChatPage() {
  const auth = useAuth()
  const location = useLocation()
  const { roomId: rawRoomId } = useParams()
  const roomId = toPostId(rawRoomId)
  const here = `${location.pathname}${location.search}`

  const [seen, setSeen] = useState(false)
  if (auth.status === 'authenticated' && !seen) setSeen(true)
  const [expired, setExpired] = useState(false)
  useEffect(() => subscribeSessionExpired(() => setExpired(true)), [])
  const [elsewhere, setElsewhere] = useState(false)
  useEffect(() => subscribeSignedOutElsewhere(() => setElsewhere(true)), [])

  if (roomId === null) return <NotFoundPage />

  if (auth.status === 'anonymous') {
    const state: LoginNoticeState | undefined = seen
      ? {
          notice: expired
            ? '로그인이 만료됐어요. 다시 로그인해 주세요.'
            : elsewhere
              ? '다른 창에서 로그아웃했어요.'
              : '로그아웃했어요.',
        }
      : undefined
    return <Navigate to={loginPath(here)} replace state={state} />
  }

  return (
    <ChatScreen
      key={roomId}
      roomId={roomId}
      myId={auth.status === 'authenticated' ? auth.me.id : null}
      enabled={auth.status === 'authenticated'}
    />
  )
}

function ChatScreen({ roomId, myId, enabled }: { roomId: number; myId: number | null; enabled: boolean }) {
  const rooms = useChatRooms(enabled)
  const messages = useChatMessages(roomId, enabled)
  const room = rooms.data?.find((r) => r.roomId === roomId)
  const markRead = useMarkRoomRead()
  const [announcement, setAnnouncement] = useState('')

  // 방 목록에 아직 없는 방(방금 열림 · 목록이 오래됨) — 기록을 받은 뒤 목록을 한 번 더 받는다. 그 뒤에도 없으면 없는 방
  const missing = rooms.isSuccess && !room
  const roomsStale = rooms.dataUpdatedAt < messages.dataUpdatedAt
  const { refetch: refetchRooms } = rooms
  useEffect(() => {
    if (missing && messages.isSuccess && roomsStale && !rooms.isFetching) void refetchRooms()
  }, [missing, messages.isSuccess, roomsStale, rooms.isFetching, refetchRooms])

  const postId = room?.postId ?? null
  const post = useQuery({ ...postDetailQueryOptions(postId ?? 0), enabled: enabled && postId !== null })
  const receiver = room ? isReceiverSide(post.data?.type ?? null, room.writer) : null
  const line = room ? chatStatusLine(room, receiver) : null

  // 읽음 — 들어왔을 때 · 보고 있는 동안 상대 말이 왔을 때 · 탭이 다시 보일 때(숨은 동안 온 말)
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { mutate: markRoomRead } = markRead
  const scheduleRead = useCallback(() => {
    if (document.visibilityState !== 'visible') return
    if (readTimer.current) clearTimeout(readTimer.current)
    readTimer.current = setTimeout(() => {
      readTimer.current = null
      markRoomRead(roomId)
    }, READ_DEBOUNCE_MS)
  }, [markRoomRead, roomId])
  useEffect(() => () => {
    if (readTimer.current) clearTimeout(readTimer.current)
  }, [])

  const loaded = messages.isSuccess
  useEffect(() => {
    if (!loaded) return
    markRoomRead(roomId)
    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleRead()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loaded, roomId, markRoomRead, scheduleRead])

  const partnerName = room?.partnerNickname ?? '상대'
  const onArrive = useCallback(
    (message: ChatMessageResponse, mine: boolean) => {
      if (mine) return
      scheduleRead()
      // 새로 온 말만 한 번 읽는다(지난 대화를 받을 때는 읽지 않는다)
      setAnnouncement(isSystemMessage(message) ? `안내: ${message.content}` : `${partnerName} 님: ${message.content}`)
    },
    [scheduleRead, partnerName, setAnnouncement],
  )

  const live = useChatRoom({ roomId, myId, enabled, canSubscribe: loaded, postId, onArrive })

  const title = room ? `${room.partnerNickname} 님과 대화` : '대화'
  useDocumentTitle(title)

  // 당사자가 아니거나 없는 방 — 없는 화면과 같은 면(방이 있는지 알리지 않는다)
  const error = messages.error
  if (
    (error && (hasErrorCode(error, 'CHAT_ROOM_FORBIDDEN') || hasErrorCode(error, 'CHAT_ROOM_NOT_FOUND'))) ||
    (missing && messages.isSuccess && !roomsStale && !rooms.isFetching)
  ) {
    return <NotFoundPage />
  }

  const list = flattenMessages(messages.data?.pages)
  const loadError = messages.data === undefined && messages.isError ? messages.error : rooms.data === undefined && rooms.isError ? rooms.error : null

  return (
    <div className={styles.page} data-chat-screen="">
      <section className={styles.conversation} aria-label={title}>
        <ChatHead room={room} postType={post.data?.type ?? null} line={line} roomLoading={rooms.isPending} />

        {loadError ? (
          <div className={styles.error} role="alert">
            <p className={styles.errorTitle}>대화를 불러오지 못했어요.</p>
            <p className={styles.errorText}>{getErrorMessage(loadError)}</p>
            <Button
              onClick={() => {
                void rooms.refetch()
                void messages.refetch()
              }}
              pending={messages.isFetching || rooms.isFetching}
              pendingLabel="다시 불러오는 중"
            >
              <ArrowClockwise />
              다시 시도
            </Button>
          </div>
        ) : messages.isPending ? (
          <ChatMessagesSkeleton />
        ) : (
          <ChatMessages
            messages={list}
            pending={live.pending}
            myId={myId}
            partner={room?.partnerNickname ?? '상대'}
            hasOlder={messages.hasNextPage}
            loadingOlder={messages.isFetchingNextPage}
            olderError={messages.isFetchNextPageError ? getErrorMessage(messages.error) : null}
            onLoadOlder={() => void messages.fetchNextPage()}
            onResend={live.resend}
            onDiscard={live.discard}
            emptyHint={line?.place === 'head'}
          />
        )}

        <ChatFoot room={room} line={line} status={live.status} onSend={live.send} onReconnect={live.reconnect} />
      </section>

      {/* 새로 온 말만 읽는다 — 목록 자체를 알림 영역으로 두지 않는다(지난 대화를 받을 때 읽지 않게) */}
      <div className="sr-only" role="log" aria-live="polite">
        {announcement}
      </div>
    </div>
  )
}

/**
 * 머리 — ←(뒤로) · 상대 닉네임(h1) · 글 이름표 + 제목 링크(44px) · 메뉴(차단), 아래 줄 지금 상태 + 받는 쪽만 ‘받았어요’
 */
function ChatHead({
  room,
  postType,
  line,
  roomLoading,
}: {
  room: ChatRoomResponse | undefined
  postType: 'LOST' | 'FOUND' | null
  line: ReturnType<typeof chatStatusLine> | null
  roomLoading: boolean
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const decide = useDecideClaim(room?.postId ?? 0)
  const block = useBlockRoom()
  const [confirm, setConfirm] = useState<'receive' | 'block' | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // ← 는 브라우저 기록의 이전 화면(제이콥). 주소로 바로 들어왔으면 갈 곳이 앱 밖이라 목록으로
  function handleBack(event: MouseEvent<HTMLAnchorElement>) {
    if (location.key === 'default' || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    navigate(-1)
  }

  function submitReceive() {
    if (!room?.claimId) return
    setDialogError(null)
    decide.mutate(
      { claimId: room.claimId, decision: 'receive' },
      {
        onSuccess: () => setConfirm(null),
        onError: (error) => {
          if (CLAIM_STALE_CODES.some((code) => hasErrorCode(error, code))) {
            setConfirm(null)
            setNotice(getErrorMessage(error))
            return
          }
          setDialogError(getErrorMessage(error))
        },
      },
    )
  }

  function submitBlock() {
    if (!room) return
    setDialogError(null)
    block.mutate(room.roomId, {
      onSuccess: () => setConfirm(null),
      onError: (error) => setDialogError(getErrorMessage(error)),
    })
  }

  const canBlock = room !== undefined && room.status !== 'BLOCKED'
  const head = line?.place === 'head' ? line : null

  return (
    <div className={styles.top} data-act={head?.canReceive || undefined}>
      <Link to={paths.postList} className={styles.back} aria-label="뒤로" onClick={handleBack}>
        <ArrowLeft />
      </Link>

      <div className={styles.who}>
        {room ? (
          <h1 ref={titleRef} className={styles.partner} tabIndex={-1}>
            <bdi>{room.partnerNickname}</bdi>
            <span className="sr-only"> 님과 대화</span>
          </h1>
        ) : (
          <h1 className={styles.partner}>
            {roomLoading ? <Skeleton shape="text" width="6rem" /> : '대화'}
            {roomLoading ? <span className="sr-only">대화</span> : null}
          </h1>
        )}
        <p className={styles.about}>
          {room ? (
            <>
              {postType ? <TypeBadge type={postType} /> : null}
              {room.postId !== null ? (
                <Link to={paths.postDetail(room.postId)} className={styles.aboutLink}>
                  <span>{room.postTitle}</span>
                </Link>
              ) : (
                <span className={styles.aboutText}>
                  <span>{room.postTitle}</span>
                </span>
              )}
            </>
          ) : (
            <span className={styles.aboutText}>
              <Skeleton shape="text" width="12rem" />
            </span>
          )}
        </p>
      </div>

      {canBlock ? (
        <RoomMenu
          onBlock={() => {
            setDialogError(null)
            setConfirm('block')
          }}
        />
      ) : null}

      {head ? (
        <p className={styles.line}>
          <HandHeart />
          <span>{head.text}</span>
        </p>
      ) : null}

      {head?.canReceive ? (
        <div className={styles.act}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setDialogError(null)
              setConfirm('receive')
            }}
          >
            <Check />
            받았어요
          </Button>
        </div>
      ) : null}

      {notice ? (
        <p className={styles.notice} role="alert">
          <WarningCircle />
          {notice}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirm === 'receive'}
        title="물건을 받았나요?"
        confirmLabel="받았어요"
        pendingLabel="알리는 중"
        pending={decide.isPending}
        error={confirm === 'receive' ? dialogError : null}
        onConfirm={submitReceive}
        onClose={() => setConfirm(null)}
        fallbackFocus={() => titleRef.current}
      >
        <p>{RECEIVE_CONSEQUENCE}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'block'}
        title="이 대화를 차단할까요?"
        confirmLabel="차단하기"
        pendingLabel="차단하는 중"
        pending={block.isPending}
        error={confirm === 'block' ? dialogError : null}
        onConfirm={submitBlock}
        onClose={() => setConfirm(null)}
        fallbackFocus={() => titleRef.current}
      >
        <p>{BLOCK_CONSEQUENCE}</p>
      </ConfirmDialog>
    </div>
  )
}

/**
 * 머리 메뉴 — 지금은 `차단` 하나(신고는 신고 백엔드가 생기면 이 메뉴에 더한다 — 빈 단추를 두지 않는다).
 * 펼침 단추 + 단추 목록(disclosure) — 계정 메뉴와 같은 방식(`role="menu"` 의 화살표 약속을 하지 않는다).
 * 닫히는 때 : 다시 누름 · Esc(단추로 포커스) · 바깥 누름 · 포커스가 밖으로 · 항목 선택
 */
function RoomMenu({ onBlock }: { onBlock: () => void }) {
  const [open, setOpen] = useState(false)
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
  }, [open])

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget
    if (next instanceof Node && !event.currentTarget.contains(next)) setOpen(false)
  }

  return (
    <div ref={rootRef} className={styles.tools} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.menuButton}
        aria-label="대화 메뉴"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <DotsThreeVertical />
      </button>
      {open ? (
        <div id={panelId} className={styles.menu}>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setOpen(false)
              buttonRef.current?.focus()
              onBlock()
            }}
          >
            <Prohibit />
            차단하기
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * 아래 — 말할 수 있는 방이면 입력 줄(+ 연결이 끊겼으면 그 위 한 줄), 닫힌 방이면 입력 줄 대신 까닭 한 줄(한 번만 말한다)
 */
function ChatFoot({
  room,
  line,
  status,
  onSend,
  onReconnect,
}: {
  room: ChatRoomResponse | undefined
  line: ReturnType<typeof chatStatusLine> | null
  status: string
  onSend: (content: string) => void
  onReconnect: () => void
}) {
  const offlineId = useId()
  const disconnected = status !== 'open'
  const showOffline = useLateFlag(disconnected && room?.status === 'OPEN', OFFLINE_NOTICE_MS)

  if (!room || !line) {
    return (
      <div className={styles.composerSkeleton} aria-hidden="true">
        <Skeleton height="3rem" />
      </div>
    )
  }

  if (line.place === 'bottom') {
    return (
      <p className={styles.closed}>
        <LockSimple />
        <span>{line.text}</span>
      </p>
    )
  }

  return (
    <>
      {showOffline ? (
        <p className={styles.offline} id={offlineId} role="status">
          <WifiSlash />
          <span>{status === 'stopped' ? '연결하지 못했어요.' : '연결이 끊겼어요. 다시 연결하는 중이에요…'}</span>
          {status === 'stopped' ? (
            <Button size="sm" variant="ghost" onClick={onReconnect}>
              다시 연결
            </Button>
          ) : null}
        </p>
      ) : null}
      <ChatComposer offline={disconnected} offlineNoteId={showOffline ? offlineId : undefined} onSend={onSend} />
    </>
  )
}
