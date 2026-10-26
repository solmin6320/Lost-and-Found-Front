import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import type { To } from 'react-router-dom'

import { PAGE_TURN_FOCUS_ATTR } from '@/app/RouteFocus'
import {
  ADMIN_MEMBERS_PAGE_GROUP,
  ADMIN_MEMBERS_PAGE_SIZE,
  AdminMemberList,
  AdminMemberListSkeleton,
  ManagerChangeDialog,
  MemberRoleTabs,
  MemberSearchForm,
  adminMembersQueryOptions,
  managerChangeCopy,
  managerChangeFailure,
  memberPageAnnouncement,
  resultScopeLabel,
  toAdminMemberParams,
  useAdminMemberSearch,
  useManagerChange,
  type AdminMemberResponse,
  type AdminMemberSearch,
  type ManagerChange,
  type ManagerChangeTarget,
} from '@/features/admin'
import type { MemberRole } from '@/features/members'
import { isPlainClick } from '@/shared/lib/events'
import { showFlash } from '@/shared/lib/flash'
import { getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { useDropPageWhenEmpty } from '@/shared/lib/pageParam'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import type { PagedModel } from '@/shared/types/api'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { MagnifyingGlass, User } from '@/shared/ui/icons'
import { Pagination } from '@/shared/ui/Pagination'

import styles from './Admin.module.css'
import { useAdminOutlet } from './adminOutlet'
import { ManagersHead, ResultCount } from './ManagersHead'

/** 페이지를 넘긴 뒤 · 검색한 뒤 포커스 자리 표시(RouteFocus 가 뒤로 · 앞으로의 대체 자리로 찾는다) */
const PAGE_TURN_FOCUS = { [PAGE_TURN_FOCUS_ATTR]: true } as const

/**
 * SCR-19 매니저 관리 · `/admin/managers` — 관리자만(가드는 `AdminLayout`). 기능명세서 7.4.
 * `GET /api/admin/members` · `POST · DELETE /api/admin/managers/{memberId}`
 *
 * ① 제목 + 할 일 한 줄 ② 회원 찾기(닉네임 · 이메일 일부) ③ 역할 탭(전체 · 매니저 · 관리자 · 회원) ④ 결과 제목(`전체 128명`) ⑤ 회원 줄 ⑥ 페이지 번호.
 * 조건은 모두 주소에 실린다 — 뒤로가기 · 새로고침 · 주소 공유가 그대로 된다.
 *
 * 임명 · 해임은 확인 창이 결과를 먼저 말한다(그 회원은 5분 안에 로그인이 풀리고 다시 로그인해야 적용). 끝나면 짧은 알림(polite) · 목록을 다시 받는다.
 * 그사이 바뀐 줄(409 · 404)은 창을 닫고 서버 문장을 알린 뒤 목록을 맞춘다. 서버가 403 이면 권한 없음 면으로
 */
export function ManagersPage() {
  useDocumentTitle('매니저 관리')
  const { deny } = useAdminOutlet()
  const { search, hrefForPage, hrefForRole, applyKeyword } = useAdminMemberSearch()
  const query = useQuery({
    ...adminMembersQueryOptions(toAdminMemberParams(search)),
    placeholderData: keepPreviousData,
  })

  // 서버가 관리자가 아니라고 했다 — 토큰의 역할은 화면 표시용이다. 권한 없음 면으로(관리자 틀이 바꾼다)
  useEffect(() => {
    if (hasErrorCode(query.error, 'ACCESS_DENIED')) deny()
  }, [query.error, deny])

  const settled = query.data && !query.isPlaceholderData ? query.data : null
  // 이 조건이 0건이면 ?page=4 를 지운다 — 갈 페이지가 없다(목록 · 내가 쓴 글과 같다)
  useDropPageWhenEmpty(settled?.page.totalElements)

  /*
   * 검색 · 페이지를 넘기면 결과 제목으로 데려간다(목록의 결과 제목과 같다). 주소가 그려진 **뒤에** 옮긴다 —
   * 누른 직후에 옮기면 그 스크롤이 떠나는 기록으로 남아 뒤로가기가 엉뚱한 자리로 돌아온다(QA-P-25 · D-21).
   * 역할 탭은 옮기지 않는다 — 누른 탭에 포커스가 남아 다음 탭으로 바로 갈 수 있다(내가 쓴 글과 같다)
   */
  const resultsRef = useRef<HTMLHeadingElement>(null)
  const moveToResults = useRef(false)
  useEffect(() => {
    if (!moveToResults.current) return
    moveToResults.current = false
    const heading = resultsRef.current
    if (!heading) return
    heading.scrollIntoView({ block: 'start' })
    heading.focus({ preventScroll: true })
  }, [search.keyword, search.role, search.page])

  function handleSearch(keyword: string) {
    moveToResults.current = true
    applyKeyword(keyword)
  }

  function handlePageNavigate() {
    moveToResults.current = true
  }

  /*
   * 결과 알림. 같은 조건에서 페이지를 넘긴 결과는 `3페이지예요. 128명 중 41~60번째 회원이에요.`,
   * 조건을 바꾼 결과 · 처음 받은 결과는 결과 제목(`매니저 3명`). 마지막으로 다 받은 조건과 견준다
   */
  const scopeLabel = resultScopeLabel(search)
  const searchKey = `${search.keyword}|${search.role ?? ''}`
  const [shown, setShown] = useState<{ key: string; page: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  if (settled && (shown === null || shown.key !== searchKey || shown.page !== search.page)) {
    const turned = shown !== null && shown.key === searchKey && settled.content.length > 0
    setShown({ key: searchKey, page: search.page })
    setAnnouncement(
      turned
        ? memberPageAnnouncement(search.page, settled.content.length, settled.page.totalElements)
        : `${scopeLabel} ${settled.page.totalElements.toLocaleString('ko-KR')}명`,
    )
  }

  // ── 임명 · 해임 ──
  const mutation = useManagerChange()
  const [target, setTarget] = useState<ManagerChangeTarget | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  function requestChange(member: AdminMemberResponse, change: ManagerChange) {
    mutation.reset()
    setDialogError(null)
    setTarget({ member, change })
    setDialogOpen(true)
  }

  function confirmChange() {
    if (!target || mutation.isPending) return
    const copy = managerChangeCopy(target.member.nickname, target.change)
    mutation.mutate(target, {
      onSuccess: () => {
        setDialogOpen(false)
        showFlash(copy.done)
      },
      onError: (error) => {
        const failure = managerChangeFailure(error)
        if (failure === 'retry') {
          // 연결 끊김 · 서버 오류 — 창을 열어 둔 채 문장을 보이고 다시 누를 수 있게
          setDialogError(getErrorMessage(error))
          return
        }
        setDialogOpen(false)
        if (failure === 'denied') {
          deny()
          return
        }
        // 그사이 바뀐 줄 — 서버 문장 그대로(`이미 매니저인 회원입니다` 등). 목록은 다시 받는 중이다(useManagerChange)
        showFlash(getErrorMessage(error), 'info')
      },
    })
  }

  const resultsId = useId()
  // 다 받은 조건의 수만 쓴다 — 다시 받는 동안(직전 조건의 수)은 자리만 두고 0.3초 뒤 점 셋
  const total = settled ? settled.page.totalElements : null

  return (
    <div className={styles.page}>
      <ManagersHead />

      <div className={styles.search}>
        {/* 적용된 검색어가 바뀌면(뒤로가기 · 검색 풀기) 칸을 새로 시작한다 */}
        <MemberSearchForm key={search.keyword} keyword={search.keyword} onSearch={handleSearch} />
      </div>

      <div className={styles.tabs}>
        <MemberRoleTabs selected={search.role} hrefFor={hrefForRole} />
      </div>

      <section aria-labelledby={resultsId}>
        <div className={styles.resultHead}>
          {/* 결과 제목 — 이 구역의 이름이자 검색 · 페이지를 넘긴 뒤 포커스 자리. 검색어는 넣지 않는다(위조 통로) */}
          <h2 id={resultsId} ref={resultsRef} tabIndex={-1} className={styles.resultTitle} {...PAGE_TURN_FOCUS}>
            <ResultCount label={scopeLabel} total={total} loading={query.isFetching} />
          </h2>
        </div>

        {/* 조건 · 페이지를 바꾼 결과를 알린다. 포커스가 결과 제목 · 탭에 있어 스크린리더는 목록을 따로 듣지 못한다 */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        <ManagersBody
          query={query}
          search={search}
          hrefForPage={hrefForPage}
          hrefForRole={hrefForRole}
          onPageNavigate={handlePageNavigate}
          onClearKeyword={() => handleSearch('')}
          onRequestChange={requestChange}
        />

        {settled && settled.content.length > 0 ? (
          <div className={styles.pagination}>
            <Pagination
              page={search.page}
              totalPages={settled.page.totalPages}
              hrefFor={hrefForPage}
              onNavigate={handlePageNavigate}
              groupSize={ADMIN_MEMBERS_PAGE_GROUP}
            />
          </div>
        ) : null}
      </section>

      <ManagerChangeDialog
        target={target}
        open={dialogOpen}
        pending={mutation.isPending}
        error={dialogError}
        onConfirm={confirmChange}
        onClose={() => setDialogOpen(false)}
        // 역할 탭에서 그 줄이 빠졌거나(임명한 회원은 `회원` 탭에서 사라진다) 회원이 없어졌으면 결과 제목으로
        fallbackFocus={() => resultsRef.current}
      />
    </div>
  )
}

interface ManagersBodyProps {
  query: UseQueryResult<PagedModel<AdminMemberResponse>>
  search: AdminMemberSearch
  hrefForPage: (page: number) => To
  hrefForRole: (role: MemberRole | undefined) => To
  onPageNavigate: () => void
  onClearKeyword: () => void
  onRequestChange: (member: AdminMemberResponse, change: ManagerChange) => void
}

/** 네 가지 상태 — 로딩 · 오류 · 비어 있음(검색 0건 · 역할 0건 · 끝을 넘은 페이지) · 목록. 권한은 관리자 틀에서 갈랐다 */
function ManagersBody({ query, search, hrefForPage, hrefForRole, onPageNavigate, onClearKeyword, onRequestChange }: ManagersBodyProps) {
  // 직전 조건이 비어 있었으면 그 빈 상태를 흐리게 남기지 않는다 — 문장이 새 조건과 어긋난다
  if (query.isPending || (query.isPlaceholderData && query.data?.content.length === 0)) {
    return <AdminMemberListSkeleton count={ADMIN_MEMBERS_PAGE_SIZE} />
  }

  if (query.isError) {
    // 403 은 관리자 틀이 권한 없음 면으로 바꾼다(그 사이 한 프레임은 빈 자리)
    if (hasErrorCode(query.error, 'ACCESS_DENIED')) return null
    return (
      <div className={styles.stateBox}>
        <ErrorState titleAs="h3" message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </div>
    )
  }

  const { content, page } = query.data
  if (content.length === 0) {
    return <div className={styles.stateBox}>{emptyOf(search, page, hrefForPage, hrefForRole, onPageNavigate, onClearKeyword)}</div>
  }

  return <AdminMemberList members={content} onRequestChange={onRequestChange} stale={query.isPlaceholderData} />
}

/** 왜 비었는지 + 다음에 할 일. 막다른 길을 만들지 않는다. 검색어 · 주소 값을 문장에 넣지 않는다 */
function emptyOf(
  search: AdminMemberSearch,
  page: { totalElements: number; totalPages: number },
  hrefForPage: (page: number) => To,
  hrefForRole: (role: MemberRole | undefined) => To,
  onPageNavigate: () => void,
  onClearKeyword: () => void,
) {
  // 오래된 링크 · 그사이 줄어 페이지가 없어졌다 — 목록과 같은 문장 · 같은 행선지(마지막 페이지)
  if (page.totalElements > 0) {
    const last = Math.max(page.totalPages, 1)
    const lastText = last.toLocaleString('ko-KR')
    return (
      <EmptyState
        titleAs="h3"
        icon={<MagnifyingGlass />}
        title="이 페이지에는 회원이 없어요."
        description={`회원은 ${lastText}페이지까지 있어요.`}
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

  if (search.keyword) {
    return (
      <EmptyState
        titleAs="h3"
        icon={<MagnifyingGlass />}
        title="찾는 회원이 없어요."
        description="닉네임이나 이메일의 다른 부분으로 찾아보세요."
        action={<Button onClick={onClearKeyword}>검색 풀기</Button>}
      />
    )
  }

  if (search.role === 'MANAGER') {
    return (
      <EmptyState
        titleAs="h3"
        icon={<User />}
        title="아직 매니저가 없어요."
        description="‘회원’ 탭에서 회원을 골라 매니저로 임명할 수 있어요."
        action={<ButtonLink to={hrefForRole('USER')}>회원 보기</ButtonLink>}
      />
    )
  }

  if (search.role === 'ADMIN') {
    return (
      <EmptyState
        titleAs="h3"
        icon={<User />}
        title="관리자가 없어요."
        description="관리자는 서버 설정으로만 정해요."
        action={<ButtonLink to={hrefForRole(undefined)}>전체 보기</ButtonLink>}
      />
    )
  }

  if (search.role === 'USER') {
    return (
      <EmptyState
        titleAs="h3"
        icon={<User />}
        title="일반 회원이 없어요."
        description="가입한 사람이 모두 매니저나 관리자예요."
        action={<ButtonLink to={hrefForRole(undefined)}>전체 보기</ButtonLink>}
      />
    )
  }

  return <EmptyState titleAs="h3" icon={<User />} title="아직 가입한 회원이 없어요." />
}
