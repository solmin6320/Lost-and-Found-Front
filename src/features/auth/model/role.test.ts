import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearAccessToken,
  getAccessTokenRemainingMs,
  getAccessTokenRole,
  readRoleClaim,
  setAccessToken,
  subscribeAccessTokenRole,
} from '@/shared/lib/http'

import { adminAccess, toMemberRole } from './role'

/** 서명 없는 시험용 JWT — 가운데 조각만 base64url(패딩 없이). 화면은 서명을 보지 않는다 */
function fakeJwt(claims: Record<string, unknown>): string {
  const base64url = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base64url({ alg: 'HS256' })}.${base64url(claims)}.signature`
}

afterEach(() => {
  clearAccessToken()
})

describe('토큰의 역할 클레임 읽기 — 화면 표시용', () => {
  it('role 클레임을 원문 그대로 읽는다', () => {
    expect(readRoleClaim(fakeJwt({ sub: '1', role: 'ADMIN' }))).toBe('ADMIN')
    expect(readRoleClaim(fakeJwt({ sub: '1', role: 'MANAGER' }))).toBe('MANAGER')
  })

  it('클레임이 없거나 문자열이 아니거나 토큰 모양이 틀리면 null', () => {
    expect(readRoleClaim(fakeJwt({ sub: '1' }))).toBeNull()
    expect(readRoleClaim(fakeJwt({ sub: '1', role: 3 }))).toBeNull()
    expect(readRoleClaim('not-a-jwt')).toBeNull()
    expect(readRoleClaim('a.@@@.c')).toBeNull()
    expect(readRoleClaim(`a.${btoa('[1,2]')}.c`)).toBeNull()
  })

  it('base64url(- _ · 패딩 없음)도 읽는다 — 닉네임 같은 긴 클레임이 섞여도', () => {
    const token = fakeJwt({ sub: '12', role: 'ADMIN', note: '>>>???<<<' })
    expect(token.split('.')[1]).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(readRoleClaim(token)).toBe('ADMIN')
  })

  it('토큰을 받으면 역할을 기억하고, 비우면 잊는다 — 수명 계산은 그대로', () => {
    setAccessToken(fakeJwt({ sub: '1', role: 'ADMIN', iat: 1000, exp: 1300 }))
    expect(getAccessTokenRole()).toBe('ADMIN')
    expect(getAccessTokenRemainingMs()).toBeGreaterThan(299_000)
    clearAccessToken()
    expect(getAccessTokenRole()).toBeNull()
    expect(getAccessTokenRemainingMs()).toBeNull()
  })

  it('역할이 바뀔 때만 알린다(재발급으로 같은 역할 토큰이 와도 다시 그리지 않는다)', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeAccessTokenRole(listener)
    setAccessToken(fakeJwt({ sub: '1', role: 'USER' }))
    setAccessToken(fakeJwt({ sub: '1', role: 'USER', jti: 'next' }))
    expect(listener).toHaveBeenCalledTimes(1)
    setAccessToken(fakeJwt({ sub: '1', role: 'MANAGER' }))
    expect(listener).toHaveBeenCalledTimes(2)
    clearAccessToken()
    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
    setAccessToken(fakeJwt({ sub: '1', role: 'ADMIN' }))
    expect(listener).toHaveBeenCalledTimes(3)
  })
})

describe('toMemberRole — 서버와 같이 없으면 회원', () => {
  it.each([
    ['ADMIN', 'ADMIN'],
    ['MANAGER', 'MANAGER'],
    ['USER', 'USER'],
    [null, 'USER'],
    ['admin', 'USER'],
    ['SUPER', 'USER'],
  ] as const)('%s → %s', (claim, role) => {
    expect(toMemberRole(claim)).toBe(role)
  })
})

describe('adminAccess — 관리자 화면 가드(화면 표시용, 막는 것은 서버)', () => {
  it('세션을 되살리는 중이면 기다린다(역할과 상관없이)', () => {
    expect(adminAccess('unknown', null)).toBe('pending')
    expect(adminAccess('unknown', 'ADMIN')).toBe('pending')
  })

  it('비로그인은 로그인으로', () => {
    expect(adminAccess('anonymous', null)).toBe('login')
  })

  it('로그인한 회원 · 매니저는 권한 없음, 관리자만 들어간다', () => {
    expect(adminAccess('authenticated', 'USER')).toBe('denied')
    expect(adminAccess('authenticated', 'MANAGER')).toBe('denied')
    expect(adminAccess('authenticated', null)).toBe('denied')
    expect(adminAccess('authenticated', 'ADMIN')).toBe('allowed')
  })
})
