import { keepPreviousData, useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, type To } from 'react-router-dom'

import { loginPath } from '@/app/authRedirect'
import { PAGE_TURN_FOCUS_ATTR } from '@/app/RouteFocus'
import { paths, postDetailFromMine, type LoginNoticeState } from '@/app/paths'
import { subscribeSignedOutElsewhere, useAuth } from '@/features/auth'
import {
  cachedMyPostCounts,
  ConceptButtonLink,
  MY_POSTS_PAGE_GROUP,
  MY_POSTS_PAGE_SIZE,
  myPostsSkeletonCount,
  POST_STATUSES,
  POST_STATUS_LABEL,
  PostCard,
  PostStatusTabs,
  myPostsQueryOptions,
  toMyPostsParams,
  useMyPostsSearch,
  type MyPostsSearch,
  type PostListResponse,
  type PostStatus,
  type PostStatusCounts,
} from '@/features/posts'
import { isPlainClick } from '@/shared/lib/events'
import { getErrorMessage, subscribeSessionExpired } from '@/shared/lib/http'
import { pageAnnouncement } from '@/shared/lib/pageAnnouncement'
import { useDropPageWhenEmpty } from '@/shared/lib/pageParam'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import type { PagedModel } from '@/shared/types/api'
import { ButtonLink } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { Archive, MagnifyingGlass } from '@/shared/ui/icons'
import { LoadingDots } from '@/shared/ui/LoadingDots'
import { Pagination } from '@/shared/ui/Pagination'

import styles from './MyPage.module.css'
import { MyPostsGridSkeleton } from './MyPageSkeleton'

/** 페이지를 넘긴 뒤 포커스 자리 표시(RouteFocus 가 뒤로 · 앞으로의 대체 자리로 찾는다) */
const PAGE_TURN_FOCUS = { [PAGE_TURN_FOCUS_ATTR]: true } as const

/** 첫 줄 카드 수(가장 넓은 4열). 이 카드들의 사진은 미루지 않는다 */
const FIRST_ROW = 4

/** 탭에 글이 없을 때 — 그 상태가 무엇인지, 글을 그 상태로 두려면 어디서 바꾸는지 */
const TAB_EMPTY: Record<PostStatus, { title: string; description: string }> = {
  OPEN: {
    title: '게시중인 글이 없어요.',
    description: '올린 글이 모두 연락중이거나 완료예요.',
  },
  IN_PROGRESS: {
    title: '연락중인 글이 없어요.',
    description: '댓글로 연락이 닿으면 글을 열어 연락중으로 바꿔 주세요.',
  },
  DONE: {
    title: '완료된 글이 없어요.',
    description: '물건이 주인에게 돌아가면 글을 열어 완료로 바꿔 주세요.',
  },
}

/**
 * SCR-07 내가 쓴 글 · `/me` — [6.1] `GET /api/members/me/posts`
 *
 * 로그인이 필요하다. 처음부터 비로그인이면 로그인을 거쳐 이 탭으로 돌아온다(`?redirect=`).
 * 보는 도중 로그인이 끊기면(세션 만료 · 로그아웃) 로그인 화면으로 가며 까닭을 한 줄 싣는다.
 * 세션을 되살리는 동안(앱 시작 직후)은 같은 모양의 스켈레톤이다 — 요청은 로그인이 확인된 뒤에 나간다.
 */
export function MyPage() {
  const auth = useAuth()
  const location = useLocation()
  const here = `${location.pathname}${location.search}`
  useDocumentTitle('내가 쓴 글')

  // 한 번이라도 로그인한 채로 이 화면을 봤나 — 그 뒤의 비로그인은 "끊김"이다
  const [seen, setSeen] = useState(false)
  if (auth.status === 'authenticated' && !seen) setSeen(true)

  // 재발급이 거절돼 끝났는지(만료), 사용자가 로그아웃했는지(이 창 · 다른 창) — 로그인 화면의 문장이 다르다
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

  return <MyPosts enabled={auth.status === 'authenticated'} />
}

