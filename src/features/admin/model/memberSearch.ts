import { useCallback, useMemo } from 'react'
import { useSearchParams, type To } from 'react-router-dom'

import { isMemberRole, type MemberRole } from '@/features/members'
import { parsePageParam, useCanonicalPageParam } from '@/shared/lib/pageParam'

import type { AdminMemberSearchParams } from '../api/types'

/*
 * 매니저 관리의 조건 — 검색어 · 역할 탭 · 페이지. 주소(`/admin/managers?keyword=kim&role=MANAGER&page=2`)에 싣는다.
 * 뒤로가기 한 번이 직전 조건으로 돌아가고, 새로고침해도 같은 결과가 열린다. 내가 쓴 글(`myPostsSearch`)과 같은 규칙 :
 * `page` 는 **1부터**(서버로 보낼 때 1을 뺀다), 기본값(검색어 없음 · 전체 · 1페이지)은 주소에 쓰지 않는다.
 */

export interface AdminMemberSearch {
  /** 앞뒤 공백을 자른 검색어. 없으면 `''` */
  keyword: string
  /** 없으면 모든 역할 */
  role?: MemberRole
  page: number
}

/** 한 페이지의 회원 수 · 번호 묶음 — 서버 기본값(20)과 목록 · 내가 쓴 글의 페이지 모양(다섯 개씩)과 같다 */
export const ADMIN_MEMBERS_PAGE_SIZE = 20
export const ADMIN_MEMBERS_PAGE_GROUP = 5

/** 검색어 칸 최대 글자. 닉네임(20) · 이메일 일부를 찾는 칸이라 넉넉히 — 주소에 실려 오는 긴 값도 여기서 자른다 */
export const ADMIN_KEYWORD_MAX_LENGTH = 50

/** 역할 탭 — 본인 지시 순서(전체 · 매니저 · 관리자 · 회원, 2026-10-25). 매니저를 앞에 둔다(이 화면의 일이 매니저다) */
export const ADMIN_ROLE_TABS: readonly { role: MemberRole | undefined; label: string }[] = [
  { role: undefined, label: '전체' },
  { role: 'MANAGER', label: '매니저' },
  { role: 'ADMIN', label: '관리자' },
  { role: 'USER', label: '회원' },
]

/** 역할 이름(이름표 · 탭 · 결과 제목) */
export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  USER: '회원',
  MANAGER: '매니저',
  ADMIN: '관리자',
}

/** 주소의 검색어 — 앞뒤 공백을 자르고 칸 최대 글자까지(코드 포인트로 자른다 — 한글 · 그림 글자가 반쪽으로 잘리지 않게) */
export function cleanKeyword(raw: string | null): string {
  const trimmed = (raw ?? '').trim()
  return Array.from(trimmed).slice(0, ADMIN_KEYWORD_MAX_LENGTH).join('').trim()
}

export function parseAdminMemberSearch(params: URLSearchParams): AdminMemberSearch {
  const role = params.get('role')
  return {
    keyword: cleanKeyword(params.get('keyword')),
    role: isMemberRole(role) ? role : undefined,
    page: parsePageParam(params.get('page')),
  }
}

/** 기본값은 주소에 쓰지 않는다 — `/admin/managers` 와 `?page=1` 이 다른 기록이 되지 않게 */
export function adminMemberSearchParams(search: AdminMemberSearch): URLSearchParams {
  const params = new URLSearchParams()
  if (search.keyword) params.set('keyword', search.keyword)
  if (search.role) params.set('role', search.role)
  if (search.page > 1) params.set('page', String(search.page))
  return params
}

/** 조건 → 서버 요청. 여기서만 page 를 0부터로 바꾼다 */
export function toAdminMemberParams(search: AdminMemberSearch): AdminMemberSearchParams {
  return {
    keyword: search.keyword || undefined,
    role: search.role,
    page: search.page - 1,
    size: ADMIN_MEMBERS_PAGE_SIZE,
  }
}

/**
 * 결과 제목 — `전체 128명` · `매니저 3명` · `검색 결과 2명`(검색어가 있으면, 역할은 탭이 말한다).
 * **검색어를 문장에 넣지 않는다**(주소로 남의 화면에 문장을 심는 통로 — 검색칸에 이미 보인다, 디자인품질기준 9장)
 */
export function resultScopeLabel(search: Pick<AdminMemberSearch, 'keyword' | 'role'>): string {
  if (search.keyword) return '검색 결과'
  return search.role ? MEMBER_ROLE_LABEL[search.role] : '전체'
}

/** 페이지를 넘긴 결과 알림 — 목록의 문장(`pageAnnouncement`)과 같은 모양, 세는 말만 `명` · `회원` */
export function memberPageAnnouncement(page: number, shown: number, total: number): string {
  const from = (page - 1) * ADMIN_MEMBERS_PAGE_SIZE + 1
  const to = from + shown - 1
  const n = (value: number) => value.toLocaleString('ko-KR')
  return `${page}페이지예요. ${n(total)}명 중 ${n(from)}~${n(to)}번째 회원이에요.`
}

/**
 * 주소와 맞물린 조건. 탭 · 페이지 이동은 링크라서 새 탭 열기 · 주소 복사가 된다.
 * 검색어 · 역할을 바꾸면 1페이지부터다 — 결과가 달라진다
 */
export function useAdminMemberSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useMemo(() => parseAdminMemberSearch(searchParams), [searchParams])
  // ?page=0 · abc · 1 처럼 고쳐 읽은 값이 주소와 다르면 주소를 바꿔 쓴다(목록 · 내가 쓴 글과 같다)
  useCanonicalPageParam(search.page)

  const hrefWith = useCallback(
    (patch: Partial<AdminMemberSearch>): To => {
      const query = adminMemberSearchParams({ ...search, page: 1, ...patch }).toString()
      return { search: query ? `?${query}` : '' }
    },
    [search],
  )

  const hrefForPage = useCallback((page: number): To => hrefWith({ page }), [hrefWith])
  const hrefForRole = useCallback((role: MemberRole | undefined): To => hrefWith({ role }), [hrefWith])

  /** 검색어를 적용한다(지울 때는 `''`). 역할 탭은 그대로, 1페이지부터. 기록을 쌓는다 — 뒤로가기가 직전 검색으로 */
  const applyKeyword = useCallback(
    (keyword: string) => {
      setSearchParams(adminMemberSearchParams({ ...search, keyword: cleanKeyword(keyword), page: 1 }), {
        preventScrollReset: true,
      })
    },
    [search, setSearchParams],
  )

  return { search, hrefForPage, hrefForRole, applyKeyword }
}
