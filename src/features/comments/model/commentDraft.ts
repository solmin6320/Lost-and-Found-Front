/*
 * 쓰던 댓글의 임시 보관 — 로그인이 끊겨도 쓰던 글자를 잃지 않는다(등록 · 수정의 `postForm` 보관과 같은 규칙).
 *
 * 댓글을 쓰는 도중 재발급이 거절되면(다른 기기에서 비밀번호를 바꿈 · 리프레시 토큰 만료) 로그인해야 한다.
 * 그때 **글자만** 이 탭의 sessionStorage 에 잠시 넣어 두고, 로그인하고 이 글로 돌아오면 이어서 쓸지 묻는다.
 *
 * - 토큰이 아니라 사용자가 쓴 글이다(보안명세서 3장의 금지 대상이 아니다). 그래도 오래 두지 않는다 —
 *   탭을 닫으면 사라지고(sessionStorage), 6시간이 지나면 버리고, 이어 쓰기를 고르든 버리든 바로 지운다
 * - **같은 회원에게만** 묻는다. 공용 기기에서 다른 사람이 로그인하면 보이지 않는다(지우지도 않는다)
 * - 글마다 하나다(`comment-draft:v1:{postId}`). 다른 글의 댓글 칸에는 나오지 않는다
 * - **직접 로그아웃하면 지운다**(공용 기기 — `shared/lib/writeDrafts`). 세션 만료 때는 남긴다 — 이어 쓰려고 두는 것이다
 */

import type { LeaveCopy } from '@/shared/lib/dirtyRegistry'
import { COMMENT_DRAFT_PREFIX as PREFIX } from '@/shared/lib/writeDrafts'

const MAX_AGE_MS = 6 * 60 * 60 * 1000

export interface CommentDraft {
  memberId: number
  postId: number
  savedAt: number
  content: string
}

/** 보관했으면 `true`. 저장소가 막힌 브라우저면 `false` — 로그인 화면이 "이어서 쓸 수 있다"고 말하지 않는다 */
export function saveCommentDraft(draft: CommentDraft): boolean {
  try {
    window.sessionStorage.setItem(PREFIX + draft.postId, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function loadCommentDraft(postId: number, memberId: number, now = Date.now()): CommentDraft | null {
  let raw: string | null = null
  try {
    raw = window.sessionStorage.getItem(PREFIX + postId)
  } catch {
    return null
  }
  if (!raw) return null

  const draft = parse(raw)
  if (!draft || draft.postId !== postId || now - draft.savedAt > MAX_AGE_MS || !draft.content.trim()) {
    clearCommentDraft(postId)
    return null
  }
  return draft.memberId === memberId ? draft : null
}

export function clearCommentDraft(postId: number): void {
  try {
    window.sessionStorage.removeItem(PREFIX + postId)
  } catch {
    // 막힌 저장소에는 애초에 없다
  }
}

/** 저장소 값은 누구나 고칠 수 있다. 모양이 맞을 때만 쓴다 */
function parse(raw: string): CommentDraft | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (
      typeof data.memberId !== 'number' ||
      typeof data.postId !== 'number' ||
      typeof data.savedAt !== 'number' ||
      typeof data.content !== 'string'
    ) {
      return null
    }
    return { memberId: data.memberId, postId: data.postId, savedAt: data.savedAt, content: data.content }
  } catch {
    return null
  }
}

/** 쓰던 댓글이 있을 때 이탈 확인 문장 — 쓰던 칸 등록부에 칸이 건넨다(렌더마다 새로 만들지 않게 상수) */
export const COMMENT_LEAVE_COPY: LeaveCopy = {
  title: '쓰던 댓글을 두고 나갈까요?',
  body: '나가면 쓰던 댓글은 저장되지 않아요.',
}
