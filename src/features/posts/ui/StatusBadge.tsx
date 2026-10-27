import { ChatCircleDots, Check, CheckCircle, MegaphoneSimple, type Icon } from '@/shared/ui/icons'

import type { PostStatus } from '../api/types'
import { POST_STATUS_LABEL } from '../model/labels'
import styles from './Badge.module.css'

interface StatusBadgeProps {
  status: PostStatus
  /**
   * `photo` 사진 위에 겹칠 때. 불투명한 바탕을 깔고, 완료는 잉크 도장으로 바꾼다.
   * `detail` 상세 제목 아래. 종이 위 외곽선 그대로, **완료만 목록과 같은 잉크 도장** — 같은 상태는 같은 모양이다.
   * 목록에서는 끝난 글을 조용하게, 상세에서는 "이미 돌아갔다" 를 분명하게(UI-11)
   */
  surface?: 'plain' | 'photo' | 'detail'
  /**
   * 주인 확인 완료([4.8] 받았어요로 끝난 글). 완료 배지 **하나 안에서** 체크를 동그라미 체크(완료 표시 전용)로 바꾸고
   * 스크린리더에 "주인 확인"을 더한다 — 배지를 하나 더 달지 않는다(완료 글은 목록에서 조용히 · 사진 위 표시는 최소로)
   */
  verified?: boolean
}

/**
 * 상태마다 아이콘 하나 — 색이 아니라 모양과 라벨로 가른다.
 *   게시중 : 알리는 중(확성기) · 연락중 : 이야기가 오가는 중(말풍선) · 완료 : 끝(체크)
 */
const STATUS_ICON: Record<PostStatus, Icon> = {
  OPEN: MegaphoneSimple,
  IN_PROGRESS: ChatCircleDots,
  DONE: Check,
}

/** 게시중 · 연락중 · 완료. 종이 위(`plain`)에서는 완료가 가장 옅다 */
export function StatusBadge({ status, surface = 'plain', verified = false }: StatusBadgeProps) {
  const showVerified = verified && status === 'DONE'
  const StatusIcon = showVerified ? CheckCircle : STATUS_ICON[status]
  return (
    <span className={styles.status} data-status={status} data-surface={surface}>
      <StatusIcon className={styles.statusIcon} />
      {POST_STATUS_LABEL[status]}
      {showVerified ? <span className="sr-only">, 주인 확인</span> : null}
    </span>
  )
}
