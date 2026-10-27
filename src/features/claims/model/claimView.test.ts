import { describe, expect, it } from 'vitest'

import {
  approveBlockedReason,
  claimAnswerLabel,
  claimPanelMode,
  myClaimLine,
  receivedClaimActions,
  sortReceivedClaims,
  validateClaimAnswer,
} from './claimView'

describe('claimPanelMode', () => {
  const open = { status: 'OPEN' as const, myClaim: null }

  it('글쓴이에게는 그리지 않는다', () => {
    expect(claimPanelMode({ ...open, myClaim: { id: 1, status: 'PENDING' } }, 'owner')).toBe('none')
  })

  it('게시중 글 — 로그인 확인 전 · 비로그인 · 회원', () => {
    expect(claimPanelMode(open, 'unknown')).toBe('checking')
    expect(claimPanelMode(open, 'guest')).toBe('sign-in')
    expect(claimPanelMode(open, 'member')).toBe('ask')
  })

  it('내 요청이 있으면 글 상태와 상관없이 상태 한 줄', () => {
    for (const status of ['OPEN', 'IN_PROGRESS', 'DONE'] as const) {
      expect(claimPanelMode({ status, myClaim: { id: 3, status: 'APPROVED' } }, 'member')).toBe('mine')
    }
  })

  it('연락중은 받지 않는다는 한 줄, 완료는 그리지 않는다', () => {
    expect(claimPanelMode({ status: 'IN_PROGRESS', myClaim: null }, 'guest')).toBe('closed')
    expect(claimPanelMode({ status: 'DONE', myClaim: null }, 'member')).toBe('none')
  })
})

describe('validateClaimAnswer', () => {
  it('칸 이름으로 시작하는 해요체', () => {
    expect(validateClaimAnswer('   ', claimAnswerLabel(true))).toBe('답을 적어 주세요')
    expect(validateClaimAnswer('', claimAnswerLabel(false))).toBe('확인할 내용을 적어 주세요')
    expect(validateClaimAnswer('가'.repeat(501), '답')).toBe('답은 500자까지 쓸 수 있어요')
  })

  it('앞뒤 공백을 뺀 500자는 통과한다(서버가 자른다)', () => {
    expect(validateClaimAnswer(`  ${'가'.repeat(500)}  `, '답')).toBeNull()
  })
})

describe('myClaimLine', () => {
  it('습득 글의 요청자는 받는 쪽 — 승인되면 [받았어요]', () => {
    expect(myClaimLine('APPROVED', 'FOUND').canReceive).toBe(true)
    expect(myClaimLine('APPROVED', 'LOST').canReceive).toBe(false)
  })

  it('대기 · 거절 · 받음에는 [받았어요]가 없다', () => {
    for (const status of ['PENDING', 'REJECTED', 'RECEIVED'] as const) {
      expect(myClaimLine(status, 'FOUND').canReceive).toBe(false)
    }
  })

  it('분실 글에서 건넨 사람은 "건넸어요"', () => {
    expect(myClaimLine('RECEIVED', 'LOST').text).toBe('물건을 건넸어요.')
    expect(myClaimLine('RECEIVED', 'FOUND').text).toBe('물건을 받았어요.')
  })
})

describe('receivedClaimActions', () => {
  const openFound = { status: 'OPEN' as const, type: 'FOUND' as const }

  it('대기 중 — 승인 · 거절. 승인한 요청이 있으면 승인은 없다', () => {
    expect(receivedClaimActions({ status: 'PENDING' }, openFound, false)).toEqual({
      approve: true,
      reject: true,
      cancel: false,
      receive: false,
    })
    expect(receivedClaimActions({ status: 'PENDING' }, openFound, true).approve).toBe(false)
  })

  it('게시중이 아니면 승인할 수 없다(서버 CLAIM_NOT_ACCEPTING)', () => {
    expect(receivedClaimActions({ status: 'PENDING' }, { status: 'IN_PROGRESS', type: 'FOUND' }, false).approve).toBe(false)
  })

  it('승인한 요청 — 승인 취소, 분실 글이면 받았어요', () => {
    expect(receivedClaimActions({ status: 'APPROVED' }, { status: 'IN_PROGRESS', type: 'LOST' }, true)).toEqual({
      approve: false,
      reject: false,
      cancel: true,
      receive: true,
    })
    expect(receivedClaimActions({ status: 'APPROVED' }, { status: 'IN_PROGRESS', type: 'FOUND' }, true).receive).toBe(false)
  })

  it('끝난 요청에는 할 일이 없다', () => {
    for (const status of ['REJECTED', 'RECEIVED'] as const) {
      expect(Object.values(receivedClaimActions({ status }, openFound, false)).some(Boolean)).toBe(false)
    }
  })
})

describe('approveBlockedReason', () => {
  it('대기 중이 없으면 말하지 않는다', () => {
    expect(approveBlockedReason([{ status: 'APPROVED' }], 'IN_PROGRESS')).toBeNull()
  })

  it('승인한 요청이 있으면 그 까닭이 먼저', () => {
    expect(approveBlockedReason([{ status: 'PENDING' }, { status: 'APPROVED' }], 'IN_PROGRESS')).toContain('승인한 요청이 있어서')
  })

  it('승인한 요청 없이 게시중이 아니면', () => {
    expect(approveBlockedReason([{ status: 'PENDING' }], 'IN_PROGRESS')).toBe('글이 게시중일 때만 승인할 수 있어요.')
    expect(approveBlockedReason([{ status: 'PENDING' }], 'OPEN')).toBeNull()
  })
})

describe('sortReceivedClaims', () => {
  it('승인함 → 대기 → 전달 완료 → 거절함, 같은 상태는 서버 차례 그대로', () => {
    const list = [
      { id: 1, status: 'REJECTED' as const },
      { id: 2, status: 'PENDING' as const },
      { id: 3, status: 'APPROVED' as const },
      { id: 4, status: 'PENDING' as const },
    ]
    expect(sortReceivedClaims(list).map((claim) => claim.id)).toEqual([3, 2, 4, 1])
    expect(list.map((claim) => claim.id)).toEqual([1, 2, 3, 4])
  })
})
