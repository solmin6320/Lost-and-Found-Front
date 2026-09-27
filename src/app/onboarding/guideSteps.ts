/**
 * 온보딩 1층 — 세 단계. 개념 → 탐색 → 행동(docs/온보딩설계.md 3장).
 *
 * 가리키는 대상은 화면 요소의 `data-guide` 값이다. 헤더의 [글 올리기]는 목록 밖(레이아웃)에 있어
 * ref 대신 속성으로 찾는다.
 *   intent : 목록 맨 위 의도 선택 두 칸 — 이 서비스의 구조. 글이 0건이어도 · 불러오는 중에도 늘 있다
 *   finder : 검색창 + 필터 칩
 *   create : 헤더의 [글 올리기]
 *
 * 되돌릴 수 없는 동작(삭제 · 완료)은 여기서 말하지 않는다 — 그 버튼을 누르는 순간 알린다.
 * 없는 기능(쪽지 · 소유 확인 · 알림)도 말하지 않는다.
 */

export type GuideTarget = 'intent' | 'finder' | 'create'

export interface GuideStep {
  target: GuideTarget
  /** 한 문장. 무엇을 하는 자리인지 */
  title: string
  /** 짧은 보조 문장 */
  body: string
  /** 카드의 두 이름표(분실 · 습득)를 실제 배지로 보여 준다. 목록에서 같은 모양을 다시 만난다 */
  typeLegend?: boolean
}

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    target: 'intent',
    title: '먼저 내 상황을 골라요',
    body: '잃어버렸다면 누군가 주워 둔 물건을, 주웠다면 주인이 찾는 물건을 모아 보여 드려요.',
    typeLegend: true,
  },
  {
    target: 'finder',
    title: '물건 이름으로 찾아요',
    body: '카테고리, 상태, 장소, 기간으로 더 좁힐 수 있어요.',
  },
  {
    target: 'create',
    title: '찾는 물건이 없으면 글을 올려요',
    body: '사진과 장소를 남기면 본 사람이 댓글로 알려 줘요.',
  },
]

export function guideTargetElement(target: GuideTarget): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-guide="${target}"]`)
}
