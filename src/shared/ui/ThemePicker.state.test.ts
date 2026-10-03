import { describe, expect, it } from 'vitest'

import { themeOptionState } from './ThemePicker.state'

describe('화면 모드 칸 표시', () => {
  it('고른 적이 없으면 지금 그려지는 칸만 "기기 설정 따름"(빈 테), 다른 칸은 꺼짐', () => {
    expect(themeOptionState('light', null, 'light')).toBe('following')
    expect(themeOptionState('dark', null, 'light')).toBe('off')
    expect(themeOptionState('dark', null, 'dark')).toBe('following')
  })

  it('고정하면 그 칸은 채운 표시, 기기가 반대 모드여도 고정한 칸을 따른다', () => {
    expect(themeOptionState('light', 'light', 'light')).toBe('fixed')
    expect(themeOptionState('light', 'light', 'dark')).toBe('fixed')
    expect(themeOptionState('dark', 'light', 'dark')).toBe('off')
  })

  it('어느 경우에도 "고정"과 "따름"이 한꺼번에 둘 생기지 않는다(두 칸 유지)', () => {
    for (const preference of [null, 'light', 'dark'] as const) {
      for (const resolved of ['light', 'dark'] as const) {
        const states = (['light', 'dark'] as const).map((option) => themeOptionState(option, preference, resolved))
        expect(states.filter((state) => state !== 'off')).toHaveLength(1)
      }
    }
  })
})
