import type { ReactNode } from 'react'
import { Link, type To } from 'react-router-dom'

import { cx } from '@/shared/lib/cx'
import { LoadingDots } from '@/shared/ui/LoadingDots'

import { POST_STATUSES, type PostStatus } from '../api/types'
import { POST_STATUS_LABEL } from '../model/labels'
import styles from './PostStatusTabs.module.css'

/** 탭별 글 수. 아직 모르면 `undefined`(자리만 잡는다), 불러오지 못했으면 `null`(숫자 없이) */
export type PostStatusCounts = Record<PostStatus | 'ALL', number | null | undefined>

interface PostStatusTabsProps {
  /** 지금 보는 탭. `undefined` 면 전체 */
  selected: PostStatus | undefined
  counts: PostStatusCounts
  /** 탭 → 주소. 경로는 부른 쪽이 정한다 */
  hrefFor: (status: PostStatus | undefined) => To
  /** 탭 줄에 덧붙는 것(다시 받는 중의 점 셋). 탭 목록 밖 — 목록 항목 수가 늘지 않는다. 자리는 부른 쪽이 정한다(이 줄이 기준 상자) */
  trailing?: ReactNode
  className?: string
}

const TABS: { status: PostStatus | undefined; label: string }[] = [
  { status: undefined, label: '전체' },
  ...POST_STATUSES.map((status) => ({ status, label: POST_STATUS_LABEL[status] })),
]

/**
 * 상태 탭 — 전체 · 게시중 · 연락중 · 완료. 주소를 바꾸는 **링크**다(ARIA 탭이 아니다).
 * 탭마다 주소가 있어 뒤로가기 · 새로고침 · 새 탭 열기가 그대로 된다. 지금 탭은 `aria-current="true"`(묶음 안의 지금 것) —
 * `"page"` 는 아래 페이지 번호의 지금 페이지 하나에만 쓴다. 둘 다 `page` 면 한 화면에 "지금 페이지"가 둘로 읽혔다(QA-P-23)
 *
 * 필터 칩(알약)과 모양을 가른다 — 칩은 조건을 켜고 끄는 것, 이것은 내 글을 나눠 보는 자리다.
 * 글자와 아래 막대(잉크)로만 고른 탭을 보인다. 색을 쓰지 않는다.
 * 숫자는 자리를 먼저 잡는다(숫자 한 자리 폭) — 0.3초가 넘으면 그 자리에 점 셋이 겹쳐 선다(모든 건수 자리가 같은 표시, 본인 결정 2026-10-16 QA-P-12).
 * 예전엔 점 자리(20px)가 숫자보다 넓어 숫자가 들어오면 탭이 11px 줄고 뒤 탭들이 왼쪽으로 33px 당겨졌다(QA-P-19).
 */
export function PostStatusTabs({ selected, counts, hrefFor, trailing, className }: PostStatusTabsProps) {
  return (
    <nav className={cx(styles.nav, className)} aria-label="상태별로 보기">
      <ul className={styles.list} role="list">
        {TABS.map(({ status, label }) => {
          const current = status === selected
          const count = counts[status ?? 'ALL']
          return (
            <li key={label}>
              <Link className={styles.tab} to={hrefFor(status)} aria-current={current ? 'true' : undefined}>
                <span className={styles.label}>{label}</span>
                {count === undefined ? (
                  // 숫자 한 자리 폭을 잡고 점 셋은 그 위에 겹쳐 선다 — 숫자가 들어와도 탭 폭이 그대로다(QA-P-19, 목록 건수 자리와 같은 방식)
                  <span className={cx(styles.count, styles.countPending)} data-numeric>
                    <span className={styles.countGhost} aria-hidden="true">
                      0
                    </span>
                    <LoadingDots announce={false} className={styles.countDots} />
                  </span>
                ) : count === null ? null : (
                  <span className={styles.count} data-numeric>
                    {count.toLocaleString('ko-KR')}
                    <span className="sr-only">건</span>
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
      {trailing}
    </nav>
  )
}
