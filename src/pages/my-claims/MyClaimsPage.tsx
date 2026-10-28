import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, type To } from 'react-router-dom'

import { loginPath } from '@/app/authRedirect'
import { PAGE_TURN_FOCUS_ATTR } from '@/app/RouteFocus'
import { paths, type LoginNoticeState } from '@/app/paths'
import { subscribeSignedOutElsewhere, useAuth } from '@/features/auth'
import { myClaimsQueryOptions, type ClaimStatus, type MyClaimResponse } from '@/features/claims'
import { StatusBadge, TypeBadge } from '@/features/posts'
import { formatDate } from '@/shared/lib/date'
import { isPlainClick } from '@/shared/lib/events'
import { getErrorMessage, subscribeSessionExpired } from '@/shared/lib/http'
import { useDropPageWhenEmpty } from '@/shared/lib/pageParam'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import type { PagedModel } from '@/shared/types/api'
import { ButtonLink } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { CaretDown, CheckCircle, Clock, HandHeart, Info, MagnifyingGlass, PaperPlaneRight, XCircle, type Icon } from '@/shared/ui/icons'
import { Pagination } from '@/shared/ui/Pagination'
import { Skeleton } from '@/shared/ui/Skeleton'

import styles from './MyClaims.module.css'
import {
  MY_CLAIMS_PAGE_GROUP,
  MY_CLAIMS_PAGE_SIZE,
  claimNextStep,
  claimSettledAt,
  claimStatusLabel,
  claimStatusTone,
  claimsPageAnnouncement,
  isStalledClosed,
  useMyClaimsPage,
} from './myClaimsModel'
import { MY_CLAIMS_HINT, MyClaimsListSkeleton } from './MyClaimsSkeleton'

/** 페이지를 넘긴 뒤 포커스 자리 표시(RouteFocus 가 뒤로 · 앞으로의 대체 자리로 찾는다) */
const PAGE_TURN_FOCUS = { [PAGE_TURN_FOCUS_ATTR]: true } as const

/**
 * 요청 상태 아이콘 — 알림 줄과 같은 표지(승인 `HandHeart` · 거절 `XCircle`). 채운 `CheckCircle` 은 완료 전용이라 전달 완료에만
 */
const STATUS_ICON: Record<ClaimStatus, Icon> = {
  PENDING: Clock,
  APPROVED: HandHeart,
  REJECTED: XCircle,
  RECEIVED: CheckCircle,
}

/**
 * SCR-12 ③ 보낸 확인 요청 · `/me/claims` — `GET /api/members/me/claims`(최근 보낸 순)
 *
 * 로그인이 필요하다. 처음부터 비로그인이면 로그인을 거쳐 이 쪽으로 돌아온다(`?redirect=`).
 * 보는 도중 로그인이 끊기면 로그인 화면으로 가며 까닭을 한 줄 싣는다(내가 쓴 글과 같다).
 * 세션을 되살리는 동안은 같은 모양의 스켈레톤이다 — 요청은 로그인이 확인된 뒤에 나간다.
 */
export function MyClaimsPage() {
  const auth = useAuth()
  const location = useLocation()
  const here = `${location.pathname}${location.search}`
  useDocumentTitle('보낸 확인 요청')

  const [seen, setSeen] = useState(false)
  if (auth.status === 'authenticated' && !seen) setSeen(true)

  const [expired, setExpired] = useState(false)
  useEffect(() => subscribeSessionExpired(() => setExpired(true)), [])
  const [elsewhere, setElsewhere] = useState(false)
  useEffect(() => subscribeSignedOutElsewhere(() => setElsewhere(true)), [])

  if (auth.status === 'anonymous') {
    const state: LoginNoticeState | undefined = seen
      ? {
          notice: expired
            ? '로그인이 만료됐어요. 다시 로그인해 주세요.'
            : elsewhere
              ? '다른 창에서 로그아웃했어요.'
              : '로그아웃했어요.',
        }
      : undefined
    return <Navigate to={loginPath(here)} replace state={state} />
  }

  return <MyClaims enabled={auth.status === 'authenticated'} />
}

