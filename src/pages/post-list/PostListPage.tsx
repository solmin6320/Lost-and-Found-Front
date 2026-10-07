import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { OnboardingTour, usePostListGuide } from '@/app/onboarding'
import { POST_DETAIL_FROM_LIST, paths } from '@/app/paths'
import { useAuth } from '@/features/auth'
import {
  ANY_INTENT_EMPTY,
  BadgeGuide,
  PostCard,
  PostCardSkeleton,
  PostFilterBar,
  PostIntentNext,
  PostIntentPicker,
  PostSearchBar,
  hasActiveFilters,
  intentShowing,
  postListConditionKey,
  postListHeading,
  postListProgress,
  postListQueryOptions,
  postListSearchKey,
  postListShownLimit,
  suggestionParams,
  toPostListParams,
  usePostListSearch,
  withKeyword,
  withoutFilter,
  withoutFilters,
  type PostIntent,
  type PostListResponse,
  type PostListSearch,
  type PostType,
} from '@/features/posts'
import { getErrorMessage } from '@/shared/lib/http'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import type { PagedModel } from '@/shared/types/api'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { ArrowClockwise, MagnifyingGlass, Plus, WarningCircle } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import styles from './PostListPage.module.css'

/** 첫 줄 카드 수(가장 넓은 4열 기준). 이 카드들의 사진은 미루지 않고 바로 받는다 */
const FIRST_ROW = 4
/**
 * 결과 제목 아래 글쓰기 입구를 띄우는 최소 건수. 두 줄(4건) 이하면 목록 끝의 "찾는 물건이 없나요?"가
 * 같은 화면에 보여 같은 입구가 둘이 된다
 */
const WRITE_LINK_MIN = 5

type PostList = PagedModel<PostListResponse>

/** [더 보기]를 누른 순간의 기준 — 이미 본 마지막 카드와 그 화면 위치 */
interface ExpandAnchor {
  condition: string
  id: number
  top: number
  count: number
}

/**
 * SCR-01 게시글 목록 · `/`
 *
 * 맨 위에서 글 종류를 고른다(`잃어버린 물건` = 분실 글, `주운 물건` = 습득 글 — 칸 이름 = 보여 주는 글, 본인 결정 2026-10-07).
 * 그 아래 검색 · 필터 칩 · 사진 피드. 상태를 고르지 않으면 "진행 중"(게시중 + 연락중)만 보여 준다(회의 ⑧).
 * 종류 · 검색 · 필터 · 펼친 수는 전부 URL 에 있다. 이 화면은 주소를 읽어 그리고, 바꿀 때는 주소를 바꾼다.
 * 조건을 바꾸는 동안에는 직전 목록을 흐리게 남겨 둔다(`keepPreviousData`) — 빈 화면으로 깜빡이지 않는다.
 *
 * 목록은 **[더 보기]로 이어진다**(모든 폭, 2026-10-03 회의 ⑥). 누를 때마다 24건 묶음을 하나 더 펼쳐 처음부터 한 번에
 * 다시 받는다(최대 96건). 이미 본 카드는 흐리게 하지 않고 제자리에 둔다 — 그사이 맨 위에 새 글이 끼어도 보던 자리가
 * 움직이지 않게 마지막 카드 위치를 맞춘다. 포커스는 새로 붙은 첫 카드로 간다. 자동으로 이어 붙이지 않는다.
 *
 * 누른 버튼이 사라지는 동작(검색 · 지우기 · 필터 모두 지우기 · 다시 시도)은 전부 결과 제목으로 포커스를 옮긴다.
 * 그냥 두면 포커스가 문서 맨 앞(body)으로 빠져, 키보드 · 스크린리더 사용자가 처음부터 다시 찾아 내려와야 한다.
 */
