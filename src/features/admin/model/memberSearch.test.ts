import { describe, expect, it } from 'vitest'

import { normalizeAdminMemberParams } from '../api/adminApi'
import {
  ADMIN_KEYWORD_MAX_LENGTH,
  adminMemberSearchParams,
  cleanKeyword,
  memberPageAnnouncement,
  parseAdminMemberSearch,
  resultScopeLabel,
  toAdminMemberParams,
} from './memberSearch'

const parse = (query: string) => parseAdminMemberSearch(new URLSearchParams(query))

describe('매니저 관리 조건 — 주소 읽기', () => {
  it('기본값 — 검색어 없음 · 전체 · 1페이지', () => {
    expect(parse('')).toEqual({ keyword: '', role: undefined, page: 1 })
  })

  it('검색어 · 역할 · 페이지', () => {
    expect(parse('keyword=kim&role=MANAGER&page=3')).toEqual({ keyword: 'kim', role: 'MANAGER', page: 3 })
  })

  it('모르는 역할 · 소문자 역할은 버린다(요청까지 가지 않는다 — 서버는 400)', () => {
    expect(parse('role=SUPER').role).toBeUndefined()
    expect(parse('role=manager').role).toBeUndefined()
  })

  it('잘못된 페이지는 1페이지(목록과 같은 규칙)', () => {
    expect(parse('page=0').page).toBe(1)
    expect(parse('page=1e1').page).toBe(1)
    expect(parse('page=abc').page).toBe(1)
  })

  it('검색어는 앞뒤 공백을 자르고 칸 최대 글자까지(글자 단위로 — 그림 글자가 반쪽으로 잘리지 않게)', () => {
    expect(cleanKeyword('  kim  ')).toBe('kim')
    expect(cleanKeyword(null)).toBe('')
    expect(cleanKeyword('   ')).toBe('')
    const long = '가'.repeat(ADMIN_KEYWORD_MAX_LENGTH + 10)
    expect(Array.from(cleanKeyword(long))).toHaveLength(ADMIN_KEYWORD_MAX_LENGTH)
    const emoji = '😀'.repeat(ADMIN_KEYWORD_MAX_LENGTH + 1)
    expect(Array.from(cleanKeyword(emoji))).toHaveLength(ADMIN_KEYWORD_MAX_LENGTH)
    expect(cleanKeyword(emoji)).not.toMatch(/[\uD800-\uDBFF]$/)
  })
})

describe('매니저 관리 조건 — 주소 쓰기 · 서버 요청', () => {
  it('기본값은 주소에 쓰지 않는다', () => {
    expect(adminMemberSearchParams({ keyword: '', role: undefined, page: 1 }).toString()).toBe('')
    expect(adminMemberSearchParams({ keyword: 'kim', role: 'ADMIN', page: 2 }).toString()).toBe('keyword=kim&role=ADMIN&page=2')
  })

  it('읽고 쓰면 같은 주소', () => {
    const query = 'keyword=%EA%B9%80&role=USER&page=4'
    expect(adminMemberSearchParams(parse(query)).toString()).toBe(query)
  })

  it('서버에는 0부터의 페이지 · 20건, 빈 검색어 · 전체 역할은 싣지 않는다', () => {
    expect(toAdminMemberParams({ keyword: '', role: undefined, page: 1 })).toEqual({
      keyword: undefined,
      role: undefined,
      page: 0,
      size: 20,
    })
    expect(normalizeAdminMemberParams(toAdminMemberParams({ keyword: 'kim', role: 'MANAGER', page: 3 }))).toEqual({
      keyword: 'kim',
      role: 'MANAGER',
      page: 2,
      size: 20,
    })
  })

  it('같은 조건은 같은 캐시 키 — 공백 · 0페이지 · 모르는 역할을 다듬는다', () => {
    expect(normalizeAdminMemberParams({ keyword: '  ', page: 0, size: 20 })).toEqual({ size: 20 })
    expect(normalizeAdminMemberParams({ keyword: ' kim ', role: 'X' as never })).toEqual({ keyword: 'kim' })
  })
})

describe('결과 제목 · 알림', () => {
  it('검색어를 문장에 넣지 않는다(위조 통로) — 검색이면 `검색 결과`, 아니면 역할 이름 · 전체', () => {
    expect(resultScopeLabel({ keyword: '고객센터 02-000-0000', role: 'MANAGER' })).toBe('검색 결과')
    expect(resultScopeLabel({ keyword: '', role: 'MANAGER' })).toBe('매니저')
    expect(resultScopeLabel({ keyword: '', role: 'ADMIN' })).toBe('관리자')
    expect(resultScopeLabel({ keyword: '', role: 'USER' })).toBe('회원')
    expect(resultScopeLabel({ keyword: '', role: undefined })).toBe('전체')
  })

  it('페이지를 넘긴 결과 — 목록과 같은 모양, 세는 말만 명 · 회원', () => {
    expect(memberPageAnnouncement(3, 20, 128)).toBe('3페이지예요. 128명 중 41~60번째 회원이에요.')
    expect(memberPageAnnouncement(7, 8, 1208)).toBe('7페이지예요. 1,208명 중 121~128번째 회원이에요.')
  })
})
