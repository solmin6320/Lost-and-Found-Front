import { useState } from 'react'

/** 열린 뒤 이 시간 안에 **시작된** 포인터 누름은 흘려보낸다. 두 번 누름(더블클릭 · 두 번 탭)의 둘째 누름 간격보다 길다 */
export const PRESS_GUARD_MS = 500

/**
 * 막 나타난 버튼이 **원래 다른 버튼을 노린 누름**을 받지 않게 한다(보안 결정 SE-1).
 *
 * [삭제]를 두 번 누르면 첫 누름이 확인 창을 열고, 둘째 누름이 그 자리에 막 뜬 [삭제하기]에 떨어진다 —
 * 읽지도 않은 확인이 통과된다. 그래서 창이 열린 뒤 0.5초 안에 **시작된** 마우스 · 터치 누름만 무시한다.
 *
 * - 기준은 누름이 끝난 때가 아니라 **시작된 때**(`pointerdown`)다. 열리기 직전에 손가락을 댄 채 0.5초를 넘겨 떼도 막힌다
 * - 키보드(Enter · Space)는 막지 않는다 — `click` 의 `detail` 이 0 이다. 포커스는 [취소]에 있어 일부러 옮겨야만 닿는다
 * - 버튼 모양은 바꾸지 않는다. 비활성처럼 보이면 "안 눌리네?" 하고 다시 누른다. 일반 사용자는 차이를 느끼지 못한다
 * - [취소]처럼 물러나는 동작에는 쓰지 않는다
 *
 * 공용이다 : 확인 다이얼로그(확인 버튼 · 바깥 누름 닫기), 온보딩 카드처럼 "막 나타난 면을 누르면 실행되는" 자리.
 */
export interface PressGuard {
  /** 지켜야 할 면이 막 나타났다(다이얼로그를 연 바로 그때) */
  arm: () => void
  /** 그 면 안의 `pointerdown` 에서 부른다 — 누름이 시작된 시각을 적는다 */
  pointerDown: () => void
  /** `click` 에서 부른다. `false` 면 이 누름을 무시한다 */
  allows: (event: { detail: number }) => boolean
}

export function createPressGuard(windowMs = PRESS_GUARD_MS, now: () => number = () => performance.now()): PressGuard {
  let armedAt = Number.NEGATIVE_INFINITY
  let downAt: number | null = null

  return {
    arm() {
      armedAt = now()
      downAt = null
    },
    pointerDown() {
      downAt = now()
    },
    allows(event) {
      // 키보드 · 보조 기술이 보낸 누름. 손이 미끄러질 일이 없다
      if (event.detail === 0) return true
      // 열린 뒤 시작된 누름을 못 봤다 — 열리기 전에 시작된 누름이다
      if (downAt === null || downAt < armedAt) return false
      return downAt - armedAt >= windowMs
    },
  }
}

/** 화면이 다시 그려져도 같은 지킴이를 쓴다 */
export function usePressGuard(windowMs = PRESS_GUARD_MS): PressGuard {
  const [guard] = useState(() => createPressGuard(windowMs))
  return guard
}
