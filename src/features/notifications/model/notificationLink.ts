import { paths, POST_CLAIMS_HASH, POST_MATCHES_HASH, POST_PUBLIC_MATCHES_HASH } from '@/app/paths'

import type { NotificationResponse } from '../api/types'

/** 상세의 확인 요청 칸 조각(`app/paths`). 상세가 이 조각을 받으면 그 칸(받은 요청 묶음 · 내 요청)으로 데려간다(SCR-12) */
export { POST_CLAIMS_HASH, POST_MATCHES_HASH, POST_PUBLIC_MATCHES_HASH }

/**
 * 알림 줄을 누르면 가는 곳 — 종류마다 다음 행동이 있는 자리(화면정의서 SCR-10 "누르면").
 *
 * - `CLAIM_REQUESTED` (글쓴이가 받음) → 그 글 상세의 받은 요청 묶음(`#claims`)
 * - `CLAIM_APPROVED` (요청자가 받음) → 그 글 상세의 내 요청 칸(`#claims`) — 채팅이 생기면 그 방으로
 * - `CLAIM_REJECTED` (요청자가 받음) → 보낸 확인 요청(`/me/claims`) — 거절된 글에는 할 일이 없다. 글이 지워졌어도 간다
 * - `MATCH_SUGGESTED` (내 글에 비슷한 글이 올라옴 — `postId` 는 **받는 사람의 글**) → 그 글 상세의 추천 후보 묶음(`#matches`, SCR-11)
 * - `PUBLIC_MATCH_SUGGESTED` (경찰서 · 기관에 비슷한 물건이 맡겨짐 — `postId` 는 받는 사람의 **분실 글**) → 그 글 상세의 공공 후보 묶음(`#public-matches`)
 * - 그 밖 → 그 글 상세. 글이 없는 알림은 링크가 아니다(`null`)
 */
export function notificationHref(n: Pick<NotificationResponse, 'type' | 'postId'>): string | null {
  if (n.type === 'CLAIM_REJECTED') return paths.myClaims
  if (n.postId === null) return null
  if (n.type === 'CLAIM_REQUESTED' || n.type === 'CLAIM_APPROVED') {
    return `${paths.postDetail(n.postId)}${POST_CLAIMS_HASH}`
  }
  if (n.type === 'MATCH_SUGGESTED') return `${paths.postDetail(n.postId)}${POST_MATCHES_HASH}`
  // 경찰서 · 기관 보관 후보 — `postId` 는 받는 사람의 분실 글(`PublicMatchService.saveAndAlert` 가 `lost.getId()` 를 싣는다)
  if (n.type === 'PUBLIC_MATCH_SUGGESTED') return `${paths.postDetail(n.postId)}${POST_PUBLIC_MATCHES_HASH}`
  return paths.postDetail(n.postId)
}
