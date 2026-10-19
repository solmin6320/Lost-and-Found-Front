import { describe, expect, it } from 'vitest'

import { parseLab } from './labSwitch'

describe('시안 스위치(개발 모드 전용)', () => {
  it('요소-시안을 쉼표로 읽는다', () => {
    expect(parseLab('strip-a,map-c')).toEqual({ variants: { strip: 'a', map: 'c' } })
  })

  it('상태를 함께 읽는다', () => {
    expect(parseLab('bell-b,state-error')).toEqual({ variants: { bell: 'b' }, state: 'error' })
  })

  it('모르는 요소 · 시안 · 상태는 버린다', () => {
    expect(parseLab('strip-z,hero-a,state-boom, match-b ')).toEqual({ variants: { match: 'b' } })
  })

  it('비어 있으면 아무 시안도 켜지 않는다', () => {
    expect(parseLab(null)).toEqual({ variants: {} })
    expect(parseLab('')).toEqual({ variants: {} })
  })
})