function MyClaims({ enabled }: { enabled: boolean }) {
  const { page, hrefForPage } = useMyClaimsPage()
  const query = useQuery({
    ...myClaimsQueryOptions({ page: page - 1, size: MY_CLAIMS_PAGE_SIZE }),
    enabled,
    placeholderData: keepPreviousData,
  })
  const settled = query.data && !query.isPlaceholderData ? query.data : null
  useDropPageWhenEmpty(settled?.page.totalElements)

  /*
   * 쪽을 넘기면 건수 줄부터 다시 읽는다 — 보이는 자리라 키보드로 넘기면 포커스 링이 선다(내가 쓴 글의 "지금 탭"과 같은 까닭, QA-P-29).
   * 주소가 그려진 뒤에 옮긴다(QA-P-25 — 누른 직후에 옮기면 그 스크롤이 떠나는 쪽의 기록으로 남는다)
   */
  const countRef = useRef<HTMLParagraphElement>(null)
  const turnedPage = useRef(false)
  function handlePageNavigate() {
    turnedPage.current = true
  }
  useEffect(() => {
    if (!turnedPage.current) return
    turnedPage.current = false
    const count = countRef.current
    if (!count) return
    count.scrollIntoView({ block: 'start' })
    count.focus({ preventScroll: true })
  }, [page])

  // 결과 알림 — 처음 받은 결과는 건수, 같은 화면에서 쪽을 넘긴 결과는 목록과 같은 꼴의 문장
  const [shownPage, setShownPage] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  if (settled && shownPage !== page) {
    const total = settled.page.totalElements
    setShownPage(page)
    setAnnouncement(
      shownPage !== null && settled.content.length > 0
        ? claimsPageAnnouncement(page, settled.content.length, total)
        : `보낸 확인 요청 ${total.toLocaleString('ko-KR')}건`,
    )
  }

  const total = query.data?.page.totalElements
  const hasAny = total === undefined || total > 0 || query.isError

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>보낸 확인 요청</h1>
        <p className={styles.hint}>{MY_CLAIMS_HINT}</p>
      </header>

      <section aria-labelledby="my-claims-count">
        {/* 건수 줄 — 이 구역의 이름이자 쪽을 넘긴 뒤의 포커스 자리. 받기 전에는 자리만(높이가 바뀌지 않게) */}
        <p
          id="my-claims-count"
          ref={countRef}
          className={styles.count}
          tabIndex={-1}
          data-idle={!hasAny || undefined}
          {...PAGE_TURN_FOCUS}
        >
          {total !== undefined && !query.isError ? (
            <>
              보낸 요청 <b>{total.toLocaleString('ko-KR')}</b>건
            </>
          ) : (
            <>
              {query.isPending ? <Skeleton shape="text" width="5rem" /> : null}
              <span className="sr-only">보낸 요청</span>
            </>
          )}
        </p>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        <MyClaimsBody query={query} hrefForPage={hrefForPage} onPageNavigate={handlePageNavigate} />

        {settled && settled.content.length > 0 ? (
          <div className={styles.pagination}>
            <Pagination
              page={page}
              totalPages={settled.page.totalPages}
              hrefFor={hrefForPage}
              onNavigate={handlePageNavigate}
              groupSize={MY_CLAIMS_PAGE_GROUP}
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}

interface MyClaimsBodyProps {
  query: UseQueryResult<PagedModel<MyClaimResponse>>
  hrefForPage: (page: number) => To
  onPageNavigate: () => void
}

/** 네 가지 상태 — 로딩 · 오류 · 비어 있음(아직 없음 · 끝을 넘은 쪽) · 목록. 권한은 화면 앞에서 갈랐다 */
function MyClaimsBody({ query, hrefForPage, onPageNavigate }: MyClaimsBodyProps) {
  if (query.isPending || (query.isPlaceholderData && query.data?.content.length === 0)) {
    return <MyClaimsListSkeleton />
  }

  if (query.isError) {
    return (
      <div className={styles.stateBox}>
        <ErrorState
          titleAs="h2"
          message={getErrorMessage(query.error)}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </div>
    )
  }

  const { content, page: pageInfo } = query.data

  if (content.length === 0) {
    // 오래된 링크 · 끝을 넘은 쪽 — 목록 · 내가 쓴 글과 같은 문장 · 행선지
    if (pageInfo.totalElements > 0) {
      const last = Math.max(pageInfo.totalPages, 1)
      const lastText = last.toLocaleString('ko-KR')
      return (
        <div className={styles.stateBox}>
          <EmptyState
            icon={<MagnifyingGlass />}
            title="이 페이지에는 요청이 없어요."
            description={`보낸 요청은 ${lastText}페이지까지 있어요.`}
            action={
              <ButtonLink
                to={hrefForPage(last)}
                onClick={(event) => {
                  if (isPlainClick(event)) onPageNavigate()
                }}
              >
                {`${lastText}페이지로`}
              </ButtonLink>
            }
          />
        </div>
      )
    }
    return (
      <div className={styles.stateBox}>
        <EmptyState
          icon={<PaperPlaneRight />}
          title="아직 보낸 확인 요청이 없어요."
          description="주운 물건 글의 ‘내 물건이에요’, 잃어버린 물건 글의 ‘제가 주웠어요’로 보낸 요청이 여기에 모여요."
          action={<ButtonLink to={paths.postList}>목록 둘러보기</ButtonLink>}
        />
      </div>
    )
  }

  return (
    <ul
      className={styles.list}
      role="list"
      aria-busy={query.isPlaceholderData}
      data-stale={query.isPlaceholderData || undefined}
    >
      {content.map((claim) => (
        <li key={claim.id}>
          <ClaimItem claim={claim} />
        </li>
      ))}
    </ul>
  )
}

/**
 * 요청 한 칸. 위(이름표 · 제목 · 보낸 날)는 통째로 그 글 상세로 가는 링크 하나(늘인 `::after`),
 * 아래는 내 요청 상태와 다음 행동 한 줄, 맨 아래 접은 `내가 보낸 답`(누르는 줄 44px).
 * 강조는 승인된 요청의 상태 하나만(잉크 채움) — 할 일이 있는 칸이다
 */
function ClaimItem({ claim }: { claim: MyClaimResponse }) {
  // 완료 글에 남은 대기 요청 — 거절이 아니라 닫힘이라 안내 아이콘(C2)
  const StatusIcon = isStalledClosed(claim) ? Info : STATUS_ICON[claim.status]
  const tone = claimStatusTone(claim)
  const next = claimNextStep(claim)
  const settledAt = claimSettledAt(claim)

  return (
    <article className={styles.item} data-tone={tone}>
      <div className={styles.top}>
        <div className={styles.meta}>
          <TypeBadge type={claim.postType} />
          <StatusBadge status={claim.postStatus} />
          <span className={styles.sent}>
            <time dateTime={claim.createdAt}>{formatDate(claim.createdAt)}</time> 보냄
          </span>
        </div>
        <h2 className={styles.postTitle}>
          <Link className={styles.link} to={paths.postDetail(claim.postId)}>
            {claim.postTitle}
          </Link>
        </h2>
      </div>

      <div className={styles.state}>
        <p className={styles.claimStatus} data-tone={tone}>
          <span className={styles.statusMark}>
            <StatusIcon className={styles.statusIcon} />
            <span className="sr-only">내 요청 </span>
            {claimStatusLabel(claim)}
          </span>
          {settledAt ? (
            <time className={styles.settled} dateTime={settledAt}>
              {formatDate(settledAt)}
            </time>
          ) : null}
        </p>
        {next ? <p className={styles.next}>{next}</p> : null}
      </div>

      <details className={styles.answer}>
        <summary className={styles.summary}>
          내가 보낸 답
          <CaretDown className={styles.caret} />
        </summary>
        <dl className={styles.qa}>
          {claim.question ? (
            <div>
              <dt>글쓴이의 질문</dt>
              <dd>{claim.question}</dd>
            </div>
          ) : null}
          <div>
            <dt>{claim.question ? '내 답' : '확인할 내용'}</dt>
            <dd>{claim.answer}</dd>
          </div>
        </dl>
      </details>
    </article>
  )
}
