import type { MouseEvent } from 'react'
import { Link, type To } from 'react-router-dom'

import { cx } from '@/shared/lib/cx'
import { isPlainClick } from '@/shared/lib/events'

import { CaretLeft, CaretRight } from './icons'
import { pageRangeLabel } from './pageRangeLabel'
import styles from './Pagination.module.css'
import tip from './Tooltip.module.css'

interface PaginationProps {
  /** 지금 페이지. **1부터** */
  page: number
  totalPages: number
  /** 페이지 번호 → 주소. 링크라서 새 탭 열기 · 주소 복사가 된다 */
  hrefFor: (page: number) => To
  /** 링크를 누른 직후. 결과 제목 · 탭 줄로 옮길 때 쓴다. 새 탭으로 여는 클릭(Ctrl · Cmd · 가운데 버튼)에는 부르지 않는다 */
  onNavigate?: () => void
  /**
   * 번호를 이만큼씩 묶어 보인다(`1 2 3 4 5` · `6 7 8 9 10`, 본인 결정 2026-10-16 — 목록 · 내가 쓴 글 같은 모양, 2026-10-17 QA-D-20).
   * 전체가 이보다 **많으면**(6페이지부터) 양 끝에 이전 · 다음 **묶음** 화살표(‹ ›)를 둔다 — 첫 묶음의 ‹ · 마지막 묶음의 › 는 흐리게(누를 수 없음).
   * 딱 이만큼(5페이지)이면 화살표를 두지 않는다 — 둘 다 누를 수 없는 화살표는 할 일이 없다(본인 결정 2026-10-17, QA-D-15)
   */
  groupSize: number
}

/** 지금 페이지가 든 묶음의 첫 · 끝 번호(1부터) */
function pageGroup(page: number, totalPages: number, groupSize: number): { start: number; end: number } {
  const current = Math.min(Math.max(page, 1), Math.max(totalPages, 1))
  const start = Math.floor((current - 1) / groupSize) * groupSize + 1
  return { start, end: Math.min(start + groupSize - 1, totalPages) }
}

/**
 * 페이지 이동 — `‹ 1 2 3 4 5 ›`. 번호는 지금 묶음만, 화살표는 앞 · 뒤 묶음으로 간다(‹ 는 앞 묶음의 끝 번호, › 는 뒤 묶음의 첫 번호).
 * 화살표는 아이콘만 보이고 이름표(툴팁)와 이름(`이전 페이지 묶음, 1~5페이지`)이 무엇을 하는지 말한다.
 * 누르는 면은 모두 44px. 칸이 좁으면(320 · 글자 200%) 번호 줄이 위, 화살표 둘이 아래 줄로 내려가고 번호도 줄을 바꾼다 — 넘치지 않는다.
 * 한 페이지뿐이면 그리지 않는다
 */
export function Pagination({ page, totalPages, hrefFor, onNavigate, groupSize }: PaginationProps) {
  if (totalPages <= 1) {
    return null
  }
  const { start, end } = pageGroup(page, totalPages, groupSize)
  // 화살표는 6페이지부터 — 딱 다섯 페이지면 둘 다 누를 수 없는 화살표만 남는다(본인 결정 2026-10-17, QA-D-15 · P-18①)
  const arrows = totalPages > groupSize
  const prev = start > 1 ? pageGroup(start - 1, totalPages, groupSize) : null
  const next = end < totalPages ? pageGroup(end + 1, totalPages, groupSize) : null
  const handleClick = (event: MouseEvent) => {
    if (isPlainClick(event)) onNavigate?.()
  }
  const numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  return (
    <nav className={styles.nav} aria-label="페이지 이동">
      {/* 칸 수(번호 + 화살표)로 한 줄에 들어가는지 가른다(CSS 컨테이너 질의) */}
      <div className={styles.groups} data-arrows={arrows || undefined} data-slots={arrows ? numbers.length + 2 : undefined}>
        {arrows ? (
          prev ? (
            <Link
              className={cx(styles.arrow, styles.arrowPrev, tip.host)}
              to={hrefFor(prev.end)}
              aria-label={`이전 페이지 묶음, ${pageRangeLabel(prev)}`}
              onClick={handleClick}
            >
              <CaretLeft />
              <span className={tip.tip} aria-hidden="true">
                {pageRangeLabel(prev)}
              </span>
            </Link>
          ) : (
            <span className={cx(styles.arrow, styles.arrowPrev)} aria-disabled="true">
              <CaretLeft />
              <span className="sr-only">이전 페이지 묶음 없음</span>
            </span>
          )
        ) : null}

        <ol className={styles.groupPages} role="list">
          {numbers.map((n) => (
            <li key={n}>
              <Link
                className={styles.page}
                to={hrefFor(n)}
                aria-label={`${n}페이지`}
                aria-current={n === page ? 'page' : undefined}
                onClick={handleClick}
              >
                {n}
              </Link>
            </li>
          ))}
        </ol>

        {arrows ? (
          next ? (
            <Link
              className={cx(styles.arrow, styles.arrowNext, tip.host)}
              to={hrefFor(next.start)}
              aria-label={`다음 페이지 묶음, ${pageRangeLabel(next)}`}
              onClick={handleClick}
            >
              <CaretRight />
              <span className={cx(tip.tip, styles.tipEnd)} aria-hidden="true">
                {pageRangeLabel(next)}
              </span>
            </Link>
          ) : (
            <span className={cx(styles.arrow, styles.arrowNext)} aria-disabled="true">
              <CaretRight />
              <span className="sr-only">다음 페이지 묶음 없음</span>
            </span>
          )
        ) : null}
      </div>
    </nav>
  )
}
