import type { PostDetailResponse } from '@/features/posts'
import { safeImageUrl } from '@/shared/lib/url'

import type { PublicMatchResponse } from '../api/publicMatchTypes'

/** 상세의 공공 후보 묶음 자리 id — 알림(`PUBLIC_MATCH_SUGGESTED`)이 `#public-matches` 로 데려온다 */
export const PUBLIC_MATCHES_ANCHOR_ID = 'public-matches'

/**
 * 공공 후보 묶음을 그리는가 — **글쓴이 · 게시중 · 분실 글만**(`showsMatches` + 분실 글).
 * 습득 글은 서버도 빈 배열을 준다(물건을 주운 사람이 경찰서 보관 물건을 찾을 까닭이 없다) — 묶음도 요청도 없다
 */
export function showsPublicMatches(post: Pick<PostDetailResponse, 'status' | 'type'>, isOwner: boolean): boolean {
  return isOwner && post.status === 'OPEN' && post.type === 'LOST'
}

/**
 * 묶음 문구. 글 제목을 문장에 끼우지 않는다(조사 문제, QA-D-L16 · P-L20).
 * 안내 줄은 **다음 행동**과 **우리 사이트 흐름과의 차이**를 한 번에 — 이 카드는 글이 아니라 `[내 물건이에요]`가 없고,
 * 찾아가는 일은 보관 장소에서 한다(기능명세서 7.6 ②-1 "우리는 여기 보관 중까지만 알린다")
 */
export const PUBLIC_MATCHES_COPY = {
  heading: '경찰서 · 기관에 맡겨진 비슷한 물건',
  lead: '맞는 물건 같으면 카드에 적힌 보관 장소에 직접 문의해 찾아가세요. 이 사이트의 글이 아니라서 ‘내 물건이에요’로는 알릴 수 없어요.',
  emptyTitle: '아직 경찰서 · 기관에 맡겨진 비슷한 물건이 없어요.',
  emptyDescription: '들어오면 알림으로 알려 드려요.',
  loading: '경찰서 · 기관에 맡겨진 물건을 불러오는 중이에요.',
  /** 공공데이터 출처 표시 — 경찰서 · 기관 보관 모두 경찰청 API 가 준다 */
  credit: '출처: 경찰청',
  /** 보관 장소가 비어 온 후보(카드 자리를 비워 두지 않는다) */
  noPlace: '보관 장소 정보가 없어요.',
} as const

/** 숨기기 — 분실 글 쪽 이름 그대로(SCR-11 확정안). 되돌리는 API 가 없어 확인 창(화면정의서 1.6) */
export const PUBLIC_DISMISS = {
  label: '내 물건 아니에요',
  title: '이 물건을 추천에서 숨길까요?',
  /** 앞에 `「물품명」` 이 붙는다 — 뒤 조사는 `물건을` 로 받침과 무관하게(QA-P-L20) */
  body: '물건을 숨기면 이 추천에 다시 나오지 않아요. 되돌릴 수 없어요.',
  confirm: '숨기기',
  pending: '숨기는 중',
  done: '추천에서 숨겼어요.',
} as const

/** 사진 위 이름표 — 어디에 맡겨졌나. 모르는 출처는 `기관 보관`(경찰서가 아닌 곳) */
export function publicSourceLabel(source: PublicMatchResponse['source']): string {
  return source === 'POLICE' ? '경찰서 보관' : '기관 보관'
}

