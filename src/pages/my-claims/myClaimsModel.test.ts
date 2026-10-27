import { describe, expect, it } from 'vitest'

import { claimNextStep, claimSettledAt, claimsPageAnnouncement } from './myClaimsModel'

describe('보낸 확인 요청 — 다음 행동 한 줄', () => {
  it('승인 — 받는 쪽에 따라 [받았어요] 를 누를 사람이 다르다', () => {
    expect(claimNextStep({ status: 'APPROVED', postType: 'FOUND' })).toContain('‘받았어요’를 눌러 주세요')
    expect(claimNextStep({ status: 'APPROVED', postType: 'LOST' })).toContain('글쓴이가 받으면')
    for (const postType of ['FOUND', 'LOST'] as const) {
      expect(claimNextStep({ status: 'APPROVED', postType })).toMatch(/^상세에서 만날 곳을 정해 주세요/)
    }
  })

  it('거절 — 다시 보낼 수 없다 · 전달 완료 — 할 일 없음', () => {
    expect(claimNextStep({ status: 'REJECTED', postType: 'FOUND' })).toBe('거절된 글에는 다시 보낼 수 없어요.')
    expect(claimNextStep({ status: 'RECEIVED', postType: 'LOST' })).toBeNull()
  })
})

describe('상태가 정해진 때', () => {
  const base = { decidedAt: '2026-10-02T10:00:00', receivedAt: '2026-10-05T18:00:00' }
  it('대기는 없음, 승인 · 거절은 decidedAt, 전달 완료는 receivedAt', () => {
    expect(claimSettledAt({ ...base, status: 'PENDING' })).toBeNull()
    expect(claimSettledAt({ ...base, status: 'APPROVED' })).toBe(base.decidedAt)
    expect(claimSettledAt({ ...base, status: 'REJECTED' })).toBe(base.decidedAt)
    expect(claimSettledAt({ ...base, status: 'RECEIVED' })).toBe(base.receivedAt)
  })
})

it('쪽 알림 — 마지막 쪽은 받은 수로 끝 번호를 센다', () => {
  expect(claimsPageAnnouncement(2, 5, 25)).toBe('2페이지예요. 25건 중 21~25번째 요청이에요.')
})
