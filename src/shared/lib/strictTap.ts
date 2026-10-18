/**
 * 손가락 누름이 정말 그 요소 **안**에 닿았는가(QA-P-4, 2026-10-14).
 *
 * 휴대폰 브라우저는 누른 점 둘레에 누를 수 있는 것이 있으면 그쪽으로 끌어당긴다(touch adjustment) —
 * 목록 첫 화면의 고른 의도 칸은 칸 가장자리 바깥 6px 빈 곳 · 두 칸 사이 틈을 눌러도 칸이 눌려, 검색어 · 필터가 한꺼번에 풀렸다.
 * 끌어당긴 뒤의 `click` 은 칸에 오지만, 그 앞의 `pointerdown` 은 손가락이 실제로 닿은 점에 온다. 그 점을 기억해 두었다가
 * `click` 에서 칸 상자 밖이었으면 누름을 버린다.
 *
 * - 터치에만 쓴다. 마우스 · 펜 · 키보드(Enter 는 pointerdown 이 없다)는 그대로
 * - 오래된 기록(1초 넘게 지난 누름)은 보지 않는다
 */
interface LastPress {
  x: number
  y: number
  type: string
  at: number
}

let last: LastPress | null = null
let listening = false

function listen() {
  if (listening || typeof document === 'undefined') return
  listening = true
  document.addEventListener(
    'pointerdown',
    (event) => {
      last = { x: event.clientX, y: event.clientY, type: event.pointerType, at: event.timeStamp }
    },
    { capture: true, passive: true },
  )
}

/** 앱이 뜰 때 한 번 — 첫 누름부터 기록한다 */
listen()

/** 이 `click` 이 손가락이 상자 밖에 닿은 누름을 브라우저가 끌어당긴 것인가 */
export function isTouchOutside(element: Element, event: { timeStamp: number }): boolean {
  if (!last || last.type !== 'touch' || event.timeStamp - last.at > 1000) return false
  const box = element.getBoundingClientRect()
  return last.x < box.left || last.x > box.right || last.y < box.top || last.y > box.bottom
}

/**
 * 이 `click` 의 누름(`pointerdown`)이 `element` 상자에서 `margin` px 안쪽 둘레에 닿았는가(QA-P-8, 2026-10-16).
 *
 * 목록 첫 화면의 고른 의도 칸은 칸 **안**에 [×](선택만 풀기)를 둔다. [×]를 노린 손가락이 2px 만 빗나가도 칸이 눌려
 * 검색어 · 필터까지 한꺼번에 풀렸다(처음 목록으로). [×] 둘레의 띠를 칸이 받지 않게 이 함수로 거른다 — 띠 안의 누름은 아무 일도 하지 않는다.
 *
 * - 마우스 · 터치 · 펜 모두(빗나간 누름은 손가락에서 잦지만, 마우스도 [×] 바로 옆이면 [×]를 노린 것이다)
 * - 키보드(Enter)로 연 `click` 은 `detail` 이 0 이다 — 보지 않는다
 * - 오래된 기록(1초 넘게 지난 누름)은 보지 않는다
 */
export function isPressNear(element: Element, event: { timeStamp: number; detail: number }, margin: number): boolean {
  if (event.detail === 0 || !last || event.timeStamp - last.at > 1000) return false
  const box = element.getBoundingClientRect()
  return (
    last.x >= box.left - margin && last.x <= box.right + margin && last.y >= box.top - margin && last.y <= box.bottom + margin
  )
}