function MyPosts({ enabled }: { enabled: boolean }) {
  const { search, hrefForPage, hrefForStatus } = useMyPostsSearch()
  const location = useLocation()
  const query = useQuery({
    ...myPostsQueryOptions(toMyPostsParams(search)),
    enabled,
    placeholderData: keepPreviousData,
  })
  // 탭의 숫자 — 상태마다 한 건만 달라고 해서 전체 수(`totalElements`)만 읽는다
  const countQueries = useQueries({
    queries: POST_STATUSES.map((status) => ({ ...myPostsQueryOptions({ status, size: 1 }), enabled })),
  })
  const counts = countsOf(countQueries, search, query)
  /*
   * 이번 방문에 받은 건수(쿼리 캐시). 탭의 자리 폭은 **화면을 연 순간의 값으로 고정**한다(QA-P-31) — 매번 다시 읽으면 카드 응답이
   * 먼저 와 `전체`의 자릿수가 바뀐 순간 탭이 한 번, 숫자가 들어올 때 또 한 번 움직였다. 고정하면 탭 x가 바뀌는 것은 숫자를 그리는 한 프레임뿐이다.
   * 카드 자리표시 수는 탭을 바꿀 때마다 그때 아는 건수로 센다(완료 0건 → 연락중 3건이면 3장)
   */
  const queryClient = useQueryClient()
  const [knownCounts] = useState(() => cachedMyPostCounts(queryClient))
  const liveCounts = cachedMyPostCounts(queryClient)

  const tabsRef = useRef<HTMLDivElement>(null)
  const noPostsYet = counts.ALL === 0

  /*
   * 쪽을 넘기면 탭 줄부터 다시 읽는다. 포커스는 **지금 탭**(`aria-current="true"`)에 — 보이는 자리라 키보드 사용자에게 링이 서고,
   * 스크린리더는 `전체 230건, 현재` 다음에 결과 알림(`3페이지예요. 230건 중 41~60번째 글이에요.`)을 듣는다(QA-P-29).
   * 거기서 Tab 은 뒤 탭들을 지나 첫 카드다(전체 4 · 게시중 3 · 연락중 2 · 완료 1번). 10차엔 화면에 없는 결과 제목(1px)에 두어
   * 키보드 사용자가 포커스를 볼 수 없었고 첫 카드까지 Tab 이 한 번 더 들었다(QA-P-23 → P-29)
   *
   * 주소가 그려진 **뒤에** 옮긴다(목록과 같다, QA-P-25 · D-21). 누른 직후(다음 프레임)에 옮기면 주소가 아직 그려지기 전이라
   * 그 스크롤이 떠나는 페이지의 기록으로 남아(ScrollMemory) 뒤로가기가 누르던 번호 줄이 아니라 맨 위(탭 줄)로 돌아왔다
   */
  const turnedPage = useRef(false)
  function handlePageNavigate() {
    turnedPage.current = true
  }
  useEffect(() => {
    if (!turnedPage.current) return
    turnedPage.current = false
    const tabs = tabsRef.current
    if (!tabs) return
    tabs.scrollIntoView({ block: 'start' })
    tabs.querySelector<HTMLElement>('a[aria-current="true"]')?.focus({ preventScroll: true })
  }, [search.status, search.page])

  const tabLabel = search.status ? POST_STATUS_LABEL[search.status] : '전체'
  const settled = query.data && !query.isPlaceholderData ? query.data : null
  // 이 탭이 0건이면 ?page=4 를 지운다 — 갈 페이지가 없다(QA-P-28, 목록과 같다)
  useDropPageWhenEmpty(settled?.page.totalElements)

  /*
   * 결과 알림. 같은 탭에서 쪽을 넘긴 결과는 목록과 같은 문장(`3페이지예요. 230건 중 41~60번째 글이에요.`, QA-P-23),
   * 탭을 바꾼 결과 · 처음 받은 결과는 건수(`연락중 글 3건`). 마지막으로 다 받은 탭 · 쪽과 견준다
   */
  const [shown, setShown] = useState<{ status: PostStatus | undefined; page: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  if (settled && (shown === null || shown.status !== search.status || shown.page !== search.page)) {
    const turned = shown !== null && shown.status === search.status && settled.content.length > 0
    setShown({ status: search.status, page: search.page })
    setAnnouncement(
      turned
        ? pageAnnouncement(search.page, MY_POSTS_PAGE_SIZE, settled.content.length, settled.page.totalElements)
        : `${tabLabel} 글 ${settled.page.totalElements.toLocaleString('ko-KR')}건`,
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>내가 쓴 글</h1>
        {/* 관리하는 곳을 알린다 — 카드에는 동작을 두지 않고 상세의 `내 글 관리` 한 곳에 모았다 */}
        {noPostsYet ? null : (
          <p className={styles.hint}>글을 열면 ‘내 글 관리’에서 상태를 바꾸거나 고칠 수 있어요.</p>
        )}
      </header>

      <section aria-labelledby="my-posts-heading">
        {/* 결과 제목 — 이 구역의 이름(화면에는 탭이 이름이라 읽는 사람에게만). 포커스 자리는 아니다(지금 탭이 받는다, QA-P-29) */}
        <h2 id="my-posts-heading" className="sr-only">
          {`${tabLabel} 글`}
        </h2>
        {/* 올린 글이 하나도 없으면 탭을 두지 않는다 — "0 0 0 0" 은 읽을 거리가 아니라 소음이다. 빈 상태가 첫 글을 권한다 */}
        {noPostsYet ? null : (
          <div ref={tabsRef} className={styles.tabs}>
            <PostStatusTabs
              selected={search.status}
              counts={counts}
              knownCounts={knownCounts}
              hrefFor={hrefForStatus}
              // 쪽을 넘긴 뒤 · 뒤로 · 앞으로에서 고른 자리가 화면 밖일 때(RouteFocus)의 포커스 자리 — 지금 탭(QA-P-29)
              currentData={PAGE_TURN_FOCUS}
              // 탭 · 쪽을 바꿔 다시 받는 중 — 직전 글은 흐리게 두고 **탭 줄 바로 아래(탭 줄과 카드 사이 여백)에 점 셋**(0.3초 넘을 때만, QA-P-9).
              // 여백 안에 겹쳐 서서 탭 · 카드가 밀리지 않고 카드 이름표도 덮지 않는다. 예전엔 탭 뒤 흐름 안에 서서 자리가 모자라면(320) 줄을 바꿔
              // 카드가 22px 내려갔다 돌아왔다. 탭 뒤 한 줄에 두면 글자를 키운 폭(125 ~ 200%)에서 탭이 줄을 바꿔 자리가 없다
              trailing={
                <LoadingDots
                  active={query.isPlaceholderData && (query.data?.content.length ?? 0) > 0}
                  label="글을 불러오는 중"
                 
                  reserve
                  className={styles.tabsDots}
                />
              }
            />
          </div>
        )}

        {/* 탭 · 쪽을 바꿀 때 결과를 알린다. 탭 링크 · 결과 제목에 포커스가 있어 스크린리더는 목록을 따로 듣지 못한다 */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        <div className={styles.body}>
          <MyPostsBody
            query={query}
            search={search}
            skeletonCount={myPostsSkeletonCount(liveCounts[search.status ?? 'ALL'], search.page)}
            noPostsYet={noPostsYet}
            allHref={hrefForStatus(undefined)}
            hrefForPage={hrefForPage}
            onPageNavigate={handlePageNavigate}
            linkState={postDetailFromMine(location.search)}
          />
        </div>

        {settled && settled.content.length > 0 ? (
          <div className={styles.pagination}>
            <Pagination
              page={search.page}
              totalPages={settled.page.totalPages}
              hrefFor={hrefForPage}
              onNavigate={handlePageNavigate}
              groupSize={MY_POSTS_PAGE_GROUP}
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}

/**
 * 탭별 수. 아직 모르면 `undefined`(자리만), 못 불러왔으면 `null`(숫자 없이).
 * 전체는 세 상태의 합이다 — 따로 한 번 더 묻지 않는다. 셋 중 하나라도 비면 지금 보는 전체 탭의 수로 대신한다.
 * **셋이 다 끝날 때까지(받음 · 실패) 넷 다 기다린다** — 응답이 0.1초 간격으로 나뉘어 오면 탭 줄이 두세 번 나뉘어 움직였다(QA-D-25)
 */
function countsOf(
  countQueries: UseQueryResult<PagedModel<PostListResponse>>[],
  search: MyPostsSearch,
  query: UseQueryResult<PagedModel<PostListResponse>>,
): PostStatusCounts {
  if (countQueries.some((q) => !q.data && !q.isError)) {
    return { ALL: undefined, OPEN: undefined, IN_PROGRESS: undefined, DONE: undefined }
  }
  const byStatus = countQueries.map((q) => (q.data ? q.data.page.totalElements : null))
  const [open, progress, done] = byStatus

  let all: number | null | undefined
  if (byStatus.every((n) => typeof n === 'number')) {
    all = (open ?? 0) + (progress ?? 0) + (done ?? 0)
  } else if (!search.status && query.data && !query.isPlaceholderData) {
    all = query.data.page.totalElements
  } else {
    all = byStatus.includes(null) ? null : undefined
  }
  return { ALL: all, OPEN: open, IN_PROGRESS: progress, DONE: done }
}

interface MyPostsBodyProps {
  query: UseQueryResult<PagedModel<PostListResponse>>
  search: MyPostsSearch
  /** 받는 동안의 카드 자리표시 수(이번 방문에 받은 건수가 있으면 그 쪽에 남은 만큼, 없으면 20) */
  skeletonCount: number
  /** 올린 글이 하나도 없다(세 상태의 합이 0) */
  noPostsYet: boolean
  allHref: To
  /** 끝을 넘은 쪽에서 돌아갈 마지막 쪽 주소 */
  hrefForPage: (page: number) => To
  /** [n페이지로]를 눌렀다 — 쪽 번호를 누른 것과 같이 탭 줄로 데려간다 */
  onPageNavigate: () => void
  linkState: unknown
}

/** 네 가지 상태 — 로딩 · 오류 · 비어 있음(전체 0건 · 이 탭 0건 · 끝을 넘은 쪽) · 목록. 권한은 화면 앞에서 갈랐다 */
function MyPostsBody({ query, search, skeletonCount, noPostsYet, allHref, hrefForPage, onPageNavigate, linkState }: MyPostsBodyProps) {
  // 세 상태의 건수가 먼저 와 모두 0이면 카드 응답을 기다리지 않고 바로 첫 글 권유 — 어느 탭 · 쪽이든 글이 없다(QA-P-35).
  // 스켈레톤 20장이 섰다가 빈 상태로 줄어 문서가 한 번 크게 줄던 것
  if (noPostsYet && (query.isPending || query.isPlaceholderData)) {
    return (
      <div className={styles.stateBox}>
        {emptyOf(search, { totalElements: 0, totalPages: 0 }, true, allHref, hrefForPage, onPageNavigate)}
      </div>
    )
  }

  // 직전 탭이 비어 있었으면 그 빈 상태를 흐리게 남기지 않는다 — 문장이 새 탭과 어긋난다
  if (query.isPending || (query.isPlaceholderData && query.data?.content.length === 0)) {
    return <MyPostsGridSkeleton count={skeletonCount} />
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

  const { content, page } = query.data

  if (content.length === 0) {
    return (
      <div className={styles.stateBox}>
        {emptyOf(search, page, noPostsYet, allHref, hrefForPage, onPageNavigate)}
      </div>
    )
  }

  return (
    <ul
      className={styles.grid}
      role="list"
      aria-busy={query.isPlaceholderData}
      data-stale={query.isPlaceholderData || undefined}
    >
      {content.map((post, index) => (
        <li key={post.id}>
          <PostCard
            post={post}
            to={paths.postDetail(post.id)}
            thumbnailUrl={post.thumbnailUrl}
            headingLevel="h2"
            priority={index < FIRST_ROW}
            linkState={linkState}
          />
        </li>
      ))}
    </ul>
  )
}

/** 왜 비었는지 + 다음에 할 일. 막다른 길을 만들지 않는다 */
function emptyOf(
  search: MyPostsSearch,
  page: { totalElements: number; totalPages: number },
  noPostsYet: boolean,
  allHref: To,
  hrefForPage: (page: number) => To,
  onPageNavigate: () => void,
) {
  // 오래된 링크 · 그사이 글을 지워 쪽이 줄었다 — 목록과 같은 문장 · 같은 행선지(마지막 쪽, 본인 결정 2026-10-17)
  if (page.totalElements > 0) {
    const last = Math.max(page.totalPages, 1)
    const lastText = last.toLocaleString('ko-KR')
    return (
      <EmptyState
        icon={<MagnifyingGlass />}
        title="이 페이지에는 글이 없어요."
        description={`글은 ${lastText}페이지까지 있어요.`}
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
    )
  }

  // 올린 글이 아예 없다 — 어느 탭이든 첫 글을 올리게 한다. 버튼 색은 올릴 글의 개념을 따른다
  if (noPostsYet || !search.status) {
    return (
      <EmptyState
        icon={<Archive />}
        title="아직 올린 글이 없어요."
        description="잃어버렸거나 주운 물건을 올리면 여기에 모여요."
        action={
          <div className={styles.actions}>
            <ConceptButtonLink concept="LOST" to={paths.postCreateAs('LOST')}>
              분실 글 올리기
            </ConceptButtonLink>
            <ConceptButtonLink concept="FOUND" to={paths.postCreateAs('FOUND')}>
              습득 글 올리기
            </ConceptButtonLink>
          </div>
        }
      />
    )
  }

  const copy = TAB_EMPTY[search.status]
  return (
    <EmptyState
      icon={<Archive />}
      title={copy.title}
      description={copy.description}
      action={<ButtonLink to={allHref}>전체 보기</ButtonLink>}
    />
  )
}
