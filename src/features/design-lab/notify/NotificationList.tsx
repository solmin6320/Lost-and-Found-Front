import { Link } from 'react-router-dom'

import { paths } from '@/app/paths'
import { cx } from '@/shared/lib/cx'
import { Button } from '@/shared/ui/Button'
import { ChatsCircle, CheckCircle, HandWaving, ListMagnifyingGlass, XCircle, type Icon } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { LabVariant } from '../labSwitch'
import type { LabNotification, NotificationKind } from '../mock'
import type { LabResource } from '../useLabResource'
import styles from './notify.module.css'
import { shortTime } from './time'

const KIND: Record<NotificationKind, { icon: Icon; tone: string }> = {
  CLAIM_REQUESTED: { icon: HandWaving, tone: 'request' },
  CLAIM_APPROVED: { icon: CheckCircle, tone: 'approved' },
  CLAIM_REJECTED: { icon: XCircle, tone: 'rejected' },
  MATCH_SUGGESTED: { icon: ListMagnifyingGlass, tone: 'match' },
}

/** 알림 문장 — 누가 · 어느 글에 · 무엇을. 글 제목은 따옴표 대신 굵게 */
function sentence(n: LabNotification) {
  switch (n.kind) {
    case 'CLAIM_REQUESTED':
      return (
        <>
          <b>{n.actor}</b> 님이 <b>{n.postTitle}</b> 글에 주인 확인을 요청했어요.
        </>
      )
    case 'CLAIM_APPROVED':
      return (
        <>
          <b>{n.actor}</b> 님이 확인 요청을 승인했어요. 이제 대화할 수 있어요.
        </>
      )
    case 'CLAIM_REJECTED':
      return (
        <>
          <b>{n.actor}</b> 님이 <b>{n.postTitle}</b> 글의 확인 요청을 거절했어요.
        </>
      )
    case 'MATCH_SUGGESTED':
      return (
        <>
          <b>{n.postTitle}</b> 글과 비슷한 습득 글이 <b>{n.matchCount}건</b> 올라왔어요.
        </>
      )
  }
}

function action(n: LabNotification, variant: LabVariant) {
  switch (n.kind) {
    case 'CLAIM_REQUESTED':
      return { to: paths.postDetail(n.postId), label: '요청 보기' }
    case 'CLAIM_APPROVED':
      return { to: paths.lab.chat(variant, n.roomId), label: '대화 열기' }
    case 'CLAIM_REJECTED':
      return { to: paths.postDetail(n.postId), label: '글 보기' }
    case 'MATCH_SUGGESTED':
      return { to: `${paths.postDetail(n.postId)}?lab=match-${variant},bell-${variant}`, label: '후보 보기' }
  }
}

interface NotificationListProps {
  resource: LabResource<LabNotification[]>
  variant: LabVariant
  /** 읽음 처리한 알림 */
  readIds: number[]
  onOpen: (id: number) => void
  /** 넓게(받은함 화면) */
  roomy?: boolean
}

/** 알림 목록 — 새 알림 / 지난 알림 두 묶음. 네 가지 상태를 모두 그린다 */
export function NotificationList({ resource, variant, readIds, onOpen, roomy }: NotificationListProps) {
  if (resource.status === 'loading') {
    return (
      <ul role="list" className={cx(styles.list, roomy && styles.roomy)} aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className={styles.item}>
            <Skeleton className={styles.kindSkeleton} />
            <span className={styles.body}>
              <Skeleton shape="text" width="92%" />
              <Skeleton shape="text" width="60%" />
            </span>
          </li>
        ))}
        <li className="sr-only">알림을 불러오는 중이에요</li>
      </ul>
    )
  }
  if (resource.status === 'error') {
    return (
      <div className={styles.state}>
        <p className={styles.stateTitle}>알림을 불러오지 못했어요.</p>
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
        <p className={styles.stateTitle}>아직 알림이 없어요.</p>
        <p className={styles.stateText}>누가 내 글에 확인을 요청하거나 비슷한 글이 올라오면 여기에 와요.</p>
      </div>
    )
  }

  const unread = (n: LabNotification) => !n.read && !readIds.includes(n.id)
  const groups = [
    { title: '새 알림', items: resource.data.filter(unread) },
    { title: '지난 알림', items: resource.data.filter((n) => !unread(n)) },
  ].filter((g) => g.items.length > 0)

  return (
    <div className={cx(styles.groups, roomy && styles.roomy)}>
      {groups.map((group) => (
        <section key={group.title} className={styles.group} aria-label={group.title}>
          <h3 className={styles.groupTitle}>{group.title}</h3>
          <ul role="list" className={styles.list}>
            {group.items.map((n) => {
              const kind = KIND[n.kind]
              const KindIcon = kind.icon
              const go = action(n, variant)
              const isNew = unread(n)
              return (
                <li key={n.id} className={styles.item} data-unread={isNew || undefined}>
                  <span className={styles.kind} data-tone={kind.tone} aria-hidden="true">
                    <KindIcon />
                  </span>
                  <span className={styles.body}>
                    <span className={styles.text}>
                      {isNew ? <span className="sr-only">안 읽음. </span> : null}
                      {sentence(n)}
                    </span>
                    <span className={styles.meta}>
                      <time dateTime={n.createdAt}>{shortTime(n.createdAt)}</time>
                      <Link className={styles.go} to={go.to} onClick={() => onOpen(n.id)}>
                        {n.kind === 'CLAIM_APPROVED' ? <ChatsCircle /> : null}
                        {go.label}
                      </Link>
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
