/**
 * 게시글 요청·응답 타입.
 * 원본 : Lost-and-Found `entity/PostType·PostCategory·PostStatus`,
 *        `dto/response/PostListResponse·PostDetailResponse·PostImageResponse·PostStatusResponse`,
 *        `dto/request/PostSearchCondition·PostStatusUpdateRequest`
 *
 * Enum 은 TS `enum` 대신 값 배열로 둔다. 필터 선택지와 URL 값 검증에 그대로 쓴다.
 * 백엔드 Enum 에 값이 늘면 여기도 같이 늘려야 한다.
 */

import type { CommentResponse } from '@/features/comments'

/** 분실 · 습득 */
export const POST_TYPES = ['LOST', 'FOUND'] as const
export type PostType = (typeof POST_TYPES)[number]

/** 지갑 · 전자기기 · 카드 · 의류 · 기타 */
export const POST_CATEGORIES = ['WALLET', 'ELECTRONICS', 'CARD', 'CLOTHES', 'ETC'] as const
export type PostCategory = (typeof POST_CATEGORIES)[number]

/** 게시중 · 연락중 · 완료. 완료는 되돌릴 수 없다([4.6]) */
export const POST_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
}

/**
 * URL 쿼리스트링처럼 밖에서 들어온 값을 Enum 으로 좁힌다.
 * 없는 값을 그대로 보내면 백엔드가 400 을 준다.
 */
export const isPostType = (value: unknown): value is PostType => isOneOf(POST_TYPES, value)
export const isPostCategory = (value: unknown): value is PostCategory =>
  isOneOf(POST_CATEGORIES, value)
export const isPostStatus = (value: unknown): value is PostStatus => isOneOf(POST_STATUSES, value)

/** `GET /api/posts` 의 항목 하나. 본문(`content`)·작성자 id 는 없고, 이미지는 대표 한 장(`thumbnailUrl`)만 있다 */
export interface PostListResponse {
  id: number
  /** 작성자 닉네임. 목록에는 `memberId` 가 없어 본인 판정을 할 수 없다 */
  nickname: string
  type: PostType
  title: string
  category: PostCategory
  location: string
  /** 분실·습득일. `LocalDate` — `"2026-09-20"` */
  lostFoundDate: string
  status: PostStatus
  viewCount: number
  /** 등록일시. `LocalDateTime` — 시간대 오프셋이 없다 (`"2026-09-21T14:03:11.123456"`) */
  createdAt: string
  /** 대표 사진(첫 장) 주소. 사진이 없는 글은 `null` — 카드가 포스터로 채운다 */
  thumbnailUrl: string | null
}

/**
 * `GET /api/posts` 검색 조건. 이름이 백엔드 쿼리 파라미터와 같다.
 * 비워 둔 조건은 적용되지 않는다.
 */
export interface PostSearchCondition {
  /** 제목 또는 본문 부분 일치 */
  keyword?: string
  type?: PostType
  category?: PostCategory
  status?: PostStatus
  /** 장소 부분 일치 */
  location?: string
  /** 분실·습득일 시작(포함). `"yyyy-MM-dd"` */
  from?: string
  /** 분실·습득일 끝(포함). `from` 보다 앞이면 400 `INVALID_INPUT` */
  to?: string
}

/** 검색 조건 + 페이지. 정렬은 등록일 내림차순 고정이라 받지 않는다(서버가 `sort` 를 무시한다) */
export interface PostListParams extends PostSearchCondition {
  /** **0부터** 센다. 기본 0 */
  page?: number
  /** 기본 20, 최대 100. 넘기면 서버가 100 으로 자른다 */
  size?: number
}

/** 첨부 사진 한 장. 원본 : `dto/response/PostImageResponse` */
export interface PostImageResponse {
  id: number
  /** 올릴 때의 파일 이름. 사용자 입력이라 텍스트로만 쓴다(`alt` 등) */
  originalFilename: string
  /** 공개 주소(S3 base URL + 객체 키) */
  url: string
}

/**
 * `GET /api/posts/{id}` 응답. 원본 : `dto/response/PostDetailResponse`
 *
 * 목록 항목과 달리 본문 · 작성자 `memberId` · 사진 전체 · 댓글 첫 20건이 있다.
 * 작성자 본인 판정은 `memberId === me.id` 로 한다(닉네임은 바뀐다).
 */
export interface PostDetailResponse {
  id: number
  /** 작성자 회원 id */
  memberId: number
  /** 작성자 닉네임 */
  nickname: string
  type: PostType
  title: string
  /** 본문. 사용자 입력 — 텍스트로만 렌더링한다 */
  content: string
  category: PostCategory
  location: string
  /** 분실·습득일. `LocalDate` — `"2026-09-20"` */
  lostFoundDate: string
  status: PostStatus
  /** 로그인 회원 기준 하루 한 번 집계된 값. 이번 조회가 반영된 뒤의 수다 */
  viewCount: number
  /** `LocalDateTime` — 시간대 오프셋이 없다 */
  createdAt: string
  /** 수정 · 상태 변경 전에는 `null` */
  updatedAt: string | null
  /** 첨부 사진. 없으면 빈 배열. 순서는 등록 순서 */
  images: PostImageResponse[]
  /**
   * 댓글 **처음 20건**(등록 오래된 순). 21번째부터는 `GET /api/posts/{id}/comments?page=1` 이다.
   * 화면에서는 이 배열을 직접 쓰지 말고 `@/features/comments` 의 `usePostComments()` 를 쓴다
   */
  comments: CommentResponse[]
  /** 댓글 전체 개수. `comments.length` 보다 크면 더 볼 댓글이 있다 */
  totalCommentCount: number
}

/** [4.6] `PATCH /api/posts/{id}/status` 본문(JSON). 원본 : `dto/request/PostStatusUpdateRequest` */
export interface PostStatusUpdateRequest {
  status: PostStatus
}

/** [4.6] 상태 변경 응답. 배지 갱신에 필요한 것만 온다. 원본 : `dto/response/PostStatusResponse` */
export interface PostStatusResponse {
  id: number
  status: PostStatus
  /** 같은 상태로 바꾸면 서버가 아무것도 안 해서 이전 값(첫 변경 전이면 `null`)이 그대로 온다 */
  updatedAt: string | null
}
