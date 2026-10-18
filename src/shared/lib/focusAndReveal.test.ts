import { afterEach, describe, expect, it, vi } from 'vitest'

import { focusAndReveal, REVEAL_GAP, revealDelta } from './focusAndReveal'

/*
 * 제출이 막혔을 때 빠뜨린 칸으로(본인 요청 2026-10-16) · 그 칸 묶음이 붙은 줄 사이에 보이게(QA-D-13, 2026-10-17).
 * 실제 스크롤 · 붙은 줄에 가리는지는 브라우저에서 잰다(round6/r9 focus3 · f4 · f6).
 * 테스트는 DOM 없이(node) 돈다 — 칸과 문서를 흉내 낸다
 */
function fakeField(rect = { top: 100, bottom: 148 }) {
  return {
    isConnected: true,
    focus: vi.fn(),
    closest: vi.fn(() => null),
    getAttribute: vi.fn(() => null),
    getBoundingClientRect: vi.fn(() => rect),
  }
}

function stubPage(activeElement: unknown, scrollBy = vi.fn()) {
  vi.stubGlobal('document', {
    activeElement,
    querySelectorAll: () => [],
    getElementById: () => null,
  })
  vi.stubGlobal('window', { innerHeight: 600, visualViewport: undefined, scrollBy })
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => callback())
  return scrollBy
}

describe('revealDelta — 묶음을 붙은 줄 사이 띠에 넣는 스크롤 양', () => {
  const band = { top: 57, bottom: 500 }

  it('이미 띠 안이면 움직이지 않는다', () => {
    expect(revealDelta({ top: 200, bottom: 300 }, band)).toBe(0)
  })

  it('아래 끝(오류 줄)이 제출 줄 밑이면 그만큼 내린다 — 줄 위 8px 까지', () => {
    expect(revealDelta({ top: 400, bottom: 530 }, band)).toBe(530 - (500 - REVEAL_GAP))
  })

  it('위 끝(칸 이름)이 헤더 밑이면 올린다', () => {
    expect(revealDelta({ top: 20, bottom: 120 }, band)).toBe(20 - (57 + REVEAL_GAP))
  })

  it('띠보다 크면 칸 이름이 헤더 아래에 오게 맞춘다', () => {
    expect(revealDelta({ top: 300, bottom: 1000 }, band)).toBe(300 - (57 + REVEAL_GAP))
  })
})

describe('focusAndReveal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('포커스가 없던 칸은 스크롤 없이 포커스를 옮긴다 — 보이게 하는 스크롤은 직접 잰다', () => {
    const field = fakeField()
    stubPage({})
    focusAndReveal(field as unknown as HTMLElement)
    expect(field.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('이미 포커스가 있는 칸도 화면 밖이면 보이는 데까지 옮긴다(focus() 는 아무것도 하지 않는다)', () => {
    const field = fakeField({ top: 900, bottom: 948 })
    const scrollBy = stubPage(field)
    focusAndReveal(field as unknown as HTMLElement)
    expect(field.focus).not.toHaveBeenCalled()
    expect(scrollBy).toHaveBeenCalledWith({ top: 948 - (600 - REVEAL_GAP), behavior: 'instant' })
  })

  it('보이는 칸이면 스크롤하지 않는다', () => {
    const field = fakeField()
    const scrollBy = stubPage(field)
    focusAndReveal(field as unknown as HTMLElement)
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('칸이 없으면 아무것도 하지 않는다', () => {
    expect(() => focusAndReveal(null)).not.toThrow()
  })
})
