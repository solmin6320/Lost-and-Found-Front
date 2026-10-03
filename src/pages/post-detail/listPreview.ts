import type { QueryClient } from '@tanstack/react-query'

import { postKeys, type PostListResponse } from '@/features/posts'

/** 목록 캐시가 이보다 오래됐으면 쓰지 않는다 — 상세의 신선도(1분)와 같다. 그 사이 지워지거나 고친 글의 옛 제목 · 사진을 크게 띄우지 않게 */
const PREVIEW_MAX_AGE_MS = 60_000

/** 목록 응답 한 장(`{ content }`) 또는 이어 붙인 여러 장(`{ pages: [{ content }] }`)에서 카드들을 꺼낸다 */
function itemsOf(data: unknown): PostListResponse[] {
  if (typeof data !== 'object' || data === null) return []
  const { content, pages } = data as { content?: unknown; pages?: unknown }
  if (Array.isArray(content)) return content as PostListResponse[]
  if (Array.isArray(pages)) return pages.flatMap(itemsOf)
  return []
}

/**
 * 상세를 받는 동안 먼저 그릴 머리(API-3) — 방금 누른 카드가 목록 캐시에 있다. **요청을 더 보내지 않는다.**
 *
 * 목록에는 본문 · 작성자 id · 사진 전체 · 댓글이 없다. 그래서 가짜 상세를 만들지 않고(`placeholderData` 금지 — 내 글 판정과
 * 댓글 초기값이 틀린다) 제목 · 이름표 · 첫 사진만 스켈레톤에 얹는다. 지운 뒤 아직 다시 받지 않은 목록(무효화됨)은 건너뛴다.
 * 내가 쓴 글 목록도 `lists()` 아래라 같이 찾는다
 */
export function findListPreview(queryClient: QueryClient, postId: number): PostListResponse | null {
  const now = Date.now()
  for (const query of queryClient.getQueryCache().findAll({ queryKey: postKeys.lists() })) {
    if (query.state.isInvalidated || now - query.state.dataUpdatedAt > PREVIEW_MAX_AGE_MS) continue
    const item = itemsOf(query.state.data).find((post) => post.id === postId)
    if (item) return item
  }
  return null
}
