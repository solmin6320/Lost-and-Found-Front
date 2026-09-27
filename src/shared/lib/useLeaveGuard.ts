import { useCallback, useEffect, useRef } from 'react'
import { useBlocker, type Blocker } from 'react-router-dom'

export interface LeaveGuard {
  /** 앱 안 이동이 막혔을 때 `state === 'blocked'`. 확인 창을 띄우고 `proceed()` · `reset()` 중 하나를 부른다 */
  blocker: Blocker
  /**
   * 이제 떠나도 된다 — 저장이 끝났거나 사용자가 "나가기"를 골랐다. 다음 이동부터 막지 않는다.
   * 막힌 이동(`blocker`)을 풀 때는 이것 말고 `blocker.proceed()` 를 쓴다
   */
  allowLeave: () => void
}

/**
 * 작성 중에 떠나려 하면 붙잡는다(화면정의서 1.7).
 *
 * - **새로고침 · 탭 닫기 · 주소 입력** : `beforeunload`. 문장은 브라우저가 정한다(바꿀 수 없다)
 * - **앱 안 이동**(링크 · 뒤로가기 · `navigate`) : React Router `useBlocker` — 우리 확인 창을 띄운다.
 *   같은 화면 안에서 주소의 `?` 뒤만 바뀌는 이동은 막지 않는다(쓰던 칸이 그대로다)
 *
 * `when` 이 거짓이면 아무것도 막지 않는다. 막을지는 이동하는 **그 순간**의 값으로 정한다.
 */
export function useLeaveGuard(when: boolean): LeaveGuard {
  const whenRef = useRef(when)
  const allowed = useRef(false)

  useEffect(() => {
    whenRef.current = when
  })

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        whenRef.current && !allowed.current && currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  )

  useEffect(() => {
    if (!when) return
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (allowed.current) return
      event.preventDefault()
      // 옛 브라우저는 이 값이 있어야 묻는다
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [when])

  // 막힌 채로 더 막을 이유가 없어지면(저장 완료 등) 풀어 준다
  useEffect(() => {
    if (blocker.state === 'blocked' && !when) blocker.reset()
  }, [blocker, when])

  const allowLeave = useCallback(() => {
    allowed.current = true
  }, [])

  return { blocker, allowLeave }
}
