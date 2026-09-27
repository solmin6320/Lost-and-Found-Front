/**
 * 백엔드 공통 응답 형태.
 * 원본 : Lost-and-Found `exception/ErrorResponse`, `exception/ErrorCode`, Spring Data `PagedModel`
 */

/**
 * 모든 오류 응답의 본문. `GlobalExceptionHandler` 와 `CustomAuthenticationEntryPoint` 가 이 형태로만 내려준다.
 * `message` 는 화면에 그대로 보여줄 한글 문장이다.
 */
export interface ErrorResponse {
  code: string
  message: string
}

/**
 * 백엔드 `ErrorCode` 이름. 분기는 상태 코드가 아니라 이 값으로 한다(401 이 네 종류다).
 *
 * 도메인 이름이 섞여 있지만 여기에 둔다. 백엔드에서도 전역 목록 하나이고,
 * 도메인별로 쪼개면 새 코드가 생겼을 때 어디에 넣을지 흩어진다.
 */
export type ErrorCode =
  // 회원
  | 'DUPLICATE_EMAIL' // 409
  | 'DUPLICATE_NICKNAME' // 409
  | 'MEMBER_NOT_FOUND' // 404
  | 'PASSWORD_MISMATCH' // 400
  | 'INVALID_CREDENTIALS' // 401
  | 'ACCOUNT_LOCKED' // 423
  // 인증·토큰
  | 'INVALID_ACCESS_TOKEN' // 401
  | 'REFRESH_TOKEN_MISMATCH' // 401
  | 'INVALID_REFRESH_TOKEN' // 401
  // 게시글·댓글
  | 'POST_NOT_FOUND' // 404
  | 'COMMENT_NOT_FOUND' // 404
  | 'FORBIDDEN_ACCESS' // 403 — 남의 글·댓글. `@PreAuthorize` 거부도 이 code 다
  | 'INVALID_STATUS_TRANSITION' // 409 — 완료(DONE)된 글의 상태를 되돌리려 함
  // 이미지
  | 'INVALID_IMAGE_EXTENSION' // 400
  | 'EXCEEDED_IMAGE_COUNT' // 400
  // 공통
  | 'INVALID_INPUT' // 400
  | 'RESOURCE_NOT_FOUND' // 404
  | 'METHOD_NOT_ALLOWED' // 405
  | 'INTERNAL_SERVER_ERROR' // 500

/**
 * 페이지 응답의 `page` 부분.
 * 백엔드가 `spring.data.web.pageable.serialization-mode: via-dto` 라 `Page` 가 이 모양으로 고정된다.
 */
export interface PageMetadata {
  /** 요청한 페이지 크기. 100 을 넘겨 요청하면 100 으로 잘려서 돌아온다 */
  size: number
  /** 현재 페이지 번호. **0부터** 센다 */
  number: number
  totalElements: number
  totalPages: number
}

/** `Page<T>` 를 반환하는 엔드포인트의 응답 */
export interface PagedModel<T> {
  content: T[]
  page: PageMetadata
}
