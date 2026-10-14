import { describe, expect, it } from 'vitest'

import { paintOver } from './pageScrollLock'

// 잠근 동안 스크롤바 자리에 칠할 색(QA-D-24) — 덮개가 반투명이면 종이 위에 겹친 색이어야 덮개 옆 띠가 튀지 않는다
describe('paintOver', () => {
  it('불투명한 덮개(사진 보기 바탕)는 그 색 그대로', () => {
    expect(paintOver('rgb(14, 15, 17)', 'rgb(255, 255, 255)')).toBe('rgb(14, 15, 17)')
  })

  it('반투명 덮개(시트 스크림 잉크 50%)는 종이 위에 겹친 색', () => {
    expect(paintOver('rgba(25, 27, 31, 0.5)', 'rgb(255, 255, 255)')).toBe('rgb(140, 141, 143)')
    expect(paintOver('rgb(6 7 8 / 0.62)', 'rgb(22, 23, 26)')).toBe('rgb(12, 13, 15)')
  })

  it('투명하거나 읽지 못하는 색이면 칠하지 않는다', () => {
    expect(paintOver('rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)')).toBeNull()
    expect(paintOver('transparent', 'rgb(255, 255, 255)')).toBeNull()
  })
})
