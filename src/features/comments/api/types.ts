/**
 * 댓글 요청·응답 타입.
 * 원본 : Lost-and-Found `dto/response/CommentResponse`, `dto/request/CommentRequest`,
 *        `service/CommentService`(페이지 크기)
 */

/** 댓글 한 건. 게시글 상세의 `comments` 와 `GET /api/posts/{id}/comments` 의 항목이 같은 모양이다 */
export interface CommentResponse {
  id: number
  /** 작성자 회원 id. 본인 판정은 이것으로 한다(`memberId === me.id`) */
  memberId: number
  nickname: string
  /** 사용자 입력 — 텍스트로만 렌더링한다 */
  content: string
  /** `LocalDateTime` — 시간대 오프셋이 없다 */
  createdAt: string
  /** 수정 전에는 `null`. 값이 있으면 "수정됨" 표시 근거가 된다 */
  updatedAt: string | null
}

/**
 * [5.1] 등록 · 수정 공용 본문(JSON).
 * 백엔드 검증 : `@NotBlank`(공백만 있어도 거절) · `@Size(max = 300)`. 서버는 앞뒤 공백을 자르지 않는다.
 */
export interface CommentRequest {
  content: string
}

/** 댓글 최대 길이. 서버 `@Size` 는 Java `String.length()`(UTF-16) 로 세고, JS `.length` 와 같다 */
export const COMMENT_MAX_LENGTH = 300

/**
 * 댓글 한 페이지 크기. **서버가 20 으로 고정**한다(`CommentService.PAGE_SIZE`). `size` 를 보내도 무시된다.
 * 상세 응답의 미리보기(`COMMENT_PREVIEW_SIZE`)도 20 이라, 상세의 `comments` 가 곧 댓글 0 페이지다
 */
export const COMMENT_PAGE_SIZE = 20