/** 제목 아래 작은 글자 — 색상 · 원문 분류명(있는 것만). 둘 다 없으면 `null` */
export function publicItemDetail(item: Pick<PublicMatchResponse, 'colorName' | 'categoryName'>): string | null {
  const parts = [item.colorName, item.categoryName].map((part) => part?.trim()).filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * 공공 습득물 사진을 그리는 출처 — 경찰민원24 하나(실제 API 응답으로 확인, 2026-11-01).
 * CSP `img-src` 의 `PUBLIC_DATA_IMAGE_ORIGINS`(`build/csp.ts`)와 같은 값이다(이 파일 시험이 맞춰 본다)
 */
export const PUBLIC_PHOTO_ORIGIN = 'https://minwon24.police.go.kr'

/**
 * 카드에 그릴 사진 주소. 아니면 `null`(카테고리 포스터) —
 *   1. `safeImageUrl` 로 거른다(`javascript:` · `data:` · 제어 문자 · 상대 주소)
 *   2. **`PUBLIC_PHOTO_ORIGIN` 으로 시작하는 주소만** — 다른 출처는 CSP 가 막아 깨진 그림이 될 뿐이라 처음부터 그리지 않는다
 *   3. 사진이 없는 습득물은 사이트의 "이미지 없음" 그림(`…/img02_no_img.gif`)이 온다 — 경로에 `no_img` 가 있으면 사진 없음
 * 받다가 실패하면(`onError`) `PostThumbnail` 이 포스터로 바꾼다
 */
export function publicItemPhoto(item: Pick<PublicMatchResponse, 'imageUrl'>): string | null {
  const safe = safeImageUrl(item.imageUrl)
  if (!safe) return null
  let url: URL
  try {
    url = new URL(safe)
  } catch {
    return null
  }
  if (url.origin !== PUBLIC_PHOTO_ORIGIN) return null
  if (/no_img/i.test(url.pathname)) return null
  return safe
}

/** 경찰민원24 — 묶음 머리에 한 번 두는 외부 링크. 상세 경로(습득물 한 건)는 확인하지 못해 홈 주소만 쓴다 */
export const PUBLIC_PORTAL = {
  href: 'https://minwon24.police.go.kr',
  label: '경찰민원24에서 직접 찾아보기',
  /** 스크린리더에 새 창으로 열린다는 것을 알린다(보이는 쪽은 아이콘) */
  newWindow: '(새 창)',
} as const

export interface PublicMatchReason {
  key: 'category' | 'date' | 'name'
  text: string
  /** 같다(체크 표시) — 날짜가 다를 때는 표시 없이 글자로만(SCR-11 "✓는 같을 때만") */
  same: boolean
}

/**
 * 맞은 이유 — **`%` 없이 말로**(SCR-11 카드와 같은 말투). 서버가 준 사실만 옮긴다.
 *   종류 : 서버가 같은 종류만 고르므로 늘 `같은 종류`
 *   날짜 : 늘 내가 잃어버린 뒤 주운 것(서버 조건 분실일 ≤ 습득일) — `같은 날 주움` / `3일 뒤 주움`
 *   이름 : 비슷할 때만 `이름 비슷`(다르다고 굳이 말하지 않는다). 장소는 없다 — 보관 장소는 주운 곳이 아니다(서버도 점수에 안 쓴다)
 */
export function publicMatchReasons(item: Pick<PublicMatchResponse, 'daysApart' | 'similarName'>): PublicMatchReason[] {
  const days = Math.max(0, Math.round(item.daysApart))
  const reasons: PublicMatchReason[] = [
    { key: 'category', text: '같은 종류', same: true },
    { key: 'date', text: days === 0 ? '같은 날 주움' : `${days}일 뒤 주움`, same: days === 0 },
  ]
  if (item.similarName) reasons.push({ key: 'name', text: '이름 비슷', same: true })
  return reasons
}

/** 숨긴 뒤 포커스를 둘 후보 — 다음 카드, 마지막이었으면 앞 카드, 하나뿐이었으면 없음(머리로) */
export function nextFocusPublicItem(list: Pick<PublicMatchResponse, 'itemId'>[], removedId: number): number | null {
  const index = list.findIndex((item) => item.itemId === removedId)
  if (index < 0) return null
  return list[index + 1]?.itemId ?? list[index - 1]?.itemId ?? null
}
