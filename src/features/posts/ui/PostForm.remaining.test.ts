import { describe, expect, it } from 'vitest'

import { emptyPostFormValues, type PostFormValues } from '../model/postForm'
import { remainingFieldCount, remainingMessage } from './PostForm.remaining'

const TODAY = '2026-10-03'

describe('제출이 막혔을 때 남은 칸 수(AR-10)', () => {
  it('빈 폼은 다섯 곳이 남는다 — 날짜는 오늘로 채워져 있다', () => {
    expect(remainingFieldCount(emptyPostFormValues(null, TODAY), TODAY)).toBe(5)
  })

  it('목록에서 유형을 골라 들어오면 넷', () => {
    expect(remainingFieldCount(emptyPostFormValues('LOST', TODAY), TODAY)).toBe(4)
  })

  it('칸을 채울 때마다 줄고, 다 채우면 0', () => {
    const values: PostFormValues = {
      ...emptyPostFormValues('FOUND', TODAY),
      title: '에어팟 왼쪽',
      category: 'ELECTRONICS',
    }
    expect(remainingFieldCount(values, TODAY)).toBe(2)
    const done: PostFormValues = { ...values, location: '서울숲 3번 출입구', content: '벤치 위에 있었어요.' }
    expect(remainingFieldCount(done, TODAY)).toBe(0)
  })

  it('공백만 쓴 칸 · 오늘 이후 날짜도 남은 곳으로 센다', () => {
    const values: PostFormValues = {
      type: 'LOST',
      title: '   ',
      category: 'WALLET',
      location: '강남역',
      lostFoundDate: '2026-10-04',
      content: '검은색',
    }
    expect(remainingFieldCount(values, TODAY)).toBe(2)
  })

  it('문장 — 등록은 "올라가요", 수정은 "저장돼요". 0 이면 줄이 없다', () => {
    expect(remainingMessage(3, 'create')).toBe('3곳을 더 채워야 올라가요')
    expect(remainingMessage(1, 'edit')).toBe('1곳을 더 채워야 저장돼요')
    expect(remainingMessage(0, 'create')).toBeNull()
  })

  it('글자 기호를 쓰지 않는다', () => {
    for (const mode of ['create', 'edit'] as const) expect(remainingMessage(2, mode)).not.toMatch(/[↓→✓]/)
  })
})
