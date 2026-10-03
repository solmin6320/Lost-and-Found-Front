import type { PostDetailResponse } from '@/features/posts'

import { usePostComments } from './commentQueries'

/** 상세의 댓글 제목 id — 로그인하고 `#comments` 로 돌아오면 여기에 포커스가 온다(①-b) */
export const COMMENTS_HEADING_ID = 'comments'

/** 댓글 쓰기 입구가 데려가는 일. 입구는 여러 곳(배지 줄 · 댓글 제목 옆 · 휴대폰 하단 줄)이고 하는 일은 하나다 */
export interface CommentEntryHandle {
  /**
   * 쓰는 칸으로 데려간다. **누른 그 이벤트 안에서** 부른다 — 휴대폰은 사용자 동작 안에서 `focus()` 해야 키보드를 띄운다.
   * 로그인했으면 입력칸, 아니면 로그인 권유 칸의 [로그인]
   */
  open: () => void
}

/**
 * 댓글 수 — 제목 `댓글 N` · 입구 · 하단 줄이 **같은 값**을 읽는다.
 * 상세의 `totalCommentCount` 를 따로 읽으면 1분 뒤 댓글을 다시 받는 사이 둘이 잠깐 달라진다(같은 캐시라 요청은 늘지 않는다)
 */
export function useCommentTotal(post: PostDetailResponse): number {
  const thread = usePostComments(post.id, post)
  return thread.data?.totalCount ?? post.totalCommentCount
}
