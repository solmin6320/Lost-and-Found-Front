import { COMMENT_MAX_LENGTH } from '../api/types'

/**
 * 보내기 전 검사 문장 — 프론트가 짓는 문장이라 해요체다(2026-10-03 회의 ⑦). 판정은 서버가 한다.
 * 서버 `CommentRequest` 가 같은 이유로 막으면 서버 문장("댓글 내용은 필수입니다" — 합니다체)이 그대로 온다.
 */
export const COMMENT_MESSAGES = {
  contentRequired: '댓글을 적어 주세요',
  contentLength: '댓글은 300자까지 쓸 수 있어요',
} as const

/** 서버처럼 공백만 있으면 빈 것으로 본다. 길이는 보낼 값 그대로 센다(서버가 자르지 않는다) */
export function checkCommentContent(value: string): string | undefined {
  if (!value.trim()) return COMMENT_MESSAGES.contentRequired
  if (value.length > COMMENT_MAX_LENGTH) return COMMENT_MESSAGES.contentLength
  return undefined
}
