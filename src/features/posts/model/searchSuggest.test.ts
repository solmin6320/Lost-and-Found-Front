import { describe, expect, it } from 'vitest'

import { EMPTY_POST_LIST_SEARCH, type PostListSearch } from './postListSearch'
import {
  SUGGESTION_DEBOUNCE_MS,
  SUGGESTION_LIMIT,
  SUGGESTION_HOLD_EMPTY_MS,
  isSyllableInFlux,
  resolveSuggestions,
  withoutPendingFinal,
  foldLead,
  highlightParts,
  suggestTerm,
  suggestionKeyAction,
  suggestionParams,
  titleMatches,
} from './searchSuggest'

describe('suggestTerm — 입력칸 글자 → 추천을 찾을 말', () => {
  it('빈칸 · 공백뿐이면 찾지 않는다', () => {
    expect(suggestTerm('', false)).toBe('')
    expect(suggestTerm('   ', false)).toBe('')
    expect(suggestTerm('　 ', false)).toBe('')
  })

  it('한 글자부터 찾는다(앞뒤 공백은 지운다)', () => {
    expect(suggestTerm(' 지 ', false)).toBe('지')
  })

  it('조합 중이면 끝에 매달린 낱자모는 떼고 찾는다 — "지ㄱ"은 "지"', () => {
    expect(suggestTerm('지ㄱ', true)).toBe('지')
    expect(suggestTerm('검은 ㅈ', true)).toBe('검은')
    expect(suggestTerm('ㅈ', true)).toBe('')
  })

  it('조합 중이어도 완성된 글자는 그대로 — 마지막 글자가 조합 중으로 남아도 찾는다', () => {
    expect(suggestTerm('지갑', true)).toBe('지갑')
  })

  it('조합이 끝난 낱자모는 사용자가 친 말이라 그대로', () => {
    expect(suggestTerm('ㅋㅋ', false)).toBe('ㅋㅋ')
  })

  it('검색어 한도(100자)로 자른다', () => {
    expect(suggestTerm('가'.repeat(150), false)).toHaveLength(100)
  })
})

describe('isSyllableInFlux — 조합 중인 끝 글자는 곧 바뀐다', () => {
  it('조합 중 끝이 한글 완성 글자 — "직"(받침이 다음 글자로 옮겨 간다), "지가"(받침이 붙는다)', () => {
    expect(isSyllableInFlux('직', true)).toBe(true)
    expect(isSyllableInFlux('지가', true)).toBe(true)
  })

  it('끝이 한글 완성 글자가 아니면 아니다', () => {
    expect(isSyllableInFlux('ipad', true)).toBe(false)
    expect(isSyllableInFlux('', true)).toBe(false)
  })

  it('조합이 끝났으면 그 글자는 사용자가 고른 글자다', () => {
    expect(isSyllableInFlux('직', false)).toBe(false)
  })

  it('0건을 미루는 시간은 1초보다 짧다 — 멈추면 곧 사실을 말한다', () => {
    expect(SUGGESTION_HOLD_EMPTY_MS).toBeGreaterThan(SUGGESTION_DEBOUNCE_MS)
    expect(SUGGESTION_HOLD_EMPTY_MS).toBeLessThan(1000)
  })
})

describe('SUGGESTION_DEBOUNCE_MS — 치는 대로 바로바로', () => {
  it('사람이 즉시로 느끼는 안쪽(150ms 이하)', () => {
    expect(SUGGESTION_DEBOUNCE_MS).toBeLessThanOrEqual(150)
    expect(SUGGESTION_DEBOUNCE_MS).toBeGreaterThan(0)
  })
})

describe('suggestionParams — 그 말로 Enter 를 눌렀을 때 나올 목록의 앞 5건', () => {
  const search: PostListSearch = { ...EMPTY_POST_LIST_SEARCH, keyword: '지갑', type: 'LOST', category: 'WALLET', page: 3 }

  it('새 말이면 분실 · 습득을 함께(종류를 풀고), 칩 조건은 그대로, 첫 쪽 5건', () => {
    const params = suggestionParams(search, '카드')
    expect(params).toMatchObject({ keyword: '카드', category: 'WALLET', page: 0, size: SUGGESTION_LIMIT })
    expect(params.type).toBeUndefined()
  })

  it('지금 검색어와 같은 말이면 골라 둔 종류를 그대로(Enter 결과와 같다)', () => {
    expect(suggestionParams(search, '지갑').type).toBe('LOST')
  })

  it('상태를 고르지 않았으면 목록과 같은 "진행 중"(게시중 + 연락중)', () => {
    expect(suggestionParams(search, '카드').status).toEqual(['OPEN', 'IN_PROGRESS'])
  })

  it('상태를 골랐으면 그 상태', () => {
    expect(suggestionParams({ ...search, status: 'DONE' }, '카드').status).toEqual(['DONE'])
  })
})

