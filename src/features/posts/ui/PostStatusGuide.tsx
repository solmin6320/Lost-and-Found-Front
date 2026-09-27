import { Toggletip } from '@/shared/ui/Toggletip'

import { POST_STATUSES, type PostStatus, type PostType } from '../api/types'
import { POST_STATUS_MEANING, POST_TYPE_MEANING } from '../model/labels'
import styles from './BadgeGuide.module.css'
import { StatusBadge } from './StatusBadge'
import { TypeBadge } from './TypeBadge'

interface PostStatusGuideProps {
  type: PostType
  status: PostStatus
  /** 헤더 `서비스 안내`가 열 때(제어). 주지 않으면 스스로 여닫는다 */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

/**
 * 상세의 `이름표 안내` — 온보딩 2층(docs/온보딩설계.md 4장 "상태 배지(상세)"). 배지 줄 끝에서 **누르면** 펼친다.
 * 목록의 안내와 같은 문장(`labels.ts`)을 쓰되, 이 글의 유형 하나와 상태 셋을 보여 주고 지금 상태에 표시를 붙인다 —
 * 상태가 게시중 → 연락중 → 완료로 흘러간다는 것을 이 글 앞에서 한 번에 본다.
 * 배지 줄의 오른쪽 끝에 두고 판을 오른쪽에 맞춰 펼친다 — 320 폭에서도 화면 밖으로 나가지 않는다.
 */
export function PostStatusGuide({ type, status, open, onOpenChange, className }: PostStatusGuideProps) {
  return (
    <Toggletip label="이름표 안내" align="end" open={open} onOpenChange={onOpenChange} className={className}>
      <p className={styles.title}>이 글의 이름표</p>
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt>
            <TypeBadge type={type} />
          </dt>
          <dd>{POST_TYPE_MEANING[type]}</dd>
        </div>
        {POST_STATUSES.map((value) => (
          <div key={value} className={styles.row} data-current={value === status || undefined}>
            <dt>
              <StatusBadge status={value} />
            </dt>
            <dd>
              {POST_STATUS_MEANING[value]}
              {value === status ? <span className={styles.now}>지금 이 글의 상태</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>상태는 글쓴이가 바꿔요. 완료가 되면 더는 바꿀 수 없어요.</p>
    </Toggletip>
  )
}
