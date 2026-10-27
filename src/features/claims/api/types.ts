/**
 * 주인 확인 요청 타입. 원본 : Lost-and-Found `entity/ClaimStatus`,
 *        `dto/request/ClaimRequest`, `dto/response/ClaimResponse · MyClaimResponse · MyClaimSummaryResponse · ReturnRecordResponse`(PR #41)
 */

import type { PostStatus, PostType } from '@/features/posts'

/** 대기 · 승인 · 거절(또는 승인 취소) · 받음 */
export const CLAIM_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'RECEIVED'] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export const isClaimStatus = (value: unknown): value is ClaimStatus =>
  typeof value === 'string' && (CLAIM_STATUSES as readonly string[]).includes(value)

/** 답 최대 길이. 원본 : `ClaimRequest.answer` `@Size(max = 500)` — 서버가 앞뒤 공백을 자른다 */
export const CLAIM_ANSWER_MAX_LENGTH = 500

/** `POST /api/posts/{postId}/claims` 본문 */
export interface ClaimRequest {
  /** 1~500자 */
  answer: string
}

/** 요청 하나(보낸 직후 · 글쓴이가 받은 목록 · 승인/거절/받음 응답) */
export interface ClaimResponse {
  id: number
  postId: number
  /** 보낸 때의 확인 질문. 글쓴이가 질문을 걸지 않았으면 `null` */
  question: string | null
  /** 비공개 답 — 글쓴이와 보낸 사람만 본다. 텍스트로만 그린다 */
  answer: string
  status: ClaimStatus
  claimantNickname: string
  /** `LocalDateTime` — 시간대 오프셋이 없다 */
  createdAt: string
  /** 승인 · 거절 시각 */
  decidedAt: string | null
  /** 주인이 받은 시각 */
  receivedAt: string | null
}

/** `GET /api/members/me/claims` 의 항목 — 내가 보낸 요청과 그 글 */
export interface MyClaimResponse {
  id: number
  postId: number
  postTitle: string
  postType: PostType
  postStatus: PostStatus
  question: string | null
  answer: string
  status: ClaimStatus
  createdAt: string
  decidedAt: string | null
  receivedAt: string | null
}

/** 상세(`PostDetailResponse.myClaim`)에 실리는 내 요청 — 글쓴이가 아닌 로그인 회원이 이 글에 보낸 것 */
export interface MyClaimSummary {
  id: number
  status: ClaimStatus
}

/** 되찾기 공개 기록 — 주인 확인이 끝난 글(`ownerVerified`)에만 있다 */
export interface ReturnRecordResponse {
  requestedAt: string
  approvedAt: string | null
  receivedAt: string | null
}

/** 내가 보낸 요청 목록 조건. 정렬은 서버 고정(최근 보낸 순) */
export interface MyClaimsParams {
  /** **0부터** */
  page?: number
  size?: number
}
