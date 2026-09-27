import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { loginPath } from '@/app/authRedirect'
import { usePageGuide } from '@/app/onboarding'
import type { LoginNoticeState } from '@/app/paths'
import { useAuth } from '@/features/auth'
import type { LeaveFn } from '@/features/posts'
import { subscribeSessionExpired } from '@/shared/lib/http'

/**
 * 등록 · 수정 화면(SCR-02 · SCR-04)이 같이 쓰는 연결 — 로그인 여부 · 로그인이 끊겼을 때 · 헤더 `서비스 안내`.
 *
 * - `gate` : `pending`(세션 복구 중 — 폼 모양 스켈레톤) · `login`(처음부터 비로그인 — 로그인으로 보낸다) · `form`
 * - 쓰는 도중 로그인이 끊기면(재발급 거절 · 로그아웃) 폼을 **내리지 않는다.** 폼이 쓰던 글자를 보관한 뒤
 *   `onSessionLost` 를 부르고, 여기서 로그인 화면으로 보낸다(돌아올 곳 · 안내 한 줄을 싣는다)
 */
export function usePostWritePage() {
  const auth = useAuth()
  const location = useLocation()
  const here = `${location.pathname}${location.search}`

  // 한 번이라도 로그인한 채로 이 화면을 봤나 — 그 뒤의 비로그인은 "끊김"이다
  const [lastMemberId, setLastMemberId] = useState<number | null>(null)
  const currentId = auth.status === 'authenticated' ? auth.me.id : null
  // 그리는 중에 맞춘다(effect 로 한 박자 늦게 맞추면 끊긴 순간에 아직 null 일 수 있다)
  if (currentId !== null && currentId !== lastMemberId) setLastMemberId(currentId)

  // 재발급이 거절돼 끝났는지(만료), 사용자가 로그아웃했는지 — 로그인 화면의 문장이 다르다
  const expired = useRef(false)
  useEffect(() => subscribeSessionExpired(() => (expired.current = true)), [])

  const memberId = currentId ?? lastMemberId
  const gate: 'pending' | 'login' | 'form' =
    auth.status === 'unknown' ? 'pending' : memberId === null ? 'login' : 'form'

  function onSessionLost(draftSaved: boolean, leave: LeaveFn) {
    const first = expired.current ? '로그인이 만료됐습니다. 다시 로그인하세요.' : '로그아웃했어요.'
    const state: LoginNoticeState = {
      notice: draftSaved ? `${first} 로그인하면 쓰던 글을 이어서 쓸 수 있어요.` : first,
    }
    // 로그인 화면이 이 화면을 기록에서 대신한다 — 로그인하면 돌아올 곳은 `?redirect=`
    leave(loginPath(here), { replace: true, state })
  }

  // 헤더 `서비스 안내` — 목록으로 떠나지 않고 이 화면의 `쓰는 요령`을 연다(쓰던 글을 두고 가지 않는다)
  const [guideOpen, setGuideOpen] = useState(false)
  const guideRef = useRef<HTMLDivElement>(null)
  usePageGuide(() => {
    const root = guideRef.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    root.scrollIntoView({ block: 'center', behavior: reduce ? 'instant' : 'smooth' })
    root.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    setGuideOpen(true)
  })

  return {
    gate,
    memberId,
    signedIn: auth.status === 'authenticated',
    loginHref: loginPath(here),
    onSessionLost,
    guide: { guideOpen, onGuideOpenChange: setGuideOpen, guideRef },
  }
}
