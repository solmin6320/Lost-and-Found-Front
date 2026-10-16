/**
 * 제출이 막혔을 때 **빠뜨리거나 틀린 칸으로** 포커스를 옮기고, 그 칸이 보이게 한다(본인 요청 2026-10-16 — "안 적어서 취소되면 안 적은 부분으로 커서").
 *
 * 보이게 하는 것은 칸 하나가 아니라 **묶음** — 이름 · 칸 · 그 아래 오류 한 줄(`data-field-group` · `fieldset`)이다.
 * 그 묶음이 붙은 헤더 아래 · 아래 붙은 제출 줄 위(`data-sticks="top" | "bottom"`, 지금 붙어 있는 것만 실측)에 8px 띄워 들어오게 스크롤한다.
 *
 * 왜 브라우저의 `focus()` 스크롤에 맡기지 않나 — 두 경우에 빗나갔다.
 *  ① 그 칸에 이미 포커스가 있으면 `focus()` 는 아무것도 하지 않는다(iOS 처럼 버튼이 포커스를 받지 않거나 칸에서 Enter 로 보낸 경우).
 *  ② 칸이 화면 아래쪽에 **이미 보이면** 스크롤하지 않는데, 그다음 프레임에 오류 한 줄이 칸 아래에 생기고 붙은 제출 줄이
 *     "4곳을 더 채워야 올라가요"로 35px 자라 그 오류를 덮는다(QA-D-13, 글 올리기 · 수정 320 · 375 실측).
 *     제출 줄 높이를 미리 잡아 두는 방식은 쓰지 않는다(PM 결정 2026-10-17 — 막히지 않은 동안 줄이 늘 커진다).
 * 그래서 포커스는 스크롤 없이 옮기고, 지금 한 번 + 다음 두 프레임(오류 · 줄이 그려진 뒤)에 다시 재서 맞춘다.
 * 이미 들어와 있으면 움직이지 않는다 — 여러 번 불러도 같다. 화면이 그려지기 전에 끝나 두 번 튀어 보이지 않는다.
 *
 * 시트 · 다이얼로그 안의 칸은 그 안에서 스크롤한다(`scrollIntoView` nearest — 문서는 잠겨 있다).
 */

const GROUP = '[data-field-group], fieldset, [data-field]'
/** 묶음과 붙은 줄 사이 여유 — 오류 줄 아래 끝이 줄 선에 닿아 보이지 않게 */
export const REVEAL_GAP = 8

export interface Band {
  top: number
  bottom: number
}

/**
 * 묶음 [top, bottom] 을 띠 [band.top + gap, band.bottom − gap] 안에 넣으려면 얼마나 스크롤할까(+ 는 아래로).
 * 띠보다 묶음이 크면 위 끝(칸 이름)을 맞춘다 — 무엇을 적는 칸인지가 먼저다. 순수 계산 — 시험용으로 꺼내 둔다
 */
export function revealDelta(box: { top: number; bottom: number }, band: Band, gap = REVEAL_GAP): number {
  const top = band.top + gap
  const bottom = band.bottom - gap
  let delta = 0
  if (box.bottom > bottom) delta = box.bottom - bottom
  if (box.top - delta < top) delta = box.top - top
  return Math.abs(delta) < 1 ? 0 : delta
}

/** 지금 붙어 있는 줄들이 가리지 않는 띠(화면 좌표) */
function clearBand(): Band {
  const viewport = window.visualViewport
  let top = 0
  let bottom = viewport ? Math.min(window.innerHeight, viewport.offsetTop + viewport.height) : window.innerHeight
  for (const bar of document.querySelectorAll<HTMLElement>('[data-sticks]')) {
    const style = getComputedStyle(bar)
    if (style.position !== 'sticky' && style.position !== 'fixed') continue
    if (style.display === 'none' || style.visibility === 'hidden') continue
    const rect = bar.getBoundingClientRect()
    if (rect.height === 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) continue
    if (bar.dataset.sticks === 'top') top = Math.max(top, rect.bottom)
    else bottom = Math.min(bottom, rect.top)
  }
  return { top, bottom }
}

/** 묶음의 위 끝(이름)부터 오류 줄 아래 끝까지 — 도움말 · 결과 고지 줄은 넣지 않는다(보여야 할 것은 이름 · 칸 · 오류) */
function groupBox(element: HTMLElement): { top: number; bottom: number } {
  const group = element.closest<HTMLElement>(GROUP) ?? element
  const ids = [element, group].flatMap((node) => (node.getAttribute('aria-describedby') ?? '').split(' '))
  const error =
    ids
      .filter((id) => id.endsWith('-error'))
      .map((id) => document.getElementById(id))
      .find((node) => node && group.contains(node)) ?? null
  const top = group.getBoundingClientRect().top
  const bottom = Math.max(element.getBoundingClientRect().bottom, error ? layoutBottom(error) : 0)
  return { top, bottom }
}

/** 오류 줄은 4px 위에서 내려오며 나타난다(`error-in`) — 움직이는 중에 재도 내려앉을 자리로 계산한다 */
function layoutBottom(node: HTMLElement): number {
  const transform = getComputedStyle(node).transform
  const shift = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0
  return node.getBoundingClientRect().bottom - shift
}

function reveal(element: HTMLElement) {
  if (!element.isConnected) return
  if (element.closest('dialog, [role="dialog"], [data-sticks]')) {
    ;(element.closest<HTMLElement>(GROUP) ?? element).scrollIntoView({ block: 'nearest', inline: 'nearest' })
    return
  }
  const delta = revealDelta(groupBox(element), clearBand())
  if (delta !== 0) window.scrollBy({ top: delta, behavior: 'instant' })
}

export function focusAndReveal(element: HTMLElement | null | undefined): void {
  if (!element) return
  if (document.activeElement !== element) element.focus({ preventScroll: true })
  reveal(element)
  // 오류 줄 · 자란 제출 줄은 이 처리가 끝나야 그려진다 — 다음 프레임에 다시 잰다(비동기 실패는 한 프레임 더 늦을 수 있다)
  requestAnimationFrame(() => {
    reveal(element)
    requestAnimationFrame(() => reveal(element))
  })
}
