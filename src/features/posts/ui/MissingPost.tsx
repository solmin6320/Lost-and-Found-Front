import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { ButtonLink } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { MagnifyingGlass } from '@/shared/ui/icons'

interface MissingPostProps {
  /** 목록 주소. 경로는 app 이 정한다 */
  listHref: string
  /** 감싸는 면(각 화면의 상태 상자). 놓이는 자리가 화면마다 조금씩 달라 부른 쪽이 준다 */
  className?: string
}

/**
 * 없거나 지워진 글 — 상세(SCR-03)와 수정(SCR-04)이 같은 문장을 쓴다.
 * 숫자가 아닌 주소 · 서버에 없는 글(404) · 받아 주지 않는 id(400)가 모두 여기로 온다.
 * 막다른 길이 되지 않게 목록으로 가는 문을 둔다.
 */
export function MissingPost({ listHref, className }: MissingPostProps) {
  useDocumentTitle('없는 글')
  return (
    <div className={className}>
      <EmptyState
        titleAs="h1"
        icon={<MagnifyingGlass />}
        title="없거나 삭제된 글이에요."
        description="주소가 맞는지 확인하거나 목록에서 다시 찾아보세요."
        action={
          <ButtonLink to={listHref} variant="primary">
            목록으로
          </ButtonLink>
        }
      />
    </div>
  )
}
