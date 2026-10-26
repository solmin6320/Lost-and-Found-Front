import { LoadingDots } from '@/shared/ui/LoadingDots'

import styles from './Admin.module.css'

/** 제목 · 할 일 한 줄 — 받은 화면 · 스켈레톤 · 코드를 받는 동안이 같은 머리를 쓴다(자리가 바뀌지 않게) */
export function ManagersHead() {
  return (
    <header className={styles.head}>
      <h1 className={styles.title}>매니저 관리</h1>
      <p className={styles.hint}>회원을 찾아 매니저로 임명하거나 해임해요.</p>
    </header>
  )
}

/**
 * 결과 제목 줄 — `전체 128명`. 수를 모르는 동안은 수 자리에 점 셋(0.3초 뒤, 모든 건수 자리 같은 표시 — 본인 결정 2026-10-16).
 * 자리는 늘 잡아 둔다 — 수가 들어와도 줄 높이가 그대로다
 */
export function ResultCount({ label, total, loading }: { label: string; total: number | null; loading: boolean }) {
  return (
    <span className={styles.resultText}>
      {label}{' '}
      <span className={styles.resultCount} data-numeric>
        {total === null ? (
          <LoadingDots active={loading} label="회원 수를 세는 중" announce={false} reserve className={styles.resultDots} />
        ) : (
          `${total.toLocaleString('ko-KR')}명`
        )}
      </span>
    </span>
  )
}

/**
 * 관리자 화면의 코드를 처음 받는 동안(라우트의 대체 화면, `routes.tsx`) — 머리만 그린다.
 * 이 파일은 첫 묶음에 실린다. 관리자 기능(`@/features/admin`)을 여기서 부르면 관리자만 쓰는 코드가 모든 방문자의 첫 묶음에 실려,
 * 머리(제목 · 할 일 한 줄)까지만 같은 자리에 그리고 나머지(찾기 · 탭 · 줄)는 조각이 도착한 뒤 그 아래에 나타난다 — 위에 있던 것은 움직이지 않는다
 */
export function AdminRouteFallback() {
  return (
    <div className={styles.page}>
      <ManagersHead />
      <p className="sr-only" role="status">
        관리자 화면을 불러오는 중이에요
      </p>
    </div>
  )
}
