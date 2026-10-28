import { describe, expect, it } from 'vitest'

import { claimNextStep, claimSettledAt, claimStatusLabel, claimStatusTone, claimsPageAnnouncement } from './myClaimsModel'

describe('보낸 확인 요청 — 다음 행동 한 줄', () => {
  const open = 'IN_PROGRESS' as const
  it('승인 — 받는 쪽에 따라 받았어요 단추를 누를 사람이 다르다', () => {
    expect(claimNextStep({ status: 'APPROVED', postType: 'FOUND', postStatus: open })).toContain('‘받았어요’ 단추를 눌러 주세요')
    expect(claimNextStep({ status: 'APPROVED', postType: 'LOST', postStatus: open })).toContain('글쓴이가 받았다고 누르면')
    for (const postType of ['FOUND', 'LOST'] as const) {
      expect(claimNextStep({ status: 'APPROVED', postType, postStatus: open })).not.toContain('댓글')
    }
  })

  it('거절 — 다시 보낼 수 없다 · 전달 완료 — 할 일 없음', () => {
    expect(claimNextStep({ status: 'REJECTED', postType: 'FOUND', postStatus: 'OPEN' })).toBe('거절된 글에는 다시 보낼 수 없어요.')
    expect(claimNextStep({ status: 'RECEIVED', postType: 'LOST', postStatus: 'DONE' })).toBeNull()
  })

  it('대기 — 게시중만 알림을 약속한다. 완료 글은 닫힘(C2)', () => {
    expect(claimNextStep({ status: 'PENDING', postType: 'FOUND', postStatus: 'OPEN' })).toContain('알림으로 알려 드려요')
    for (const postStatus of ['IN_PROGRESS', 'DONE'] as const) {
      expect(claimNextStep({ status: 'PENDING', postType: 'FOUND', postStatus })).not.toContain('알려 드려요')
    }
    expect(claimStatusLabel({ status: 'PENDING', postStatus: 'DONE' })).toBe('닫힘')
    expect(claimStatusTone({ status: 'PENDING', postStatus: 'DONE' })).toBe('closed')
    expect(claimStatusLabel({ status: 'PENDING', postStatus: 'OPEN' })).toBe('결정을 기다리는 중')
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
