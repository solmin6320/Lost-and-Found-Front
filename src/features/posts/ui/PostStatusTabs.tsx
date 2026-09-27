import { Link, type To } from 'react-router-dom'

import { Skeleton } from '@/shared/ui/Skeleton'

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
  className?: string
}

const TABS: { status: PostStatus | undefined; label: string }[] = [
  { status: undefined, label: '전체' },
  ...POST_STATUSES.map((status) => ({ status, label: POST_STATUS_LABEL[status] })),
]

/**
 * 상태 탭 — 전체 · 게시중 · 연락중 · 완료. 주소를 바꾸는 **링크**다(ARIA 탭이 아니다).
 * 탭마다 주소가 있어 뒤로가기 · 새로고침 · 새 탭 열기가 그대로 된다. 지금 탭은 `aria-current="page"`.
 *
 * 필터 칩(알약)과 모양을 가른다 — 칩은 조건을 켜고 끄는 것, 이것은 내 글을 나눠 보는 자리다.
 * 글자와 아래 막대(잉크)로만 고른 탭을 보인다. 색을 쓰지 않는다.
 * 숫자는 자리를 먼저 잡는다(스켈레톤) — 숫자가 들어와도 탭이 옆으로 밀리지 않는다.
 */
export function PostStatusTabs({ selected, counts, hrefFor, className }: PostStatusTabsProps) {
  return (
    <nav className={className} aria-label="상태별로 보기">
      <ul className={styles.list} role="list">
        {TABS.map(({ status, label }) => {
          const current = status === selected
          const count = counts[status ?? 'ALL']
          return (
            <li key={label}>
              <Link className={styles.tab} to={hrefFor(status)} aria-current={current ? 'page' : undefined}>
                <span className={styles.label}>{label}</span>
                {count === undefined ? (
                  <Skeleton shape="text" width="1.25rem" className={styles.countSkeleton} />
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
    </nav>
  )
}
