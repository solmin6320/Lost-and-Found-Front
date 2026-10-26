import { queryOptions } from '@tanstack/react-query'

import { memberKeys } from '@/features/members'

import { normalizeAdminMemberParams, searchAdminMembers } from '../api/adminApi'
import type { AdminMemberSearchParams } from '../api/types'

/**
 * 관리자 쿼리 키 — **회원 키(`memberKeys.all`) 아래에** 둔다.
 * 회원의 개인 데이터(이메일)라 로그아웃 · 세션 만료 · 비밀번호 변경 때 지워야 하는데, `AuthProvider` 의 정리(`forgetMember`)가
 * 이미 `memberKeys.all` 을 통째로 지운다 — 여기에 두면 따로 챙기지 않아도 같이 지워진다(보안명세서 8장).
 * 내 정보(`memberKeys.me()`)와는 키가 갈려 서로를 무효화하지 않는다
 */
export const adminKeys = {
  all: [...memberKeys.all, 'admin'] as const,
  memberLists: () => [...adminKeys.all, 'list'] as const,
  /** 검색어 · 역할 · 페이지가 키에 들어간다 */
  members: (params: AdminMemberSearchParams) => [...adminKeys.memberLists(), normalizeAdminMemberParams(params)] as const,
}

/** 회원 검색 쿼리 설정. 화면이 이전 페이지를 붙잡아 두는 옵션을 덧붙여 펼쳐 쓴다(내가 쓴 글과 같다) */
export function adminMembersQueryOptions(params: AdminMemberSearchParams) {
  return queryOptions({
    queryKey: adminKeys.members(params),
    queryFn: ({ signal }) => searchAdminMembers(params, signal),
  })
}
