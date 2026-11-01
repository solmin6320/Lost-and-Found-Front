import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'

import { getErrorMessage } from '@/shared/lib/http'
import { relativeTime } from '@/shared/lib/localDateTime'
import { Button } from '@/shared/ui/Button'
import { LockSimple } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { ChatRoomResponse } from '../api/types'
import { useChatRooms } from '../model/chatQueries'
import { roomPreview, sortRooms } from '../model/chatView'
import styles from './RoomList.module.css'

/** 스켈레톤 줄 수 — 알림 탭과 같은 높이 감각 */
const SKELETON_ROWS = 3

interface RoomListProps {
  /** 방 주소(`app/paths` 가 정한다 — 기능이 경로 문자열을 짓지 않게) */
  roomHref: (roomId: number) => string
  /** 줄을 눌렀다 — 칸을 닫는다(새 탭 열기면 두고) */
  onOpen: (event: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * 대화 목록 — 헤더 종 펼침 칸의 `대화` 탭(SCR-10, 시안 RoomList 기준).
 * 방 한 줄 = 상대 닉네임 · 글 제목 · 마지막 메시지 · 시각 · 안 읽은 수. **줄 전체가 링크 하나**(늘인 `::after`, 최소 56px) — 알림 줄과 같은 말투.
 * 말할 수 있는 방이 위, 닫힌 방(읽기 전용 · 닫힘 · 차단)은 자물쇠 이름표와 함께 아래. 안 읽음 = 왼쪽 잉크 점 + 굵은 글자 + 수(색만으로 가르지 않는다).
 * 글 사진은 방 응답에 없어 그리지 않는다(줄 앞 회색 원 아이콘도 두지 않는다 — 디자인품질기준 "새 요소 규칙")
 */
export function RoomList({ roomHref, onOpen }: RoomListProps) {
  const rooms = useChatRooms(true)

  if (rooms.isPending) {
    return (
      <div className={styles.area} aria-busy="true">
        <ul role="list" className={styles.list}>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <li key={i} className={styles.room} aria-hidden="true">
              <span className={styles.top}>
                <Skeleton shape="text" width={i % 2 === 0 ? '55%' : '68%'} />
                <Skeleton shape="text" width="3rem" />
              </span>
              <Skeleton shape="text" width="85%" />
            </li>
          ))}
        </ul>
        <p className="sr-only">대화 목록을 불러오는 중이에요.</p>
      </div>
    )
  }

  if (rooms.data === undefined) {
    return (
      <div className={styles.state} role="alert">
        <p className={styles.stateTitle}>대화 목록을 불러오지 못했어요.</p>
        <p className={styles.stateText}>{getErrorMessage(rooms.error)}</p>
        <Button size="sm" onClick={() => void rooms.refetch()} pending={rooms.isFetching} pendingLabel="다시 불러오는 중">
          다시 시도
        </Button>
      </div>
    )
  }

  if (rooms.data.length === 0) {
    return (
      <div className={styles.state}>
        <p className={styles.stateTitle}>아직 대화가 없어요.</p>
        <p className={styles.stateText}>확인 요청이 승인되면 두 분만의 대화방이 열려요.</p>
      </div>
    )
  }

  const now = new Date()
  return (
    <div className={styles.area}>
      <ul role="list" className={styles.list}>
        {sortRooms(rooms.data).map((room) => (
          <RoomRow key={room.roomId} room={room} href={roomHref(room.roomId)} now={now} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  )
}

function RoomRow({
  room,
  href,
  now,
  onOpen,
}: {
  room: ChatRoomResponse
  href: string
  now: Date
  onOpen: RoomListProps['onOpen']
}) {
  const unread = room.unreadCount > 0
  const closed = room.status !== 'OPEN'
  return (
    <li className={styles.room} data-unread={unread || undefined} data-closed={closed || undefined}>
      <span className={styles.top}>
        <Link className={styles.link} to={href} onClick={onOpen}>
          {unread ? <span className="sr-only">안 읽음. </span> : null}
          <bdi className={styles.partner}>{room.partnerNickname}</bdi>
          <span className={styles.post}>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, 글 </span>
            {room.postTitle}
          </span>
        </Link>
        <time className={styles.time} dateTime={room.lastMessageAt}>
          {relativeTime(room.lastMessageAt, now)}
        </time>
      </span>
      <span className={styles.last}>
        {closed ? (
          <span className={styles.closedTag}>
            <LockSimple />
            닫힌 대화
          </span>
        ) : null}
        {/* 서버가 이미 가린 본문 — 텍스트로만 */}
        <span className={styles.lastText}>{roomPreview(room)}</span>
        {unread ? (
          <span className={styles.count}>
            <span className="sr-only">안 읽은 메시지 </span>
            {room.unreadCount > 99 ? '99+' : room.unreadCount}
            <span className="sr-only">개</span>
          </span>
        ) : null}
      </span>
    </li>
  )
}
