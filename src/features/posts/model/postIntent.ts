import type { PostType } from '../api/types'

/**
 * 첫 화면의 두 칸 — `잃어버린 물건`(분실 글) / `주운 물건`(습득 글).
 *
 * **칸 이름 = 그 칸이 보여 주는 글의 종류**(본인 결정 2026-10-07). 칸 하나가 맡는 것은 글 한 종류뿐이다.
 *   분실 색(마리골드) `잃어버린 물건` : 분실(LOST) 글을 보고, 분실 글을 올린다
 *   습득 색(코발트)   `주운 물건`     : 습득(FOUND) 글을 보고, 습득 글을 올린다
 * 예전에는 "잃어버렸어요 → 습득 글을 보여 준다"처럼 고르는 말과 보여 주는 글이 엇갈렸다. 주황 칸을 눌렀는데 파란 이름표의 글이
 * 나와 헷갈린다는 본인 피드백으로 걷어 냈다. 이제 칸의 색 · 이름, 결과 카드의 이름표, 올리는 글의 유형이 모두 한 갈래다.
 *
 * 같은 묶음은 같은 뿌리의 말로 부른다(RV-9). 칸 아래 한 줄은 카드 위 이름표와 같은 말(`분실 글` · `습득 글`)이라
 * 칸에서 본 말을 카드에서 그대로 다시 만난다. 같은 일을 하는 입구는 어디서나 같은 이름(`분실 글 올리기`)이다.
 */
export interface PostIntent {
  /** 이 칸이 맡는 글의 유형. 목록에 거는 `type` · 칸의 색 · "올리기"의 유형이 모두 이것이다 */
  concept: PostType
  /** 칸 이름. 좁은 칸에서는 두 줄로 끊는다 */
  label: readonly [string, string]
  /** 칸 아래 한 줄의 앞부분 — 카드 이름표와 같은 말. 뒤에 "12건 보기"가 붙는다 */
  sees: string
  /** 이 칸을 골랐을 때 결과 제목. 칸 이름과 같다 */
  heading: string
  /** 결과 끝의 다음 행동 — 같은 종류의 내 글을 올려 두게 한다 */
  next: { title: string; description: string; action: string }
  /** 이 칸만 골랐는데(검색어 · 필터 없음) 글이 하나도 없을 때 */
  empty: { title: string; description: string }
  /** 결과 제목 줄 아래 한 줄 — 칸을 고른 순간의 글쓰기 입구. 링크 글자는 `next.action` 과 같다 */
  write: { lead: string }
}

const LOST_POSTS: PostIntent = {
  concept: 'LOST',
  label: ['잃어버린', '물건'],
  sees: '분실 글',
  heading: '잃어버린 물건',
  next: {
    title: '잃어버린 물건이 있나요?',
    description: '분실 글을 올려 두면 주운 사람이 보고 댓글로 알려 줄 수 있어요.',
    action: '분실 글 올리기',
  },
  empty: {
    title: '진행 중인 분실 글이 없어요.',
    description: '물건을 잃어버렸다면 분실 글을 올려 두세요. 주운 사람이 보고 댓글로 알려 줄 수 있어요.',
  },
  write: { lead: '물건을 잃어버렸다면' },
}

const FOUND_POSTS: PostIntent = {
  concept: 'FOUND',
  label: ['주운', '물건'],
  sees: '습득 글',
  heading: '주운 물건',
  next: {
    title: '주운 물건이 있나요?',
    // 잃어버린 사람은 무엇을 "알려 주는" 쪽이 아니라 내 물건이라고 연락하는 쪽이다(분실 글은 주운 사람이 "알려 준다")
    description: '습득 글을 올려 두면 잃어버린 사람이 보고 댓글로 연락할 수 있어요.',
    action: '습득 글 올리기',
  },
  empty: {
    title: '진행 중인 습득 글이 없어요.',
    description: '물건을 주웠다면 습득 글을 올려 두세요. 잃어버린 사람이 보고 댓글로 연락할 수 있어요.',
  },
  write: { lead: '물건을 주웠다면' },
}

/** 화면 순서 그대로. 분실이 앞이다(이름표 안내 · 등록 화면의 순서와 같다) */
export const POST_INTENTS: readonly PostIntent[] = [LOST_POSTS, FOUND_POSTS]

/** 목록에 걸린 `type` → 그 종류의 칸. 유형이 없으면(전체) `undefined` */
export function intentShowing(type: PostType | undefined): PostIntent | undefined {
  return POST_INTENTS.find((intent) => intent.concept === type)
}

/**
 * 칸 아래 한 줄의 뒷부분. 고른 쪽은 "보기"가 "보는 중"으로 바뀐다 — 지금 무엇이 걸려 있는지 칸 자신이 말한다.
 *   숫자      → "12건 보기"
 *   undefined → "모두 보기"   건수를 모른다(불러오는 중 · 실패)
 *   null      → "보기"        검색어 · 필터가 걸려 있다. 종류 전체 건수는 지금 목록 수와 달라 헷갈리므로 뺀다
 */
export function intentHintTail(count: number | null | undefined, active: boolean): string {
  const verb = active ? '보는 중' : '보기'
  if (count === null) return verb
  const amount = count === undefined ? '모두' : `${count.toLocaleString('ko-KR')}건`
  return `${amount} ${verb}`
}

/**
 * 칸을 고르지 않았을 때의 등록 권유(빈 결과 자리). 색 면이 아니라 옅은 면 + 잉크 버튼 — 올릴 글의 유형을 아직 모른다
 */
export const ANY_INTENT_NEXT = {
  title: '찾는 물건이 없나요?',
  description: '잃어버렸거나 주운 물건을 올려 두면 본 사람이 댓글로 알려 줘요.',
  action: '글 올리기',
} as const

/** 칸을 고르지 않았고 아무 조건 없이 글이 없을 때. 기본 목록은 진행 중인 글만이라 "진행 중인"이라고 말한다 */
export const ANY_INTENT_EMPTY = {
  title: '진행 중인 글이 없어요.',
  description: '잃어버렸거나 주운 물건을 올려 보세요.',
} as const

/** 유형을 걸지 않은 목록의 제목 */
export const ALL_POSTS_HEADING = '최근 올라온 물건'

/**
 * 새 검색어로 분실 · 습득을 함께 찾은 목록의 제목. **검색어를 제목에 넣지 않는다**(주소로 남의 화면에 문장을 심는 통로 —
 * 검색칸에 이미 보인다)
 */
export const SEARCH_RESULTS_HEADING = '검색 결과'

/** 결과 제목(탭 제목도 이것을 따른다). 종류를 골랐으면 칸 이름, 검색어만 있으면 "검색 결과" */
export function postListHeading(type: PostType | undefined, keyword = ''): string {
  return intentShowing(type)?.heading ?? (keyword ? SEARCH_RESULTS_HEADING : ALL_POSTS_HEADING)
}
