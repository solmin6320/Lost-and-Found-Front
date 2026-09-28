/**
 * 쓰던 글 · 댓글의 임시 보관 키(sessionStorage). 보안명세서 3장 표의 두 줄이다.
 *
 * 보관은 **로그인이 끊겨도 쓰던 글자를 잃지 않게** 하려는 것이다(세션 만료 → 로그인 → 이어 쓰기).
 * 그래서 세션 만료 때는 지우지 않는다. 대신 **직접 로그아웃하면** 모두 지운다 —
 * 공용 기기에서 로그아웃하고 자리를 뜬 뒤 다음 사람이 개발자 도구로 이전 사람이 쓰던 글을 읽지 못하게.
 * (같은 회원에게만 되살려 주는 검사는 화면 쪽 이야기다. 저장소에 남은 글자는 누구나 읽는다)
 *
 * 글 쪽(`features/posts`)과 댓글 쪽(`features/comments`)이 이 접두사를 가져다 쓰고, 로그아웃(`features/auth`)이
 * `clearWriteDrafts()` 를 부른다. 서로를 import 하지 않게 여기 둔다.
 */
export const POST_DRAFT_PREFIX = 'post-draft:v1:'
export const COMMENT_DRAFT_PREFIX = 'comment-draft:v1:'

const PREFIXES = [POST_DRAFT_PREFIX, COMMENT_DRAFT_PREFIX] as const

type DraftStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>

/** 이 탭의 쓰던 글 · 댓글 보관을 모두 지운다. 다른 키(화면 모드 · 스크롤)는 건드리지 않는다. 던지지 않는다 */
export function clearWriteDrafts(storage?: DraftStorage): void {
  try {
    const target = storage ?? window.sessionStorage
    const keys: string[] = []
    for (let i = 0; i < target.length; i += 1) {
      const key = target.key(i)
      if (key && PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key)
    }
    // 돌면서 지우면 번호가 밀린다. 모은 뒤 지운다
    for (const key of keys) target.removeItem(key)
  } catch {
    // 저장소가 막힌 브라우저에는 애초에 없다
  }
}
