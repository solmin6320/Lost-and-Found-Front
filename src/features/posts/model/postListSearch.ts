import { formatDate, formatMonthDay, isIsoDate } from '@/shared/lib/date'
import { parsePageParam } from '@/shared/lib/pageParam'

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
 * 이름은 백엔드 [4.2] 쿼리 파라미터와 같다. `page` 는 **화면의 페이지 번호(1부터)** 다 — 서버에는 하나 빼서(0부터) 보낸다.
 * 한 페이지 20건(본인 결정 2026-10-16 — [더 보기] 대신 페이지 번호). 폭과 상관없이 뜻이 하나라 공유받은 주소가 휴대폰 · 넓은 화면에서 같은 글을 보여 준다.
 */
export interface PostListSearch {
  keyword: string
  type?: PostType
  category?: PostCategory
  /**
   * 하나만 고른다. **비어 있으면 기본값 "진행 중"**(게시중 + 연락중 — 완료 글은 기본 목록에서 빠진다, 회의 ⑧).
   * 기본값은 주소에 싣지 않는다. 요청에는 두 값을 채워 보낸다(`listStatuses`)
   */
  status?: PostStatus
  location: string
  from?: string
  to?: string
  /** 페이지 번호. 1부터. 전체 페이지 수를 넘는 번호는 화면이 "이 페이지에는 글이 없어요"로 받는다 */
  page: number
}

/**
 * 필터 칩 하나가 맡는 조건. **칩 하나 = 묶음 하나 = 펼침 칸 하나**(본인 피드백 2026-10-07 — 장소와 기간이 한 판을 같이 쓰던 것을 나눴다).
 * 기간은 `from`·`to` 둘을 한 칩으로 묶는다.
 *
 * **유형(`type`)은 필터가 아니다.** 첫 화면의 분실 · 습득 칸이 맡는다.
 * 칩 · 시트에도 두면 같은 주소 값을 고치는 곳이 둘이 되어, 한쪽을 바꾼 뒤 다른 쪽이 무엇을
 * 말하는지 헷갈린다. 그래서 빈 결과의 `필터 모두 지우기` 도 유형은 남긴다 — 검색어처럼 화면 위에 늘 보이는 값이다.
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

/** 보내기 전 검사 문장(해요체 — 회의 ⑦, 칸 이름 "시작 · 끝"으로). 서버(`PostSearchCondition.isValidPeriod`)가 막으면 서버 문장이 그대로 온다 */
export const PERIOD_ORDER_MESSAGE = '시작 날짜는 끝 날짜보다 늦을 수 없어요'

export const EMPTY_POST_LIST_SEARCH: PostListSearch = { keyword: '', location: '', page: 1 }

/**
 * 상태를 고르지 않았을 때 목록이 보여 주는 상태 — "진행 중"(게시중 + 연락중). 완료 글은 기본 목록에서 빠진다(회의 ⑧).
 * 분실 · 습득 칸의 건수 · 검색어 추천도 같은 기준이다. 내가 쓴 글(SCR-07)은 빼지 않는다
 */
export const DEFAULT_LIST_STATUSES: readonly PostStatus[] = ['OPEN', 'IN_PROGRESS']

/** 기본 상태의 이름. 상태 메뉴의 첫 칸 · 칩에 그대로 쓴다 */
export const DEFAULT_STATUS_LABEL = '진행 중'

