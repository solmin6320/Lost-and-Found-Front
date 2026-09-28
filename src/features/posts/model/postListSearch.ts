import { formatDate, isIsoDate } from '@/shared/lib/date'

import {
  isPostCategory,
  isPostStatus,
  isPostType,
  type PostCategory,
  type PostListParams,
  type PostStatus,
  type PostType,
} from '../api/types'
import { POST_CATEGORY_LABEL, POST_STATUS_LABEL } from './labels'

/**
 * 목록 화면의 검색 조건 = URL 쿼리스트링.
 * 뒤로가기 · 새로고침 · 링크 공유가 그대로 동작하도록 화면 상태를 주소에 싣는다(SCR-01).
 *
 * 이름은 백엔드 [4.2] 쿼리 파라미터와 같다. **`page` 만 1부터 센다** —
 * 주소창의 `?page=2` 가 화면의 "2쪽"과 같아야 공유받은 사람이 헷갈리지 않는다. 서버로 보낼 때 1을 뺀다.
 */
export interface PostListSearch {
  keyword: string
  type?: PostType
  category?: PostCategory
  status?: PostStatus
  location: string
  from?: string
  to?: string
  /** 1부터 */
  page: number
}

/**
 * 필터 칩 하나가 맡는 조건. 기간은 `from`·`to` 둘을 한 칩으로 묶는다.
 *
 * **유형(`type`)은 필터가 아니다.** 첫 화면의 의도 선택(`잃어버렸어요` / `주웠어요`)이 맡는다.
 * 칩 · 시트에도 두면 같은 주소 값을 고치는 곳이 둘이 되어, 한쪽을 바꾼 뒤 다른 쪽이 무엇을
 * 말하는지 헷갈린다. 그래서 `전체 해제` 도 유형은 남긴다 — 검색어처럼 화면 위에 늘 보이는 값이다.
 */
export type PostFilterField = 'category' | 'status' | 'location' | 'period'

export const POST_FILTER_FIELDS: readonly PostFilterField[] = [
  'category',
  'status',
  'location',
  'period',
]

/** 칩 라벨의 앞머리. `카테고리: 지갑` — 검색어의 "지갑"과 구분된다 */
export const POST_FILTER_FIELD_NAME: Record<PostFilterField, string> = {
  category: '카테고리',
  status: '상태',
  location: '장소',
  period: '기간',
}

/** 제목(100자)보다 긴 검색어는 의미가 없다 */
export const KEYWORD_MAX_LENGTH = 100
/** DB `location VARCHAR(100)` */
export const LOCATION_MAX_LENGTH = 100

/** 서버 문구와 같다(`PostSearchCondition.isValidPeriod`). 보내기 전에 화면이 먼저 막는다 */
export const PERIOD_ORDER_MESSAGE = '시작일이 종료일보다 늦을 수 없습니다.'

export const EMPTY_POST_LIST_SEARCH: PostListSearch = { keyword: '', location: '', page: 1 }

/**
 * 주소 → 조건. 주소는 사용자가 고칠 수 있는 입력이다. 형식에 맞지 않는 값은 버린다.
 * `from > to` 도 버린다 — 그대로 보내면 400 이 나고, 직전 목록까지 사라진다.
 */
export function parsePostListSearch(params: URLSearchParams): PostListSearch {
  const type = params.get('type')
  const category = params.get('category')
  const status = params.get('status')
  let from: string | undefined = params.get('from') ?? undefined
  let to: string | undefined = params.get('to') ?? undefined

  if (!isIsoDate(from)) from = undefined
  if (!isIsoDate(to)) to = undefined
  if (from && to && from > to) {
    from = undefined
    to = undefined
  }

  const page = Number(params.get('page'))

  return {
    keyword: (params.get('keyword') ?? '').trim().slice(0, KEYWORD_MAX_LENGTH),
    type: isPostType(type) ? type : undefined,
    category: isPostCategory(category) ? category : undefined,
    status: isPostStatus(status) ? status : undefined,
    location: (params.get('location') ?? '').trim().slice(0, LOCATION_MAX_LENGTH),
    from,
    to,
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  }
}

/** 조건 → 주소. 비어 있는 조건과 1쪽은 싣지 않는다. 같은 조건은 언제나 같은 주소가 된다 */
export function toSearchParams(search: PostListSearch): URLSearchParams {
  const params = new URLSearchParams()
  if (search.keyword) params.set('keyword', search.keyword)
  if (search.type) params.set('type', search.type)
  if (search.category) params.set('category', search.category)
  if (search.status) params.set('status', search.status)
  if (search.location) params.set('location', search.location)
  if (search.from) params.set('from', search.from)
  if (search.to) params.set('to', search.to)
  if (search.page > 1) params.set('page', String(search.page))
  return params
}

