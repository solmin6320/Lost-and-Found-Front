import { hashKey, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'

import { memberKeys, meQueryOptions, type PasswordUpdateRequest } from '@/features/members'
import { postKeys } from '@/features/posts'
import { clearAccessToken, expireSession, subscribeSessionExpired } from '@/shared/lib/http'
import { clearWriteDrafts } from '@/shared/lib/writeDrafts'

import type { LoginRequest } from '../api/types'
import { notifySignedOutElsewhere, openAuthChannel, type AuthChannel } from './authChannel'
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
 * 쓰던 댓글 · 글의 보관(`comment-draft:v1` · `post-draft:v1`)은 여기서 건드리지 않는다 — 세션 만료 뒤 이어 쓰려고 둔 것이다.
 * **직접 로그아웃**할 때만 `logout` 이 따로 지운다(공용 기기). 다른 탭에서 직접 로그아웃했을 때도 같다(`authChannel`)
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

  // 다른 탭에 로그인이 끝났음을 알리는 통로(보안명세서 3장). 열고 닫는 것은 아래 effect 가 한다
  const channel = useRef<AuthChannel | null>(null)
  // 다른 탭의 신호로 이 탭의 세션을 끝내는 중이다 — 그 만료를 다시 방송하지 않는다(메아리 금지)
  const relaying = useRef(false)

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

  // 요청 도중 재발급이 거절되면 세션이 끝난 것이다. 이전 사용자의 데이터를 남기지 않는다.
  // 리프레시 쿠키는 탭끼리 같이 쓰니 다른 탭의 세션도 끝났다 — 알린다(받은 탭이 5분까지 토큰을 들고 있지 않게)
  useEffect(
    () =>
      subscribeSessionExpired(() => {
        forgetMember(queryClient)
        dispatch({ type: 'SESSION_EXPIRED' })
        if (!relaying.current) channel.current?.post({ type: 'session-ended' })
      }),
    [queryClient],
  )

  // 다른 탭이 알려 왔다. 받은 탭은 다시 방송하지 않는다.
  // 보던 공개 화면은 그대로 두고(헤더만 로그인 버튼으로), 로그인이 필요한 화면은 평소의 비로그인 흐름을 따른다(로그인 화면 + 까닭 한 줄)
  useEffect(() => {
    const opened = openAuthChannel((message) => {
      if (message.type === 'logout') {
        // 로그인 상태가 바뀌기 전에 알린다 — 화면이 로그인 화면에 실을 문장을 고른다("다른 창에서 로그아웃했어요.")
        notifySignedOutElsewhere()
        clearAccessToken()
        forgetMember(queryClient)
        // 직접 로그아웃이다 — 이 탭에 남은 쓰던 글 보관도 지운다(sessionStorage 는 탭마다 따로다, 공용 기기)
        clearWriteDrafts()
        dispatch({ type: 'LOGGED_OUT' })
        return
      }
      // 세션 종료 — 이 탭에서 재발급이 거절된 것과 똑같이 다룬다(토큰 · 개인 캐시를 비우고, 쓰던 글은 보관한다).
      // 이 탭에 토큰이 없으면(이미 비로그인) 아무 일도 없다
      relaying.current = true
      try {
        expireSession()
      } finally {
        relaying.current = false
      }
    })
    channel.current = opened
    return () => {
      channel.current = null
      opened.close()
    }
  }, [queryClient])

  const login = useCallback(async (credentials: LoginRequest) => {
    const me = await signIn(credentials)
    dispatch({ type: 'LOGGED_IN', me })
    return me
  }, [])

  const logout = useCallback(async () => {
    await signOut()
    // 안 지우면 같은 기기의 다음 사용자가 이전 사용자의 데이터를 본다(보안명세서 8장)
    forgetMember(queryClient)
    // 스스로 로그아웃했다 — 이어 쓸 일이 없다. 쓰던 글 · 댓글의 보관도 지운다(공용 기기, 보안명세서 3장)
    clearWriteDrafts()
    dispatch({ type: 'LOGGED_OUT' })
    // 같은 기기의 다른 탭도 로그아웃시킨다 — 뒤에 남은 탭에서 다음 사람이 이전 사람으로 글을 쓰지 못하게
    channel.current?.post({ type: 'logout' })
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
      // 다른 탭의 리프레시 쿠키도 이미 죽었다. 5분 뒤 "만료"로 끊기기를 기다리지 않고 지금 알린다 — 쓰던 글은 보관한다(같은 사람이 다시 로그인한다)
      channel.current?.post({ type: 'session-ended' })
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, updatePassword }),
    [state, login, logout, updatePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
