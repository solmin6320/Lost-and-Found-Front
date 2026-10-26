import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthContext, type AuthContextValue } from '@/features/auth/model/AuthContext'
import { clearAccessToken, setAccessToken } from '@/shared/lib/http'

import { AdminLayout } from './AdminLayout'
import { useAdminOutlet } from './adminOutlet'

/*
 * 관리자 틀의 가드(SCR-19) — 세션 복구 중 · 비로그인 · 회원 · 매니저 · 관리자에서 무엇을 그리는지.
 * 역할은 토큰의 `role` 클레임(화면 표시용)이다. 막는 것은 서버이고, 서버 403 도 같은 권한 없음 면이 된다(`useAdminOutlet().deny`) —
 * 그 전환은 브라우저 점검에서 잰다(정적 그리기는 effect 를 돌리지 않는다)
 */

function fakeJwt(claims: Record<string, unknown>): string {
  const part = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${part({ alg: 'HS256' })}.${part(claims)}.sig`
}

const noop = async () => {}
const me = { id: 1, email: 'admin@example.com', nickname: '관리하는사람', createdAt: '2026-09-01T09:00:00' }

/** 섹션 자리 — 틀이 넘긴 것을 받는지 본다 */
function Section() {
  const outlet = useAdminOutlet()
  const location = useLocation()
  return <p>{`섹션 ${location.pathname} ${typeof outlet.deny}`}</p>
}

function render(status: 'unknown' | 'anonymous' | 'authenticated', role?: string): string {
  if (status === 'authenticated') setAccessToken(fakeJwt(role ? { sub: '1', role } : { sub: '1' }))
  const auth = {
    status,
    me: status === 'authenticated' ? me : null,
    login: noop,
    logout: noop,
    updatePassword: noop,
  } as unknown as AuthContextValue
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/admin/managers?role=MANAGER']}>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="managers" element={<Section />} />
          </Route>
          <Route path="/login" element={<p>로그인 화면</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  clearAccessToken()
})

describe('관리자 틀 — 가드', () => {
  it('세션을 되살리는 중 : 받은 화면과 같은 틀의 스켈레톤(제목 · 찾기 · 탭 · 줄), 섹션은 아직 그리지 않는다', () => {
    const markup = render('unknown')
    expect(markup).toContain('<h1')
    expect(markup).toContain('매니저 관리')
    expect(markup).toContain('회원 찾기')
    expect(markup).toContain('역할별로 보기')
    expect(markup).toContain('회원 목록을 불러오는 중이에요')
    expect(markup).not.toContain('섹션 ')
  })

  it('비로그인 : 섹션도 권한 없음 면도 그리지 않는다(로그인으로 보낸다 — Navigate)', () => {
    const markup = render('anonymous')
    expect(markup).not.toContain('섹션 ')
    expect(markup).not.toContain('관리자만 볼 수 있는 화면이에요.')
    expect(markup).not.toContain('매니저 관리')
  })

  it.each([
    ['회원(역할 클레임 없음)', undefined],
    ['회원', 'USER'],
    ['매니저', 'MANAGER'],
    ['모르는 역할', 'SUPER'],
  ])('%s : 권한 없음 면 — 이유와 나갈 문, 섹션은 그리지 않는다', (_, role) => {
    const markup = render('authenticated', role)
    expect(markup).toContain('관리자만 볼 수 있는 화면이에요.')
    expect(markup).toContain('다시 로그인')
    expect(markup).toContain('목록으로')
    expect(markup).not.toContain('섹션 ')
    expect(markup).not.toContain('회원 찾기')
  })

  it('관리자 : 섹션을 그리고 서버 거절을 알릴 통로(deny)를 넘긴다. 섹션이 하나뿐이라 섹션 이동 줄은 없다', () => {
    const markup = render('authenticated', 'ADMIN')
    expect(markup).toContain('섹션 /admin/managers function')
    expect(markup).not.toContain('관리자만 볼 수 있는 화면이에요.')
    expect(markup).not.toContain('관리 메뉴')
  })
})
