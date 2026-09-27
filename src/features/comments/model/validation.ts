import { COMMENT_MAX_LENGTH } from '../api/types'

/** 문구는 서버 `CommentRequest` 의 검증 메시지와 **같은 문장**이다. 판정은 서버가 한다 */
export const COMMENT_MESSAGES = {
  contentRequired: '댓글 내용은 필수입니다',
  contentLength: '댓글은 300자를 초과할 수 없습니다',
} as const

/** 서버처럼 공백만 있으면 빈 것으로 본다. 길이는 보낼 값 그대로 센다(서버가 자르지 않는다) */
export function checkCommentContent(value: string): string | undefined {
  if (!value.trim()) return COMMENT_MESSAGES.contentRequired
  if (value.length > COMMENT_MAX_LENGTH) return COMMENT_MESSAGES.contentLength
  return undefined
}