describe('highlightParts — 제목에서 맞는 조각만 강조', () => {
  const marked = (text: string, term: string) =>
    highlightParts(text, term)
      .map((part) => (part.match ? `[${part.text}]` : part.text))
      .join('')

  it('맞는 조각만 표시하고, 나머지는 그대로', () => {
    expect(highlightParts('검은색 가죽 반지갑', '지갑')).toEqual([
      { text: '검은색 가죽 반', match: false },
      { text: '지갑', match: true },
    ])
  })

  it('대소문자를 가리지 않고, 원래 글자 모양을 지킨다', () => {
    expect(marked('AirPods Pro 2세대', 'airpods')).toBe('[AirPods] Pro 2세대')
  })

  it('맞는 곳이 여럿이면 모두', () => {
    expect(marked('카드지갑 속 카드', '카드')).toBe('[카드]지갑 속 [카드]')
  })

  it('정규식 기호는 글자 그대로 찾는다', () => {
    expect(marked('자동차 열쇠 (현대) 주웠습니다', '(현대')).toBe('자동차 열쇠 [(현대]) 주웠습니다')
    expect(marked('a.b*c', '.b*')).toBe('a[.b*]c')
    expect(marked('가격 [1-2]만원', '[1-2]')).toBe('가격 [[1-2]]만원')
  })

  it('찾는 말이 없거나 맞지 않으면 통째로 한 조각', () => {
    expect(highlightParts('갈색 카드지갑', '')).toEqual([{ text: '갈색 카드지갑', match: false }])
    expect(highlightParts('갈색 카드지갑', '우산')).toEqual([{ text: '갈색 카드지갑', match: false }])
  })

  it('HTML 처럼 보이는 제목도 글자 조각일 뿐이다(화면은 React 노드로 그린다)', () => {
    expect(marked('<img src=x onerror=alert(1)> 지갑', '지갑')).toBe('<img src=x onerror=alert(1)> [지갑]')
  })

  it('맞는 조각 앞 글이 길면 앞을 접는다 — 한 줄 끝에 잘려 강조가 안 보이는 일이 없게', () => {
    const title = '지하철 2호선 신도림역에서 환승하다가 파란색 카드지갑을 떨어뜨렸어요'
    const { folded, parts } = foldLead(highlightParts(title, '카드'))
    expect(parts[0]).toEqual({ text: '가 파란색 ', match: false })
    expect(parts[1]).toEqual({ text: '카드', match: true })
    // 접은 글 + 남은 조각 = 제목 전체(스크린리더는 전부 읽는다)
    expect(folded + parts.map((part) => part.text).join('')).toBe(title)
  })

  it('앞 글이 짧거나 맞는 조각이 없으면 접지 않는다', () => {
    expect(foldLead(highlightParts('갈색 카드지갑', '카드')).folded).toBe('')
    expect(foldLead(highlightParts('지하철 2호선 신도림역에서 환승', '우산')).folded).toBe('')
  })

  it('titleMatches — 본문에서만 맞은 글은 제목에 맞는 조각이 없다', () => {
    expect(titleMatches('검은색 가죽 반지갑', '지갑')).toBe(true)
    expect(titleMatches('검은색 가죽 반지갑', '버스')).toBe(false)
  })
})

describe('suggestionKeyAction — 콤보박스 키보드', () => {
  const at = (key: string, open: boolean, active: number, count = 5, composing = false, popup = open) =>
    suggestionKeyAction({ key, open, popup, active, count, composing })

  it('↓ : 닫혀 있으면 열고 첫 칸, 열려 있으면 다음 칸, 끝에서 첫 칸으로', () => {
    expect(at('ArrowDown', false, -1)).toEqual({ type: 'move', active: 0 })
    expect(at('ArrowDown', true, -1)).toEqual({ type: 'move', active: 0 })
    expect(at('ArrowDown', true, 1)).toEqual({ type: 'move', active: 2 })
    expect(at('ArrowDown', true, 4)).toEqual({ type: 'move', active: 0 })
  })

  it('↑ : 닫혀 있으면 열고 끝 칸, 열려 있으면 앞 칸, 첫 칸에서 끝 칸으로', () => {
    expect(at('ArrowUp', false, -1)).toEqual({ type: 'move', active: 4 })
    expect(at('ArrowUp', true, 2)).toEqual({ type: 'move', active: 1 })
    expect(at('ArrowUp', true, 0)).toEqual({ type: 'move', active: 4 })
  })

  it('Esc : 열려 있으면 닫고, 닫혀 있으면 아무것도 안 한다 — 어느 쪽이든 친 글자는 남긴다(브라우저 기본 지우기를 막는다)', () => {
    expect(at('Escape', true, 2)).toEqual({ type: 'close' })
    expect(at('Escape', false, -1)).toEqual({ type: 'keep' })
  })

  it('Esc : 고를 목록이 없어도 "맞는 글이 없어요" · "찾는 중…" 칸이 떠 있으면 그 칸을 닫는다', () => {
    expect(at('Escape', false, -1, 0, false, true)).toEqual({ type: 'close' })
  })

  it('고를 칸이 없으면 열지 않는다', () => {
    expect(at('ArrowDown', false, -1, 0)).toEqual({ type: 'none' })
  })

  it('한글 조합 중에 누른 키는 무시한다(조합을 끝내는 키가 칸 이동으로 읽히지 않게)', () => {
    expect(at('ArrowDown', true, 0, 5, true)).toEqual({ type: 'none' })
    expect(at('Escape', true, 0, 5, true)).toEqual({ type: 'none' })
  })

  it('Enter · 글자 키는 다루지 않는다(Enter 는 폼 제출이 맡는다)', () => {
    expect(at('Enter', true, 1)).toEqual({ type: 'none' })
    expect(at('a', true, 1)).toEqual({ type: 'none' })
  })
})

