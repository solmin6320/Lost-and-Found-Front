/**
 * 글자 수는 한도의 80% 부터 보인다(2026-10-03 회의 UI-9 c). 그 전의 `0/100` 은 늘 떠 있는 잡음이다.
 * 제목 · 장소 100자 → 80 · 설명 5,000자 → 4,000 · 닉네임 20자 → 16 · 댓글 300자 → 240.
 * 보이기 전에도 스크린리더는 "최대 N자"를 읽는다(`FieldCount`).
 */
export const COUNT_VISIBLE_RATIO = 0.8

/** 한도의 80% 에 닿았나(넘쳤으면 당연히 보인다) */
export function countVisible(value: number, max: number): boolean {
  return value >= Math.ceil(max * COUNT_VISIBLE_RATIO)
}
