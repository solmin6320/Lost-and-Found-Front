/**
 * 관리자 API 요청 · 응답 타입(기능명세서 7.4 — 매니저 임명 · 해임 · 회원 검색).
 * 원본 : Lost-and-Found `controller/AdminController` · `dto/response/AdminMemberResponse` · `service/ManagerService`
 */
import type { MemberRole } from '@/features/members'

/** `GET /api/admin/members` 의 한 줄. 정렬은 서버 기본값 — 최근 가입 순(`createdAt desc`) */
export interface AdminMemberResponse {
  id: number
  email: string
  nickname: string
  role: MemberRole
  /** 가입일시. `LocalDateTime` — 시간대 오프셋이 없다 */
  createdAt: string
}

/**
 * `GET /api/admin/members?keyword=&role=&page=&size=` 조건.
 * - `keyword` 닉네임 · 이메일 일부(대소문자 무시). 비거나 공백뿐이면 조건 없음(서버가 `strip()` 뒤 판정)
 * - `role` 없으면 모든 역할
 * - `page` **0부터**, `size` 기본 20
 */
export interface AdminMemberSearchParams {
  keyword?: string
  role?: MemberRole
  page?: number
  size?: number
}

/** 역할 바꾸기 — 임명(회원 → 매니저) · 해임(매니저 → 회원). 관리자는 어느 쪽도 아니다(`ADMIN_ROLE_LOCKED`) */
export type ManagerChange = 'appoint' | 'dismiss'
