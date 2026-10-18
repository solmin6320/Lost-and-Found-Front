import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link, useNavigate, type To } from 'react-router-dom'

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
  POST_LIST_PAGE_GROUP,
  POST_LIST_PAGE_SIZE,
  PostSearchBar,
  anyIntentNextTitle,
  hasActiveFilters,
  intentShowing,
  postListConditionKey,
  postListHeading,
  postListQueryOptions,
  postListSearchKey,
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
import { isPlainClick } from '@/shared/lib/events'
import { getErrorMessage } from '@/shared/lib/http'
import { pageAnnouncement } from '@/shared/lib/pageAnnouncement'
import { useDropPageWhenEmpty } from '@/shared/lib/pageParam'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import type { PagedModel } from '@/shared/types/api'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { MagnifyingGlass, Plus } from '@/shared/ui/icons'
import { LoadingDots } from '@/shared/ui/LoadingDots'
import { Pagination } from '@/shared/ui/Pagination'

import styles from './PostListPage.module.css'

/** 첫 줄 카드 수(가장 넓은 4열 기준). 이 카드들의 사진은 미루지 않고 바로 받는다 */
const FIRST_ROW = 4
/**
 * 결과 제목 아래 글쓰기 입구를 띄우는 최소 건수. 두 줄(4건) 이하면 목록 끝의 "찾는 물건이 없나요?"가
 * 같은 화면에 보여 같은 입구가 둘이 된다
 */
const WRITE_LINK_MIN = 5

type PostList = PagedModel<PostListResponse>

/**
 * SCR-01 게시글 목록 · `/`
 *
 * 맨 위에서 글 종류를 고른다(`잃어버린 물건` = 분실 글, `주운 물건` = 습득 글 — 칸 이름 = 보여 주는 글, 본인 결정 2026-10-07).
 * 그 아래 검색 · 필터 칩 · 사진 피드. 상태를 고르지 않으면 "진행 중"(게시중 + 연락중)만 보여 준다(회의 ⑧).
 * 종류 · 검색 · 필터 · 페이지 번호는 전부 URL 에 있다. 이 화면은 주소를 읽어 그리고, 바꿀 때는 주소를 바꾼다.
 * 조건 · 페이지를 바꾸는 동안에는 직전 목록을 흐리게 남겨 둔다(`keepPreviousData`) — 빈 화면으로 깜빡이지 않는다.
 *
 * 목록은 **페이지 번호로 넘긴다**(본인 결정 2026-10-16 — 예전 [더 보기] · 96건 상한을 바꿨다). 한 페이지 20건, 글이 21 · 41 · 61 … 건이 되면
 * 페이지가 하나씩 는다. 번호는 다섯 개씩(`1 2 3 4 5`), 전체가 다섯 페이지보다 많으면(6페이지부터, 2026-10-17) 이전 · 다음 묶음 화살표. 페이지를 넘기면 결과 제목
 * 줄로 스크롤하고 제목에 포커스 — 새 페이지를 위에서부터 읽는다. 뒤로가기는 보던 페이지로 돌아온다. 조건을 바꾸면 1페이지로.
 *
 * 누른 버튼이 사라지는 동작(검색 · 지우기 · 필터 모두 지우기 · 다시 시도)은 전부 결과 제목으로 포커스를 옮긴다.
 * 그냥 두면 포커스가 문서 맨 앞(body)으로 빠져, 키보드 · 스크린리더 사용자가 처음부터 다시 찾아 내려와야 한다.
 */
