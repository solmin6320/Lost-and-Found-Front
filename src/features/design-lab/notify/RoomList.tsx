import { Link } from 'react-router-dom'

import { paths } from '@/app/paths'
import { PostThumbnail } from '@/features/posts'
import { cx } from '@/shared/lib/cx'
import { Button } from '@/shared/ui/Button'
import { LockSimple } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { LabVariant } from '../labSwitch'
import type { LabChatRoom } from '../mock'
import type { LabResource } from '../useLabResource'
import styles from './notify.module.css'
import { shortTime } from './time'

/** 대화 목록 — 글 포스터 + 상대 + 마지막 말 + 안 읽은 수. 닫힌 방은 자물쇠와 함께 아래로 */
export function RoomList({ resource, variant, activeId, roomy }: { resource: LabResource<LabChatRoom[]>; variant: LabVariant; activeId?: number; roomy?: boolean }) {
  if (resource.status === 'loading') {
    return (
      <ul role="list" className={cx(styles.list, roomy && styles.roomy)} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className={styles.room}>
            <Skeleton className={styles.roomThumb} />
            <span className={styles.body}>
              <Skeleton shape="text" width="50%" />
              <Skeleton shape="text" width="85%" />
            </span>
          </li>
        ))}
        <li className="sr-only">대화를 불러오는 중이에요</li>
      </ul>
    )
  }
  if (resource.status === 'error') {
    return (
      <div className={styles.state}>
        <p className={styles.stateTitle}>대화 목록을 불러오지 못했어요.</p>
        <p className={styles.stateText}>{resource.message}</p>
        <Button size="sm" onClick={resource.retry} pending={resource.retrying} pendingLabel="다시 불러오는 중">
          다시 시도
        </Button>
      </div>
    )
  }
  if (resource.data.length === 0) {
    return (
      <div className={styles.state}>
        <p className={styles.stateTitle}>아직 대화가 없어요.</p>
        <p className={styles.stateText}>주인 확인 요청이 승인되면 두 사람만의 대화방이 열려요.</p>
      </div>
    )
  }
  const rooms = [...resource.data].sort((a, b) => Number(a.closed) - Number(b.closed))
  return (
    <ul role="list" className={cx(styles.list, roomy && styles.roomy)}>
      {rooms.map((room) => (
        <li key={room.id} className={styles.room} data-closed={room.closed || undefined} data-active={room.id === activeId || undefined}>
          <PostThumbnail className={styles.roomThumb} category={room.postCategory} type={room.postType} alt="" seed={room.postId} />
          <span className={styles.body}>
            <span className={styles.roomTop}>
              <Link className={styles.roomLink} to={paths.lab.chat(variant, room.id)} aria-current={room.id === activeId ? 'page' : undefined}>
                {room.partner}
              </Link>
              <span className={styles.roomPost}>{room.postTitle}</span>
              <time className={styles.roomTime} dateTime={room.lastAt}>
                {shortTime(room.lastAt)}
              </time>
            </span>
            <span className={styles.roomLast}>
              {room.closed ? (
                <span className={styles.closedTag}>
                  <LockSimple />
                  닫힌 대화
                </span>
              ) : null}
              <span className={styles.roomLastText}>{room.lastMessage}</span>
              {room.unread > 0 ? (
                <span className={styles.unreadCount}>
                  <span className="sr-only">안 읽은 메시지 </span>
                  {room.unread}
                </span>
              ) : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
