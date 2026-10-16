import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LATE_FLAG_MIN_SHOW_MS, LATE_FLAG_MS, PENDING_SETTLE_MS, waitForPendingDots } from './useLateFlag'

/*
 * 쓰기 요청의 결과를 버튼 점이 끝나는 그림에 맞추는 기다림(QA-D-11). 프레임 단위 맞춤은 브라우저에서 잰다(round6/r8 btn2.mjs)
 */
describe('waitForPendingDots', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T12:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('점이 0.45초 머물고 여유 50ms 를 더한 0.8초가 끝나는 때다', () => {
    expect(PENDING_SETTLE_MS).toBe(LATE_FLAG_MS + LATE_FLAG_MIN_SHOW_MS + 50)
  })

  it('0.3초 안에 온 응답은 기다리지 않는다 — 점이 뜨지 않았다', () => {
    expect(waitForPendingDots(Date.now() - 120)).toBeUndefined()
    expect(waitForPendingDots(Date.now() - (LATE_FLAG_MS - 1))).toBeUndefined()
  })

  it('점이 뜬 뒤 온 응답은 보낸 때로부터 0.8초까지 기다린다', async () => {
    const startedAt = Date.now() - 400
    let done = false
    void waitForPendingDots(startedAt)?.then(() => (done = true))
    await vi.advanceTimersByTimeAsync(PENDING_SETTLE_MS - 400 - 1)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })

  it('점이 이미 충분히 머문 느린 응답은 기다리지 않는다', () => {
    expect(waitForPendingDots(Date.now() - PENDING_SETTLE_MS)).toBeUndefined()
    expect(waitForPendingDots(Date.now() - 3000)).toBeUndefined()
  })

  it('보낸 때를 모르면(0) 기다리지 않는다', () => {
    expect(waitForPendingDots(0)).toBeUndefined()
  })
})
