import { afterEach, describe, expect, it, vi } from 'vitest'

import { focusAndReveal } from './focusAndReveal'

/*
 * 제출이 막혔을 때 빠뜨린 칸으로(본인 요청 2026-10-16). 실제 스크롤 · 붙은 줄에 가리는지는 브라우저에서 잰다(round6/r8 forms.mjs).
 * 테스트는 DOM 없이(node) 돈다 — 칸과 문서를 흉내 낸다
 */
function fakeField() {
  return { focus: vi.fn(), scrollIntoView: vi.fn() }
}

describe('focusAndReveal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('포커스가 없던 칸은 포커스를 옮긴다(브라우저가 보이는 데까지 스크롤한다)', () => {
    const field = fakeField()
    vi.stubGlobal('document', { activeElement: {} })
    focusAndReveal(field as unknown as HTMLElement)
    expect(field.focus).toHaveBeenCalledTimes(1)
    expect(field.scrollIntoView).not.toHaveBeenCalled()
  })

  it('이미 포커스가 있는 칸은 focus() 가 스크롤하지 않으니 직접 보이는 데까지 옮긴다', () => {
    const field = fakeField()
    vi.stubGlobal('document', { activeElement: field })
    focusAndReveal(field as unknown as HTMLElement)
    expect(field.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    expect(field.focus).not.toHaveBeenCalled()
  })

  it('칸이 없으면 아무것도 하지 않는다', () => {
    expect(() => focusAndReveal(null)).not.toThrow()
  })
})
