import { isIsoDate, todayIsoDate } from '@/shared/lib/date'
import { particle } from '@/shared/lib/particle'
import { POST_DRAFT_PREFIX } from '@/shared/lib/writeDrafts'

import {
  POST_CONTENT_MAX_LENGTH,
  POST_LOCATION_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  isPostCategory,
  isPostType,
  type PostCategory,
  type PostCreateRequest,
  type PostDetailResponse,
  type PostType,
} from '../api/types'
import { lostFoundDateLabel } from './labels'

/*
 * 등록 · 수정 폼(SCR-02 · SCR-04)의 값과 검사. React 를 모른다.
 *
 * 필수는 여섯 칸이다(유형 · 제목 · 종류 · 장소 · 날짜 · 설명). 사진만 선택이다. 필수를 늘리지 않는다.
 * 검사 문장은 **화면의 이름**으로 쓴다(제목 · 종류 · 장소 · 분실일 · 설명). 서버 문장("카테고리는 필수입니다",
 * "본문은 …")의 낱말은 화면에 없는 말이라 그대로 옮기지 않았다. 여기서 먼저 막으므로 서버 문장은 보통 오지 않는다.
 * 서버가 막은 경우(`INVALID_INPUT`)는 서버 문장을 그대로 그 칸 아래에 둔다(`fieldOfServerMessage`).
 */

export interface PostFormValues {
  /** 고르기 전에는 `null`. 목록의 "분실 글 올리기"(`?type=LOST`)로 들어오면 미리 골라져 있다 */
  type: PostType | null
  title: string
  category: PostCategory | null
  location: string
  /** `yyyy-MM-dd`. 기본값은 오늘 */
  lostFoundDate: string
  content: string
}

export type PostFormField = keyof PostFormValues

/** 화면에 놓인 순서. 제출이 막히면 이 순서로 첫 칸에 포커스를 준다 */
export const POST_FORM_FIELDS: readonly PostFormField[] = [
  'type',
  'title',
  'category',
  'location',
  'lostFoundDate',
  'content',
]

export type PostFormErrors = Partial<Record<PostFormField, string>>

export function emptyPostFormValues(type: PostType | null = null, today = todayIsoDate()): PostFormValues {
  return { type, title: '', category: null, location: '', lostFoundDate: today, content: '' }
}

/** 수정 화면의 처음 값 — 지금 글 그대로 */
export function postFormValuesOf(post: PostDetailResponse): PostFormValues {
  return {
    type: post.type,
    title: post.title,
    category: post.category,
    location: post.location,
    lostFoundDate: post.lostFoundDate,
    content: post.content,
  }
}

export function samePostFormValues(a: PostFormValues, b: PostFormValues): boolean {
  return POST_FORM_FIELDS.every((field) => a[field] === b[field])
}

/** 날짜 칸의 이름. 유형을 고르기 전에는 "날짜" */
export function dateFieldLabel(type: PostType | null): string {
  return type ? lostFoundDateLabel(type) : '날짜'
}

/**
 * 한 칸 검사. 문제가 있으면 문장, 없으면 `undefined`.
 * 글자 수는 **앞뒤 공백을 잘라 낸 뒤** 센다 — 보낼 때 잘라서 보낸다(`toPostRequest`).
 */
export function checkPostField(field: PostFormField, values: PostFormValues, today = todayIsoDate()) {
  switch (field) {
    case 'type':
      return values.type ? undefined : '잃어버렸는지 주웠는지 골라 주세요'
    case 'title':
      return checkText(values.title, '제목', POST_TITLE_MAX_LENGTH)
    case 'category':
      return values.category ? undefined : '물건 종류를 골라 주세요'
    case 'location':
      return checkText(values.location, '장소', POST_LOCATION_MAX_LENGTH)
    case 'lostFoundDate': {
      const label = dateFieldLabel(values.type)
      if (!values.lostFoundDate || !isIsoDate(values.lostFoundDate)) {
        return `${label}${particle(label, '을')} 골라 주세요`
      }
      // 같은 모양의 문자열이라 글자 순서가 날짜 순서다
      if (values.lostFoundDate > today) {
        return `${label}${particle(label, '은')} 오늘까지만 고를 수 있어요`
      }
      return undefined
    }
    case 'content':
      return checkText(values.content, '설명', POST_CONTENT_MAX_LENGTH)
  }
}

function checkText(value: string, label: string, max: number): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return `${label}${particle(label, '을')} 적어 주세요`
  if (trimmed.length > max) {
    return `${label}${particle(label, '은')} ${max.toLocaleString('ko-KR')}자까지 쓸 수 있어요`
  }
  return undefined
}

export function checkPostForm(values: PostFormValues, today = todayIsoDate()): PostFormErrors {
  const errors: PostFormErrors = {}
  for (const field of POST_FORM_FIELDS) {
    const message = checkPostField(field, values, today)
    if (message) errors[field] = message
  }
  return errors
}

/**
 * 보낼 모양. 제목 · 장소 · 설명은 **앞뒤 공백을 잘라** 보낸다 — 서버는 자르지 않고 공백까지 센다.
 * 검사를 통과한 값만 넣는다(유형 · 종류가 `null` 이면 던진다).
 */
