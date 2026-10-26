import { formatDate } from '@/shared/lib/date'
import { Button } from '@/shared/ui/Button'
import { LockSimple } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { AdminMemberResponse, ManagerChange } from '../api/types'
import { managerChangeCopy, managerChangeFor } from '../model/managerChange'
import styles from './AdminMemberList.module.css'
import { RoleBadge } from './RoleBadge'

interface AdminMemberListProps {
  members: AdminMemberResponse[]
  /** 줄의 `[매니저로 임명]` · `[매니저 해임]`을 눌렀다 — 확인 창을 연다(바로 바꾸지 않는다) */
  onRequestChange: (member: AdminMemberResponse, change: ManagerChange) => void
  /** 다시 받는 중 — 직전 결과를 흐리게 둔다 */
  stale?: boolean
}

/**
 * 회원 목록 — **표가 아니라 목록**이다(화면정의서 SCR-15 · 19 : 휴대폰에서도 읽힌다). 한 줄 = 한 회원.
 * 넓으면 `닉네임 · 이름표 / 이메일 | 가입일 | 동작` 세 칸이 줄마다 같은 자리에 서고(가입일 · 동작 칸 폭을 고정해 줄끼리 맞는다),
 * 좁으면 위에서 아래로 쌓인다. 칸 이름 줄(머리줄)은 두지 않는다 — 이메일은 모양으로, 가입일은 `가입` 낱말로 스스로 말한다.
 *
 * 동작은 줄마다 하나뿐이다(임명 **또는** 해임). 누르면 확인 창이 결과를 먼저 말한다 — 누르자마자 바뀌는 버튼을 나란히 두지 않는다.
 * 해임도 빨강이 아니다(빨강은 오류 · 되돌릴 수 없는 삭제 전용 — 해임은 다시 임명할 수 있다). 관리자 줄은 버튼 대신 안내 한 줄
 */
export function AdminMemberList({ members, onRequestChange, stale = false }: AdminMemberListProps) {
  return (
    <div className={styles.frame}>
      <ul className={styles.list} role="list" aria-busy={stale || undefined} data-stale={stale || undefined}>
        {members.map((member) => (
          <MemberRow key={member.id} member={member} onRequestChange={onRequestChange} />
        ))}
      </ul>
    </div>
  )
}

function MemberRow({
  member,
  onRequestChange,
}: {
  member: AdminMemberResponse
  onRequestChange: AdminMemberListProps['onRequestChange']
}) {
  const change = managerChangeFor(member.role)
  const copy = change ? managerChangeCopy(member.nickname, change) : null

  return (
    <li className={styles.row}>
      <div className={styles.who}>
        <div className={styles.nameLine}>
          <h3 className={styles.name}>
            {member.nickname}
          </h3>
          <RoleBadge role={member.role} />
        </div>
        <p className={styles.email}>{member.email}</p>
      </div>
      <p className={styles.joined}>
        <span className={styles.joinedLabel}>가입</span>
        <time dateTime={member.createdAt} data-numeric>
          {formatDate(member.createdAt)}
        </time>
      </p>
      <div className={styles.action}>
        {change && copy ? (
          <Button
            size="sm"
            // 보이는 글자로 시작하고 누구인지 덧붙인다 — 같은 글자의 버튼이 스무 개라 이름만으로는 누구 것인지 모른다(보이는 말 = 읽히는 이름의 앞부분)
            aria-label={`${copy.action}: ${member.nickname}`}
            onClick={() => onRequestChange(member, change)}
          >
            {copy.action}
          </Button>
        ) : (
          <p className={styles.locked}>
            <LockSimple />
            서버 설정으로만 바꿀 수 있어요
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * 받는 동안 — 같은 줄 틀 · 같은 줄 높이(글자 자리 한 줄 = 글자 크기 × 행간). 동작 칸은 버튼 높이(44px)를 잡는다 — 관리자 줄의 안내도 같은 높이라
 * 받은 뒤 줄이 움직이지 않는다(스켈레톤 ↔ 받은 화면 이동 0)
 */
export function AdminMemberListSkeleton({ count }: { count: number }) {
  return (
    <div className={styles.frame} aria-hidden="true">
      <ul className={styles.list} role="list">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={styles.row}>
            <div className={styles.who}>
              <div className={styles.nameLine}>
                <span className={styles.name}>
                  <Skeleton shape="text" className={styles.line} width={i % 3 === 0 ? '7em' : i % 3 === 1 ? '5em' : '6em'} />
                </span>
              </div>
              <p className={styles.email}>
                <Skeleton shape="text" className={styles.line} width={i % 2 === 0 ? '13em' : '10em'} />
              </p>
            </div>
            <p className={styles.joined}>
              <Skeleton shape="text" className={styles.line} width="7.5em" />
            </p>
            <div className={styles.action}>
              <Skeleton className={styles.actionSkeleton} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
