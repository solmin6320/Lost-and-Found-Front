import { useLocation, useNavigate } from 'react-router-dom'

import { paths } from '@/app/paths'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { CaretLeft, Signpost } from '@/shared/ui/icons'

import styles from './NotFoundPage.module.css'

/**
 * SCR-09 없는 화면 · `*` — 정의되지 않은 경로 · 오타 · 오래된 링크.
 *
 * 상세의 "없거나 삭제된 글"과 같은 면 · 같은 말투다. 다른 점은 **어떤 주소로 왔는지**를 보여 준다는 것 —
 * 잘못 적힌 한 글자(`/post/12`)를 사용자가 직접 알아볼 수 있다. 주소는 글자로만 보여 준다(링크로 만들지 않는다).
 *
 * 나갈 문 둘 : [목록으로](늘 있다) · [뒤로](앱 안에서 넘어왔을 때만 — 주소창으로 바로 열었으면 돌아갈 곳이 이 앱 밖이다)
 */
export function NotFoundPage() {
  const location = useLocation()
  const navigate = useNavigate()
  useDocumentTitle('없는 화면')

  const canGoBack = location.key !== 'default'
  const address = readable(`${location.pathname}${location.search}`)

  return (
    <div className={styles.page}>
      <EmptyState
        titleAs="h1"
        icon={<Signpost />}
        title="없는 화면이에요."
        detail={
          <p className={styles.address}>
            <span className={styles.addressLabel}>주소</span>
            <span className={styles.addressValue}>{address}</span>
          </p>
        }
        description="주소가 맞는지 확인하거나 목록에서 다시 찾아보세요."
        action={
          <div className={styles.actions}>
            {canGoBack ? (
              <Button onClick={() => navigate(-1)}>
                <CaretLeft />
                뒤로
              </Button>
            ) : null}
            <ButtonLink to={paths.postList} variant="primary">
              목록으로
            </ButtonLink>
          </div>
        }
      />
    </div>
  )
}

/** `%EC%A7%80%EA%B0%91` 같은 주소를 사람이 읽는 글자로. 풀 수 없는 값이면 그대로 둔다 */
function readable(path: string): string {
  try {
    return decodeURI(path)
  } catch {
    return path
  }
}
