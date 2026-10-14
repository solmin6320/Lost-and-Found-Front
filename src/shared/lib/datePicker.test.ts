import { describe, expect, it, vi } from 'vitest'

import { openDatePicker } from './datePicker'

describe('openDatePicker — 날짜 칸 어디를 눌러도 선택기를 연다', () => {
  it('지원하는 브라우저면 showPicker 를 부른다', () => {
    const showPicker = vi.fn()
    expect(openDatePicker({ readOnly: false, disabled: false, showPicker })).toBe(true)
    expect(showPicker).toHaveBeenCalledOnce()
  })

  it('showPicker 가 없는 브라우저는 기본 동작 그대로(아무것도 하지 않는다)', () => {
    expect(openDatePicker({ readOnly: false, disabled: false })).toBe(false)
  })

  it('브라우저가 거절해도(사용자 활성화 없음 · 이미 열림) 예외가 새지 않는다', () => {
    const showPicker = vi.fn(() => {
      throw new DOMException('not allowed', 'NotAllowedError')
    })
    expect(openDatePicker({ readOnly: false, disabled: false, showPicker })).toBe(false)
  })

  it('읽기 전용 · 잠긴 칸은 열지 않는다(보내는 중)', () => {
    const showPicker = vi.fn()
    expect(openDatePicker({ readOnly: true, disabled: false, showPicker })).toBe(false)
    expect(openDatePicker({ readOnly: false, disabled: true, showPicker })).toBe(false)
    expect(showPicker).not.toHaveBeenCalled()
  })
})
