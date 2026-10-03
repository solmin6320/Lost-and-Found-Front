import { describe, expect, it } from 'vitest'

import {
  EMPTY_PLACE_DRAFT,
  EMPTY_POST_LIST_SEARCH,
  POST_LIST_MAX_PAGES,
  POST_LIST_PAGE_SIZE,
  applyPlaceDraft,
  conditionNavigation,
  expandNavigation,
  parsePostListSearch,
  placeDraftFromSearch,
  postListConditionKey,
  postListProgress,
  toPostListParams,
  toSearchParams,
  withChoice,
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

  it('page=3 은 묶음 셋을 펼친 것', () => {
    expect(parse('page=3').page).toBe(3)
  })

  it.each([['page=5'], ['page=9'], ['page=100']])('상한을 넘는 예전 쪽 번호(%s)는 펼칠 수 있는 끝(4)으로 읽는다', (query) => {
    expect(parse(query).page).toBe(POST_LIST_MAX_PAGES)
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

describe('toPostListParams — 펼친 수 n → 처음부터 24n 건을 한 번에', () => {
  const at = (page: number): PostListSearch => ({ ...EMPTY_POST_LIST_SEARCH, page })

  it.each([
    [1, 24],
    [2, 48],
    [3, 72],
    [4, 96],
  ])('n=%i → page=0 · size=%i', (page, size) => {
    expect(toPostListParams(at(page))).toMatchObject({ page: 0, size })
  })

  it('서버 상한(100)을 넘지 않는다 — n 이 4를 넘어도 96건', () => {
    expect(toPostListParams(at(9)).size).toBe(POST_LIST_PAGE_SIZE * POST_LIST_MAX_PAGES)
    expect(POST_LIST_PAGE_SIZE * POST_LIST_MAX_PAGES).toBeLessThanOrEqual(100)
  })

  it('예전 쪽 번호 링크(?page=3 = 49~72번째)는 1~72번째를 받아 그 쪽의 글이 다 들어 있다', () => {
    const params = toPostListParams(parse('page=3'))
    expect(params.page).toBe(0)
    expect(params.size).toBeGreaterThanOrEqual(72)
  })

  it('page=0 주소는 첫 묶음', () => {
    expect(toPostListParams(parse('page=0'))).toMatchObject({ page: 0, size: POST_LIST_PAGE_SIZE })
  })

  it('조건은 그대로 싣는다', () => {
    const params = toPostListParams(parse('keyword=%EC%A7%80%EA%B0%91&type=FOUND&category=WALLET&page=2'))
    expect(params).toMatchObject({ keyword: '지갑', type: 'FOUND', category: 'WALLET', size: 48 })
  })
})

describe('[더 보기] — 펼치기는 바꿔 쓰고(replace), 조건은 기록을 쌓는다', () => {
  const search: PostListSearch = { ...EMPTY_POST_LIST_SEARCH, keyword: '지갑', type: 'LOST', page: 1 }

  it('펼치면 묶음이 하나 늘고 주소를 바꿔 쓴다', () => {
    expect(expandNavigation(search)).toEqual({ search: { ...search, page: 2 }, replace: true })
  })

  it('상한(4)에서는 더 늘지 않는다', () => {
    expect(expandNavigation({ ...search, page: 4 }).search.page).toBe(4)
  })

  it('조건을 바꾸면 첫 묶음으로 돌아가고 기록을 쌓는다', () => {
    expect(conditionNavigation({ ...search, page: 3, category: 'CARD' })).toEqual({
      search: { ...search, page: 1, category: 'CARD' },
      replace: false,
    })
  })

  it('펼친 수만 다르면 조건 지문이 같다(이미 본 카드를 흐리지 않는 판정)', () => {
    expect(postListConditionKey({ ...search, page: 3 })).toBe(postListConditionKey(search))
    expect(postListConditionKey({ ...search, keyword: '카드' })).not.toBe(postListConditionKey(search))
  })
})

describe('postListProgress — 목록 끝에서 할 일', () => {
  const at = (page: number) => ({ page })

  it('더 받을 글이 있으면 다음 묶음 수와 함께 [더 보기]', () => {
    expect(postListProgress(at(1), 24, 57)).toEqual({ kind: 'more', next: 24 })
    expect(postListProgress(at(2), 48, 57)).toEqual({ kind: 'more', next: 9 })
  })

  it('다 보여 줬으면 끝', () => {
    expect(postListProgress(at(3), 57, 57)).toEqual({ kind: 'end' })
    expect(postListProgress(at(1), 0, 0)).toEqual({ kind: 'end' })
  })

  it('96건에 닿았는데 더 있으면 "조건을 좁혀 보세요"', () => {
    expect(postListProgress(at(4), 96, 120)).toEqual({ kind: 'capped' })
  })

  it('딱 96건이면 상한이 아니라 끝', () => {
    expect(postListProgress(at(4), 96, 96)).toEqual({ kind: 'end' })
  })
})

describe('칩 하나 = 묶음 하나 — 카테고리 · 상태는 고르면 바로 건다', () => {
  const search: PostListSearch = {
    ...EMPTY_POST_LIST_SEARCH,
    keyword: '지갑',
    type: 'FOUND',
    status: 'OPEN',
    location: '강남',
    page: 3,
  }

  it('고른 값만 바꾸고 나머지 조건은 그대로, 첫 묶음으로', () => {
    expect(withChoice(search, 'category', 'WALLET')).toEqual({ ...search, category: 'WALLET', page: 1 })
  })

  it('"전체"(undefined)는 그 묶음만 지운다', () => {
    const next = withChoice(search, 'status', undefined)
    expect(next.status).toBeUndefined()
    expect(next).toMatchObject({ keyword: '지갑', type: 'FOUND', location: '강남', page: 1 })
  })

  it('고른 값은 주소에 실린다', () => {
    expect(toSearchParams(withChoice(search, 'category', 'CARD')).get('category')).toBe('CARD')
  })
})

describe('장소 · 기간 [지우기] — 보이는 칸만 지운다', () => {
  const search: PostListSearch = {
    ...EMPTY_POST_LIST_SEARCH,
    keyword: '지갑',
    type: 'LOST',
    category: 'WALLET',
    status: 'IN_PROGRESS',
    location: '강남역',
    from: '2026-09-01',
    to: '2026-09-20',
    page: 2,
  }

  it('시트가 여는 값은 장소 · 기간 셋뿐', () => {
    expect(placeDraftFromSearch(search)).toEqual({ location: '강남역', from: '2026-09-01', to: '2026-09-20' })
  })

  it('지운 뒤 적용하면 장소 · 기간만 빠지고 카테고리 · 상태 · 검색어 · 유형은 남는다', () => {
    const next = applyPlaceDraft(search, EMPTY_PLACE_DRAFT)
    expect(next.location).toBe('')
    expect(next.from).toBeUndefined()
    expect(next.to).toBeUndefined()
    expect(next).toMatchObject({ keyword: '지갑', type: 'LOST', category: 'WALLET', status: 'IN_PROGRESS', page: 1 })
  })

  it('적용하면 장소는 다듬고 잘못된 날짜는 버린다', () => {
    const next = applyPlaceDraft(search, { location: '  서울숲  ', from: '2026-02-30', to: '2026-09-20' })
    expect(next).toMatchObject({ location: '서울숲', from: undefined, to: '2026-09-20' })
  })
})
