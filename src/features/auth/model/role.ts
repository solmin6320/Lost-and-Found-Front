import { useSyncExternalStore } from 'react'

import { isMemberRole, type MemberRole } from '@/features/members'
import { getAccessTokenRole, subscribeAccessTokenRole } from '@/shared/lib/http'

import type { AuthStatus } from './authReducer'
import { useAuth } from './useAuth'

/**
 * 토큰의 `role` 클레임 → 역할. 서버(`JwtTokenProvider.getRole`)와 같이 **없으면 회원**으로 본다.
 * 모르는 값(서버에 새 역할이 생겼는데 화면이 아직 모름)도 회원 — 화면이 모르는 권한을 그리지 않는다
 */
export function toMemberRole(claim: string | null): MemberRole {
  return isMemberRole(claim) ? claim : 'USER'
}

/**
 * 내 역할 — **화면 표시용**(계정 메뉴의 `관리자` 입구 · 관리자 화면의 첫 판정). 로그인하지 않았으면 `null`.
 *
 * 지금은 액세스 토큰의 `role` 클레임을 읽는다(`GET /api/members/me` 응답에 아직 역할이 없다, 2026-10-25).
 * 토큰이 바뀔 때(로그인 · 5분마다 재발급 · 로그아웃 · 세션 만료) 따라 바뀐다.
 * 서명을 검사하지 않은 값이라 **믿지 않는다** — 관리자 API 는 서버가 403 `ACCESS_DENIED` 로 막고, 화면은 그때도 권한 없음으로 간다.
 *
 * 나중에 `/me` 응답에 `role` 이 생기면 여기만 바꾼다 — `auth.me.role` 을 돌려주고 토큰 구독을 걷는다(부르는 쪽은 그대로)
 */
export function useMyRole(): MemberRole | null {
  const auth = useAuth()
  const claim = useSyncExternalStore(subscribeAccessTokenRole, getAccessTokenRole, getAccessTokenRole)
  return auth.status === 'authenticated' ? toMemberRole(claim) : null
}

/**
 * 관리자 화면에 들어갈 수 있는지(`app` 의 관리자 틀이 가른다).
 *
 * - `pending` 세션을 되살리는 중(앱 시작 직후) — 화면과 같은 모양의 스켈레톤
 * - `login` 비로그인 — 로그인을 거쳐 돌아온다(`?redirect=`)
 * - `denied` 로그인했지만 관리자가 아니다 — 권한 없음 면(서버가 403 을 줘도 같은 면)
 * - `allowed` 관리자 — 섹션을 그린다. 요청을 막는 것은 여전히 서버다
 */
export type AdminAccess = 'pending' | 'login' | 'denied' | 'allowed'

export function adminAccess(status: AuthStatus, role: MemberRole | null): AdminAccess {
  if (status === 'unknown') return 'pending'
  if (status === 'anonymous') return 'login'
  return role === 'ADMIN' ? 'allowed' : 'denied'
}
