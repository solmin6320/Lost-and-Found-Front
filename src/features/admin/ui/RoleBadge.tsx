import type { MemberRole } from '@/features/members'

import { MEMBER_ROLE_LABEL } from '../model/memberSearch'
import styles from './RoleBadge.module.css'

/**
 * 역할 이름표 — `회원` · `매니저` · `관리자`. 배지(4px 이름표) 모양이고 **색을 쓰지 않는다**(분실 · 습득 두 색은 글의 개념에만, 빨강은 오류 · 삭제에만 — 화면정의서 1.2).
 * 무게로 가른다 : 회원은 옅은 선, 매니저는 잉크 선 두 겹, 관리자는 잉크 채움. 글자가 늘 함께 있어 색 · 모양 없이도 읽힌다.
 * 기능명세서 7.4 의 "역할 이름표"(닉네임 옆)와 같은 모양이다 — 나중에 글 · 댓글 작성자 옆에 붙을 때도 이것을 쓴다
 */
export function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span className={styles.badge} data-role={role}>
      {MEMBER_ROLE_LABEL[role]}
    </span>
  )
}