export function PostListPage() {
  const { search, apply, expand, hrefWith } = usePostListSearch()
  const navigate = useNavigate()
  const query = useQuery({
    ...postListQueryOptions(toPostListParams(search)),
    placeholderData: keepPreviousData,
  })
  const createHref = useCreateHref()
  const intent = intentShowing(search.type)
  // 탭 제목은 결과 제목을 따른다 — "잃어버린 물건 | 분실물 찾기". 칸을 바꾸면 탭 제목도 바뀐다. 검색어는 넣지 않는다
  const heading = postListHeading(search.type, search.keyword)
  useDocumentTitle(heading)

  const titleRef = useRef<HTMLHeadingElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const guide = usePostListGuide()
  const stuck = useStuck(chipsRef)

  const searchKey = postListSearchKey(search)
  const condition = postListConditionKey(search)

  /**
   * 마지막으로 **다 받은** 목록. [더 보기]를 받는 동안 · 실패했을 때 이것을 그대로 그린다 —
   * 받아 둔 카드는 사라지지 않는다. 조건이 바뀌면 새 조건의 목록이 들어올 때 바뀐다
   */
  const [settled, setSettled] = useState<{ condition: string; data: PostList } | null>(null)
  if (query.data && !query.isPlaceholderData && settled?.data !== query.data) {
    setSettled({ condition, data: query.data })
  }
  const sameCondition = settled?.condition === condition
  /** 펼친 수만 늘어 다시 받는 중 — 조건이 바뀐 것과 달리 이미 본 카드를 흐리게 하지 않는다 */
  const expanding = query.isPlaceholderData && sameCondition
  /** 펼치다 실패했다. 받아 둔 카드는 두고 버튼 자리에 서버 문장 + [다시 시도] */
  const expandFailed = query.isError && sameCondition && settled !== null
  const view: PostList | undefined = query.data ?? (expandFailed ? settled?.data : undefined)
  /** 조건이 바뀌어 직전 목록을 흐리게 남겨 둔 동안 */
  const stale = query.isPlaceholderData && !expanding

  /**
   * 조건이 바뀌어 다시 그려진 **뒤에** 결과 제목으로 포커스를 준다.
   * 주소 변경은 transition 으로 늦게 그려지므로 누른 직후가 아니라 조건 지문이 바뀐 뒤에 옮긴다.
   * [다시 시도]는 조건이 그대로라 지문이 안 바뀐다 — 응답이 도착한 때(성공 · 실패)도 본다
   */
  const refocusResults = useRef(false)

  function focusResults() {
    summaryRef.current?.scrollIntoView({ block: 'nearest' })
    headingRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!refocusResults.current) return
    refocusResults.current = false
    focusResults()
  }, [searchKey, query.dataUpdatedAt, query.errorUpdatedAt])

  /** 조건을 바꾸고 결과 제목으로 간다. 같은 조건이면 주소가 그대로라 바로 옮긴다 */
  function applyThenFocusResults(next: PostListSearch) {
    if (postListConditionKey(next) === condition && search.page === 1) {
      focusResults()
      return
    }
    refocusResults.current = true
    apply(next)
  }

  const clearFilters = () => applyThenFocusResults(withoutFilters(search))
  const clearKeyword = () => applyThenFocusResults({ ...search, keyword: '' })

  /* ── [더 보기] ── */

  const anchor = useRef<ExpandAnchor | null>(null)
  const [announcement, setAnnouncement] = useState('')

  function handleExpand() {
    if (expanding || !view) return
    const last = view.content[view.content.length - 1]
    if (!last) return
    const card = gridRef.current?.querySelector(`[data-post-id="${last.id}"]`)
    anchor.current = { condition, id: last.id, top: card?.getBoundingClientRect().top ?? 0, count: view.content.length }
    setAnnouncement('')
    expand()
  }

  // 새 묶음이 그려진 직후(칠하기 전): 보던 카드를 제자리에 두고, 새로 붙은 첫 카드로 포커스를 옮긴다.
  // 브라우저의 스크롤 고정(overflow-anchor)을 지원하지 않는 곳도 있어 직접 맞춘다. 이미 맞았으면 차이가 0이다
  useLayoutEffect(() => {
    const at = anchor.current
    if (!at || !query.data || query.isPlaceholderData) return
    anchor.current = null
    if (at.condition !== condition) return
    const grid = gridRef.current
    const { content, page } = query.data
    const card = grid?.querySelector(`[data-post-id="${at.id}"]`)
    if (card) {
      const shift = card.getBoundingClientRect().top - at.top
      if (Math.abs(shift) >= 1) window.scrollBy({ top: shift, behavior: 'instant' })
    }
    const index = content.findIndex((post) => post.id === at.id)
    const first = content[index >= 0 ? index + 1 : at.count]
    const firstCard = first ? grid?.querySelector<HTMLElement>(`[data-post-id="${first.id}"]`) : null
    if (firstCard) {
      firstCard.querySelector<HTMLElement>('a')?.focus({ preventScroll: true })
      // 엄지 자리에서 눌렀으면 새 첫 카드는 화면 맨 아래에 걸쳐 있다. 그 카드가 다 들어올 만큼만 내린다 —
      // 이미 보이면 움직이지 않고, 보던 줄은 위로 조금 밀릴 뿐 화면에 남는다. 모션 줄이기면 즉시
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      firstCard.scrollIntoView({ block: 'nearest', behavior: reduce ? 'instant' : 'smooth' })
    }
    const added = Math.max(content.length - at.count, 0)
    // 화면의 "N건 중 M건을 봤어요"와 같은 말로 읽는다 — "48 / 58"은 스크린리더가 빗금까지 읽는다
    setAnnouncement(
      `${added.toLocaleString('ko-KR')}건을 더 불러왔어요. ${page.totalElements.toLocaleString('ko-KR')}건 중 ${content.length.toLocaleString('ko-KR')}건을 봤어요.`,
    )
  }, [query.data, query.isPlaceholderData, condition])

  /** 96건을 넘으면 — 필터로 데려간다. 칩 줄이 위에 붙어 있으면 이미 보인다 */
  function goToFilters() {
    const chips = chipsRef.current
    if (!chips) return
    if (!stuck) chips.scrollIntoView({ block: 'nearest' })
    chips.querySelector<HTMLElement>('[data-filter-field]')?.focus({ preventScroll: true })
  }

  const total = view?.page.totalElements
  const empty = view ? emptyKindOf(search, view) : null
  const filtered = hasActiveFilters(search)
  // 확정된 데이터로만 판정한다. 조건을 바꾸는 동안의 앞 목록 숫자로 판정하면 입구가 한 번 떴다 사라진다
  const confirmedTotal = view && (!query.isPlaceholderData || expanding) ? view.page.totalElements : undefined
  const progress = view && !empty ? postListProgress(search, view.content.length, view.page.totalElements) : null
  // 의도를 골랐으면 목록 끝에 "내 글을 올려 두기" 를 둔다. 더 펼칠 수 있으면 아직 끝이 아니다
  const showNext =
    intent !== undefined && view !== undefined && !empty && !expanding && !expandFailed && progress?.kind !== 'more'

  return (
    <div className={styles.page}>
      {/* 읽는 순서 = Tab 순서 : 의도 → 검색 → 필터 → 결과. 가장 먼저 할 일이 가장 위에 있다 */}
      <section className={styles.hero} aria-labelledby="post-list-title">
        {/* 가입 직후 안내를 닫으면 포커스가 여기로 온다(누른 가입 버튼은 이미 사라졌다) */}
        <h1 id="post-list-title" ref={titleRef} tabIndex={-1} className={styles.title}>
          잃어버렸나요, 주웠나요?
        </h1>
        {/* 온보딩 1단계가 가리키는 자리 */}
        <div data-guide="intent">
          <PostIntentPicker
            selected={search.type}
            hrefFor={(type) => hrefWith({ type })}
            showCounts={!search.keyword && !filtered}
            // 같은 의도를 다시 눌렀다. 링크가 첫 묶음으로 이동한다 — 이미 첫 묶음이면 주소가 그대로라 바로 옮긴다
            onReselect={() => {
              if (search.page === 1) focusResults()
              else refocusResults.current = true
            }}
          />
        </div>
      </section>

      {/* 검색은 위에 붙지 않는다(입력칸은 한 벌 — 두 벌이면 치던 글자가 갈린다). 넓은 화면은 칩 줄과 한 줄에 선다 */}
      <div className={styles.search}>
        <PostSearchBar
          key={search.keyword}
          keyword={search.keyword}
          // 새 검색어는 분실 · 습득을 함께 찾는다(골라 둔 칸을 푼다). 한쪽만 보려면 위의 칸을 누른다 — 검색어는 남는다
          onSearch={(keyword) => applyThenFocusResults(withKeyword(search, keyword))}
          // 추천 = 그 말로 Enter 를 눌렀을 때 나올 목록의 앞 5건(상태 기준 · 칩 조건이 같다)
          suggestionParams={(term) => suggestionParams(search, term)}
          onOpenPost={(postId) => navigate(paths.postDetail(postId), { state: POST_DETAIL_FROM_LIST })}
        />
      </div>

      {/*
        칩 줄 — 스크롤해도 헤더 아래에 붙는다(높이 40rem · 폭 22.5rem 이상, CSS). 96장 아래에서도 조건을 바로 바꾼다.
        붙어 있는 동안만 아래에 가는 선과 바탕을 깐다(data-stuck)
      */}
      <div ref={chipsRef} className={styles.chips} data-stuck={stuck || undefined}>
        {/* [전체 해제]는 두지 않는다(본인 피드백 2026-10-07) — 걸린 칩마다 [×], 0건이면 빈 상태의 [필터 모두 지우기] */}
        <PostFilterBar search={search} onApply={apply} onRemove={(field) => apply(withoutFilter(search, field))} />
      </div>

      {/* 온보딩 2단계가 가리키는 자리 — 검색창 + 칩 줄을 함께 감싸는 틀(칩 줄이 붙기 위해 둘은 형제다) */}
      <div className={styles.guideFrame} data-guide="finder" aria-hidden="true" />

      <section className={styles.results} aria-labelledby="post-list-heading">
        <div ref={summaryRef} className={styles.summary}>
          <h2 id="post-list-heading" ref={headingRef} tabIndex={-1} className={styles.heading}>
            {heading}
          </h2>
          <p className={styles.count} aria-live="polite" aria-atomic="true" data-stale={stale || undefined}>
            {total === undefined ? (
              query.isPending ? (
                <>
                  <span className="sr-only">게시글을 불러오는 중이에요</span>
                  <Skeleton shape="text" width="2.75rem" />
                </>
              ) : null
            ) : (
              <>
                <span className="sr-only">게시글 </span>
                <strong data-numeric>{total.toLocaleString('ko-KR')}</strong>건
              </>
            )}
          </p>
          {/* 카드의 이름표가 무엇인지 — 건수 바로 뒤. 누르면 펼친다(온보딩 2층). 알림 영역(건수) 밖 형제로 둔다 */}
          <BadgeGuide className={styles.badgeGuide} />
        </div>

        {/* 의도를 고른 순간의 글쓰기 입구. 떠 있는 버튼 대신 흐름 안 한 줄 — 결심하는 순간 바로 아래에 있다 */}
        {intent && confirmedTotal !== undefined && confirmedTotal >= WRITE_LINK_MIN ? (
          <p className={styles.write}>
            {intent.write.lead}{' '}
            <Link className={styles.writeLink} to={createHref(intent.concept)}>
              <Plus />
              {intent.next.action}
            </Link>
          </p>
        ) : null}

        <PostListBody
          query={{ isPending: query.isPending, isFetching: query.isFetching, error: query.error }}
          view={view}
          pages={search.page}
          search={search}
          intent={intent}
          stale={stale}
          gridRef={gridRef}
          createHref={createHref}
          onRetry={() => {
            refocusResults.current = true
            void query.refetch()
          }}
          onClearFilters={clearFilters}
          onClearKeyword={clearKeyword}
        />

        {view && progress && !empty ? (
          <PostListMore
            progress={progress}
            loaded={view.content.length}
            total={view.page.totalElements}
            expanding={expanding}
            failed={expandFailed ? getErrorMessage(query.error) : null}
            retrying={query.isFetching}
            onExpand={handleExpand}
            onRetry={() => void query.refetch()}
            onGoToFilters={goToFilters}
          />
        ) : null}

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        {showNext ? (
          <div className={styles.next}>
            <PostIntentNext intent={intent} to={createHref(intent.concept)} />
          </div>
        ) : null}
      </section>

      <OnboardingTour open={guide.open} onClose={guide.close} fallbackFocus={() => titleRef.current} />
    </div>
  )
}

