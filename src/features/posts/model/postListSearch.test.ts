import { describe, expect, it } from 'vitest'

import {
  EMPTY_POST_LIST_SEARCH,
  POST_LIST_PAGE_SIZE,
  parsePostListSearch,
  toPostListParams,
  toSearchParams,
  type PostListSearch,
} from './postListSearch'

const parse = (query: string) => parsePostListSearch(new URLSearchParams(query))

describe('parsePostListSearch — 주소는 사용자가 고칠 수 있는 입력이다', () => {
  it('빈 주소는 빈 조건 · 1쪽', () => {
    expect(parse('')).toEqual(EMPTY_POST_LIST_SEARCH)
  })

  it('올바른 Enum 은 남긴다', () => {
    const search = parse('type=FOUND&category=WALLET&status=IN_PROGRESS')
    expect(search.type).toBe('FOUND')
    expect(search.category).toBe('WALLET')
    expect(search.status).toBe('IN_PROGRESS')
  })

  it.each([['type=lost'], ['type=ALL'], ['category=BAG'], ['status=CLOSED'], ['type=']])(
    '잘못된 Enum(%s)은 버린다',
    (query) => {
      const search = parse(query)
      expect(search.type).toBeUndefined()
      expect(search.category).toBeUndefined()
      expect(search.status).toBeUndefined()
    },
  )

  it('올바른 날짜는 남긴다', () => {
    const search = parse('from=2026-09-01&to=2026-09-28')
    expect(search.from).toBe('2026-09-01')
    expect(search.to).toBe('2026-09-28')
  })

  it.each([['2026-02-30'], ['2026-13-01'], ['2026-9-1'], ['20260901'], ['2026-09-01T00:00'], ['abc']])(
    '잘못된 날짜(%s)는 버린다',
    (value) => {
      expect(parse(`from=${value}`).from).toBeUndefined()
      expect(parse(`to=${value}`).to).toBeUndefined()
    },
  )

  it('from > to 면 둘 다 버린다(그대로 보내면 400)', () => {
    const search = parse('from=2026-09-10&to=2026-09-01')
    expect(search.from).toBeUndefined()
    expect(search.to).toBeUndefined()
  })

  it('from == to 는 남긴다', () => {
    expect(parse('from=2026-09-10&to=2026-09-10').from).toBe('2026-09-10')
  })

  it.each([['page=0'], ['page=-1'], ['page=1.5'], ['page=abc'], ['page=']])(
    '1 이상 정수가 아닌 page(%s)는 1쪽',
    (query) => {
      expect(parse(query).page).toBe(1)
    },
  )

  it('page=3 은 3쪽', () => {
    expect(parse('page=3').page).toBe(3)
  })

  it('검색어 · 장소는 앞뒤 공백을 지우고 100자로 자른다', () => {
    const search = parse(`keyword=${encodeURIComponent('  지갑  ')}&location=${'가'.repeat(150)}`)
    expect(search.keyword).toBe('지갑')
    expect(search.location).toHaveLength(100)
  })
})

describe('toSearchParams — 조건 → 주소', () => {
  it('빈 조건과 1쪽은 싣지 않는다', () => {
    expect(toSearchParams(EMPTY_POST_LIST_SEARCH).toString()).toBe('')
    expect(toSearchParams({ ...EMPTY_POST_LIST_SEARCH, keyword: '지갑' }).has('page')).toBe(false)
  })

  it('2쪽부터 page 를 싣는다', () => {
    expect(toSearchParams({ ...EMPTY_POST_LIST_SEARCH, page: 2 }).get('page')).toBe('2')
  })

  it('주소 → 조건 → 주소가 같은 값으로 돌아온다', () => {
    const query = 'keyword=%EC%A7%80%EA%B0%91&type=LOST&category=CARD&from=2026-09-01&page=4'
    expect(toSearchParams(parse(query)).toString()).toBe(query)
  })

  it('page=0 주소는 다시 쓰면 page 가 빠진다', () => {
    expect(toSearchParams(parse('page=0')).has('page')).toBe(false)
  })
})

describe('toPostListParams — URL page(1부터) → 서버 page(0부터)', () => {
  const at = (page: number): PostListSearch => ({ ...EMPTY_POST_LIST_SEARCH, page })

  it.each([
    [1, 0],
    [2, 1],
    [10, 9],
  ])('화면 %i쪽 → 서버 page=%i', (page, serverPage) => {
    expect(toPostListParams(at(page)).page).toBe(serverPage)
  })

  it('쪽 크기를 싣는다', () => {
    expect(toPostListParams(at(1)).size).toBe(POST_LIST_PAGE_SIZE)
  })

  it('page=0 주소는 서버 page=0(첫 쪽)으로 간다', () => {
    expect(toPostListParams(parse('page=0')).page).toBe(0)
  })
})
