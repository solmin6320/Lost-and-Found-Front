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
  /**
   * 이번 방문에 받은 적 있는 건수(쿼리 캐시). 숫자를 기다리는 동안 그 자릿수만큼 자리를 잡는다 — 없으면 두 자리(QA-P-26).
   * 화면에 숫자로 내지 않는다
   */
  knownCounts?: Partial<Record<PostStatus | 'ALL', number>>
  /** 탭 → 주소. 경로는 부른 쪽이 정한다 */
  hrefFor: (status: PostStatus | undefined) => To
  /**
   * 지금 탭 링크에 덧붙일 표시(`data-*`). 부른 쪽이 페이지를 넘긴 뒤 포커스 자리로 쓴다 — 내가 쓴 글의 `data-page-turn-focus`(QA-P-29)
   */
  currentData?: Record<`data-${string}`, string | true>
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
 * 숫자는 자리를 먼저 잡는다 — 이번 방문에 받은 건수가 있으면 그 자릿수, 없으면 두 자리(QA-P-26). 0.3초가 넘으면 그 자리에
 * 목록 건수 자리와 같은 6px 점 셋이 선다(모든 건수 자리가 같은 표시, 본인 결정 2026-10-16 QA-P-12 · 2026-10-18 점 크기).
 * 네 숫자는 한꺼번에 들어온다(부른 쪽이 셋 다 받은 뒤 넘긴다, QA-D-25) — 탭 줄이 두세 번 나뉘어 움직이지 않는다.
 *
 * **탭마다 자리를 늘 잡아 둔다 — 링크 안에서**(본인 지시 2026-10-18 "스켈레톤까지", 디자인 QA 10차 탭 틈 확정안). 이름은 고른 탭의 굵기만큼
 * (보이지 않는 굵은 이름을 겹친다), 숫자는 숫자 칸(`.countSlot`, 받을 숫자의 자릿수 · 점 폭)만큼. 그래서 링크(누르는 곳 · 아래 막대) 폭이 늘 같고
 * 탭 사이 틈은 `--tab-gap` 하나다 — 예전엔 자리를 링크 밖에 겹쳐 두어 남는 자리가 다음 탭과의 틈이 되어 탭마다 10 ~ 13px 로 들쭉날쭉했다.
 * 점 · 숫자 · 고른 탭의 굵기가 바뀌어도 탭 줄이 움직이지 않는다(6px 점 자리를 그때만 넓히면 숫자가 들어올 때 320 에서 탭이 53px 당겨졌다)
 */
export function PostStatusTabs({ selected, counts, knownCounts, hrefFor, currentData, trailing, className }: PostStatusTabsProps) {
  return (
    <nav className={cx(styles.nav, className)} aria-label="상태별로 보기">
      <ul className={styles.list} role="list">
        {TABS.map(({ status, label }) => {
          const current = status === selected
          const count = counts[status ?? 'ALL']
          return (
            <li key={label} className={styles.item}>
              <Link
                className={styles.tab}
                to={hrefFor(status)}
                aria-current={current ? 'true' : undefined}
                {...(current ? currentData : undefined)}
              >
                {/* 이름 — 보이지 않는 굵은 이름을 겹쳐 고른 탭이 굵어져도 폭이 그대로다 */}
                <span className={styles.label} data-label={label}>
                  {label}
                </span>
                {/*
                  숫자 칸 — 들어올 숫자의 자릿수만큼(보이지 않는 숫자) 먼저 잡고, 숫자 · 점 셋은 그 칸에 겹친다(QA-P-19 · P-26, 목록 건수 자리와 같은 방식).
                  못 불러오면(null) 숫자 없이 칸만 남는다 — 탭 폭이 그대로다
                */}
                <span className={cx(styles.count, styles.countSlot)} data-numeric>
                  <span className={styles.countGhost} aria-hidden="true">
                    {ghostOf(knownCounts?.[status ?? 'ALL'])}
                  </span>
                  {count === undefined ? (
                    <LoadingDots announce={false} className={styles.countDots} />
                  ) : count === null ? null : (
                    <span className={styles.countValue}>
                      {count.toLocaleString('ko-KR')}
                      <span className="sr-only">건</span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {trailing}
    </nav>
  )
}

/**
 * 기다리는 자리의 보이지 않는 숫자 — 받은 적 있는 건수의 자릿수(쉼표 포함), 없으면 두 자리.
 * 한 자리 자리는 230 · 40 처럼 자주 보는 두세 자리 수가 들어오면 탭이 9 · 18px 늘어 뒤 탭이 최대 54px 밀렸다(QA-P-26)
 */
function ghostOf(known: number | undefined): string {
  return known === undefined ? '00' : known.toLocaleString('ko-KR').replace(/\d/g, '0')
}