/** 글 올리기 주소. 비로그인이면 로그인을 거쳐 돌아온다. 유형을 주면 등록 화면이 미리 고른다 */
function useCreateHref() {
  const auth = useAuth()
  return (type?: PostType) => {
    const target = type ? paths.postCreateAs(type) : paths.postCreate
    return auth.status === 'anonymous' ? paths.loginThenReturn(target) : target
  }
}

/**
 * 칩 줄이 헤더 아래에 붙어 있나. 붙어 있는 동안만 바탕 · 아래 선을 깐다(붙기 전에는 종이와 같은 색이라 필요 없다).
 * 스크롤 이벤트 대신 IntersectionObserver 하나 — 헤더 바로 아래 선을 넘을 때만 알려 준다
 */
function useStuck(ref: RefObject<HTMLElement | null>) {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const headerBottom = Math.ceil(document.querySelector('header')?.getBoundingClientRect().height ?? 0)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        const sticky = getComputedStyle(el).position === 'sticky'
        setStuck(sticky && entry.intersectionRatio < 1 && entry.boundingClientRect.top <= headerBottom)
      },
      { rootMargin: `-${headerBottom + 1}px 0px 0px 0px`, threshold: [1] },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return stuck
}

/**
 * 비어 있는 까닭.
 *   filtered  : 검색어나 필터가 걸려 있다
 *   none-yet  : 조건 없이도 글이 없다(의도만 골랐으면 그 유형의 글이 없다)
 * 언제나 처음부터 받으므로 "끝을 넘은 쪽"은 없다
 */