export function toPostRequest(values: PostFormValues): PostCreateRequest {
  if (!values.type || !values.category) {
    throw new Error('검사를 통과한 값만 보낸다')
  }
  return {
    type: values.type,
    title: values.title.trim(),
    content: values.content.trim(),
    category: values.category,
    location: values.location.trim(),
    lostFoundDate: values.lostFoundDate,
  }
}

/**
 * 서버 `INVALID_INPUT` 문장이 가리키는 칸. 백엔드 `PostCreateRequest` 의 문장은 필드 이름으로 시작한다 —
 * "유형은 …" · "제목은 …" · "본문은 …" · "카테고리는 …" · "장소는 …" · "분실ㆍ습득 일자는 …". 모르면 `null`(폼 위 한 줄)
 */
export function fieldOfServerMessage(message: string): PostFormField | null {
  if (message.startsWith('유형')) return 'type'
  if (message.startsWith('제목')) return 'title'
  if (message.startsWith('본문')) return 'content'
  if (message.startsWith('카테고리')) return 'category'
  if (message.startsWith('장소')) return 'location'
  if (message.startsWith('분실')) return 'lostFoundDate'
  return null
}

/** 주소의 `?type=` 을 유형으로. 모르는 값은 버린다 */
export function postTypeFromQuery(value: string | null): PostType | null {
  return isPostType(value) ? value : null
}

/* ── 임시 보관 — 로그인이 끊겨도 쓰던 글을 잃지 않는다(개선 목록 A-4) ──────────────
 *
 * 쓰는 도중 재발급이 거절되면(다른 기기에서 비밀번호를 바꿈 · 리프레시 토큰 만료) 로그인 화면으로 가야 한다.
 * 그때 **글자만** 이 탭의 sessionStorage 에 잠시 넣어 두고, 로그인하고 돌아오면 이어서 쓸지 묻는다.
 *
 * - 사진은 넣지 못한다(파일은 저장소에 담을 수 없다). 몇 장이었는지만 적어 두고 다시 골라 달라고 알린다
 * - 토큰이 아니라 사용자가 쓴 글이다(보안명세서 3장의 금지 대상이 아니다). 그래도 오래 두지 않는다 —
 *   탭을 닫으면 사라지고(sessionStorage), 6시간이 지나면 버리고, 이어 쓰기를 고르든 버리든 바로 지운다
 * - **같은 회원에게만** 묻는다. 공용 기기에서 다른 사람이 로그인하면 보이지 않는다
 * - **직접 로그아웃하면 지운다**(`shared/lib/writeDrafts`). 세션 만료 때는 남긴다 — 이어 쓰려고 두는 것이다
 */

const DRAFT_PREFIX = POST_DRAFT_PREFIX
const DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000

export interface PostDraft {
  memberId: number
  savedAt: number
  values: PostFormValues
  /** 골라 두었던 새 사진 수. 파일은 보관하지 못한다 */
  photoCount: number
  /** 수정 화면에서 "기존 사진 전부 삭제"를 눌러 두었나. 파일이 필요 없어 되살릴 수 있다 */
  removeExisting: boolean
}

/** 등록은 `create`, 수정은 `edit:{postId}` */
export function postDraftKey(postId?: number): string {
  return postId === undefined ? 'create' : `edit:${postId}`
}

export function savePostDraft(key: string, draft: PostDraft): boolean {
  try {
    window.sessionStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(draft))
    return true
  } catch {
    // 저장소가 막힌 브라우저 — 보관하지 못했다. 로그인 화면이 "이어서 쓸 수 있다"고 말하지 않는다
    return false
  }
}

export function loadPostDraft(key: string, memberId: number, now = Date.now()): PostDraft | null {
  let raw: string | null = null
  try {
    raw = window.sessionStorage.getItem(DRAFT_PREFIX + key)
  } catch {
    return null
  }
  if (!raw) return null

  const draft = parseDraft(raw)
  if (!draft || now - draft.savedAt > DRAFT_MAX_AGE_MS) {
    clearPostDraft(key)
    return null
  }
  // 다른 회원이 남긴 것은 보여 주지 않는다. 지우지도 않는다 — 그 사람이 다시 로그인할 수 있다
  return draft.memberId === memberId ? draft : null
}

export function clearPostDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(DRAFT_PREFIX + key)
  } catch {
    // 막힌 저장소에는 애초에 없다
  }
}

/** 저장소 값은 누구나 고칠 수 있다. 모양이 맞을 때만 쓴다 */
function parseDraft(raw: string): PostDraft | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const values = data.values as Record<string, unknown> | undefined
    if (
      typeof data.memberId !== 'number' ||
      typeof data.savedAt !== 'number' ||
      typeof values !== 'object' ||
      values === null
    ) {
      return null
    }
    const text = (value: unknown) => (typeof value === 'string' ? value : '')
    return {
      memberId: data.memberId,
      savedAt: data.savedAt,
      photoCount: typeof data.photoCount === 'number' ? Math.max(0, Math.floor(data.photoCount)) : 0,
      removeExisting: data.removeExisting === true,
      values: {
        type: isPostType(values.type) ? values.type : null,
        title: text(values.title),
        category: isPostCategory(values.category) ? values.category : null,
        location: text(values.location),
        lostFoundDate: isIsoDate(values.lostFoundDate) ? values.lostFoundDate : todayIsoDate(),
        content: text(values.content),
      },
    }
  } catch {
    return null
  }
}
