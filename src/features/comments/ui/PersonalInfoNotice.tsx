import { cx } from '@/shared/lib/cx'
import { Eye } from '@/shared/ui/icons'

import styles from './PersonalInfoNotice.module.css'

interface PersonalInfoNoticeProps {
  /** 입력칸의 `aria-describedby` 가 가리킨다 */
  id: string
  /** `usePersonalInfoCheck` 의 한 줄. 없으면 자리만 남는다 */
  notice: string | null
  className?: string
}

/**
 * 쓰는 칸에 전화번호 · 주민등록번호 · 카드 번호 모양이 보일 때만 뜨는 한 줄(SE-3). 막지 않는다.
 *
 * 제출 버튼과 **같은 줄 왼쪽**에 둔다. 칸과 버튼 사이에 줄이 새로 끼면 버튼이 밀려 누름이 빗나간다(API2-12) —
 * 같은 줄이면 몇 줄로 늘어도 버튼은 제자리다. 알림 영역은 늘 있어 처음 뜰 때 스크린리더가 한 번 읽는다.
 * 빨강을 쓰지 않는다(빨강은 방금 틀린 것 · 되돌릴 수 없는 동작). 눈 아이콘 = "누구나 봐요"
 */
export function PersonalInfoNotice({ id, notice, className }: PersonalInfoNoticeProps) {
  return (
    <p id={id} className={cx(styles.notice, className)} aria-live="polite">
      {notice ? (
        <span key={notice} className={styles.line}>
          <Eye />
          {notice}
        </span>
      ) : null}
    </p>
  )
}
