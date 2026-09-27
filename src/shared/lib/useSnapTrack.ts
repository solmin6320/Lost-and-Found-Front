import { useCallback, useEffect, useRef } from 'react'

/** 한 장이 이만큼 보이면 "지금 보는 장"으로 친다 */
const SETTLE_RATIO = 0.6
/** 버튼으로 옮기는 동안 지나가는 장은 세지 않는다. 부드러운 스크롤이 끝날 만한 시간 */
const PROGRAMMATIC_MS = 700

/**
 * 가로 스크롤 스냅 줄(사진 넘겨 보기). 손가락으로 넘기면 스크롤 스냅이 맞추고,
 * 지금 몇 번째인지는 IntersectionObserver 가 알려 준다(스크롤 이벤트를 듣지 않는다).
 *
 * 줄의 자식(`<li data-index>`) 하나가 한 장이다. 한 장의 폭은 줄 폭과 같아야 한다.
 *
 * ```tsx
 * const { trackRef, scrollToIndex } = useSnapTrack(images.length, setIndex)
 * <ul ref={trackRef}>{images.map((_, i) => <li data-index={i} />)}</ul>
 * ```
 */
export function useSnapTrack(count: number, onSettle: (index: number) => void) {
  const trackRef = useRef<HTMLUListElement>(null)
  const target = useRef<{ index: number; until: number } | null>(null)
  const onSettleRef = useRef(onSettle)

  useEffect(() => {
    onSettleRef.current = onSettle
  })

  useEffect(() => {
    const track = trackRef.current
    if (!track || count < 2) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < SETTLE_RATIO) continue
          const index = Number((entry.target as HTMLElement).dataset.index)
          const moving = target.current
          // 버튼으로 3 → 1 로 옮길 때 2 를 지나며 번호가 깜빡이지 않게
          if (moving && performance.now() < moving.until && index !== moving.index) continue
          target.current = null
          onSettleRef.current(index)
        }
      },
      { root: track, threshold: SETTLE_RATIO },
    )
    for (const slide of Array.from(track.children)) observer.observe(slide)
    return () => observer.disconnect()
  }, [count])

  /** `smooth` 여도 모션 줄이기면 바로 옮긴다 */
  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const track = trackRef.current
    if (!track) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.current = { index, until: performance.now() + PROGRAMMATIC_MS }
    track.scrollTo({ left: index * track.clientWidth, behavior: smooth && !reduce ? 'smooth' : 'instant' })
  }, [])

  return { trackRef, scrollToIndex }
}
