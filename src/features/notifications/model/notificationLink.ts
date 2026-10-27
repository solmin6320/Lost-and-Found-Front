import { paths } from '@/app/paths'

import type { NotificationResponse } from '../api/types'

/**
 * 상세의 확인 요청 칸 조각. 상세가 이 조각을 받으면 그 칸(받은 요청 묶음 · 내 요청)으로 스크롤한다(SCR-12).
 * 알림 줄은 로그인 리다이렉트를 거치지 않으므로 `safeRedirectPath` 의 허용 조각(`#comments`)과 무관하다
 */
export const POST_CLAIMS_HASH = '#claims'

/**
 * 알림 줄을 누르면 가는 곳 — 종류마다 다음 행동이 있는 자리(화면정의서 SCR-10 "누르면").
 *
 * - `CLAIM_REQUESTED` (글쓴이가 받음) → 그 글 상세의 받은 요청 묶음(`#claims`)
 * - `CLAIM_APPROVED` (요청자가 받음) → 그 글 상세의 내 요청 칸(`#claims`) — 채팅이 생기면 그 방으로
 * - `CLAIM_REJECTED` (요청자가 받음) → 보낸 확인 요청(`/me/claims`) — 거절된 글에는 할 일이 없다. 글이 지워졌어도 간다
 * - 그 밖 → 그 글 상세. 글이 없는 알림은 링크가 아니다(`null`)
 */
export function notificationHref(n: Pick<NotificationResponse, 'type' | 'postId'>): string | null {
  if (n.type === 'CLAIM_REJECTED') return paths.myClaims
  if (n.postId === null) return null
  if (n.type === 'CLAIM_REQUESTED' || n.type === 'CLAIM_APPROVED') {
    return `${paths.postDetail(n.postId)}${POST_CLAIMS_HASH}`
  }
  return paths.postDetail(n.postId)
}
