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
  // 역할 · 관리자(7.4) — 매니저 임명 · 해임 `POST · DELETE /api/admin/managers/{memberId}`
  | 'ACCESS_DENIED' // 403 — 역할이 모자람(`@PreAuthorize("hasRole('ADMIN')")` 거부). 관리자 화면은 권한 없음 면으로 간다
  | 'ALREADY_MANAGER' // 409 — 이미 매니저인 회원을 임명
  | 'NOT_MANAGER' // 409 — 매니저가 아닌 회원을 해임
  | 'ADMIN_ROLE_LOCKED' // 409 — 관리자의 역할은 바꿀 수 없음(서버 환경변수 `ADMIN_EMAILS` 로만)
  // 이미지 — 크기 한도(장당 10MB · 요청 60MB) 초과는 전용 code 가 **없다**.
  // 413 이 아니라 전역 처리기의 500 `INTERNAL_SERVER_ERROR` 로 오거나, 연결이 끊겨 응답 자체가 없다.
  // 그래서 크기는 보내기 전에 막는다(`features/posts` 의 `preparePostImages`)
  | 'INVALID_IMAGE_EXTENSION' // 400 — 파일 이름의 확장자가 jpg · jpeg · png · gif 가 아님(이름에 `.` 이 없어도)
  | 'EXCEEDED_IMAGE_COUNT' // 400 — 빈 파트를 뺀 사진이 5장 초과
  // 알림
  | 'NOTIFICATION_NOT_FOUND' // 404 — 없는 알림 · 남의 알림을 읽음으로 바꾸려 함
  // 주인 확인 요청([4.7] [4.8])
  | 'CLAIM_NOT_FOUND' // 404 — 없는 요청
  | 'CLAIM_OWN_POST' // 400 — 내 글에 요청
  | 'CLAIM_NOT_ACCEPTING' // 409 — 게시중이 아닌 글에 요청 · 승인
  | 'DUPLICATE_CLAIM' // 409 — 이 글에 이미 요청을 보냄(거절돼도 다시 못 보낸다)
  | 'INVALID_CLAIM_STATUS' // 409 — 지금 요청 상태에서 할 수 없는 동작(그사이 바뀜)
  | 'CLAIM_IN_PROGRESS' // 409 — 승인된 요청이 있어 글 상태를 직접 바꿀 수 없음
  // 자동 매칭(7.6 ②)
  | 'MATCH_NOT_FOUND' // 404 — 없는 후보 쌍을 숨기려 함
  // 공공 습득물 자동 대조(7.6 ②-1)
  | 'PUBLIC_MATCH_NOT_FOUND' // 404 — 없는 공공 후보를 숨기려 함(30일 지나 지워짐 · 다른 탭에서 숨김)
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