/**
 * 조건의 지문. 같은 조건이면 같은 문자열이다.
 * 주소 변경은 transition 으로 늦게 그려지므로, "바뀐 뒤에 할 일"(포커스 옮기기 등)을 이 값의 변화에 건다
 */
export function postListSearchKey(search: PostListSearch): string {
  return toSearchParams(search).toString()
}

/**
 * 목록 한 쪽에 싣는 글 수. 2 · 3 · 4 의 공배수라 피드가 몇 열이든 마지막 줄이 비지 않는다
 * (서버 기본 20 은 3열에서 두 칸이 빈다). 서버 최대는 100
 */
export const POST_LIST_PAGE_SIZE = 24

/** 조건 → 서버 요청. 여기서만 page 를 0부터로 바꾼다 */
export function toPostListParams(search: PostListSearch): PostListParams {
  return {
    keyword: search.keyword,
    type: search.type,
    category: search.category,
    status: search.status,
    location: search.location,
    from: search.from,
    to: search.to,
    page: search.page - 1,
    size: POST_LIST_PAGE_SIZE,
  }
}

/** 필터(검색어 · 유형 제외)가 하나라도 걸려 있나 */
export function hasActiveFilters(search: PostListSearch): boolean {
  return POST_FILTER_FIELDS.some((field) => filterValueLabel(search, field) !== null)
}

/** 칩에 쓸 값 라벨. 걸려 있지 않으면 `null` */
export function filterValueLabel(search: PostListSearch, field: PostFilterField): string | null {
  switch (field) {
    case 'category':
      return search.category ? POST_CATEGORY_LABEL[search.category] : null
    case 'status':
      return search.status ? POST_STATUS_LABEL[search.status] : null
    case 'location':
      return search.location || null
    case 'period':
      if (search.from && search.to) return `${formatDate(search.from)} ~ ${formatDate(search.to)}`
      if (search.from) return `${formatDate(search.from)}부터`
      if (search.to) return `${formatDate(search.to)}까지`
      return null
  }
}

/** 조건 하나를 지운다. 결과가 달라지므로 1쪽으로 돌아간다 */
export function withoutFilter(search: PostListSearch, field: PostFilterField): PostListSearch {
  const next: PostListSearch = { ...search, page: 1 }
  if (field === 'period') {
    next.from = undefined
    next.to = undefined
  } else if (field === 'location') {
    next.location = ''
  } else {
    next[field] = undefined
  }
  return next
}

/** 필터만 전부 지운다. 검색어와 유형은 남긴다 — 검색창 · 의도 선택에 그대로 보이는 값이다 */
export function withoutFilters(search: PostListSearch): PostListSearch {
  return { ...EMPTY_POST_LIST_SEARCH, keyword: search.keyword, type: search.type }
}

/* ── 필터 입력 중인 값 ───────────────────────────────── */

/** 필터 입력칸이 들고 있는 값. 적용 전까지는 주소에 싣지 않는다 */
export interface PostFilterDraft {
  category?: PostCategory
  status?: PostStatus
  location: string
  /** `<input type="date">` 값. 비었으면 `''` */
  from: string
  to: string
}

export const EMPTY_POST_FILTER_DRAFT: PostFilterDraft = { location: '', from: '', to: '' }

export function draftFromSearch(search: PostListSearch): PostFilterDraft {
  return {
    category: search.category,
    status: search.status,
    location: search.location,
    from: search.from ?? '',
    to: search.to ?? '',
  }
}

/** 입력값을 조건에 반영한다. 검색어 · 유형은 그대로 두고 1쪽으로 돌아간다 */
export function applyDraft(search: PostListSearch, draft: PostFilterDraft): PostListSearch {
  return {
    keyword: search.keyword,
    type: search.type,
    category: draft.category,
    status: draft.status,
    location: draft.location.trim().slice(0, LOCATION_MAX_LENGTH),
    from: isIsoDate(draft.from) ? draft.from : undefined,
    to: isIsoDate(draft.to) ? draft.to : undefined,
    page: 1,
  }
}

/** 기간이 거꾸로면 문구, 아니면 `null` */
export function periodError(draft: Pick<PostFilterDraft, 'from' | 'to'>): string | null {
  return draft.from && draft.to && draft.from > draft.to ? PERIOD_ORDER_MESSAGE : null
}
