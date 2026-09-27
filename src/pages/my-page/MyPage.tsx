import { keepPreviousData, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, type To } from 'react-router-dom'

import { loginPath } from '@/app/authRedirect'
import { paths, postDetailFromMine, type LoginNoticeState } from '@/app/paths'
import { useAuth } from '@/features/auth'
import {
  ConceptButtonLink,
  POST_STATUSES,
  POST_STATUS_LABEL,
  PostCard,
  PostCardSkeleton,
  PostStatusTabs,
  myPostsQueryOptions,
  toMyPostsParams,
  useMyPostsSearch,
  type MyPostsSearch,
  type PostListResponse,
  type PostStatus,
  type PostStatusCounts,
} from '@/features/posts'
import { getErrorMessage, subscribeSessionExpired } from '@/shared/lib/http'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import type { PagedModel } from '@/shared/types/api'
import { ButtonLink } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { Archive, MagnifyingGlass } from '@/shared/ui/icons'
import { Pagination } from '@/shared/ui/Pagination'

import styles from './MyPage.module.css'

/** 로딩 스켈레톤 개수 — 2 · 4열에서 줄이 채워진다. 내 글은 목록보다 적다 */
const SKELETON_COUNT = 8
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
    description: '주인으로 보이는 사람과 이야기를 시작하면 글을 열어 연락중으로 바꿔 두세요.',
  },
  DONE: {
    title: '완료된 글이 없어요.',
    description: '물건이 주인에게 돌아가면 글을 열어 완료로 바꿔 두세요.',
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

  // 재발급이 거절돼 끝났는지(만료), 사용자가 로그아웃했는지 — 로그인 화면의 문장이 다르다
  const [expired, setExpired] = useState(false)
  useEffect(() => subscribeSessionExpired(() => setExpired(true)), [])

  if (auth.status === 'anonymous') {
    const state: LoginNoticeState | undefined = seen
      ? { notice: expired ? '로그인이 만료됐어요. 다시 로그인하세요.' : '로그아웃했어요.' }
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

  const tabsRef = useRef<HTMLDivElement>(null)
  const noPostsYet = counts.ALL === 0

  // 쪽을 넘기면 탭 줄부터 다시 읽는다. 포커스는 지금 탭에 — 거기서 Tab 한 번이면 첫 카드다
  function handlePageNavigate() {
    requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({ block: 'start' })
      tabsRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus({ preventScroll: true })
    })
  }

  const tabLabel = search.status ? POST_STATUS_LABEL[search.status] : '전체'
  const settled = query.data && !query.isPlaceholderData ? query.data : null

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>내가 쓴 글</h1>
        {/* 관리하는 곳을 알린다 — 카드에는 동작을 두지 않고 상세의 `내 글 관리` 한 곳에 모았다 */}
        {noPostsYet ? null : (
          <p className={styles.hint}>글을 열면 ‘내 글 관리’에서 상태를 바꾸거나 고칠 수 있어요.</p>
        )}
      </header>

      <section aria-label={`${tabLabel} 글`}>
        {/* 올린 글이 하나도 없으면 탭을 두지 않는다 — "0 0 0 0" 은 읽을 거리가 아니라 소음이다. 빈 상태가 첫 글을 권한다 */}
        {noPostsYet ? null : (
          <div ref={tabsRef} className={styles.tabs}>
            <PostStatusTabs selected={search.status} counts={counts} hrefFor={hrefForStatus} />
          </div>
        )}

        {/* 탭을 바꿀 때 결과를 알린다. 탭 링크에 포커스가 남아 있어 스크린리더는 목록을 따로 듣지 못한다 */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {settled ? `${tabLabel} 글 ${settled.page.totalElements.toLocaleString('ko-KR')}건` : ''}
        </p>

        <div className={styles.body}>
          <MyPostsBody
            query={query}
            search={search}
            noPostsYet={noPostsYet}
            allHref={hrefForStatus(undefined)}
            firstPageHref={hrefForPage(1)}
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
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}

/**
 * 탭별 수. 아직 모르면 `undefined`(자리만), 못 불러왔으면 `null`(숫자 없이).
 * 전체는 세 상태의 합이다 — 따로 한 번 더 묻지 않는다. 셋 중 하나라도 비면 지금 보는 전체 탭의 수로 대신한다
 */
function countsOf(
  countQueries: UseQueryResult<PagedModel<PostListResponse>>[],
  search: MyPostsSearch,
  query: UseQueryResult<PagedModel<PostListResponse>>,
): PostStatusCounts {
  const byStatus = countQueries.map((q) => (q.data ? q.data.page.totalElements : q.isError ? null : undefined))
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
  /** 올린 글이 하나도 없다(세 상태의 합이 0) */
  noPostsYet: boolean
  allHref: To
  firstPageHref: To
  linkState: unknown
}

/** 네 가지 상태 — 로딩 · 오류 · 비어 있음(전체 0건 · 이 탭 0건 · 끝을 넘은 쪽) · 목록. 권한은 화면 앞에서 갈랐다 */
function MyPostsBody({ query, search, noPostsYet, allHref, firstPageHref, linkState }: MyPostsBodyProps) {
  // 직전 탭이 비어 있었으면 그 빈 상태를 흐리게 남기지 않는다 — 문장이 새 탭과 어긋난다
  if (query.isPending || (query.isPlaceholderData && query.data?.content.length === 0)) {
    return (
      <ul className={styles.grid} role="list" aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <li key={i}>
            <PostCardSkeleton />
          </li>
        ))}
      </ul>
    )
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
    return <div className={styles.stateBox}>{emptyOf(search, page.totalElements, noPostsYet, allHref, firstPageHref)}</div>
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
  totalElements: number,
  noPostsYet: boolean,
  allHref: To,
  firstPageHref: To,
) {
  // 오래된 링크 · 그사이 글을 지워 쪽이 줄었다
  if (totalElements > 0) {
    return (
      <EmptyState
        icon={<MagnifyingGlass />}
        title={`${search.page}페이지에는 글이 없어요.`}
        description={`이 탭의 글 ${totalElements.toLocaleString('ko-KR')}건은 앞 페이지에 있어요.`}
        action={<ButtonLink to={firstPageHref}>첫 페이지로</ButtonLink>}
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
