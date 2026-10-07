import type { PostCategory, PostStatus, PostType } from '../api/types'

/**
 * 서버 Enum → 화면 표기(화면정의서 1.1). 화면에는 Enum 이름을 그대로 쓰지 않는다.
 * `Record` 로 둬서 백엔드 Enum 이 늘면 여기서 타입 오류가 난다.
 */

export const POST_TYPE_LABEL: Record<PostType, string> = {
  LOST: '분실',
  FOUND: '습득',
}

export const POST_CATEGORY_LABEL: Record<PostCategory, string> = {
  WALLET: '지갑',
  ELECTRONICS: '전자기기',
  CARD: '카드',
  CLOTHES: '의류',
  ETC: '기타',
}

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  OPEN: '게시중',
  IN_PROGRESS: '연락중',
  DONE: '완료',
}

/**
 * 이름표가 뜻하는 것 — 사용자가 직접 여는 설명(목록의 `이름표 안내`, 필터 시트의 상태 도움말)에 쓴다.
 * 없는 기능(쪽지 · 소유 확인)을 약속하지 않는다.
 * 유형은 첫 화면 두 칸의 이름(`잃어버린 물건` · `주운 물건`)과 같은 말로 시작한다 — 칸에서 본 말을 이름표 설명에서 다시 만난다
 * (본인 결정 2026-10-07 : 칸 이름 = 그 칸이 보여 주는 글의 종류)
 */
export const POST_TYPE_MEANING: Record<PostType, string> = {
  LOST: '잃어버린 물건을 주인이 찾는 글이에요',
  FOUND: '주운 물건의 주인을 찾는 글이에요',
}

export const POST_STATUS_MEANING: Record<PostStatus, string> = {
  OPEN: '아직 주인을 찾고 있어요',
  IN_PROGRESS: '주인으로 보이는 사람과 이야기하고 있어요',
  DONE: '주인에게 돌아간 물건이에요',
}

/**
 * `lostFoundDate` 의 라벨. 등록일(`createdAt`)과 헷갈리지 않게 유형을 붙인다 — "분실일", "습득일"
 */
export function lostFoundDateLabel(type: PostType): string {
  return `${POST_TYPE_LABEL[type]}일`
}
