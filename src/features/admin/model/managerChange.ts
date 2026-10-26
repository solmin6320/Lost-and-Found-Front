import type { MemberRole } from '@/features/members'
import { hasErrorCode } from '@/shared/lib/http'

import type { ManagerChange } from '../api/types'

/**
 * 이 역할의 회원에게 할 수 있는 변경. 관리자는 없다 — 서버 환경변수(`ADMIN_EMAILS`)로만 바뀐다(`ADMIN_ROLE_LOCKED`).
 * 그래서 관리자 줄에는 버튼 대신 안내 한 줄을 둔다(누를 수 없는 버튼을 그리지 않는다)
 */
export function managerChangeFor(role: MemberRole): ManagerChange | null {
  if (role === 'USER') return 'appoint'
  if (role === 'MANAGER') return 'dismiss'
  return null
}

/**
 * 액세스 토큰 수명(분) — 서버 `JwtTokenProvider` 의 5분. 역할을 바꾸면 그 회원의 리프레시 토큰이 지워져
 * 늦어도 이만큼 지나면 다음 재발급이 거절되어 로그인이 풀린다. 결과 고지에 숫자로 쓴다(화면정의서 1.6 "숫자까지")
 */
export const ACCESS_TOKEN_MINUTES = 5

export interface ManagerChangeCopy {
  /** 줄의 버튼 — 무엇을 하는지 동사로 */
  action: string
  /** 확인 창 제목 — 누구에게 무엇을 할지 */
  title: string
  /** 확인 창 본문 — 누르기 전에 결과를 한 번, 숫자까지(화면정의서 1.6) */
  result: string
  confirmLabel: string
  pendingLabel: string
  /** 끝난 뒤 짧은 알림(polite) */
  done: string
}

/**
 * 임명 · 해임의 문구. 해요체. 보이는 문장에 줄표를 쓰지 않는다(design-taste 9.G).
 * 결과는 **그 회원이 다시 로그인해야 적용된다**는 것과 **언제 로그인이 풀리는지** — 관리자가 "바로 바뀌었다"고 믿고 그 회원에게 일을 맡기지 않게
 */
export function managerChangeCopy(nickname: string, change: ManagerChange): ManagerChangeCopy {
  if (change === 'appoint') {
    return {
      action: '매니저로 임명',
      title: `${nickname} 님을 매니저로 임명할까요?`,
      result: `임명하면 이 회원은 모든 기기에서 ${ACCESS_TOKEN_MINUTES}분 안에 로그인이 풀려요. 다시 로그인하면 매니저 권한이 적용돼요.`,
      confirmLabel: '임명하기',
      pendingLabel: '임명하는 중',
      done: `${nickname} 님을 매니저로 임명했어요. 다시 로그인하면 적용돼요.`,
    }
  }
  return {
    action: '매니저 해임',
    title: `${nickname} 님을 매니저에서 해임할까요?`,
    result: `해임하면 회원으로 돌아가고, 모든 기기에서 ${ACCESS_TOKEN_MINUTES}분 안에 로그인이 풀려요. 다시 로그인하면 회원 권한만 남아요.`,
    confirmLabel: '해임하기',
    pendingLabel: '해임하는 중',
    done: `${nickname} 님을 매니저에서 해임했어요. 다시 로그인하면 적용돼요.`,
  }
}

/**
 * 임명 · 해임이 실패했을 때 화면이 할 일.
 *
 * - `stale` 보던 줄이 낡았다 — 그사이 다른 창에서 이미 바꿈(`ALREADY_MANAGER` · `NOT_MANAGER`), 관리자가 됨(`ADMIN_ROLE_LOCKED`),
 *   회원이 없어짐(`MEMBER_NOT_FOUND`). 창을 닫고 서버 문장을 짧은 알림으로, 목록을 다시 받아 지금 상태를 맞춘다(상세의 409 와 같은 규칙, 화면정의서 1.4)
 * - `denied` 관리자가 아니다(`ACCESS_DENIED` 403 — 토큰의 역할은 화면 표시용이라 서버가 다르게 볼 수 있다). 창을 닫고 권한 없음 면으로
 * - `retry` 그 밖(연결 끊김 · 서버 오류) — 창을 열어 둔 채 서버 문장을 보이고 다시 누를 수 있게
 */
export type ManagerChangeFailure = 'stale' | 'denied' | 'retry'

export function managerChangeFailure(error: unknown): ManagerChangeFailure {
  if (hasErrorCode(error, 'ACCESS_DENIED')) return 'denied'
  if (
    hasErrorCode(error, 'ALREADY_MANAGER') ||
    hasErrorCode(error, 'NOT_MANAGER') ||
    hasErrorCode(error, 'ADMIN_ROLE_LOCKED') ||
    hasErrorCode(error, 'MEMBER_NOT_FOUND')
  ) {
    return 'stale'
  }
  return 'retry'
}
