import { matchPath } from 'react-router-dom'

import { paths } from '@/app/paths'

/**
 * 관리자 화면의 섹션 — **기능이 생길 때마다 여기에 한 줄씩 더한다**(본인 지시 2026-10-25 "지금 가능한 정도만, 추후 기능이 추가될 때마다 추가").
 *
 * 지금은 `매니저 관리` 하나다. 둘 이상이 되면 관리자 틀(`AdminLayout`)이 제목 위에 섹션 이동 줄(밑줄 탭 링크)을 그린다 —
 * 하나뿐일 때는 그리지 않는다(갈 곳이 하나인 메뉴는 할 일이 없다, 힉스). 아직 없는 섹션의 빈 자리(`준비 중`)도 그리지 않는다.
 *
 * 붙을 차례(화면정의서 SCR-19 "추후 섹션 추가 지점")
 *   1. 신고 처리(`SCR-15`) — 백엔드 신고 · 관리 머지 뒤. 매니저도 쓰는 화면이면 경로를 `/manage/reports/*`(안)로 따로 둘 수 있다
 *      (그때는 이 목록이 아니라 계정 메뉴의 `신고 관리` 입구 — 관리자 틀의 가드는 관리자만 통과시킨다)
 *   2. 감사 기록(매니저의 행동만) — 백엔드 `ADMIN_ACTION_LOG` 머지 뒤
 *
 * 더하는 법 : `app/paths.ts` 의 `paths.admin` 에 경로 → 여기에 한 줄(`id` · 이름 · 경로) → `app/routes.tsx` 의 `/admin` 아래 자식 라우트 하나.
 * 섹션 화면은 제목(`h1`)부터 그리고, 서버가 403 `ACCESS_DENIED` 를 주면 `useAdminOutlet().deny()` 를 부른다(권한 없음 면).
 * 맨 앞 섹션이 `/admin` 의 기본 행선지다
 */
export interface AdminSection {
  id: 'managers'
  /** 탭 제목 · 섹션 이동 줄의 이름 */
  label: string
  path: string
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [{ id: 'managers', label: '매니저 관리', path: paths.admin.managers }]

/** 지금 주소의 섹션. 모르는 주소(`/admin/없는곳`)면 `null` — 라우터가 없는 화면으로 보낸다 */
export function adminSectionAt(pathname: string): AdminSection | null {
  return ADMIN_SECTIONS.find((section) => matchPath({ path: section.path, end: true }, pathname)) ?? null
}
