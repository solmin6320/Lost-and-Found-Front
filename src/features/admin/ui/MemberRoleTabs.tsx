import { Link, type To } from 'react-router-dom'

import type { MemberRole } from '@/features/members'

import { ADMIN_ROLE_TABS } from '../model/memberSearch'
import styles from './MemberRoleTabs.module.css'

interface MemberRoleTabsProps {
  /** 지금 보는 역할. `undefined` 면 전체 */
  selected: MemberRole | undefined
  /** 역할 → 주소. 검색어는 그대로 두고 1페이지로(부른 쪽이 정한다) */
  hrefFor: (role: MemberRole | undefined) => To
  /** 지금 탭 링크에 덧붙일 표시(`data-*`) — 뒤로 · 앞으로의 포커스 대체 자리(RouteFocus) */
  currentData?: Record<`data-${string}`, string | true>
}

/**
 * 역할 탭 — 전체 · 매니저 · 관리자 · 회원. 내가 쓴 글의 상태 탭(`PostStatusTabs`)과 같은 모양 · 같은 말투다(제이콥 — 이 서비스 안에서 이미 배운 것) :
 * 주소를 바꾸는 **링크 묶음**(ARIA 탭이 아니다), 고른 탭은 굵은 글자 + 아래 잉크 막대, 색 없음, 지금 탭은 `aria-current="true"`
 * (`"page"` 는 아래 페이지 번호의 지금 페이지 하나에만). 탭마다 주소가 있어 뒤로가기 · 새로고침 · 새 탭 열기가 된다.
 *
 * 건수는 두지 않는다 — 결과 제목(`매니저 3명`)이 고른 탭의 수를 말한다. 탭마다 수를 물으면 요청이 넷 늘고, 숫자가 들어올 때 탭이 움직인다
 */
export function MemberRoleTabs({ selected, hrefFor, currentData }: MemberRoleTabsProps) {
  return (
    <nav className={styles.nav} aria-label="역할별로 보기">
      <ul className={styles.list} role="list">
        {ADMIN_ROLE_TABS.map(({ role, label }) => {
          const current = role === selected
          return (
            <li key={label}>
              <Link
                className={styles.tab}
                to={hrefFor(role)}
                aria-current={current ? 'true' : undefined}
                {...(current ? currentData : undefined)}
              >
                {/* 보이지 않는 굵은 이름을 겹쳐 고른 탭이 굵어져도 폭이 그대로다(상태 탭과 같다) */}
                <span className={styles.label} data-label={label}>
                  {label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
