import type { MouseEventHandler, Ref } from 'react'

import { cx } from '@/shared/lib/cx'
import { Button } from '@/shared/ui/Button'
import { ChatCircleDots } from '@/shared/ui/icons'

import styles from './CommentEntry.module.css'

interface CommentEntryButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>
  /** 지금 댓글 수. 0 이거나 주지 않으면 숫자를 붙이지 않는다(제목 옆처럼 바로 앞에 숫자가 있는 자리) */
  count?: number
  className?: string
  ref?: Ref<HTMLButtonElement>
}

/**
 * `댓글 쓰기 N` — 선 버튼(말풍선 + 글자 + 숫자). 이 화면의 연락 입구다.
 * 같은 화면 안에서 쓰는 칸으로 데려가는 일이라 버튼이다(주소가 바뀌지 않는다).
 * 채움은 진짜 제출 [댓글 남기기]와 휴대폰 하단 줄의 몫이라 여기는 선만 두른다
 */
export function CommentEntryButton({ onClick, count, className, ref }: CommentEntryButtonProps) {
  return (
    <Button ref={ref} size="sm" className={cx(styles.entry, className)} onClick={onClick}>
      <ChatCircleDots />
      댓글 쓰기
      {count ? (
        <span className={styles.count} data-numeric>
          <span className="sr-only">, 지금 댓글 </span>
          {count.toLocaleString('ko-KR')}
          <span className="sr-only">개</span>
        </span>
      ) : null}
    </Button>
  )
}
