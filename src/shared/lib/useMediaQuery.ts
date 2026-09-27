import { useSyncExternalStore } from 'react'

/**
 * CSS 미디어 쿼리가 지금 맞는지. 화면 폭 · 입력 장치가 바뀌면 다시 그린다.
 * 모양은 CSS 로 바꾸고, **동작**이 달라져야 할 때만 쓴다(넓은 화면 마우스에서만 끌어다 놓기).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
