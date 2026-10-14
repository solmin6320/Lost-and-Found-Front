import { useEffect, useRef, useState } from 'react'

/** 이보다 짧은 기다림에는 아무것도 띄우지 않는다 — 빠른 응답에 표시가 한 번 깜빡이면 오히려 느려 보인다(디자인품질기준 4장 ~300ms) */
export const LATE_FLAG_MS = 300

/**
 * 한 번 띄운 표시를 적어도 이만큼은 둔다(QA-D-2, 2026-10-14). 0.3초를 갓 넘긴 응답(0.32 · 0.35초)에서 점이 수십 ms 만
 * 나타났다 사라져 "글자가 깜빡였다"로 보였다. 0.3 + 0.45 = 0.75초 안에 끝나는 기다림은 한 번에 끝난 것처럼 보인다
 */
export const LATE_FLAG_MIN_SHOW_MS = 450

interface LateFlagOptions {
  /** 한 번 켜지면 적어도 이만큼 둔다(ms). 기본 0 — 바로 내린다 */
  minShow?: number
  /** 이 값이 바뀌면 기다림을 처음부터 다시 잰다(예 : 찾는 말이 바뀜) */
  resetKey?: unknown
}

/**
 * `flag` 가 `ms` 넘게 이어졌는가. 짧게 켜졌다 꺼지면 끝까지 `false` — 빠른 응답에는 아무것도 바뀌지 않는다.
 * `ms` 가 0 이하이면 `flag` 그대로. `minShow` 를 주면 한 번 켜진 뒤 그 시간이 지나기 전에는 내리지 않는다
 */
export function useLateFlag(flag: boolean, ms: number = LATE_FLAG_MS, options: LateFlagOptions = {}): boolean {
  const { minShow = 0, resetKey } = options
  const [late, setLate] = useState(false)
  const [holding, setHolding] = useState(false)
  const shownAt = useRef<number | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!flag || ms <= 0) return
    const timer = setTimeout(() => {
      if (holdTimer.current) clearTimeout(holdTimer.current)
      holdTimer.current = null
      setHolding(false)
      shownAt.current = performance.now()
      setLate(true)
    }, ms)
    return () => {
      clearTimeout(timer)
      const since = shownAt.current
      shownAt.current = null
      setLate(false)
      if (since === null || minShow <= 0) return
      const left = minShow - (performance.now() - since)
      if (left <= 0) return
      // 내릴 때가 왔지만 아직 최소 시간이 남았다 — 남은 만큼 더 둔다(글자 숨김 · 점이 같은 그림 안에서 바뀐다)
      setHolding(true)
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null
        setHolding(false)
      }, left)
    }
  }, [flag, ms, minShow, resetKey])

  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current)
    },
    [],
  )

  return (flag && (ms <= 0 || late)) || holding
}