export function PostListPage() {
  const { search, apply, hrefForPage, hrefWith } = usePostListSearch()
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

  const summaryRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const stuck = useStuck(chipsRef)

  const searchKey = postListSearchKey(search)
  const condition = postListConditionKey(search)

  const view: PostList | undefined = query.data
  /** 조건 · 페이지를 바꿔 직전 목록을 흐리게 남겨 둔 동안 */
  const stale = query.isPlaceholderData

  /**
   * 페이지를 넘긴 결과를 한 번 알린다 — "2페이지예요. 58건 중 21~40번째 글이에요."(조건을 바꾼 결과는 건수 알림이 맡는다).
   * 마지막으로 다 받은 조건 · 페이지와 견준다
   */
  const [shown, setShown] = useState<{ condition: string; page: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  if (query.data && !query.isPlaceholderData && (shown?.condition !== condition || shown.page !== search.page)) {
    // 글이 없는 쪽(끝을 넘은 번호)은 알리지 않는다 — 빈 상태 제목이 말한다. 예전엔 "99페이지예요. 1,961~1,960번째"라고 읽었다(QA-P-17)
    const turned = shown !== null && shown.condition === condition && query.data.content.length > 0
    setShown({ condition, page: search.page })
    setAnnouncement(
      turned
        ? pageAnnouncement(search.page, POST_LIST_PAGE_SIZE, query.data.content.length, query.data.page.totalElements)
        : '',
    )
  }

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

  /** 처음 목록으로 — 주소는 링크가 `/` 로 바꾼다. 검색칸은 다시 그려 치다 만 글자까지 비우고, 맨 위로 올린다 */
  const [resetCount, setResetCount] = useState(0)
  function resetToStart() {
    setResetCount((count) => count + 1)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, left: 0, behavior: reduce ? 'instant' : 'smooth' })
  }

  const clearFilters = () => applyThenFocusResults(withoutFilters(search))
  const clearKeyword = () => applyThenFocusResults({ ...search, keyword: '' })

  /**
   * 페이지를 넘겼다 — 결과 제목 줄로 스크롤하고 제목에 포커스(새 페이지를 위에서부터 읽는다). 직전 카드는 흐리게 남아 있다.
   * 주소가 그려진 **뒤에** 옮긴다 — 누른 직후에 옮기면 그 스크롤이 떠나는 페이지의 기록으로 남아(ScrollMemory) 뒤로가기가
   * 보던 자리(페이지 번호 줄)가 아니라 결과 제목으로 돌아왔다
   */
  const turnedPage = useRef(false)
  function handlePageNavigate() {
    turnedPage.current = true
  }
  useEffect(() => {
    if (!turnedPage.current) return
    turnedPage.current = false
    const summary = summaryRef.current
    if (!summary) return
    // 결과 제목 줄 위끝을 붙은 헤더 · 칩 줄 바로 아래에(문서의 scroll-padding-top 이 그 높이 + 16px).
    // scrollIntoView 는 줄의 scroll-margin 까지 더해 두 배로 내려 놓는다
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    window.scrollTo({ top: summary.getBoundingClientRect().top + window.scrollY - pad, behavior: 'instant' })
    headingRef.current?.focus({ preventScroll: true })
  }, [searchKey])

  const total = view?.page.totalElements
  const empty = view ? emptyKindOf(search, view) : null
  const filtered = hasActiveFilters(search)
  // 확정된 데이터로만 판정한다. 조건을 바꾸는 동안의 앞 목록 숫자로 판정하면 입구가 한 번 떴다 사라진다
  const confirmedTotal = view && !query.isPlaceholderData ? view.page.totalElements : undefined
  // 0건이면 ?page=4 를 지운다 — 갈 페이지가 없다(QA-P-28)
  useDropPageWhenEmpty(confirmedTotal)
  const totalPages = view?.page.totalPages ?? 0
  /** 뒤 페이지가 남았나(확정된 목록 기준) */
  const morePages = view !== undefined && !stale && search.page < totalPages
  /*
   * 결과 제목 아래 글쓰기 입구 줄 — 보임 · 자리만(보이지 않게) · 없음.
   * 칸을 골라 처음 받는 동안(스켈레톤)은 **자리만 잡는다**(QA-P-30) — 받은 뒤에야 줄이 서면 카드 전체가 35px 내려갔다(375 `?type=LOST`).
   * 다시 받는 동안(직전 목록이 흐림)은 직전 화면에 줄이 있었을 때만 — 같은 칸이면 그대로 보이고, 칸을 바꿨으면 자리만(없던 줄이 생겼다 사라지지 않게).
   * 확정 건수가 4건 이하면 그때 거둔다(그 경우만 카드가 35px 올라온다 — 목록 끝의 입구가 같은 화면에 보여 둘이 되지 않게)
   */
  const writeDecided = confirmedTotal === undefined ? undefined : intent !== undefined && confirmedTotal >= WRITE_LINK_MIN
  /** 마지막으로 확정된 화면에 줄이 있었으면 그 줄의 종류(분실 · 습득), 없었으면 null */
  const [writeShownFor, setWriteShownFor] = useState<PostType | null>(null)
  const decidedFor = writeDecided === undefined ? undefined : writeDecided && intent ? intent.concept : null
  if (decidedFor !== undefined && decidedFor !== writeShownFor) setWriteShownFor(decidedFor)
  const writeRow: 'show' | 'reserve' | 'none' =
    intent === undefined || query.isError
      ? 'none'
      : writeDecided !== undefined
        ? writeDecided
          ? 'show'
          : 'none'
        : writeShownFor === intent.concept
          ? 'show' // 같은 칸에서 페이지 · 조건만 바꾸는 중 — 있던 줄을 그대로 둔다
          : query.isPending || writeShownFor !== null
            ? 'reserve'
            : 'none'

  // 목록 끝의 "내 글을 올려 두기".
  //  칸을 골랐으면 그 종류 하나, **마지막 페이지에서만**(본인 결정 2026-10-16) — 그 전 페이지는 결과 제목 아래 한 줄이 이미 입구다(5건 이상)
  //  칸 · 검색어 · 필터가 없는 처음 목록이면 두 종류를 나란히(QA P-1). 휴대폰 헤더의 [+]는 글자가 없어 본문에 글로 된 입구가
  //  이것 하나뿐이라 모든 페이지에 둔다 — 제목만 갈린다(뒤 페이지가 남았으면 "올릴 물건이 있나요?", 마지막이면 "찾는 물건이 없나요?")
  const plainList = intent === undefined && !search.keyword && !filtered
  const showNext = view !== undefined && !empty && !stale && (intent !== undefined ? !morePages : plainList)

  return (
    <div className={styles.page}>
      {/* 읽는 순서 = Tab 순서 : 의도 → 검색 → 필터 → 결과. 가장 먼저 할 일이 가장 위에 있다 */}
      <section className={styles.hero} aria-labelledby="post-list-title">
        <h1 id="post-list-title" tabIndex={-1} className={styles.title}>
          잃어버렸나요, 주웠나요?
        </h1>
        <PostIntentPicker
          selected={search.type}
          hrefFor={(type) => hrefWith({ type })}
          resetTo={paths.postList}
          showCounts={!search.keyword && !filtered}
          // 고른 칸 → 처음 목록(본인 결정 2026-10-14). 링크가 주소를 `/` 로 바꾼다 — 치다 만 검색칸 글자도 비우고 맨 위로.
          // [×]는 분실 · 습득 선택만 푼다(검색어 · 필터 그대로, QA-P-6)
          onReset={resetToStart}
        />
      </section>

      {/* 검색은 위에 붙지 않는다(입력칸은 한 벌 — 두 벌이면 치던 글자가 갈린다). 넓은 화면은 칩 줄과 한 줄에 선다 */}
      <div className={styles.search}>
        <PostSearchBar
          key={`${search.keyword}#${resetCount}`}
          keyword={search.keyword}
          // 새 검색어는 분실 · 습득을 함께 찾는다(골라 둔 칸을 푼다). 한쪽만 보려면 위의 칸을 누른다 — 검색어는 남는다
          onSearch={(keyword) => applyThenFocusResults(withKeyword(search, keyword))}
          // 추천 = 그 말로 Enter 를 눌렀을 때 나올 목록의 앞 5건(상태 기준 · 칩 조건이 같다)
          suggestionParams={(term) => suggestionParams(search, term)}
          onOpenPost={(postId) => navigate(paths.postDetail(postId), { state: POST_DETAIL_FROM_LIST })}
        />
      </div>

      {/*
        칩 줄 — 스크롤해도 헤더 아래에 붙는다(높이 40rem · 폭 22.5rem 이상, CSS). 목록 아래에서도 조건을 바로 바꾼다.
        붙어 있는 동안만 아래에 가는 선과 바탕을 깐다(data-stuck)
      */}
      <div ref={chipsRef} className={styles.chips} data-stuck={stuck || undefined} data-sticks="top">
        {/* [전체 해제]는 두지 않는다(본인 피드백 2026-10-07) — 걸린 칩마다 [×], 0건이면 빈 상태의 [필터 모두 지우기] */}
        <PostFilterBar search={search} onApply={apply} onRemove={(field) => apply(withoutFilter(search, field))} />
      </div>

      <section className={styles.results} aria-labelledby="post-list-heading">
        <div ref={summaryRef} className={styles.summary}>
          {/* data-page-turn-focus : 같은 경로의 뒤로 · 앞으로에서 고른 자리가 화면 밖이면 여기로(RouteFocus, QA-P-24) */}
          <h2 id="post-list-heading" ref={headingRef} tabIndex={-1} className={styles.heading} data-page-turn-focus>
            {heading}
          </h2>
          {/*
            건수 자리 — 결과를 기다리는 동안 점 셋이 서는 곳도 여기 하나다(첫 로딩 · 다시 받기 모두, QA-P-5 · P-9).
            다시 받는 중(조건 · 페이지를 바꿈)에는 직전 목록을 흐리게 두고 **건수 자리에 점 셋이 겹쳐 선다**(0.3초 넘을 때만) — 건수 글자는 그동안
            보이지 않게 둔다(직전 조건의 수다). 점 자리는 늘 잡혀 있고(`reserve`) 건수 상자 위에 겹쳐 서서 줄 · 이름표 안내 · 카드가
            밀리지 않는다. 예전엔 건수 뒤 흐름 안에 서서 이름표 안내가 ±50px 오갔고(200%에서 첫 카드 +52px), 쉬는 동안에도 빈 자리가
            칸 하나를 차지해 건수 → 이름표 안내가 8 → 16px 벌어졌다(QA-D-12).
            건수와 이름표 안내는 한 묶음으로 줄을 바꾼다(countGroup) — 따로 서면 글자 200%에서 기다리는 점(56px)은 제목 옆에 서고 받은 건수(`132건` 69px)는
            다음 줄로 내려가 결과 제목이 4px · 줄이 9px 움직였다(본인 지시 2026-10-18 "스켈레톤까지")
          */}
          <div className={styles.countGroup}>
            <div className={styles.countSlot}>
              {/*
                건수 자리 — 세 자리(`000건`)만큼 늘 잡아 둔다(보이지 않음, QA-P-34). 기다리는 점(26px)보다 숫자(`230건` 46px)가 넓어
                숫자가 들어오는 순간 이름표 안내가 7px(200% 13px) 오른쪽으로 밀렸다. 한두 자리 수면 그만큼 안내 앞이 넓어진다
              */}
              <span className={styles.countReserve} aria-hidden="true">
                <strong data-numeric>000</strong>건
              </span>
              <p className={styles.count} aria-live="polite" aria-atomic="true" data-stale={stale || undefined}>
                {total === undefined ? (
                  query.isPending ? (
                    // 첫 로딩 — 카드 자리는 스켈레톤, 건수 자리에는 점 셋(본인 결정 2026-10-14, QA-P-5).
                    // 자리(점 셋 폭)를 먼저 잡아 두어 숫자가 들어와도 줄이 밀리지 않는다. 0.3초 전에는 빈 자리
                    <>
                      <span className="sr-only">게시글을 불러오는 중이에요</span>
                      <LoadingDots announce={false} />
                    </>
                  ) : null
                ) : (
                  <span className={styles.countText}>
                    <span className="sr-only">게시글 </span>
                    <strong data-numeric>{total.toLocaleString('ko-KR')}</strong>건
                  </span>
                )}
              </p>
              {/* 알림 영역(건수) 밖 형제 — 건수 문장을 다시 읽히지 않게. 누름을 받지 않는다 */}
              <LoadingDots active={stale} label="글을 불러오는 중" reserve className={styles.staleDots} />
            </div>
            {/* 카드의 이름표가 무엇인지 — 건수 바로 뒤. 누르면 펼친다(온보딩 2층). 알림 영역(건수) 밖 형제로 둔다 */}
            <BadgeGuide className={styles.badgeGuide} />
          </div>
        </div>

        {/* 의도를 고른 순간의 글쓰기 입구. 떠 있는 버튼 대신 흐름 안 한 줄 — 결심하는 순간 바로 아래에 있다 */}
        {intent && writeRow !== 'none' ? (
          // 자리만 잡을 때는 보이지 않고 누를 수도 · 읽을 수도 없다(inert)
          <p className={styles.write} data-reserve={writeRow === 'reserve' || undefined} inert={writeRow === 'reserve'}>
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
          search={search}
          lastPageHref={view ? hrefForPage(Math.max(view.page.totalPages, 1)) : undefined}
          onPageNavigate={handlePageNavigate}
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

        {/*
          페이지 번호 — 마지막 카드 줄 바로 아래. 다섯 개씩, 6페이지부터 이전 · 다음 묶음 화살표(본인 결정 2026-10-16 · 10-17).
          한 페이지뿐이면 그리지 않는다. 넘기는 동안에도 자리는 그대로(직전 카드가 흐리게 남는다)
        */}
        {view && !empty && totalPages > 1 ? (
          <div className={styles.pagination}>
            <Pagination
              page={search.page}
              totalPages={totalPages}
              hrefFor={hrefForPage}
              onNavigate={handlePageNavigate}
              groupSize={POST_LIST_PAGE_GROUP}
            />
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        {showNext ? (
          <div className={styles.next}>
            {intent ? (
              <PostIntentNext intent={intent} to={createHref(intent.concept)} />
            ) : (
              // 제목만 갈린다 — 뒤 페이지가 남았으면 "올릴 물건이 있나요?", 마지막 페이지면 "찾는 물건이 없나요?"(QA-P-14)
              <PostIntentNext
                to={createHref()}
                hrefFor={createHref}
                title={anyIntentNextTitle(morePages)}
              />
            )}
          </div>
        ) : null}
      </section>
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
 *   past-end  : 글은 있는데 이 페이지 번호가 끝을 넘었다(지난 주소 · 그사이 글이 줄었다)
 *   filtered  : 검색어나 필터가 걸려 있다
 *   none-yet  : 조건 없이도 글이 없다(의도만 골랐으면 그 유형의 글이 없다)
 */
type EmptyKind = 'past-end' | 'filtered' | 'none-yet'

function emptyKindOf(search: PostListSearch, data: PostList): EmptyKind | null {
  if (data.content.length > 0) return null
  if (data.page.totalElements > 0) return 'past-end'
  if (hasActiveFilters(search) || search.keyword) return 'filtered'
  return 'none-yet'
}

interface PostListBodyProps {
  query: { isPending: boolean; isFetching: boolean; error: unknown }
  view: PostList | undefined
  search: PostListSearch
  /** 끝을 넘은 페이지에서 돌아갈 마지막 페이지 주소 */
  lastPageHref: To | undefined
  /** [n페이지로]를 눌렀다 — 페이지 번호를 누른 것과 같이 결과 제목으로 데려가고 알린다(QA-P-17 · D-14 — 누른 버튼이 사라져 포커스가 body 로 빠졌다) */
  onPageNavigate: () => void
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
  search,
  lastPageHref,
  onPageNavigate,
  intent,
  stale,
  gridRef,
  createHref,
  onRetry,
  onClearFilters,
  onClearKeyword,
}: PostListBodyProps) {
  if (!view && query.isPending) {
    // 한 페이지(20건)만큼 자리를 잡는다. 새로고침 · 오래된 뒤로가기에서도 문서 높이가 응답 전에 거의 맞아,
    // 스크롤 기억이 보던 자리로 데려가고 카드가 같은 자리에서 스켈레톤을 대신한다
    return (
      <ul className={styles.grid} role="list" aria-busy="true">
        {Array.from({ length: POST_LIST_PAGE_SIZE }, (_, i) => (
          // 키를 글 id 와 겹치지 않게 — 같은 목록(ul) 자리라 React 가 `key=19` 자리표시를 글 19 의 카드로 옮겨 쓰면,
          // 화면 밖(맨 아래)에 있던 칸이 둘째 카드 자리로 와 레이아웃 이동(CLS 0.15)으로 잡혔다(QA-D-28)
          <li key={`skeleton-${i}`}>
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

  if (empty === 'past-end') {
    // 지난 주소의 페이지 번호가 끝을 넘었다 — 막다른 길 대신 마지막 페이지로
    const last = view.page.totalPages.toLocaleString('ko-KR')
    return (
      <div className={styles.empty}>
        <EmptyState
          titleAs="h3"
          icon={<MagnifyingGlass />}
          title="이 페이지에는 글이 없어요."
          description={`글은 ${last}페이지까지 있어요.`}
          action={
            lastPageHref ? (
              <ButtonLink
                to={lastPageHref}
                onClick={(event) => {
                  if (isPlainClick(event)) onPageNavigate()
                }}
              >
                {`${last}페이지로`}
              </ButtonLink>
            ) : null
          }
        />
      </div>
    )
  }

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
    // 회색 판 대신 등록 권유 면 하나. 버튼 색은 올릴 글을 따른다. 칸을 안 골랐으면 결과 끝과 같은 두 버튼
    // ([분실 글 올리기] [습득 글 올리기]) — 잉크 [글 올리기] 하나는 누른 뒤 등록 화면에서 또 골라야 했다(QA 2026-10-11)
    return (
      <PostIntentNext
        intent={intent}
        to={createHref(intent?.concept)}
        hrefFor={intent ? undefined : createHref}
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
