import { useId } from 'react'

import { ButtonLink } from '@/shared/ui/Button'
import { Plus } from '@/shared/ui/icons'

import { ANY_INTENT_NEXT, type PostIntent } from '../model/postIntent'
import { ConceptButtonLink } from './ConceptButtonLink'
import styles from './PostIntentNext.module.css'

interface PostIntentNextProps {
  /** 고른 의도. 없으면 올릴 글의 유형을 모른다 — 옅은 면 + 잉크 [글 올리기] */
  intent?: PostIntent
  /** 등록 화면 주소. 비로그인이면 로그인을 거친다 — 경로는 app 이 정한다 */
  to: string
  /** 제목 · 설명을 바꿀 때(빈 결과). 주지 않으면 결과 끝의 문구 */
  title?: string
  description?: string
}

/**
 * 찾는 글이 없을 때의 다음 행동 — 결과 끝, 그리고 빈 결과 자리(회색 판 대신).
 * 잃어버린 사람에게는 분실 글을, 주운 사람에게는 습득 글을 올려 두게 한다. 색은 올릴 글(내가 한 일)을 따른다.
 * 한 자리에 면은 이것 하나다. 버튼 이름은 헤더 · 결과 제목 아래 입구와 같은 말(`분실 글 올리기`)이다.
 */
export function PostIntentNext({ intent, to, title, description }: PostIntentNextProps) {
  const titleId = useId()
  const copy = intent?.next ?? ANY_INTENT_NEXT

  return (
    <aside className={styles.next} data-concept={intent?.concept ?? 'ANY'} aria-labelledby={titleId}>
      <div className={styles.text}>
        <h3 id={titleId} className={styles.title}>
          {title ?? copy.title}
        </h3>
        <p className={styles.description}>{description ?? copy.description}</p>
      </div>
      {intent ? (
        <ConceptButtonLink concept={intent.concept} to={to} className={styles.action}>
          {copy.action}
        </ConceptButtonLink>
      ) : (
        <ButtonLink to={to} variant="primary" className={styles.action}>
          <Plus />
          {copy.action}
        </ButtonLink>
      )}
    </aside>
  )
}
