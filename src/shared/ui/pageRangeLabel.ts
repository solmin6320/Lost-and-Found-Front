/**
 * 페이지 묶음 이름 — `6~10페이지`, 한 쪽뿐이면 `6페이지`(QA-P-18② · D-16 — `6~6페이지`라고 읽지 않게).
 * `Pagination` 의 화살표 이름 · 이름표가 쓴다. 컴포넌트 파일 밖에 둔다(빠른 새로고침은 컴포넌트만 내보내는 파일에서 동작한다)
 */
export function pageRangeLabel({ start, end }: { start: number; end: number }): string {
  return start === end ? `${start}페이지` : `${start}~${end}페이지`
}
