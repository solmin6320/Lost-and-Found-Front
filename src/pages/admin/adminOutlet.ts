import { useOutletContext } from 'react-router-dom'

/** 섹션 화면이 관리자 틀(`AdminLayout`)에서 받는 것 */
export interface AdminOutletContext {
  /** 서버가 403 `ACCESS_DENIED` 를 줬다 — 권한 없음 면으로 바꾼다(토큰의 역할은 화면 표시용이라 서버가 다르게 볼 수 있다) */
  deny: () => void
}

/** 섹션 화면이 부른다(`ManagersPage`) */
export function useAdminOutlet(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>()
}
