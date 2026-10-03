import { useState, type ReactNode } from 'react'

import { allowLeave, hasDirtyFields, markSelfLogout } from '@/shared/lib/dirtyRegistry'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'

/**
 * 리프레시 토큰 쿠키의 수명 — 백엔드 `jwt.refresh-token-expiration`(7일, `AuthService` 의 쿠키 `maxAge`).
 * 백엔드가 바꾸면 이 값과 아래 문장도 같이 바꾼다(회의 SE-9)
 */
export const REFRESH_TOKEN_DAYS = 7

/** 로그아웃 버튼 바로 아래 흐린 한 줄 — 공용 기기에서 로그아웃해야 하는 이유를 버튼 곁에서 한 번(SE-9) */
export const STAY_SIGNED_IN_NOTE = `이 기기에서는 ${REFRESH_TOKEN_DAYS}일 동안 로그인이 유지돼요.`

/**
 * 로그아웃 — 쓰던 글자가 **있을 때만** 묻는다(회의 SE-5).
 *
 * - 쓰던 칸 등록부(`dirtyRegistry`)가 판정한다. 이탈 확인과 같은 기준이라 "어떤 화면은 묻고 어떤 화면은 안 묻는" 어긋남이 없다
 * - 묻는 창 : `쓰던 글을 두고 로그아웃할까요?` · [계속 쓰기](기본 포커스) · [로그아웃]. 쓰던 글은 **여전히 보관하지 않는다**
 *   (공용 기기 — 직접 로그아웃하면 남기지 않는다, 보안명세서 3장)
 * - 글자가 없으면 지금처럼 바로 로그아웃한다(되돌릴 수 있는 일, 화면정의서 1.10)
 * - 로그아웃을 고르면 등록부에 "이 창에서 고른 로그아웃"이라고 적는다 — 쓰던 칸이 다른 창 로그아웃(SE2-10)과 가른다
 *
 * 헤더 계정 메뉴와 설정 화면 끝의 [로그아웃]이 같이 쓴다.
 */
export function useGuardedLogout(logout: () => Promise<void>) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function run() {
    if (loggingOut) return
    markSelfLogout()
    // 쓰던 화면이 로그인 화면으로 옮겨질 때 이탈 확인을 다시 띄우지 않는다(방금 물었다)
    allowLeave()
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  function request() {
    if (loggingOut) return
    if (hasDirtyFields()) setConfirmOpen(true)
    else void run()
  }

  const dialog: ReactNode = (
    <ConfirmDialog
      open={confirmOpen}
      title="쓰던 글을 두고 로그아웃할까요?"
      confirmLabel="로그아웃"
      cancelLabel="계속 쓰기"
      onConfirm={() => {
        setConfirmOpen(false)
        void run()
      }}
      onClose={() => setConfirmOpen(false)}
    >
      <p>쓰던 글은 이 기기에 남기지 않아요.</p>
    </ConfirmDialog>
  )

  return { request, loggingOut, confirmOpen, dialog }
}
