import { useEffect, type RefObject } from 'react'

/** 화면 아래에 붙은 줄이 차지한 높이(px). 짧은 알림(Flash)이 이 위로 비켜 뜬다 */
export const BOTTOM_INSET_VAR = '--bottom-inset'

/**
 * 화면 아래에 붙는 줄이 **자기 높이를 문서에 알린다**(API2-3). 지금 쓰는 곳은 상세의 휴대폰 댓글 줄(`CommentBar`) 하나다 —
 * 폼의 제출 줄은 `--form-bar-h` 로 스크롤 여백만 따로 잰다(폼에서는 짧은 알림이 뜨지 않는다).
 *
 * - `--bottom-inset` : 짧은 알림이 그 위로 비켜 뜬다(`Flash.module.css`). 4초 동안 줄의 버튼 글자를 가리지 않게
 * - `scroll-padding-bottom` : Tab 으로 옮긴 포커스 · 찾아가는 스크롤이 줄 밑에 숨지 않게
 *
 * 줄이 숨으면(`active` 거짓) 둘 다 0 으로 돌린다. 높이는 글자 크기 · 기기 아래 여백(safe-area)에 따라 달라지니 재어서 쓴다.
 * 한 화면에 붙는 아래 줄은 하나다(디자인 회의 총량 규칙) — 둘이 동시에 쓰지 않는다.
 */
export function useBottomInset(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const element = ref.current
    if (!active || !element) return
    const root = document.documentElement

    function apply(height: number) {
      const px = `${Math.ceil(height)}px`
      root.style.setProperty(BOTTOM_INSET_VAR, px)
      root.style.scrollPaddingBottom = px
    }

    apply(element.getBoundingClientRect().height)
    const observer = new ResizeObserver(([entry]) => {
      if (entry) apply(entry.borderBoxSize[0]?.blockSize ?? entry.target.getBoundingClientRect().height)
    })
    observer.observe(element)

    return () => {
      observer.disconnect()
      root.style.removeProperty(BOTTOM_INSET_VAR)
      root.style.removeProperty('scroll-padding-bottom')
    }
  }, [ref, active])
}
