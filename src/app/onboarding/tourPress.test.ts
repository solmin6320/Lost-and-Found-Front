import { describe, expect, it } from 'vitest'

import { enterPressesPrimary, keepsFocusOnPress, tourClickOutcome, tourPressArea } from './tourPress'

describe('서비스 안내 — 누른 곳', () => {
  it('카드가 테보다 먼저다(카드가 테 위에 겹쳐도 카드)', () => {
    expect(tourPressArea({ inCard: true, inRing: true })).toBe('card')
    expect(tourPressArea({ inCard: true, inRing: false })).toBe('card')
    expect(tourPressArea({ inCard: false, inRing: true })).toBe('ring')
    expect(tourPressArea({ inCard: false, inRing: false })).toBe('backdrop')
  })
})

describe('서비스 안내 — 바깥(막)을 눌러도 닫히지 않는다(본인 피드백 2026-10-07)', () => {
  it('막에서 누르고 막에서 떼면 아무 일도 없다', () => {
    expect(tourClickOutcome({ pressedIn: 'backdrop', releasedIn: 'backdrop', guardAllows: true })).toBe('none')
  })

  it('막에서 눌러 테 · 카드로 끌어 떼도 아무 일도 없다', () => {
    expect(tourClickOutcome({ pressedIn: 'backdrop', releasedIn: 'ring', guardAllows: true })).toBe('none')
    expect(tourClickOutcome({ pressedIn: 'backdrop', releasedIn: 'card', guardAllows: true })).toBe('none')
  })

  it('카드 안에서 눌러 바깥에서 뗀 것(글자 고르기)도 닫지 않는다', () => {
    expect(tourClickOutcome({ pressedIn: 'card', releasedIn: 'backdrop', guardAllows: true })).toBe('none')
  })

  it('누름 시작을 모르는 click(키보드로 만든 것 등)은 아무 일도 없다', () => {
    expect(tourClickOutcome({ pressedIn: null, releasedIn: 'backdrop', guardAllows: true })).toBe('none')
    expect(tourClickOutcome({ pressedIn: null, releasedIn: 'ring', guardAllows: true })).toBe('none')
  })
})

describe('서비스 안내 — 테 안을 누르면 그 자리를 누른다(회의 RV-10)', () => {
  it('테에서 시작해 테에서 끝난 누름', () => {
    expect(tourClickOutcome({ pressedIn: 'ring', releasedIn: 'ring', guardAllows: true })).toBe('ring-action')
  })

  it('테가 막 나타난 0.5초 안에 시작된 누름은 무시한다(SE-1)', () => {
    expect(tourClickOutcome({ pressedIn: 'ring', releasedIn: 'ring', guardAllows: false })).toBe('none')
  })

  it('테에서 눌러 밖에서 떼면 아무 일도 없다', () => {
    expect(tourClickOutcome({ pressedIn: 'ring', releasedIn: 'backdrop', guardAllows: true })).toBe('none')
  })
})

describe('서비스 안내 — 포커스와 Enter', () => {
  it('카드 밖을 누르면 포커스를 지킨다 — [다음]에 남아 Enter 가 이어진다', () => {
    expect(keepsFocusOnPress('backdrop')).toBe(true)
    expect(keepsFocusOnPress('ring')).toBe(true)
    expect(keepsFocusOnPress('card')).toBe(false)
  })

  it('포커스가 버튼 밖이면 Enter 가 기본 버튼([다음] · [시작하기])을 누른다', () => {
    expect(enterPressesPrimary({ key: 'Enter', isComposing: false, repeat: false, focusOnControl: false })).toBe(true)
  })

  it('포커스가 카드의 버튼이면 그 버튼에 맡긴다(브라우저 기본)', () => {
    expect(enterPressesPrimary({ key: 'Enter', isComposing: false, repeat: false, focusOnControl: true })).toBe(false)
  })

  it('한글 조합 중 · 꾹 눌러 반복되는 Enter · 다른 키는 받지 않는다', () => {
    expect(enterPressesPrimary({ key: 'Enter', isComposing: true, repeat: false, focusOnControl: false })).toBe(false)
    expect(enterPressesPrimary({ key: 'Enter', isComposing: false, repeat: true, focusOnControl: false })).toBe(false)
    expect(enterPressesPrimary({ key: ' ', isComposing: false, repeat: false, focusOnControl: false })).toBe(false)
    expect(enterPressesPrimary({ key: 'Escape', isComposing: false, repeat: false, focusOnControl: false })).toBe(false)
  })
})
