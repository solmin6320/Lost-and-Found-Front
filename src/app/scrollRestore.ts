/**
 * 뒤로 · 앞으로(POP)에서 스크롤을 되돌리는 중인가 — ScrollMemory 가 켜고 끄고, RouteFocus 가 본다(QA-P-24, 2026-10-18).
 *
 * 포커스를 어디에 둘지는 스크롤이 제자리에 온 **뒤에** 정해야 한다. 그 전에 "화면 안인가"를 재면 아직 옮기기 전의 화면으로 재서,
 * 되돌린 뒤에는 화면 밖인 링크에 포커스가 남아 다음 Tab 에 화면이 튀었다
 */
let restoring = false

export function setScrollRestoring(value: boolean): void {
  restoring = value
}

export function isScrollRestoring(): boolean {
  return restoring
}
