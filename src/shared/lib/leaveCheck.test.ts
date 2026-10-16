import { describe, expect, it } from 'vitest'

import { isPressingSubmit, PRESS_FRESH_MS } from './leaveCheck'

/*
 * 칸을 벗어날 때의 검사를 미룰까(QA-P-15). 실제 누름 순서(mousedown · 탭 → blur → click)는 브라우저에서 잰다(round6/r9 f4 · f6).
 * 여기서는 판정만 — 폼은 같은지만 보면 되니 빈 객체로 흉내 낸다
 */
const form = {} as HTMLFormElement
const other = {} as HTMLFormElement

describe('isPressingSubmit — 이 폼의 제출 버튼을 누르는 중인가', () => {
  it('누른 채(마우스)면 시간이 지나도 미룬다', () => {
    expect(isPressingSubmit({ form, at: 0, down: true }, form, 5000)).toBe(true)
  })

  it('손을 뗀 뒤(탭은 그 뒤에 blur 가 온다) 1초 안이면 미룬다', () => {
    expect(isPressingSubmit({ form, at: 1000, down: false }, form, 1000 + PRESS_FRESH_MS - 1)).toBe(true)
  })

  it('오래된 누름이면 바로 검사한다', () => {
    expect(isPressingSubmit({ form, at: 0, down: false }, form, PRESS_FRESH_MS + 1)).toBe(false)
  })

  it('다른 폼의 버튼이거나 누름이 없으면(키보드 Tab) 바로 검사한다', () => {
    expect(isPressingSubmit({ form: other, at: 0, down: true }, form, 0)).toBe(false)
    expect(isPressingSubmit(null, form, 0)).toBe(false)
  })
})