describe('withoutPendingFinal — 조합 중 끝 글자의 받침 떼기(화면에 먼저 보일 앞 결과 고르기용)', () => {
  it('홑받침은 통째로, 겹받침은 뒤 자음만 뗀다', () => {
    expect(withoutPendingFinal('직', true)).toBe('지')
    expect(withoutPendingFinal('카드직', true)).toBe('카드지')
    expect(withoutPendingFinal('닭', true)).toBe('달')
  })

  it('받침이 없거나 조합이 끝났으면 그대로', () => {
    expect(withoutPendingFinal('지가', true)).toBe('지가')
    expect(withoutPendingFinal('직', false)).toBe('직')
    expect(withoutPendingFinal('ipad', true)).toBe('ipad')
  })
})

describe('resolveSuggestions — 치는 동안 추천 칸에 그릴 것', () => {
  const post = (title: string) => ({ title })
  const cache = new Map<string, { title: string }[]>([
    ['카', [post('카드지갑'), post('카메라 가방')]],
    ['카드', [post('카드지갑'), post('교통카드')]],
    ['지', [post('카드지갑')]],
  ])
  const lookup = (term: string) => cache.get(term)
  const resolve = (typed: string, composing = false, rested = false, last = null as ReturnType<typeof resolveSuggestions<{ title: string }>>) =>
    resolveSuggestions({ typed, composing, rested, lookup, last })

  it('서버가 그 말로 답했으면 그대로(확정)', () => {
    expect(resolve('카드')).toEqual({ items: cache.get('카드'), term: '카드', confirmed: true })
  })

  it('아직 모르는 말이면 앞부분 결과를 지금 말로 걸러 바로 보인다(확정 아님)', () => {
    const view = resolve('카드지')
    expect(view?.items.map((item) => item.title)).toEqual(['카드지갑'])
    expect(view?.confirmed).toBe(false)
    expect(view?.term).toBe('카드지')
  })

  it('조합 중 받침 글자("직")는 받침을 뗀 말("지") 결과를 먼저 보인다', () => {
    const view = resolve('직', true)
    expect(view?.items.map((item) => item.title)).toEqual(['카드지갑'])
    expect(view?.term).toBe('지')
    expect(view?.confirmed).toBe(false)
  })

  it('거를 것도 없으면 직전 결과를 그대로 둔다 — 칸이 닫히지 않고 "없어요"도 아니다', () => {
    const last = { items: [post('카드지갑')], term: '카드', confirmed: true }
    const view = resolve('쿼', true, false, last)
    expect(view?.items).toBe(last.items)
    expect(view?.confirmed).toBe(false)
  })

  it('음절을 확정하는 사이("카" → "칻")에도 받침을 뗀 "카" 결과가 그대로 보인다', () => {
    expect(resolve('칻', true)?.items).toBe(cache.get('카'))
  })

  it('서버가 0건을 확정하면 "없어요" — 조합 중인 끝 글자라면 손이 멈춘 뒤에만', () => {
    cache.set('카드지가', [])
    const last = { items: [post('카드지갑')], term: '카드지', confirmed: false }
    expect(resolve('카드지가', true, false, last)?.confirmed).toBe(false)
    expect(resolve('카드지가', true, true, last)).toEqual({ items: [], term: '카드지가', confirmed: true })
    expect(resolve('카드지가', false, false, last)).toEqual({ items: [], term: '카드지가', confirmed: true })
  })

  it('빈 말이면 아무것도 그리지 않는다', () => {
    expect(resolve('')).toBeNull()
  })
})
