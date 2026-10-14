import type { MouseEvent } from 'react'

type PickerInput = Pick<HTMLInputElement, 'readOnly' | 'disabled'> & { showPicker?: () => void }

/**
 * 날짜 칸(`<input type="date">`)을 누르면 **어디를 눌러도** 날짜 선택기를 연다(본인 피드백 2026-10-14).
 *
 * 브라우저 기본은 오른쪽 달력 아이콘만 선택기를 열고, "연도. 월. 일." 글자를 누르면 연도 칸에 커서만 들어간다 —
 * 휴대폰에서는 작은 아이콘을 맞혀야 하고, 글자를 누른 사람은 "안 열린다"고 느낀다(피츠 · 제이콥).
 * 칸 이름(label)을 눌러도 브라우저가 칸에 `click` 을 넘기므로 이 처리가 그대로 탄다.
 *
 * - `showPicker()` 가 없는 브라우저(오래된 Safari 등)는 지금 동작 그대로 둔다
 * - 사용자 활성화가 없거나 이미 열려 있으면 브라우저가 예외를 던진다 — 삼키고 기본 동작에 맡긴다
 * - 읽기 전용 · 잠긴 칸(보내는 중)은 열지 않는다
 * - 키보드는 건드리지 않는다 — 포커스한 칸에 숫자를 바로 칠 수 있다(Enter 는 `click` 을 만들지 않는다)
 *
 * @returns 선택기를 열었는가
 */
export function openDatePicker(input: PickerInput): boolean {
  if (input.readOnly || input.disabled) return false
  if (typeof input.showPicker !== 'function') return false
  try {
    input.showPicker()
    return true
  } catch {
    return false
  }
}

/** `<input type="date" onClick={openDatePickerOnClick}>` — 누른 칸의 선택기를 연다 */
export function openDatePickerOnClick(event: MouseEvent<HTMLInputElement>) {
  openDatePicker(event.currentTarget)
}