type EmptyKind = 'filtered' | 'none-yet'

function emptyKindOf(search: PostListSearch, data: PostList): EmptyKind | null {
  if (data.content.length > 0) return null
  if (hasActiveFilters(search) || search.keyword) return 'filtered'
  return 'none-yet'
}

interface PostListBodyProps {
  query: { isPending: boolean; isFetching: boolean; error: unknown }
  view: PostList | undefined
  /** 펼친 묶음 수. 불러오는 동안 이만큼 자리를 잡는다 */
  pages: number
  search: PostListSearch
  intent: PostIntent | undefined
  stale: boolean
  gridRef: RefObject<HTMLUListElement | null>
  createHref: (type?: PostType) => string
  onRetry: () => void
  onClearFilters: () => void
  onClearKeyword: () => void
}

/** 네 가지 상태 — 로딩 · 오류 · 비어 있음 · 목록. 권한은 해당 없다(전체 공개, 소유자 동작 없음) */
function PostListBody({
  query,
  view,
  pages,
  search,
  intent,
  stale,
  gridRef,
  createHref,
  onRetry,
  onClearFilters,
  onClearKeyword,
}: PostListBodyProps) {
  if (!view && query.isPending) {
    // 펼친 수만큼 자리를 잡는다. 새로고침 · 오래된 뒤로가기에서도 문서 높이가 응답 전에 거의 맞아,
    // 스크롤 기억이 보던 자리로 데려가고 카드가 같은 자리에서 스켈레톤을 대신한다
    return (
      <ul className={styles.grid} role="list" aria-busy="true">
        {Array.from({ length: postListShownLimit({ page: pages }) }, (_, i) => (
          <li key={i}>
            <PostCardSkeleton />
          </li>
        ))}
      </ul>
    )
  }

  if (!view) {
    return (
      <div className={styles.stateBox}>
        <ErrorState titleAs="h3" message={getErrorMessage(query.error)} onRetry={onRetry} retrying={query.isFetching} />
      </div>
    )
  }

  const empty = emptyKindOf(search, view)

  if (empty === 'filtered') {
    // 검색어는 제목에 넣지 않는다 — 주소로 남의 화면에 문장을 심는 통로가 된다. 검색칸에 이미 보인다
    return (
      <div className={styles.empty}>
        <EmptyState
          titleAs="h3"
          icon={<MagnifyingGlass />}
          title="조건에 맞는 글이 없어요."
          description="검색어나 필터를 바꿔 보세요."
          action={
            hasActiveFilters(search) ? (
              // 칩 줄에는 한 번에 지우는 버튼이 없다. 막다른 0건에서만 한 번에 되돌리는 길(검색어 · 종류는 남긴다)
              <Button onClick={onClearFilters}>필터 모두 지우기</Button>
            ) : (
              <Button onClick={onClearKeyword}>검색어 지우기</Button>
            )
          }
        />
        <PostIntentNext intent={intent} to={createHref(intent?.concept)} />
      </div>
    )
  }

  if (empty === 'none-yet') {
    // 회색 판 대신 등록 권유 면 하나. 버튼 색은 올릴 글을 따른다(의도를 안 골랐으면 잉크)
    return (
      <PostIntentNext
        intent={intent}
        to={createHref(intent?.concept)}
        title={intent?.empty.title ?? ANY_INTENT_EMPTY.title}
        description={intent?.empty.description ?? ANY_INTENT_EMPTY.description}
      />
    )
  }

  return (
    <ul ref={gridRef} className={styles.grid} role="list" aria-busy={stale} data-stale={stale || undefined}>
      {view.content.map((post, index) => (
        <li key={post.id} data-post-id={post.id}>
          <PostCard
            post={post}
            to={paths.postDetail(post.id)}
            thumbnailUrl={post.thumbnailUrl}
            priority={index < FIRST_ROW}
            linkState={POST_DETAIL_FROM_LIST}
          />
        </li>
      ))}
    </ul>
  )
}

