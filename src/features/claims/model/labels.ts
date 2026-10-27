import type { PostType } from '@/features/posts'

import type { ClaimStatus } from '../api/types'

/** 요청 상태 이름 — 보낸 사람 쪽 말 */
export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  PENDING: '답을 기다리는 중',
  APPROVED: '승인됨',
  REJECTED: '거절됨',
  RECEIVED: '전달 완료',
}

/**
 * 요청을 여는 단추 이름 — 습득 글엔 주인이 `내 물건이에요`, 분실 글엔 주운 사람이 `제가 주웠어요`
 */
export function claimEntryLabel(type: PostType): string {
  return type === 'FOUND' ? '내 물건이에요' : '제가 주웠어요'
}

/**
 * 물건을 받는 쪽인가(서버 `Claim.receiverId`) — 습득 글은 요청자, 분실 글은 글쓴이. [받았어요]는 이쪽에만 그린다
 */
export function isReceiver(type: PostType, side: 'author' | 'claimant'): boolean {
  return type === 'FOUND' ? side === 'claimant' : side === 'author'
}

/** 되돌릴 수 없는 동작의 결과 문장(화면정의서 SCR-12 ⑤) */
export const CLAIM_CONSEQUENCE = {
  send: '한 글에 한 번만 보낼 수 있고, 거절돼도 다시 보낼 수 없어요.',
  approve: '승인하면 글이 연락중으로 바뀌고, 다른 요청은 기다리게 돼요.',
  reject: '거절하면 이 분은 이 글에 다시 요청할 수 없어요.',
  cancel: '승인을 취소하면 글이 다시 게시중이 되고, 이 분은 다시 요청할 수 없어요.',
  receive: '받았다고 하면 글이 완료되고 주인 확인 완료로 남아요. 되돌릴 수 없어요.',
} as const
