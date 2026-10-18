import { describe, expect, it } from 'vitest'

import { isPressingSubmit, RELEASE_FRESH_MS } from './leaveCheck'

/*
 * 칸을 벗어날 때의 검사를 미룰까(QA-P-15 · D-23). 실제 누름 순서(mousedown · 탭 → blur → click)는 브라우저에서 잰다(round6/r9 f4 · f6 · qa9d forms).
 * 여기서는 판정만 — 폼은 같은지만 보면 되니 빈 객체로 흉내 낸다
 */
const form = {} as HTMLFormElement
const other = {} as HTMLFormElement

describe('isPressingSubmit — 이 폼의 제출 버튼을 누르는 중인가', () => {
  it('누르는 중이면 시간이 지나도 미룬다', () => {
    expect(isPressingSubmit({ form, releasedAt: null }, form, 5000)).toBe(true)
  })

  it('손을 뗀 지 0.3초 안이면 미룬다 — 누른 시간과 상관없다(터치를 2.5초 눌러도, QA-D-23)', () => {
    expect(isPressingSubmit({ form, releasedAt: 2500 }, form, 2500 + RELEASE_FRESH_MS - 1)).toBe(true)
  })

  it('손을 뗀 지 오래면 바로 검사한다', () => {
    expect(isPressingSubmit({ form, releasedAt: 0 }, form, RELEASE_FRESH_MS + 1)).toBe(false)
  })

  it('다른 폼의 버튼이거나 누름이 없으면(키보드 Tab) 바로 검사한다', () => {
    expect(isPressingSubmit({ form: other, releasedAt: null }, form, 0)).toBe(false)
    expect(isPressingSubmit(null, form, 0)).toBe(false)
  })
})
