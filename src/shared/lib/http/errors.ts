import type { ErrorCode, ErrorResponse } from '@/shared/types/api'

/**
 * 서버 응답을 못 받았을 때 화면에 쓰는 유일한 문장(화면정의서 1.3).
 * 서버 오류에 프론트가 직접 짓는 문구는 이것뿐이다. 나머지는 서버 `message` 를 그대로 쓴다.
 * (보내기 전에 브라우저가 멈춘 실패는 `ClientValidationError` 가 제 문장을 가진다)
 */
export const CONNECTION_FAILED_MESSAGE =
  '연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'

/**
 * 응답은 왔지만 우리 백엔드의 `ErrorResponse` 형식이 아닐 때의 code.
 * 백엔드가 꺼져 개발 프록시가 빈 500 을 줄 때, 게이트웨이가 HTML 502 를 줄 때,
 * 성공 응답인데 JSON 이 아닐 때(index.html 이 대신 온 경우) 이 값이 된다.
 */
export const UNEXPECTED_RESPONSE = 'UNEXPECTED_RESPONSE'

/**
 * 서버가 응답한 실패. `status` 가 있으므로 queryClient 가 4xx 는 재시도하지 않는다.
 * `message` 는 화면에 그대로 보여줄 수 있는 문장이다.
 */
export class ApiError extends Error {
  readonly status: number
  /** 백엔드 `ErrorCode` 이름. 형식 밖의 응답이면 `UNEXPECTED_RESPONSE` */
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/**
 * 응답 자체를 못 받았다(네트워크 끊김, 서버 미기동, CORS 거부).
 * 일부러 `status` 를 두지 않는다 — queryClient 가 이것을 보고 재시도 대상으로 판정한다.
 */
export class NetworkError extends Error {
  constructor(options?: { cause?: unknown }) {
    super(CONNECTION_FAILED_MESSAGE, options)
    this.name = 'NetworkError'
  }
}

/**
 * 요청을 보내기 **전에** 브라우저에서 멈춘 실패(사진을 읽지 못함, 줄여도 한도를 넘음 등).
 * 서버에는 아무것도 가지 않았다. `message` 는 화면에 그대로 보여줄 문장이다.
 *
 * `status` 를 두지 않지만 쓰기(mutation)는 재시도가 0 이라 다시 보내지지 않는다.
 * `code` 는 서버 `ErrorCode` 와 겹치지 않는 이름을 쓴다(같은 뜻이면 서버 이름을 그대로 쓴다).
 */
export class ClientValidationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ClientValidationError'
    this.code = code
  }
}

export function isErrorResponse(body: unknown): body is ErrorResponse {
  if (typeof body !== 'object' || body === null) {
    return false
  }
  const { code, message } = body as Record<string, unknown>
  return typeof code === 'string' && typeof message === 'string'
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** `code` 로 분기할 때 쓴다. 오타는 `ErrorCode` 타입이 잡는다 */
export function hasErrorCode(error: unknown, code: ErrorCode): error is ApiError {
  return error instanceof ApiError && error.code === code
}

/**
 * 화면에 띄울 문장. 서버 `message`(또는 `ClientValidationError` 의 문장)가 있으면 그것을,
 * 없으면 연결 실패 문장을 준다.
 * 스택트레이스나 예외 원문을 화면에 내보내지 않기 위해 모든 오류 표시는 이 함수를 거친다.
 */
export function getErrorMessage(error: unknown): string {
  if (
    error instanceof ApiError ||
    error instanceof NetworkError ||
    error instanceof ClientValidationError
  ) {
    return error.message
  }
  return CONNECTION_FAILED_MESSAGE
}
