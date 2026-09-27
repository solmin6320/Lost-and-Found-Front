/**
 * URL 의 `:postId` 를 숫자 id 로 좁힌다. 형식이 틀리면 `null`.
 *
 * 그대로 보내면 백엔드가 400 `INVALID_INPUT` 을 준다. 화면 입장에서는 "없는 글"과 같으므로
 * 요청하지 않고 바로 없는 글로 보여준다.
 * `"012"` · `"1e3"` · `"1.0"` 처럼 `Number()` 는 받아 주지만 주소로는 이상한 값도 거른다.
 */
export function toPostId(raw: string | undefined): number | null {
  if (raw === undefined || !/^[1-9]\d{0,15}$/.test(raw)) {
    return null
  }
  const id = Number(raw)
  return Number.isSafeInteger(id) ? id : null
}
