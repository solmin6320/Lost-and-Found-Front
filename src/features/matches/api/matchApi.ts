import { request } from '@/shared/lib/http'

import type { MatchResponse } from './types'

/**
 * `GET /api/posts/{postId}/matches` — **글쓴이만**. 내 글의 추천 후보(분실 글엔 습득 후보, 습득 글엔 분실 후보), 비슷한 순.
 * 실패 code : `FORBIDDEN_ACCESS`(403) · `POST_NOT_FOUND`(404)
 */
export function getMatches(postId: number, signal?: AbortSignal): Promise<MatchResponse[]> {
  return request<MatchResponse[]>(`/api/posts/${postId}/matches`, { signal })
}

/**
 * `PATCH /api/posts/{postId}/matches/{candidatePostId}/dismiss` — 글쓴이만. 204.
 * 그 후보를 **내 쪽에서만** 숨긴다(상대 글의 추천에는 남는다). **되돌리는 API 가 없다.**
 * 실패 code : `MATCH_NOT_FOUND`(404) · `FORBIDDEN_ACCESS`(403) · `POST_NOT_FOUND`(404)
 */
export function dismissMatch(postId: number, candidatePostId: number): Promise<void> {
  return request<void>(`/api/posts/${postId}/matches/${candidatePostId}/dismiss`, { method: 'PATCH' })
}
