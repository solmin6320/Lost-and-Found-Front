import { useCallback, useEffect, useState } from 'react'

import { detectPersonalInfo, PERSONAL_INFO_NOTICE, type PersonalInfoKind } from './personalInfo'

/** 입력이 이만큼 멈추면 판정한다. 치는 동안 줄이 떴다 사라졌다 하지 않게 */
export const PERSONAL_INFO_PAUSE_MS = 600

export interface PersonalInfoCheck {
  /** 지금 띄울 한 줄. 없으면 `null` */
  notice: string | null
  kind: PersonalInfoKind | null
  /** 칸을 벗어날 때(`onBlur`) 부른다 — 멈추기 전에 떠나도 한 번은 판정한다 */
  check: () => void
}

/**
 * 쓰는 칸의 개인정보 감지 시점(SE-3 · SE2-1). **입력이 0.6초 멈췄을 때 + 칸을 벗어날 때** 판정한다.
 *
 * 칸을 벗어날 때만 보면 댓글은 늦다 — 칸을 벗어나는 순간이 곧 [댓글 남기기]를 누르는 순간이라, 줄이 공개 뒤에 뜬다.
 * 그래서 쓰다 멈추면 먼저 알린다. 한 줄을 띄울 자리는 부른 쪽이 **미리 비워 둔다**(줄이 생기며 제출 버튼을 밀면 누름이 빗나간다).
 * 칸이 비면 바로 지운다.
 *
 * ```tsx
 * const personal = usePersonalInfoCheck(value)
 * <textarea onBlur={personal.check} aria-describedby={noticeId} />
 * <p id={noticeId} aria-live="polite">{personal.notice}</p>
 * ```
 */
export function usePersonalInfoCheck(value: string): PersonalInfoCheck {
  const [judged, setJudged] = useState<PersonalInfoKind | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setJudged(detectPersonalInfo(value)), PERSONAL_INFO_PAUSE_MS)
    return () => window.clearTimeout(timer)
  }, [value])

  const check = useCallback(() => setJudged(detectPersonalInfo(value)), [value])

  // 마지막 판정을 들고 있다가 다음 판정에서 바꾼다(치는 동안 깜빡이지 않게). 칸이 비면 바로 내린다
  const kind = value.trim() ? judged : null
  return { kind, notice: kind ? PERSONAL_INFO_NOTICE[kind] : null, check }
}
