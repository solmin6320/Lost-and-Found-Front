/**
 * 온보딩 1층 — 세 단계. 개념 → 탐색 → 행동(docs/온보딩설계.md 3장).
 *
 * 가리키는 대상은 화면 요소의 `data-guide` 값이다. 헤더의 [글 올리기]는 목록 밖(레이아웃)에 있어
 * ref 대신 속성으로 찾는다.
 *   intent : 목록 맨 위 분실 · 습득 두 칸 — 이 서비스의 구조. 글이 0건이어도 · 불러오는 중에도 늘 있다
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
    title: '어떤 글을 볼지 골라요',
    // 칸 이름 = 그 칸이 보여 주는 글의 종류(본인 결정 2026-10-07). 아래 이름표 두 개가 칸과 같은 색 · 같은 말이다
    body: '잃어버린 물건은 분실 글로, 주운 물건은 습득 글로 모여요. 카드에도 같은 이름표가 붙어요.',
    typeLegend: true,
  },
  {
    target: 'finder',
    title: '물건 이름으로 찾아요',
    body: '검색은 분실 글과 습득 글을 함께 찾아요. 카테고리, 상태, 장소, 기간으로 더 좁힐 수 있어요.',
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

/**
 * 테 안을 눌렀는데 그 점이 조작 사이 틈이었다 — 대신 할 그 대상의 대표 동작(회의 RV-10).
 *   intent : 없다. 두 의도 가운데 무엇을 골랐는지 알 수 없다 — 닫기만 한다
 *   finder : 검색칸에 포커스(틀은 검색칸과 칩 줄을 덮는 빈 칸이라 그 안에 조작이 없다)
 *   create : [글 올리기] 그 자체
 */
export function guideFallbackControl(target: GuideTarget): HTMLElement | null {
  if (target === 'finder') return document.querySelector<HTMLElement>('input[type="search"]')
  if (target === 'create') return guideTargetElement('create')
  return null
}