interface PostListMoreProps {
  progress: ReturnType<typeof postListProgress>
  loaded: number
  total: number
  expanding: boolean
  /** 펼치다 실패한 서버 문장 */
  failed: string | null
  retrying: boolean
  onExpand: () => void
  onRetry: () => void
  onGoToFilters: () => void
}

/**
 * 목록 끝 — [24건 더 보기] · 상한(96건) 안내 · 실패. 다 보여 줬으면 아무것도 두지 않는다(바로 아래 "찾는 물건이 없나요?").
 * 버튼은 마지막 카드 줄 바로 아래, 좁은 화면은 폭 전체(엄지가 닿는 넓은 면).
 */
function PostListMore({
  progress,
  loaded,
  total,
  expanding,
  failed,
  retrying,
  onExpand,
  onRetry,
  onGoToFilters,
}: PostListMoreProps) {
  const seen = (
    <>
      <span data-numeric>{total.toLocaleString('ko-KR')}</span>건 중{' '}
      <span data-numeric>{loaded.toLocaleString('ko-KR')}</span>건을 봤어요
    </>
  )

  if (failed) {
    return (
      <div className={styles.more}>
        <p className={styles.moreError} role="alert">
          <WarningCircle />
          {failed}
        </p>
        <Button
          className={styles.moreButton}
          aria-disabled={retrying || undefined}
          onClick={() => {
            if (!retrying) onRetry()
          }}
        >
          <ArrowClockwise />
          다시 시도
        </Button>
      </div>
    )
  }

  if (expanding || progress.kind === 'more') {
    const next = progress.kind === 'more' ? progress.next : 0
    return (
      <div className={styles.more}>
        <Button
          className={styles.moreButton}
          aria-disabled={expanding || undefined}
          aria-describedby="post-list-seen"
          onClick={onExpand}
        >
          {expanding ? '불러오는 중…' : `${next.toLocaleString('ko-KR')}건 더 보기`}
        </Button>
        <p id="post-list-seen" className={styles.seen}>
          {seen}
        </p>
      </div>
    )
  }

  if (progress.kind === 'capped') {
    return (
      <div className={styles.cap}>
        <p className={styles.capText}>
          {seen}. 더 보려면 조건을 좁혀 보세요.
        </p>
        <button type="button" className={styles.capAction} onClick={onGoToFilters}>
          필터로 좁히기
        </button>
      </div>
    )
  }

  return null
}
