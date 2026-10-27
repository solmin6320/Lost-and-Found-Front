import { request } from '@/shared/lib/http'
import type { PagedModel } from '@/shared/types/api'

import type { ClaimRequest, ClaimResponse, MyClaimResponse, MyClaimsParams } from './types'

function isPositiveInteger(value: number | undefined): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

/** 쪽 조건을 서버에 보낼 모양으로. 0쪽 · 잘못된 크기는 뺀다(요청과 쿼리 키가 같은 결과를 쓴다) */
export function normalizeMyClaimsParams(params: MyClaimsParams): MyClaimsParams {
  const result: MyClaimsParams = {}
  if (isPositiveInteger(params.page)) result.page = params.page
  if (isPositiveInteger(params.size)) result.size = params.size
  return result
}

/**
 * [4.7] `POST /api/posts/{postId}/claims` — 로그인 필요. 201 + 요청.
 * 한 글에 한 사람 한 번 — 거절돼도 다시 보낼 수 없다.
 *
 * 실패 code : `CLAIM_OWN_POST`(400) · `CLAIM_NOT_ACCEPTING`(409) · `DUPLICATE_CLAIM`(409) · `POST_NOT_FOUND`(404) · `INVALID_INPUT`(400)
 */
export function createClaim(postId: number, body: ClaimRequest): Promise<ClaimResponse> {
  return request<ClaimResponse>(`/api/posts/${postId}/claims`, { method: 'POST', body })
}

/**
 * `GET /api/posts/{postId}/claims` — **글쓴이만**. 받은 요청 전부(최근 순, 페이지 없음).
 * 실패 code : `FORBIDDEN_ACCESS`(403) · `POST_NOT_FOUND`(404)
 */
export function getReceivedClaims(postId: number, signal?: AbortSignal): Promise<ClaimResponse[]> {
  return request<ClaimResponse[]>(`/api/posts/${postId}/claims`, { signal })
}

/** `GET /api/members/me/claims?page=&size=` — 내가 보낸 요청(최근 순) */
export function getMyClaims(params: MyClaimsParams = {}, signal?: AbortSignal): Promise<PagedModel<MyClaimResponse>> {
  return request<PagedModel<MyClaimResponse>>('/api/members/me/claims', {
    query: { ...normalizeMyClaimsParams(params) },
    signal,
  })
}

/**
 * [4.8] `PATCH /api/claims/{claimId}/approve` — 글쓴이만. 글이 연락중이 된다.
 * 실패 code : `INVALID_CLAIM_STATUS`(409) · `CLAIM_NOT_ACCEPTING`(409, 게시중이 아님 — 이미 승인한 요청이 있다) · `FORBIDDEN_ACCESS`(403)
 */
export function approveClaim(claimId: number): Promise<ClaimResponse> {
  return request<ClaimResponse>(`/api/claims/${claimId}/approve`, { method: 'PATCH' })
}

/**
 * [4.8] `PATCH /api/claims/{claimId}/reject` — 글쓴이만. 대기 중이면 거절, **승인된 요청이면 승인 취소**(글이 다시 게시중).
 * 실패 code : `INVALID_CLAIM_STATUS`(409) · `FORBIDDEN_ACCESS`(403)
 */
export function rejectClaim(claimId: number): Promise<ClaimResponse> {
  return request<ClaimResponse>(`/api/claims/${claimId}/reject`, { method: 'PATCH' })
}

/**
 * `PATCH /api/claims/{claimId}/receive` — **물건을 받는 쪽만**(습득 글은 요청자, 분실 글은 글쓴이). 승인된 요청만.
 * 글이 완료되고 주인 확인 완료(`ownerVerified`)가 된다. 되돌릴 수 없다.
 * 실패 code : `INVALID_CLAIM_STATUS`(409) · `FORBIDDEN_ACCESS`(403)
 */
export function receiveClaim(claimId: number): Promise<ClaimResponse> {
  return request<ClaimResponse>(`/api/claims/${claimId}/receive`, { method: 'PATCH' })
}
