import { useCallback } from 'react'
import { useSearchParams, type To } from 'react-router-dom'

import { CLAIM_STATUS_LABEL, isReceiver, stalledPendingLine, type ClaimStatus, type MyClaimResponse } from '@/features/claims'
import { parsePageParam, useCanonicalPageParam } from '@/shared/lib/pageParam'

/*
 * 보낸 확인 요청(`/me/claims`)의 쪽 · 문장 — 화면 전용 조각.
 * 쪽은 내가 쓴 글과 같은 규칙(주소 `?page=` 1부터, 1쪽은 주소에 쓰지 않음, 20건 · 번호 다섯 개씩)
 */

export const MY_CLAIMS_PAGE_SIZE = 20
export const MY_CLAIMS_PAGE_GROUP = 5

/** 주소의 쪽(1부터). 고쳐 읽은 값이 주소와 다르면 주소를 바꿔 쓴다(목록 · 내가 쓴 글과 같다) */
export function useMyClaimsPage() {
  const [params] = useSearchParams()
  const page = parsePageParam(params.get('page'))
  useCanonicalPageParam(page)
  const hrefForPage = useCallback((next: number): To => ({ search: next > 1 ? `?page=${next}` : '' }), [])
  return { page, hrefForPage }
}

/**
 * 상태마다 다음 행동 한 줄. 할 일이 없으면(전달 완료) `null`.
 * 대기 중인데 글이 게시중이 아니면(연락중 · 완료) 기다림 · 알림 약속 대신 멈춘 까닭 — 상세의 내 요청과 같은 말(`stalledPendingLine`).
 * 승인된 요청 — 물건을 받는 쪽(습득 글이면 보낸 나, 분실 글이면 글쓴이)에 따라 ‘받았어요’ 단추를 누를 사람이 다르다.
 * 만날 곳은 댓글로 정하라고 권하지 않는다(공개라서, C1) — 안전 경고는 상세 칸이 한다
 */
export function claimNextStep(claim: Pick<MyClaimResponse, 'status' | 'postType' | 'postStatus'>): string | null {
  switch (claim.status) {
    case 'PENDING': {
      const stalled = stalledPendingLine(claim.postStatus)
      if (stalled) return stalled.next ? `${stalled.text} ${stalled.next}` : stalled.text
      return '글쓴이가 승인하거나 거절하면 알림으로 알려 드려요.'
    }
    case 'APPROVED':
      return isReceiver(claim.postType, 'claimant')
        ? '상세의 안내를 보고 만날 곳을 정해 주세요. 물건을 받으면 상세에서 ‘받았어요’ 단추를 눌러 주세요.'
        : '상세의 안내를 보고 만날 곳을 정해 주세요. 글쓴이가 받았다고 누르면 글이 완료돼요.'
    case 'REJECTED':
      return '거절된 글에는 다시 보낼 수 없어요.'
    case 'RECEIVED':
      return null
  }
}

/** 상태가 정해진 때(승인 · 거절은 `decidedAt`, 전달 완료는 `receivedAt`). 대기 중이면 없다 */
export function claimSettledAt(claim: Pick<MyClaimResponse, 'status' | 'decidedAt' | 'receivedAt'>): string | null {
  if (claim.status === 'RECEIVED') return claim.receivedAt ?? claim.decidedAt
  if (claim.status === 'PENDING') return null
  return claim.decidedAt
}

/** 쪽을 넘긴 결과 알림 — 목록의 문장(`pageAnnouncement`)과 같은 꼴, 낱말만 `요청` */
export function claimsPageAnnouncement(page: number, shown: number, total: number): string {
  const from = (page - 1) * MY_CLAIMS_PAGE_SIZE + 1
  const to = from + shown - 1
  const n = (value: number) => value.toLocaleString('ko-KR')
  return `${page}페이지예요. ${n(total)}건 중 ${n(from)}~${n(to)}번째 요청이에요.`
}

/** 상태 표시의 모양 갈래 — 화면이 색이 아니라 아이콘 · 글자 · 채움으로 가른다 */
export const CLAIM_STATUS_TONE: Record<ClaimStatus, 'wait' | 'act' | 'closed' | 'done'> = {
  PENDING: 'wait',
  APPROVED: 'act',
  REJECTED: 'closed',
  RECEIVED: 'done',
}

/** 완료된 글에 남은 대기 요청 — 더 기다릴 것이 없다(서버가 닫기 전까지 화면이 닫는다, C2) */
export function isStalledClosed(claim: Pick<MyClaimResponse, 'status' | 'postStatus'>): boolean {
  return claim.status === 'PENDING' && claim.postStatus === 'DONE'
}

/** 상태 이름 — 완료 글의 남은 대기 요청은 `닫힘`(기다리는 중이 아니다) */
export function claimStatusLabel(claim: Pick<MyClaimResponse, 'status' | 'postStatus'>): string {
  return isStalledClosed(claim) ? '닫힘' : CLAIM_STATUS_LABEL[claim.status]
}

/** 상태 모양 — 닫힌 대기 요청은 거절과 같은 "끝난 칸" 모양 */
export function claimStatusTone(claim: Pick<MyClaimResponse, 'status' | 'postStatus'>): (typeof CLAIM_STATUS_TONE)[ClaimStatus] {
  return isStalledClosed(claim) ? 'closed' : CLAIM_STATUS_TONE[claim.status]
}
