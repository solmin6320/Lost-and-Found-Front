import { useCallback, useEffect, useRef, useState } from 'react'

import type { LabState } from './labSwitch'

/** 시안의 오류 문장 — 실제로는 서버 `message` 를 그대로 보인다(전역 예외 처리의 한글 문장) */
export const LAB_ERROR_MESSAGE = '서버 내부 오류가 발생했습니다'

export type LabResource<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void; retrying: boolean }
  | { status: 'ready'; data: T }

/**
 * 목 데이터를 API 처럼 받는다(시안 전용). 실제 API 가 생기면 `front-api` 의 쿼리로 바뀐다.
 *   state=loading → 끝나지 않는다(캡처용) · error → 오류(다시 시도하면 다시 오류) · empty → `empty()` 값
 * `key` 가 바뀌면 다시 받는다(기준 글이 바뀜 등)
 */
export function useLabResource<T>(
  make: () => T,
  empty: () => T,
  state: LabState | undefined,
  { delay = 700, key = '' }: { delay?: number; key?: string } = {},
): LabResource<T> {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ attempt: number; key: string; ok: boolean; data?: T } | null>(null)
  const makeRef = useRef({ make, empty })
  useEffect(() => {
    makeRef.current = { make, empty }
  })

  useEffect(() => {
    if (state === 'loading') return
    const timer = window.setTimeout(() => {
      const ok = state !== 'error'
      setResult({ attempt, key, ok, data: ok ? (state === 'empty' ? makeRef.current.empty() : makeRef.current.make()) : undefined })
    }, delay)
    return () => window.clearTimeout(timer)
  }, [attempt, state, delay, key])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (state === 'loading' || result === null || result.key !== key) return { status: 'loading' }
  if (!result.ok) return { status: 'error', message: LAB_ERROR_MESSAGE, retry, retrying: result.attempt !== attempt }
  return { status: 'ready', data: result.data as T }
}
