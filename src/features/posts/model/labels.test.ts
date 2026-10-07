import { describe, expect, it } from 'vitest'

import { POST_STATUSES } from '../api/types'
import { POST_STATUS_MEANING, POST_TYPE_MEANING } from './labels'

describe('이름표 뜻 문장(2026-10-08 문구 점검)', () => {
  it('유형은 첫 화면 칸 이름과 같은 말로 시작한다', () => {
    expect(POST_TYPE_MEANING.LOST.startsWith('잃어버린 물건')).toBe(true)
    expect(POST_TYPE_MEANING.FOUND.startsWith('주운 물건')).toBe(true)
  })

  it.each(POST_STATUSES)('%s 문장은 분실 글에도 맞는다 — 분실 글은 주인이 직접 쓴 글이다', (status) => {
    expect(POST_STATUS_MEANING[status]).not.toMatch(/주인을 찾|주인으로 보이는/)
  })
})
