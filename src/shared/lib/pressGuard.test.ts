import { describe, expect, it } from 'vitest'

import { createPressGuard } from './pressGuard'

function setup() {
  let time = 1_000
  const guard = createPressGuard(500, () => time)
  return {
    guard,
    at(ms: number) {
      time = ms
    },
  }
}

const POINTER = { detail: 1 }
const KEYBOARD = { detail: 0 }

describe('createPressGuard — 막 열린 확인 버튼의 두 번 누름 무시(SE-1)', () => {
  it('열린 뒤 0.5초 안에 시작된 누름은 무시한다', () => {
    const { guard, at } = setup()
    at(1_000)
    guard.arm()
    at(1_120)
    guard.pointerDown()
    expect(guard.allows(POINTER)).toBe(false)
  })

  it('0.5초가 지나 시작된 누름은 받는다', () => {
    const { guard, at } = setup()
    at(1_000)
    guard.arm()
    at(1_500)
    guard.pointerDown()
    expect(guard.allows(POINTER)).toBe(true)
  })

  it('기준은 누름이 시작된 시각이다 — 일찍 대고 늦게 떼도 막힌다', () => {
    const { guard, at } = setup()
    at(1_000)
    guard.arm()
    at(1_200)
    guard.pointerDown()
    at(2_400) // 떼는 시각은 보지 않는다
    expect(guard.allows(POINTER)).toBe(false)
  })

  it('열리기 전에 시작된 누름(열린 뒤 pointerdown 이 없음)은 무시한다', () => {
    const { guard, at } = setup()
    at(900)
    guard.pointerDown()
    at(1_000)
    guard.arm()
    at(1_800)
    expect(guard.allows(POINTER)).toBe(false)
  })

  it('키보드(detail 0)는 열리자마자도 받는다', () => {
    const { guard, at } = setup()
    at(1_000)
    guard.arm()
    expect(guard.allows(KEYBOARD)).toBe(true)
  })

  it('다시 열면 처음부터 다시 잰다', () => {
    const { guard, at } = setup()
    at(1_000)
    guard.arm()
    at(2_000)
    guard.pointerDown()
    expect(guard.allows(POINTER)).toBe(true)
    at(3_000)
    guard.arm()
    at(3_100)
    guard.pointerDown()
    expect(guard.allows(POINTER)).toBe(false)
  })
})
