import { useEffect, useState } from 'react'

/** 이보다 짧은 기다림에는 아무것도 띄우지 않는다 — 빠른 응답에 표시가 한 번 깜빡이면 오히려 느려 보인다(디자인품질기준 4장 ~300ms) */
export const LATE_FLAG_MS = 300

/**
 * `flag` 가 `ms` 넘게 이어졌는가. 짧게 켜졌다 꺼지면 끝까지 `false` — 빠른 응답에는 아무것도 바뀌지 않는다.
 * `ms` 가 0 이하이면 `flag` 그대로
 */
export function useLateFlag(flag: boolean, ms: number = LATE_FLAG_MS): boolean {
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (!flag || ms <= 0) return
    const timer = setTimeout(() => setLate(true), ms)
    return () => {
      clearTimeout(timer)
      setLate(false)
    }
  }, [flag, ms])
  return flag && (ms <= 0 || late)
}
