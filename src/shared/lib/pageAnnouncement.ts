/**
 * 페이지를 넘긴 결과 알림 — 화면의 건수 · 페이지 번호와 같은 말로. 목록 · 내가 쓴 글이 같은 문장을 쓴다(QA-P-23, 2026-10-18)
 *
 * `3페이지예요. 230건 중 41~60번째 글이에요.` — 받은 글 수(`shown`)로 끝 번호를 센다(마지막 페이지는 20건보다 적다)
 */
export function pageAnnouncement(page: number, pageSize: number, shown: number, total: number): string {
  const from = (page - 1) * pageSize + 1
  const to = from + shown - 1
  const n = (value: number) => value.toLocaleString('ko-KR')
  return `${page}페이지예요. ${n(total)}건 중 ${n(from)}~${n(to)}번째 글이에요.`
}
