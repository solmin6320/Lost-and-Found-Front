import { isMemberRole } from '@/features/members'
import { request } from '@/shared/lib/http'
import type { PagedModel } from '@/shared/types/api'

import type { AdminMemberResponse, AdminMemberSearchParams } from './types'

/**
 * 검색 조건을 서버에 보낼 모양으로 다듬는다. 요청과 쿼리 키가 같은 결과를 쓴다(목록 `normalizePostListParams` 와 같은 규칙).
 * 검색어는 앞뒤 공백을 자르고 비면 뺀다. 역할은 아는 값만. `page` 0 은 기본값이라 뺀다
 */
export function normalizeAdminMemberParams(params: AdminMemberSearchParams): AdminMemberSearchParams {
  const result: AdminMemberSearchParams = {}
  const keyword = params.keyword?.trim()
  if (keyword) result.keyword = keyword
  if (isMemberRole(params.role)) result.role = params.role
  if (isPositiveInteger(params.page)) result.page = params.page
  if (isPositiveInteger(params.size)) result.size = params.size
  return result
}

function isPositiveInteger(value: number | undefined): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

/**
 * `GET /api/admin/members` — **관리자만**(아니면 403 `ACCESS_DENIED`). 최근 가입 순 한 페이지.
 * 화면이 모르는 역할 값이 오면 회원으로 읽는다 — 모르는 권한에 임명 · 해임 버튼을 그리지 않게, 그 줄은 회원과 같이 다룬다(서버가 다시 가른다)
 */
export async function searchAdminMembers(
  params: AdminMemberSearchParams,
  signal?: AbortSignal,
): Promise<PagedModel<AdminMemberResponse>> {
  const { keyword, role, page, size } = normalizeAdminMemberParams(params)
  const result = await request<PagedModel<AdminMemberResponse>>('/api/admin/members', {
    query: { keyword, role, page, size },
    signal,
  })
  return {
    ...result,
    content: result.content.map((member) => (isMemberRole(member.role) ? member : { ...member, role: 'USER' })),
  }
}

/**
 * `POST /api/admin/managers/{memberId}` — 매니저 임명. 성공 204(본문 없음).
 * 그 회원의 리프레시 토큰을 지운다 — **다시 로그인해야** 매니저 역할이 토큰에 실린다(액세스 토큰 5분이 지나면 로그인이 풀린다).
 *
 * 실패 code : `ALREADY_MANAGER`(409) · `ADMIN_ROLE_LOCKED`(409) · `MEMBER_NOT_FOUND`(404) · `ACCESS_DENIED`(403)
 */
export function appointManager(memberId: number): Promise<void> {
  return request<void>(`/api/admin/managers/${memberId}`, { method: 'POST' })
}

/**
 * `DELETE /api/admin/managers/{memberId}` — 매니저 해임(회원으로). 성공 204. 임명과 같이 그 회원은 다시 로그인해야 한다.
 *
 * 실패 code : `NOT_MANAGER`(409) · `ADMIN_ROLE_LOCKED`(409) · `MEMBER_NOT_FOUND`(404) · `ACCESS_DENIED`(403)
 */
export function dismissManager(memberId: number): Promise<void> {
  return request<void>(`/api/admin/managers/${memberId}`, { method: 'DELETE' })
}
