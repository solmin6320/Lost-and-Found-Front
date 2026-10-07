/**
 * 서비스 안내(온보딩 1층)에서 누름 · Enter 가 무엇을 하는지. 화면(DOM) 없이 시험할 수 있게 판정만 모았다(`OnboardingTour` 가 쓴다).
 *
 * 본인 피드백(2026-10-07) — 카드 바깥(막)을 눌러 안내가 닫혀 버렸다. 처음 보는 사람이 화면을 톡 건드리기만 해도 사라졌다.
 * 그래서 **막은 아무 일도 하지 않고**, 넘기기는 [다음](과 Enter)로만 한다. 닫는 길은 [건너뛰기] · [시작하기] · Esc 로 그대로 둔다.
 */

/** 누른 곳 — 설명 카드 · 대상을 두른 테 · 그 밖(화면 전체를 덮는 투명한 막) */
export type TourPressArea = 'card' | 'ring' | 'backdrop'

export function tourPressArea({ inCard, inRing }: { inCard: boolean; inRing: boolean }): TourPressArea {
  if (inCard) return 'card'
  if (inRing) return 'ring'
  return 'backdrop'
}

/**
 * 누름이 끝났을 때(click) 할 일.
 * - 막 : **아무것도 하지 않는다** — 닫지도, 넘기지도 않는다. 모양도 바뀌지 않는다(손 모양 · 눌림 없음)
 * - 테 : 누름이 테에서 시작해 테에서 끝났고, 테가 막 나타난 0.5초 안에 시작된 누름이 아니면(`usePressGuard`, SE-1)
 *        안내를 닫고 가리킨 자리를 누른다(회의 RV-10 — 가리킨 것을 누르는 게 가장 자연스러운 다음 동작이다)
 * - 카드 : 카드의 버튼이 스스로 처리한다
 */
export function tourClickOutcome({
  pressedIn,
  releasedIn,
  guardAllows,
}: {
  /** 누름이 시작된 곳(`pointerdown`). 모르면 `null` */
  pressedIn: TourPressArea | null
  releasedIn: TourPressArea
  guardAllows: boolean
}): 'none' | 'ring-action' {
  if (pressedIn === 'ring' && releasedIn === 'ring' && guardAllows) return 'ring-action'
  return 'none'
}

/**
 * 누름이 시작될 때 포커스를 그 자리에 둘까(`mousedown` 기본 동작을 막는다).
 * 카드 밖을 누르면 브라우저는 포커스를 문서로 빼 버린다 — 그러면 [다음]에 있던 포커스를 잃어 Enter 가 더는 넘기지 못한다.
 * 카드 안은 그대로 둔다(버튼 누름 · 글자 고르기)
 */
export function keepsFocusOnPress(area: TourPressArea): boolean {
  return area !== 'card'
}

/**
 * Enter 를 안내가 받아 기본 버튼([다음], 마지막 단계는 [시작하기])을 누를까.
 * - 포커스가 카드의 버튼에 있으면 받지 않는다 — 그 버튼이 스스로 눌린다(브라우저 기본. [건너뛰기]에서 Enter 면 건너뛴다)
 * - 포커스가 버튼 밖(카드 글자 · 막 · 문서)이면 기본 버튼을 누른다
 * - 한글 조합 중 Enter 는 글자 확정이라, 꾹 눌러 반복되는 Enter 는 단계를 내달리게 해서 받지 않는다
 */
export function enterPressesPrimary({
  key,
  isComposing,
  repeat,
  focusOnControl,
}: {
  key: string
  isComposing: boolean
  repeat: boolean
  /** 포커스가 카드 안의 버튼(누를 수 있는 것)에 있다 */
  focusOnControl: boolean
}): boolean {
  return key === 'Enter' && !isComposing && !repeat && !focusOnControl
}
