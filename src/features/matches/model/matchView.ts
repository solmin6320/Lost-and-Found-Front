import type { PostDetailResponse, PostType } from '@/features/posts'

import type { MatchResponse } from '../api/types'

/** 상세의 추천 묶음 자리 id — 알림(`MATCH_SUGGESTED`)이 `#matches` 로 데려온다 */
export const MATCHES_ANCHOR_ID = 'matches'

/**
 * 추천 묶음을 그리는가 — **글쓴이 · 게시중 글만**(화면정의서 SCR-11 권한).
 * 연락중 · 완료 글은 이미 진행 중이라 묶음이 없다. 남의 글 · 비로그인은 부른 쪽이 `isOwner` 로 막는다
 */
export function showsMatches(post: Pick<PostDetailResponse, 'status'>, isOwner: boolean): boolean {
  return isOwner && post.status === 'OPEN'
}

/**
 * 묶음 제목 — 내 글의 반대쪽 이름. **글 제목을 문장에 끼우지 않는다**(조사 문제, QA-D-L16 · P-L20).
 * 분실 글(내 물건을 찾는다) → 비슷한 습득 글 / 습득 글(주인을 찾는다) → 이 물건을 찾는 분실 글
 */
export function matchesHeading(myType: PostType): string {
  return myType === 'LOST' ? '이 물건과 비슷한 습득 글' : '이 물건을 찾는 분실 글'
}

/** 후보가 있을 때 제목 아래 한 줄 — 다음 행동. 상대 글의 확인 요청 단추 이름(`claimEntryLabel(상대 유형)`)과 같은 말 */
export function matchesLead(myType: PostType): string {
  return myType === 'LOST'
    ? '글을 열어 보고 내 물건이 맞으면 ‘내 물건이에요’로 알려 주세요.'
    : '글을 열어 보고 주운 물건이 맞으면 ‘제가 주웠어요’로 알려 주세요.'
}

/** 후보가 하나도 없을 때(한 줄 높이로 접는다) */
export function matchesEmpty(myType: PostType): { title: string; description: string } {
  return {
    title: myType === 'LOST' ? '아직 비슷한 습득 글이 없어요.' : '아직 이 물건을 찾는 분실 글이 없어요.',
    description: '비슷한 글이 올라오면 알림으로 알려 드려요.',
  }
}

/** 숨기기 단추 — 분실 글 쪽은 `내 물건 아니에요`(확정안), 습득 글 쪽은 내 물건이 아니라 `다른 물건이에요` */
export function dismissLabel(myType: PostType): string {
  return myType === 'LOST' ? '내 물건 아니에요' : '다른 물건이에요'
}

/** 숨기기 확인 창 — 되돌리는 API 가 없다(화면정의서 1.6 "되돌릴 수 없음 → 확인 창") */
export const DISMISS_DIALOG = {
  title: '이 글을 추천에서 숨길까요?',
  /** 앞에 `「제목」` 이 붙는다 — 제목 뒤 조사는 `글을` 로 받침과 무관하게(QA-P-L20) */
  body: '글을 숨기면 이 추천에 다시 나오지 않아요. 되돌릴 수 없어요. 글 목록에서는 그대로 찾을 수 있어요.',
  confirm: '숨기기',
  pending: '숨기는 중',
  done: '추천에서 숨겼어요.',
} as const

export interface MatchReason {
  key: 'category' | 'date' | 'place' | 'text'
  text: string
  /** 같다(체크 표시) — 날짜가 다를 때는 표시 없이 글자로만(확정안 "✓는 같을 때만") */
  same: boolean
}

/**
 * 맞은 이유 — **`%` 없이 말로**(디자인품질기준 "추천 일치"). 서버가 준 사실만 옮긴다.
 *   종류 : 서버가 같은 종류만 고르므로 늘 `같은 종류`
 *   날짜 : 상대가 습득 글이면 내가 잃어버린 뒤 주운 것(`3일 뒤 주움`), 분실 글이면 내가 줍기 전에 잃어버린 것(`3일 전 잃어버림`). 0일이면 `같은 날 …`
 *   장소 · 제목 : 비슷할 때만 넣는다(다르다고 굳이 말하지 않는다)
 */
export function matchReasons(match: Pick<MatchResponse, 'type' | 'daysApart' | 'similarPlace' | 'similarText'>): MatchReason[] {
  const days = Math.max(0, Math.round(match.daysApart))
  const found = match.type === 'FOUND'
  const verb = found ? '주움' : '잃어버림'
  const when = days === 0 ? `같은 날 ${verb}` : `${days}일 ${found ? '뒤' : '전'} ${verb}`
  const reasons: MatchReason[] = [
    { key: 'category', text: '같은 종류', same: true },
    { key: 'date', text: when, same: days === 0 },
  ]
  if (match.similarPlace) reasons.push({ key: 'place', text: '장소 비슷', same: true })
  if (match.similarText) reasons.push({ key: 'text', text: '제목 비슷', same: true })
  return reasons
}

/** 숨긴 뒤 포커스를 둘 후보 — 다음 카드, 마지막이었으면 앞 카드, 하나뿐이었으면 없음(제목으로) */
export function nextFocusCandidate(list: Pick<MatchResponse, 'postId'>[], removedId: number): number | null {
  const index = list.findIndex((match) => match.postId === removedId)
  if (index < 0) return null
  return list[index + 1]?.postId ?? list[index - 1]?.postId ?? null
}
