import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'

import { getErrorMessage } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { Bell, Buildings, HandHeart, HandWaving, ListMagnifyingGlass, XCircle, type Icon } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { NotificationResponse } from '../api/types'
import {
  isListedNotification,
  notificationKind,
  notificationSentence,
  notificationTime,
  type NotificationKind,
} from '../model/notificationCopy'
import { notificationHref } from '../model/notificationLink'
import { useNotificationList } from '../model/notificationQueries'
import styles from './NotificationPanel.module.css'

/**
 * 종류 아이콘 — 16px, 원 바탕 없이(QA-D-L23 · 디자인품질기준 "알림 줄"). 종류는 문장이 말하고 아이콘은 훑어볼 때의 표지다.
 * 승인은 `HandHeart`(채운 `CheckCircle` 은 "완료" 표시 전용 · `ChatsCircle` 은 대화가 생긴 뒤)
 */
const KIND_ICON: Record<NotificationKind, Icon> = {
  request: HandWaving,
  approved: HandHeart,
  rejected: XCircle,
  match: ListMagnifyingGlass,
  // 경찰서 · 기관 보관 후보 — 공공 후보 카드의 보관처 이름표와 같은 아이콘
  publicMatch: Buildings,
  other: Bell,
}

/** 스켈레톤 줄 수 — 펼침 칸 첫 화면을 채우는 정도. 칸 높이가 정해져 있어 받은 뒤 바깥은 움직이지 않는다 */
const SKELETON_ROWS = 4

interface NotificationListProps {
  /** 줄을 눌렀다 — 읽음으로 바꾸고 칸을 닫는다(새 탭 열기면 닫지 않는다) */
  onOpen: (notification: NotificationResponse, event: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * 알림 목록 — 네 가지 상태를 모두 그린다(로딩 줄 스켈레톤 · 빈 · 오류 + [다시 시도] · 권한은 종이 맡는다).
 * 한 줄 = 링크 하나(늘인 `::after` — 줄 어디를 눌러도, 최소 56px). 줄 안에 작은 글자 링크를 두지 않는다(QA-D-L17 · P-L12)
 */
export function NotificationList({ onOpen }: NotificationListProps) {
  const list = useNotificationList(true)

  if (list.isPending) {
    return (
      <div className={styles.listArea} aria-busy="true">
        <ul role="list" className={styles.list}>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <li key={i} className={styles.item} aria-hidden="true">
              <Skeleton className={styles.kindSkeleton} />
              <span className={styles.body}>
                <span className={styles.text}>
                  <Skeleton shape="text" width="94%" />
                  <Skeleton shape="text" width={i % 2 === 0 ? '58%' : '72%'} />
                </span>
                <span className={styles.time}>
                  <Skeleton shape="text" width="3.5rem" />
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="sr-only">알림을 불러오는 중이에요.</p>
      </div>
    )
  }

  // 처음 받기가 실패했을 때만 칸 전체를 오류로. 더 보기가 실패하면(받은 것은 그대로) 목록 아래 한 줄
  if (list.data === undefined) {
    return (
      <div className={styles.state} role="alert">
        <p className={styles.stateTitle}>알림을 불러오지 못했어요.</p>
        <p className={styles.stateText}>{getErrorMessage(list.error)}</p>
        <Button size="sm" onClick={() => void list.refetch()} pending={list.isFetching} pendingLabel="다시 불러오는 중">
          다시 시도
        </Button>
      </div>
    )
  }

  const items = list.data.pages.flatMap((page) => page.content).filter(isListedNotification)

  if (items.length === 0) {
    return (
      <div className={styles.state}>
        <p className={styles.stateTitle}>아직 알림이 없어요.</p>
        <p className={styles.stateText}>글에 확인 요청이 오거나 비슷한 글이 올라오면 여기서 알려 드려요.</p>
      </div>
    )
  }

  const now = new Date()

  return (
    <div className={styles.listArea}>
      <ul role="list" className={styles.list}>
        {items.map((n) => (
          <NotificationRow key={n.id} notification={n} now={now} onOpen={onOpen} />
        ))}
      </ul>
      {list.hasNextPage ? (
        <div className={styles.more}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void list.fetchNextPage()}
            pending={list.isFetchingNextPage}
            pendingLabel="지난 알림을 불러오는 중"
          >
            지난 알림 더 보기
          </Button>
        </div>
      ) : null}
      {list.isFetchNextPageError && !list.isFetchingNextPage ? (
        <p className={styles.moreError} role="alert">
          {getErrorMessage(list.error)}
        </p>
      ) : null}
    </div>
  )
}

function NotificationRow({
  notification: n,
  now,
  onOpen,
}: {
  notification: NotificationResponse
  now: Date
  onOpen: NotificationListProps['onOpen']
}) {
  const KindIcon = KIND_ICON[notificationKind(n.type)]
  const segments = notificationSentence(n)
  const href = notificationHref(n)
  const sentence = (
    <>
      {n.read ? null : <span className="sr-only">안 읽음. </span>}
      {segments.map((s, i) => (s.strong ? <b key={i}>{s.text}</b> : <span key={i}>{s.text}</span>))}
    </>
  )

  return (
    <li className={styles.item} data-unread={n.read ? undefined : ''}>
      <KindIcon className={styles.kind} />
      <span className={styles.body}>
        {/*
          가는 곳은 종류마다 다음 행동이 있는 자리(`notificationHref`, 화면정의서 SCR-10) — 요청 · 승인은 그 글 상세의 확인 요청 칸(`#claims`),
          거절은 보낸 확인 요청(`/me/claims`). 글이 없는 알림(앞으로 생길 종류)은 링크가 아니다
        */}
        {href !== null ? (
          <Link className={styles.link} to={href} onClick={(event) => onOpen(n, event)}>
            {sentence}
          </Link>
        ) : (
          <span className={styles.link}>{sentence}</span>
        )}
        <time className={styles.time} dateTime={n.createdAt}>
          {notificationTime(n.createdAt, now)}
        </time>
      </span>
    </li>
  )
}
