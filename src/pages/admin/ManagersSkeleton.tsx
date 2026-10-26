import {
  ADMIN_MEMBERS_PAGE_SIZE,
  AdminMemberListSkeleton,
  MemberRoleTabs,
  MemberSearchForm,
  resultScopeLabel,
  useAdminMemberSearch,
} from '@/features/admin'

import styles from './Admin.module.css'
import { ManagersHead, ResultCount } from './ManagersHead'

/**
 * 세션을 되살리는 동안(관리자 틀)의 모습. 받은 화면의 첫 모습과 같다 —
 * 제목 · 할 일 한 줄 · 찾기 칸 · 역할 탭 · 결과 제목(수 자리) · 줄 스무 개. 코드 · 데이터가 도착해도 자리가 바뀌지 않는다.
 * 찾기 칸과 탭은 진짜다(주소만 있으면 된다) — 기다리는 동안 다른 탭을 눌러도 그대로 간다
 */
export function ManagersSkeleton() {
  const { search, hrefForRole, applyKeyword } = useAdminMemberSearch()
  return (
    <div className={styles.page}>
      <ManagersHead />
      <div className={styles.search}>
        <MemberSearchForm key={search.keyword} keyword={search.keyword} onSearch={applyKeyword} />
      </div>
      <div className={styles.tabs}>
        <MemberRoleTabs selected={search.role} hrefFor={hrefForRole} />
      </div>
      <div className={styles.resultHead}>
        <p className={styles.resultTitle}>
          <ResultCount label={resultScopeLabel(search)} total={null} loading />
        </p>
      </div>
      <p className="sr-only" role="status">
        회원 목록을 불러오는 중이에요
      </p>
      <AdminMemberListSkeleton count={ADMIN_MEMBERS_PAGE_SIZE} />
    </div>
  )
}
