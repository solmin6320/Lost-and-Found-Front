import {
  getMe,
  updatePassword,
  type MemberResponse,
  type PasswordUpdateRequest,
} from '@/features/members'
import { clearAccessToken, refreshAccessToken, setAccessToken } from '@/shared/lib/http'

import { login, logout } from '../api/authApi'
import type { LoginRequest } from '../api/types'

/**
 * 로그인·세션 복구·로그아웃 흐름. React 를 모른다. AuthProvider 가 결과를 상태로 옮긴다.
 *
 * 토큰 응답(`LoginResponse`)에 회원 식별자가 없어서, 토큰을 받은 뒤 항상 `GET /api/members/me` 로
 * 누구인지 묻는다. 그것이 실패하면 토큰도 버린다 — "토큰은 있는데 누군지 모름" 상태를 만들지 않는다.
 */

async function loadMe(): Promise<MemberResponse> {
  try {
    return await getMe()
  } catch (error) {
    clearAccessToken()
    throw error
  }
}

/** 로그인 후 내 정보를 돌려준다. 실패하면 서버 오류(`INVALID_CREDENTIALS` 등)를 그대로 던진다 */
export async function signIn(credentials: LoginRequest): Promise<MemberResponse> {
  const { accessToken } = await login(credentials)
  setAccessToken(accessToken)
  return loadMe()
}

let restoring: Promise<MemberResponse | null> | null = null

/**
 * 앱 시작 시 세션 복구. 새로고침으로 비워진 메모리 토큰을 리프레시 쿠키로 되살린다.
 *
 * **던지지 않는다.** 쿠키 없음·만료·백엔드 꺼짐 모두 `null`(비로그인)이다.
 * 앱이 `unknown` 에 머물면 헤더가 영원히 자리표시자로 남는다.
 * 재시도하지 않는다. 한 번 실패하면 비로그인으로 시작한다.
 *
 * 개발 모드의 StrictMode 가 effect 를 두 번 돌려도 요청은 한 번씩만 나가도록 진행 중인 복구를 공유한다.
 */
export function restoreSession(): Promise<MemberResponse | null> {
  restoring ??= runRestore().finally(() => {
    restoring = null
  })
  return restoring
}

async function runRestore(): Promise<MemberResponse | null> {
  try {
    await refreshAccessToken()
    return await loadMe()
  } catch {
    return null
  }
}

/**
 * 서버에 로그아웃을 알리고 이 기기의 토큰을 비운다. **던지지 않는다.**
 *
 * 서버 호출이 네트워크 오류로 실패해도 이 기기에서는 로그아웃한다.
 * 다만 그때는 HttpOnly 리프레시 쿠키가 남아, 새로고침하면 다시 로그인된다. JS 로는 지울 수 없다.
 */
export async function signOut(): Promise<void> {
  try {
    await logout()
  } catch {
    // 이 기기에서는 끝낸다
  } finally {
    clearAccessToken()
  }
}

/**
 * 비밀번호를 바꾸고 이 기기의 토큰을 비운다. **로그아웃 API 는 부르지 않는다.**
 *
 * 성공했다면 서버가 이미 리프레시 토큰을 지웠다(모든 기기 로그아웃). 로그아웃 API 를 또 부르면
 * 할 일이 없는 요청이고, 그 요청이 실패해도 결과는 같다. 브라우저에 쿠키는 남지만
 * 다음 재발급이 `REFRESH_TOKEN_MISMATCH` 로 거절돼 조용히 비로그인이 된다.
 *
 * 액세스 토큰은 서버에서 최대 5분 더 유효하지만 기다리지 않고 지금 버린다.
 * 그냥 두면 "모든 기기에서 로그아웃됩니다"라고 알린 뒤에도 화면은 로그인 상태로 남았다가,
 * 5분 안의 아무 시점에 재발급이 거절되며 "로그인이 만료됐어요"로 끊긴다.
 *
 * 실패하면(`PASSWORD_MISMATCH` 등) 그대로 던지고 토큰은 건드리지 않는다.
 */
export async function updatePasswordAndEndSession(body: PasswordUpdateRequest): Promise<void> {
  await updatePassword(body)
  clearAccessToken()
}
