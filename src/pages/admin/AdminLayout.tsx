import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'

import { loginPath } from '@/app/authRedirect'
import type { LoginNoticeState } from '@/app/paths'
import { adminAccess, subscribeSignedOutElsewhere, useAuth, useMyRole } from '@/features/auth'
import { subscribeSessionExpired } from '@/shared/lib/http'

import { AdminDenied } from './AdminDenied'
import type { AdminOutletContext } from './adminOutlet'
import styles from './Admin.module.css'
import { ADMIN_SECTIONS, adminSectionAt } from './adminSections'
import { ManagersSkeleton } from './ManagersSkeleton'

/**
 * 관리자 화면의 틀 · `/admin/*` — **가드**와 **섹션 자리**(화면정의서 SCR-19).
 *
 * 가드(`adminAccess`) — 화면 표시용 판정이다. 권한은 서버가 가른다(관리자 API 는 서버가 403 으로 막는다, 보안명세서 1장)
 * - 세션을 되살리는 중 : 그 섹션의 스켈레톤(받은 화면과 같은 틀). 요청은 관리자로 확인된 뒤에 나간다
 * - 비로그인 : 로그인을 거쳐 이 주소로 돌아온다(`?redirect=`). 보는 도중 끊겼으면 까닭 한 줄을 싣는다(내가 쓴 글과 같은 문장)
 * - 관리자가 아님 · 서버 403 : 권한 없음 면(`AdminDenied`)
 * - 관리자 : 섹션(`Outlet`). 섹션이 둘 이상이면 제목 위에 섹션 이동 줄 — 지금은 하나라 그리지 않는다(`adminSections.ts`)
 */
export function AdminLayout() {
  const auth = useAuth()
  const role = useMyRole()
  const location = useLocation()
  const here = `${location.pathname}${location.search}`
  const access = adminAccess(auth.status, role)

  // 한 번이라도 관리자 화면을 로그인한 채로 봤나 — 그 뒤의 비로그인은 "끊김"이다(SCR-07 과 같은 판정)
  const [seen, setSeen] = useState(false)
  if (auth.status === 'authenticated' && !seen) setSeen(true)
  const [expired, setExpired] = useState(false)
  useEffect(() => subscribeSessionExpired(() => setExpired(true)), [])
  const [elsewhere, setElsewhere] = useState(false)
  useEffect(() => subscribeSignedOutElsewhere(() => setElsewhere(true)), [])

  // 서버가 거절했다. 토큰의 역할이 바뀌면(다시 로그인 · 재발급) 다시 물어본다 — 거절을 그 역할에만 묶는다
  const [deniedFor, setDeniedFor] = useState<string | null>(null)
  const serverDenied = role !== null && deniedFor === role
  const context = useMemo<AdminOutletContext>(() => ({ deny: () => setDeniedFor(role) }), [role])

  if (access === 'login') {
    const state: LoginNoticeState | undefined = seen
      ? {
          notice: expired
            ? '로그인이 만료됐어요. 다시 로그인해 주세요.'
            : elsewhere
              ? '다른 창에서 로그아웃했어요.'
              : '로그아웃했어요.',
        }
      : undefined
    return <Navigate to={loginPath(here)} replace state={state} />
  }

  // 섹션이 늘면 지금 주소의 섹션 스켈레톤을 고른다(`adminSectionAt`). 지금은 매니저 관리 하나
  if (access === 'pending') {
    return <ManagersSkeleton />
  }

  if (access === 'denied' || serverDenied) {
    return <AdminDenied />
  }

  return (
    <div className={styles.shell}>
      {ADMIN_SECTIONS.length > 1 ? <AdminSectionNav pathname={location.pathname} /> : null}
      <Outlet context={context} />
    </div>
  )
}

/**
 * 섹션 이동 줄 — 섹션이 둘 이상일 때만(지금은 그려지지 않는다). 내가 쓴 글 탭과 같은 밑줄 링크.
 * 지금 섹션은 `aria-current="page"` — 이 줄은 화면(경로)을 고른다
 */
function AdminSectionNav({ pathname }: { pathname: string }) {
  const current = adminSectionAt(pathname)
  return (
    <nav className={styles.sections} aria-label="관리 메뉴">
      <ul className={styles.sectionList} role="list">
        {ADMIN_SECTIONS.map((section) => (
          <li key={section.id}>
            <NavLink className={styles.section} to={section.path} aria-current={current?.id === section.id ? 'page' : undefined}>
              {section.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
