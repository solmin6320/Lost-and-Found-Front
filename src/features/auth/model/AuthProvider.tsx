import { hashKey, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react'

import { memberKeys, meQueryOptions, type PasswordUpdateRequest } from '@/features/members'
import { postKeys } from '@/features/posts'
import { subscribeSessionExpired } from '@/shared/lib/http'

import type { LoginRequest } from '../api/types'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { authReducer, initialAuthState } from './authReducer'
import { restoreSession, signIn, signOut, updatePasswordAndEndSession } from './session'

/**
 * 로그아웃 · 세션 만료 · 비밀번호 변경 뒤의 캐시 정리(보안명세서 8장).
 *
 * - **회원 개인 데이터는 지운다** — 내 정보(`memberKeys.all`) · 내가 쓴 글(`postKeys.mines()`).
 *   같은 기기의 다음 사용자가 이전 사용자의 것을 보면 안 된다
 * - **요청 기록도 지운다**(mutation 캐시). 비밀번호 변경의 입력값(현재 · 새 비밀번호)이 몇 분간 메모리에 남는다
 * - **공개 게시글 · 댓글은 두고 다시 받게만 한다**(`invalidateQueries`). 누가 봐도 같은 데이터다.
 *   통째로 비우면(`clear()`) 보던 상세 · 목록이 스켈레톤으로 깜빡이고 높이가 줄어 스크롤이 튄다
 *
 * 쓰던 댓글 · 글의 보관(`comment-draft:v1` · `post-draft:v1`)은 sessionStorage 라 여기서 건드리지 않는다
 */
function forgetMember(queryClient: QueryClient) {
  queryClient.getMutationCache().clear()
  queryClient.removeQueries({ queryKey: memberKeys.all })
  queryClient.removeQueries({ queryKey: postKeys.mines() })
  void queryClient.invalidateQueries({ queryKey: postKeys.all })
}

/**
 * 로그인 상태를 앱 전체에 준다. `QueryClientProvider` 안쪽에 둔다(로그아웃 시 회원 캐시를 지운다).
 *
 * 앱을 막지 않는다. 복구를 기다리는 동안에도 목록은 바로 뜬다(공개 API).
 * `status === 'unknown'` 동안 자리를 잡아야 하는 곳은 헤더뿐이다.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(authReducer, initialAuthState)

  // 앱 시작 시 한 번 — 새로고침으로 비워진 토큰을 리프레시 쿠키로 되살린다
  useEffect(() => {
    let active = true
    void restoreSession().then((me) => {
      if (active) {
        dispatch({ type: 'RESTORED', me })
      }
    })
    return () => {
      active = false
    }
  }, [])

  // 요청 도중 재발급이 거절되면 세션이 끝난 것이다. 이전 사용자의 데이터를 남기지 않는다
  useEffect(
    () =>
      subscribeSessionExpired(() => {
        forgetMember(queryClient)
        dispatch({ type: 'SESSION_EXPIRED' })
      }),
    [queryClient],
  )

  const login = useCallback(async (credentials: LoginRequest) => {
    const me = await signIn(credentials)
    dispatch({ type: 'LOGGED_IN', me })
    return me
  }, [])

  const logout = useCallback(async () => {
    await signOut()
    // 안 지우면 같은 기기의 다음 사용자가 이전 사용자의 데이터를 본다(보안명세서 8장)
    forgetMember(queryClient)
    dispatch({ type: 'LOGGED_OUT' })
  }, [queryClient])

  // 닉네임을 바꾸는 쪽(features/members)은 auth 를 모른다. members 가 auth 를 부르면 서로를 import 하게 된다.
  // 대신 여기서 members/me 캐시를 지켜보다가 새 값이 들어오면 헤더의 닉네임을 맞춘다
  useEffect(() => {
    const meQueryHash = hashKey(meQueryOptions().queryKey)

    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success' || event.query.queryHash !== meQueryHash) {
        return
      }
      const me = queryClient.getQueryData(meQueryOptions().queryKey)
      if (me) {
        dispatch({ type: 'ME_UPDATED', me })
      }
    })
  }, [queryClient])

  // 서버가 모든 기기의 리프레시 토큰을 지웠다. 이 기기도 즉시 로그아웃된 것처럼 동작한다(화면정의서 SCR-08).
  // "세션 만료"(subscribeSessionExpired)로 보내지 않는다 — 로그인 화면에 띄울 문장이 다르다
  const updatePassword = useCallback(
    async (body: PasswordUpdateRequest) => {
      await updatePasswordAndEndSession(body)
      forgetMember(queryClient)
      dispatch({ type: 'LOGGED_OUT' })
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, updatePassword }),
    [state, login, logout, updatePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
