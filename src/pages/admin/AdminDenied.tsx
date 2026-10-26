import { useLocation, useNavigate } from 'react-router-dom'

import { paths } from '@/app/paths'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { CaretLeft, LockSimple } from '@/shared/ui/icons'

import styles from './Admin.module.css'

/**
 * 권한 없음 — 로그인했지만 관리자가 아니다(토큰의 역할로 화면이 먼저 가르고, 서버가 403 `ACCESS_DENIED` 를 줘도 이 면이다).
 *
 * 없는 화면(SCR-09)과 같은 머리 : 왼쪽 정렬 제목 · 할 일 한 줄 · 나갈 문. 회색 판을 깔지 않는다.
 * 무엇이 막혔는지(관리자만)와 풀 길(관리자 계정으로 다시 로그인)을 말한다 — 막다른 길을 만들지 않는다.
 * 관리 기능의 이름 · 수는 늘어놓지 않는다(무엇이 있는지는 관리자에게만 의미가 있다)
 */
export function AdminDenied() {
  const location = useLocation()
  const navigate = useNavigate()
  useDocumentTitle('권한 없음')
  const canGoBack = location.key !== 'default'

  return (
    <div className={styles.denied}>
      <span className={styles.deniedIcon} aria-hidden="true">
        <LockSimple />
      </span>
      <h1 className={styles.title}>관리자만 볼 수 있는 화면이에요.</h1>
      <p className={styles.deniedText}>
        관리자 계정으로 로그인했는지 확인해 주세요. 관리자 권한을 방금 받았다면 로그아웃한 뒤 다시 로그인하면 돼요.
      </p>
      <div className={styles.deniedActions}>
        <ButtonLink to={paths.postList} variant="primary">
          목록으로
        </ButtonLink>
        {canGoBack ? (
          <Button onClick={() => navigate(-1)}>
            <CaretLeft />
            뒤로
          </Button>
        ) : null}
      </div>
    </div>
  )
}
