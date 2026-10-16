/**
 * 제출이 막혔을 때 **빠뜨리거나 틀린 칸으로** 포커스를 옮기고, 그 칸이 보이게 한다(본인 요청 2026-10-16 — "안 적어서 취소되면 안 적은 부분으로 커서").
 *
 * `focus()` 는 화면 밖 칸을 보이는 데까지 스크롤하지만, **그 칸에 이미 포커스가 있으면 아무 일도 하지 않는다.**
 * iOS 처럼 버튼을 눌러도 포커스가 버튼으로 오지 않는 브라우저 · 칸에서 Enter 로 보낸 경우, 손가락으로 아래로 내려 [보내기]를
 * 누르면 포커스는 화면 위로 지나간 칸에 그대로 남아 있다 — 그 칸이 틀렸으면 아무 곳도 가리키지 않았다(설정 닉네임 · 댓글 수정 실측).
 * 그때는 직접 보이는 데까지 옮긴다. 붙은 헤더 · 아래 제출 줄 · 댓글 줄 밑에 숨지 않게 문서의 `scroll-padding` 을 따른다(`nearest`).
 */
export function focusAndReveal(element: HTMLElement | null | undefined): void {
  if (!element) return
  if (document.activeElement === element) {
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    return
  }
  element.focus()
}
