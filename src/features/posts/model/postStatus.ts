import { POST_STATUSES, type PostStatus } from '../api/types'

/**
 * [4.6] 상태 전이 규칙. 원본 : 백엔드 `entity/Post.changeStatus`
 *
 * - `DONE` 은 최종 상태다. 다른 상태로 보내면 409 `INVALID_STATUS_TRANSITION`
 * - 그 밖에는 어느 방향이든 된다. `OPEN → DONE` 처럼 연락중을 건너뛰어도 되고,
 *   `IN_PROGRESS → OPEN` 으로 되돌려도 된다
 * - 같은 상태로 보내면 서버가 아무것도 하지 않고 200 을 준다. 화면은 지금 상태를 선택지에서 뺀다
 *
 * 화면에서 선택지를 거르는 것은 UX 다. 판정은 서버가 한다.
 */
export function canChangeStatus(current: PostStatus): boolean {
  return current !== 'DONE'
}

/** 지금 상태에서 고를 수 있는 다음 상태. `DONE` 이면 빈 배열 */
export function nextPostStatuses(current: PostStatus): PostStatus[] {
  if (!canChangeStatus(current)) {
    return []
  }
  return POST_STATUSES.filter((status) => status !== current)
}

/** 되돌릴 수 없는 변경인지. 참이면 화면이 확인을 한 번 더 받는다 */
export function isIrreversibleStatus(next: PostStatus): boolean {
  return next === 'DONE'
}