/** 요청에 실을 상태. 고른 것이 없으면 기본값 둘 */
export function listStatuses(search: Pick<PostListSearch, 'status'>): readonly PostStatus[] {
  return search.status ? [search.status] : DEFAULT_LIST_STATUSES
}

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

  return {
    keyword: (params.get('keyword') ?? '').trim().slice(0, KEYWORD_MAX_LENGTH),
    type: isPostType(type) ? type : undefined,
    category: isPostCategory(category) ? category : undefined,
    status: isPostStatus(status) ? status : undefined,
    location: (params.get('location') ?? '').trim().slice(0, LOCATION_MAX_LENGTH),
    from,
    to,
    page: parsePageParam(params.get('page')),
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
 * 페이지 번호를 뺀 조건의 지문. 이것이 같으면 페이지만 넘긴 것이고, 다르면 조건이 바뀐 것이다(조건이 바뀌면 1페이지로)
 */
export function postListConditionKey(search: PostListSearch): string {
  return postListSearchKey({ ...search, page: 1 })
}

/** 한 페이지에 싣는 글 수(본인 결정 2026-10-16). 글이 21 · 41 · 61 … 건이 되면 페이지가 하나씩 는다 */
export const POST_LIST_PAGE_SIZE = 20

/** 한 번에 보이는 페이지 번호 수. 전체가 이만큼 이상이면 이전 · 다음 묶음 화살표를 보인다(본인 결정 2026-10-16) */
export const POST_LIST_PAGE_GROUP = 5

/** 조건 → 서버 요청. 화면의 n 페이지 = 서버의 n−1 쪽(0부터), 20건 */
export function toPostListParams(search: PostListSearch): PostListParams {
  return {
    keyword: search.keyword,
    type: search.type,
    category: search.category,
    status: listStatuses(search),
    location: search.location,
    from: search.from,
    to: search.to,
    page: Math.max(Math.trunc(search.page) || 1, 1) - 1,
    size: POST_LIST_PAGE_SIZE,
  }
}

/**
 * 주소를 바꾸는 방법. 조건을 바꾸든 페이지를 넘기든 **기록을 쌓는다** — 뒤로가기 한 번이 방금 고른 조건 · 보던 페이지로 돌아간다
 */
export interface PostListNavigation {
  search: PostListSearch
  replace: boolean
}

/** 조건을 바꾼다. 결과가 달라지므로 1페이지로 돌아간다 */
export function conditionNavigation(next: PostListSearch): PostListNavigation {
  return { search: { ...next, page: 1 }, replace: false }
}

/** 페이지를 넘긴다. 조건은 그대로 */
export function pageNavigation(search: PostListSearch, page: number): PostListNavigation {
  return { search: { ...search, page: Math.max(Math.trunc(page) || 1, 1) }, replace: false }
}

/**
 * 하나만 고르는 묶음(카테고리 · 상태)에서 고른 값을 **바로** 건다. `undefined` 는 그 묶음의 기본값 —
 * 카테고리는 "전체", 상태는 "진행 중"(`DEFAULT_LIST_STATUSES`). 검색어 · 유형 · 다른 조건은 그대로 두고 1페이지로 돌아간다
 */
export function withChoice<F extends 'category' | 'status'>(
  search: PostListSearch,
  field: F,
  value: PostListSearch[F],
): PostListSearch {
  return { ...search, [field]: value, page: 1 }
}

/** 필터(검색어 · 유형 제외)가 하나라도 걸려 있나. 기본값(상태 "진행 중")은 건 것이 아니다 */
export function hasActiveFilters(search: PostListSearch): boolean {
  return POST_FILTER_FIELDS.some((field) => filterValueLabel(search, field) !== null)
}

/** 칩에 쓸 값 라벨. 걸려 있지 않으면(기본값이면) `null` */
export function filterValueLabel(search: PostListSearch, field: PostFilterField): string | null {
  switch (field) {
    case 'category':
      return search.category ? POST_CATEGORY_LABEL[search.category] : null
    case 'status':
      return search.status ? POST_STATUS_LABEL[search.status] : null
    case 'location':
      return search.location || null
    case 'period':
      if (search.from && search.to) return periodRangeLabel(search.from, search.to)
      if (search.from) return `${formatDate(search.from)}부터`
      if (search.to) return `${formatDate(search.to)}까지`
      return null
  }
}

/**
 * 아무것도 걸지 않았을 때 그 묶음이 실제로 거르는 값. 상태만 있다 — "진행 중"(완료 글은 기본으로 빠진다).
 * 칩이 채우지 않은 모양 그대로 `상태: 진행 중` 으로 보여 준다(기본값을 드러낸다 — 힉스). 지우기 [×]는 없다(지울 것이 없다)
 */
export function filterDefaultLabel(field: PostFilterField): string | null {
  return field === 'status' ? DEFAULT_STATUS_LABEL : null
}

/** 조건 하나를 지운다(칩의 [×]). 그 묶음의 기본값으로 돌아간다. 결과가 달라지므로 1쪽으로 돌아간다 */
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

/**
 * 필터만 전부 지운다(조건 검색 0건의 `필터 모두 지우기`). 검색어와 유형은 남긴다 — 검색창 · 분실 · 습득 칸에 그대로 보이는 값이다.
 * 상태는 기본값 "진행 중"으로 돌아간다
 */
export function withoutFilters(search: PostListSearch): PostListSearch {
  return { ...EMPTY_POST_LIST_SEARCH, keyword: search.keyword, type: search.type }
}

/* ── 장소 · 기간 — 글자 · 날짜를 치는 칸이라 [적용하기]에서 건다. 칩마다 따로 연다(본인 피드백 2026-10-07) ── */

/** 장소를 건다(장소 칸의 [적용하기]). 앞뒤 공백을 지우고 100자로 자른다. 비었으면 장소 조건이 빠진다 */
export function applyLocation(search: PostListSearch, location: string): PostListSearch {
  return { ...search, location: location.trim().slice(0, LOCATION_MAX_LENGTH), page: 1 }
}

/** 기간 칸이 들고 있는 값. 적용 전까지는 주소에 싣지 않는다 */
export interface PostPeriodDraft {
  /** `<input type="date">` 값. 비었으면 `''` */
  from: string
  to: string
}

export function periodDraftFromSearch(search: PostListSearch): PostPeriodDraft {
  return { from: search.from ?? '', to: search.to ?? '' }
}

/**
 * [지우기] — **이 칸에 보이는 것만** 비운다(적용 전 입력값). 장소 · 카테고리 · 상태 · 검색어는 건드리지 않는다.
 * "지우기 버튼은 지금 보이는 것만 지운다"(2026-10-03 회의 ③)
 */
export const EMPTY_PERIOD_DRAFT: PostPeriodDraft = { from: '', to: '' }

/** 기간을 건다. 잘못된 날짜는 버린다. 나머지 조건은 그대로 두고 1페이지로 돌아간다 */
export function applyPeriodDraft(search: PostListSearch, draft: PostPeriodDraft): PostListSearch {
  return {
    ...search,
    from: isIsoDate(draft.from) ? draft.from : undefined,
    to: isIsoDate(draft.to) ? draft.to : undefined,
    page: 1,
  }
}

/** 기간이 거꾸로면 문구, 아니면 `null` */
export function periodError(draft: PostPeriodDraft): string | null {
  return draft.from && draft.to && draft.from > draft.to ? PERIOD_ORDER_MESSAGE : null
}

/* ── 검색어 ── */

/**
 * 검색어를 건다(검색칸 Enter · 돋보기 버튼). **새 검색어는 분실 · 습득 글을 함께 찾는다**(본인 피드백 2026-10-07) —
 * 분실 · 습득 칸 하나를 골라 둔 채 새 말을 찾으면 그 칸을 풀어 두 종류를 함께 보여 준다. 결과 카드의 이름표(분실 · 습득)로 가르고,
 * 한쪽만 보려면 위의 칸을 누른다(검색어는 그대로 남는다).
 *
 * - 같은 검색어를 다시 보내면 지금 조건 그대로(칸으로 좁혀 둔 것을 풀지 않는다)
 * - 검색어를 지우면(`''`) 칸은 그대로 — 지운 것은 검색어뿐이다
 * - 카테고리 · 상태 · 장소 · 기간은 그대로 둔다(칩 줄에 보이는 값이다)
 */
export function withKeyword(search: PostListSearch, keyword: string): PostListSearch {
  const next = keyword.trim().slice(0, KEYWORD_MAX_LENGTH)
  const fresh = next !== '' && next !== search.keyword
  return { ...search, keyword: next, type: fresh ? undefined : search.type, page: 1 }
}

/**
 * 기간 칩 값 — 두 날짜가 같은 해면 연도를 뺀다(`9. 1. ~ 9. 30.`, QA-D-26). 해가 다르면 둘 다 연도까지.
 * 320 · 글자 200%에서 칩 값 칸(142px)보다 `2026. 9. 30.` 한 덩어리(155px)가 넓어 날짜 가운데서 끊겼다 — 연도를 빼면 날짜가 한 덩어리로 들어가
 * 줄은 `~` 앞뒤에서만 바뀐다. 연도는 칩을 누르면 여는 기간 칸에 그대로 있다
 */
export function periodRangeLabel(from: string, to: string): string {
  if (from.slice(0, 4) === to.slice(0, 4)) return `${formatMonthDay(from)} ~ ${formatMonthDay(to)}`
  return `${formatDate(from)} ~ ${formatDate(to)}`
}
