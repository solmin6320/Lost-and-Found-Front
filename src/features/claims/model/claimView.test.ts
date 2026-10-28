import { describe, expect, it } from 'vitest'

import {
  CLAIM_PERSONAL_INFO_NOTICE,
  approveBlockedReason,
  claimAnswerLabel,
  claimPanelMode,
  myClaimLine,
  receivedClaimActions,
  receivedClaimStatusLabel,
  sortReceivedClaims,
  stalledPendingLine,
  validateClaimAnswer,
  waitingClaimCount,
} from './claimView'
import { OWNER_VERIFIED_SENTENCE } from './labels'

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
  it('습득 글의 요청자는 받는 쪽 — 승인되면 받았어요 단추', () => {
    expect(myClaimLine('APPROVED', 'FOUND', 'IN_PROGRESS').canReceive).toBe(true)
    expect(myClaimLine('APPROVED', 'LOST', 'IN_PROGRESS').canReceive).toBe(false)
  })

  it('대기 · 거절 · 받음에는 받았어요 단추가 없다', () => {
    for (const status of ['PENDING', 'REJECTED', 'RECEIVED'] as const) {
      expect(myClaimLine(status, 'FOUND', 'OPEN').canReceive).toBe(false)
    }
  })

  it('승인 — 댓글로 정하라고 권하지 않고 안전 경고를 그린다(C1)', () => {
    for (const type of ['FOUND', 'LOST'] as const) {
      const line = myClaimLine('APPROVED', type, 'IN_PROGRESS')
      expect(line.safety).toBe(true)
      expect(`${line.text} ${line.next}`).not.toContain('댓글')
    }
  })

  it('건네는 쪽(분실 글 요청자)은 누가 닫는지 듣는다(C3)', () => {
    expect(myClaimLine('APPROVED', 'LOST', 'IN_PROGRESS').next).toBe('글쓴이가 받았다고 누르면 글이 완료돼요.')
  })

  it('화면 문장에 대괄호 단추 표기가 없다(C12)', () => {
    expect(myClaimLine('APPROVED', 'FOUND', 'IN_PROGRESS').next).toContain('‘받았어요’ 단추')
    expect(myClaimLine('APPROVED', 'FOUND', 'IN_PROGRESS').next).not.toMatch(/\[|\]/)
  })

  it('대기 — 게시중이면 기다림, 연락중 · 완료면 멈춘 까닭(C2)', () => {
    expect(myClaimLine('PENDING', 'FOUND', 'OPEN')).toMatchObject({ text: '확인 요청을 보냈어요.', stalled: false })
    const done = myClaimLine('PENDING', 'FOUND', 'DONE')
    expect(done).toMatchObject({ text: '이 글이 완료돼 요청이 더 진행되지 않아요.', next: null, stalled: true })
    const busy = myClaimLine('PENDING', 'FOUND', 'IN_PROGRESS')
    expect(busy.stalled).toBe(true)
    for (const line of [done, busy]) {
      expect(`${line.text} ${line.next ?? ''}`).not.toMatch(/알려 드려요|확인하고 있어요/)
    }
  })

  it('받음 — 돌아갔다는 말은 머리 줄이 한다. 여기는 내 요청으로 끝났다는 것만(C11)', () => {
    expect(myClaimLine('RECEIVED', 'LOST', 'DONE').text).toBe('내 요청으로 완료된 글이에요.')
  })
})

describe('stalledPendingLine', () => {
  it('게시중이면 멈추지 않았다', () => {
    expect(stalledPendingLine('OPEN')).toBeNull()
  })
})

describe('답 칸 개인정보 줄', () => {
  it('셋 다 "확인에는 필요 없어요" — 댓글로 옮기라고 하지 않는다(C1)', () => {
    for (const text of Object.values(CLAIM_PERSONAL_INFO_NOTICE)) {
      expect(text).toMatch(/확인에는 필요 없어요\.$/)
      expect(text).not.toContain('댓글')
    }
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

  it('완료 글에 남은 대기 요청은 닫혔다 — 승인 · 거절 없음(C2)', () => {
    const actions = receivedClaimActions({ status: 'PENDING' }, { status: 'DONE', type: 'FOUND' }, false)
    expect(Object.values(actions).some(Boolean)).toBe(false)
    expect(receivedClaimStatusLabel({ status: 'PENDING' }, 'DONE')).toBe('닫힘')
    expect(receivedClaimStatusLabel({ status: 'PENDING' }, 'IN_PROGRESS')).toBe('확인 전')
  })

  it('연락중 글의 대기 요청은 거절할 수 있다', () => {
    expect(receivedClaimActions({ status: 'PENDING' }, { status: 'IN_PROGRESS', type: 'FOUND' }, true).reject).toBe(true)
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

  it('완료 글은 목록 위에 까닭을 말하지 않는다(요청마다 닫혔다고 한다)', () => {
    expect(approveBlockedReason([{ status: 'PENDING' }], 'DONE')).toBeNull()
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

  it('완료 글은 전달 완료가 맨 위, 닫힌 대기는 그 아래', () => {
    const list = [
      { id: 1, status: 'PENDING' as const },
      { id: 2, status: 'RECEIVED' as const },
    ]
    expect(sortReceivedClaims(list, 'DONE').map((claim) => claim.id)).toEqual([2, 1])
  })
})

describe('waitingClaimCount', () => {
  it('완료 글에서는 세지 않는다', () => {
    expect(waitingClaimCount(2, 'DONE')).toBe(0)
    expect(waitingClaimCount(2, 'IN_PROGRESS')).toBe(2)
    expect(waitingClaimCount(null, 'OPEN')).toBe(0)
  })
})

describe('주인 확인 완료 문장', () => {
  it('증명하지 않은 것(주인에게 돌아갔다)을 단정하지 않는다(C13)', () => {
    expect(OWNER_VERIFIED_SENTENCE).not.toContain('주인에게')
    expect(OWNER_VERIFIED_SENTENCE).toContain('받았다고 알린')
  })
})
