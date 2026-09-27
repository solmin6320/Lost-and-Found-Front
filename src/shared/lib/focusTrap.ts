import type { KeyboardEvent } from 'react'

const FOCUSABLE = 'button:not(:disabled), a[href], textarea:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * 모달 안에서 Tab 을 돌린다. 네이티브 `showModal()` 은 바깥을 inert 로 만들지만,
 * 마지막 조작에서 Tab 을 누르면 주소창으로 빠진다. 첫 ↔ 마지막을 이어 준다(온보딩 카드와 같은 방식).
 *
 * `<dialog onKeyDown={(e) => trapTab(e, e.currentTarget)}>`
 */
export function trapTab(event: KeyboardEvent, container: HTMLElement | null) {
  if (event.key !== 'Tab' || !container) return
  const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) return
  const active = document.activeElement
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}
