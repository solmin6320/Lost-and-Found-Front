import { request } from '@/shared/lib/http'

import type { PublicMatchResponse } from './publicMatchTypes'

/**
 * `GET /api/posts/{postId}/public-matches` — **글쓴이만**. 내 분실 글과 비슷한 경찰서 · 기관 보관 습득물, 비슷한 순.
 * 습득 글이면 빈 배열. 실패 code : `FORBIDDEN_ACCESS`(403) · `POST_NOT_FOUND`(404)
 */
export function getPublicMatches(postId: number, signal?: AbortSignal): Promise<PublicMatchResponse[]> {
  return request<PublicMatchResponse[]>(`/api/posts/${postId}/public-matches`, { signal })
}

/**
 * `PATCH /api/posts/{postId}/public-matches/{itemId}/dismiss` — 글쓴이만. 204.
 * 그 공공 습득물을 내 글의 후보에서 숨긴다. **되돌리는 API 가 없다.**
 * 실패 code : `PUBLIC_MATCH_NOT_FOUND`(404) · `FORBIDDEN_ACCESS`(403) · `POST_NOT_FOUND`(404)
 */
export function dismissPublicMatch(postId: number, itemId: number): Promise<void> {
  return request<void>(`/api/posts/${postId}/public-matches/${itemId}/dismiss`, { method: 'PATCH' })
}
