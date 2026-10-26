import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ApiError, NetworkError } from '@/shared/lib/http'

import type { AdminMemberResponse } from '../api/types'
import { ManagerChangeDialog } from '../ui/ManagerChangeDialog'
import { ACCESS_TOKEN_MINUTES, managerChangeCopy, managerChangeFailure, managerChangeFor } from './managerChange'

const member: AdminMemberResponse = {
  id: 7,
  email: 'haneul.park@example.com',
  nickname: '박하늘',
  role: 'USER',
  createdAt: '2026-09-23T10:11:12',
}

describe('줄마다 할 수 있는 변경 — 하나뿐', () => {
  it('회원은 임명, 매니저는 해임, 관리자는 없음(서버 설정으로만)', () => {
    expect(managerChangeFor('USER')).toBe('appoint')
    expect(managerChangeFor('MANAGER')).toBe('dismiss')
    expect(managerChangeFor('ADMIN')).toBeNull()
  })
})

describe('확인 창 문구 — 누르기 전에, 한 번, 숫자까지', () => {
  it.each(['appoint', 'dismiss'] as const)('%s : 누구에게 · 언제 로그인이 풀리는지 · 다시 로그인해야 적용', (change) => {
    const copy = managerChangeCopy(member.nickname, change)
    expect(copy.title).toContain('박하늘 님')
    expect(copy.result).toContain(`${ACCESS_TOKEN_MINUTES}분 안에 로그인이 풀려요`)
    expect(copy.result).toContain('다시 로그인하면')
    expect(copy.done).toContain('다시 로그인하면 적용돼요')
    // 보이는 문장에 줄표를 쓰지 않는다(design-taste 9.G) · 해요체
    for (const text of Object.values(copy)) {
      expect(text).not.toMatch(/[—–]/)
      expect(text).not.toMatch(/습니다|십시오/)
    }
  })

  it('임명 · 해임의 동사가 버튼 · 확인 · 진행 중 글자에 맞게', () => {
    expect(managerChangeCopy('a', 'appoint')).toMatchObject({ action: '매니저로 임명', confirmLabel: '임명하기', pendingLabel: '임명하는 중' })
    expect(managerChangeCopy('a', 'dismiss')).toMatchObject({ action: '매니저 해임', confirmLabel: '해임하기', pendingLabel: '해임하는 중' })
  })

  it('확인 창이 대상의 이메일 · 결과 · 확인 버튼을 그린다(기본 포커스는 취소 — ConfirmDialog)', () => {
    const markup = renderToStaticMarkup(
      <ManagerChangeDialog
        target={{ member, change: 'appoint' }}
        open
        pending={false}
        error={null}
        onConfirm={() => {}}
        onClose={() => {}}
        fallbackFocus={() => null}
      />,
    )
    expect(markup).toContain('박하늘 님을 매니저로 임명할까요?')
    expect(markup).toContain('haneul.park@example.com')
    expect(markup).toContain(`${ACCESS_TOKEN_MINUTES}분 안에 로그인이 풀려요`)
    expect(markup).toContain('임명하기')
    expect(markup).toContain('취소')
    const dismiss = renderToStaticMarkup(
      <ManagerChangeDialog
        target={{ member: { ...member, role: 'MANAGER' }, change: 'dismiss' }}
        open
        pending={false}
        error={null}
        onConfirm={() => {}}
        onClose={() => {}}
        fallbackFocus={() => null}
      />,
    )
    expect(dismiss).toContain('박하늘 님을 매니저에서 해임할까요?')
    expect(dismiss).toContain('해임하기')
  })

  it('실패 문장은 창 안에 그대로(서버 message)', () => {
    const markup = renderToStaticMarkup(
      <ManagerChangeDialog
        target={{ member, change: 'appoint' }}
        open
        pending={false}
        error="서버 내부 오류가 발생했습니다"
        onConfirm={() => {}}
        onClose={() => {}}
        fallbackFocus={() => null}
      />,
    )
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('서버 내부 오류가 발생했습니다')
  })
})

describe('실패했을 때 할 일', () => {
  const api = (status: number, code: string) => new ApiError(status, code, 'message')

  it('그사이 바뀐 줄(409 · 404)은 창을 닫고 목록을 맞춘다', () => {
    expect(managerChangeFailure(api(409, 'ALREADY_MANAGER'))).toBe('stale')
    expect(managerChangeFailure(api(409, 'NOT_MANAGER'))).toBe('stale')
    expect(managerChangeFailure(api(409, 'ADMIN_ROLE_LOCKED'))).toBe('stale')
    expect(managerChangeFailure(api(404, 'MEMBER_NOT_FOUND'))).toBe('stale')
  })

  it('403 ACCESS_DENIED 는 권한 없음 면으로', () => {
    expect(managerChangeFailure(api(403, 'ACCESS_DENIED'))).toBe('denied')
  })

  it('연결 끊김 · 서버 오류는 창을 열어 둔 채 다시 누를 수 있게', () => {
    expect(managerChangeFailure(api(500, 'INTERNAL_SERVER_ERROR'))).toBe('retry')
    expect(managerChangeFailure(new NetworkError())).toBe('retry')
  })
})
