import { Toggletip } from '@/shared/ui/Toggletip'

import { POST_STATUS_MEANING, POST_TYPE_MEANING } from '../model/labels'
import styles from './BadgeGuide.module.css'
import { StatusBadge } from './StatusBadge'
import { TypeBadge } from './TypeBadge'

/**
 * 목록 카드의 이름표가 무엇인지 — 온보딩 2층. 결과 제목 줄 끝의 `이름표 안내`를 **누르면** 펼친다.
 * 카드 위와 같은 모양(사진 위 변형)으로 보여 준다 — 여기서 본 이름표를 카드에서 그대로 다시 만난다.
 * 연락중만 선 배지다. 사진 위 변형은 흰 칸이라 흰 판 위에서는 테두리가 사라진다(라벨 · 아이콘은 같다).
 * 게시중은 카드에 표시하지 않으므로 "이름표가 없으면" 한 줄로 말한다.
 */
export function BadgeGuide({ className }: { className?: string }) {
  return (
    // 결과 제목 줄의 안내 — 모든 폭에서 아이콘 + 글자(터치에서는 이름표가 뜨지 않는다, 회의 UI-8)
    <Toggletip label="이름표 안내" align="end" showLabel className={className}>
      <p className={styles.title}>카드의 이름표</p>
      <dl className={styles.list}>
        <div className={styles.row}>
          <dt>
            <TypeBadge type="LOST" surface="photo" />
          </dt>
          <dd>{POST_TYPE_MEANING.LOST}</dd>
        </div>
        <div className={styles.row}>
          <dt>
            <TypeBadge type="FOUND" surface="photo" />
          </dt>
          <dd>{POST_TYPE_MEANING.FOUND}</dd>
        </div>
        <div className={styles.row}>
          <dt>
            <StatusBadge status="IN_PROGRESS" />
          </dt>
          <dd>{POST_STATUS_MEANING.IN_PROGRESS}</dd>
        </div>
        <div className={styles.row}>
          <dt>
            <StatusBadge status="DONE" surface="photo" />
          </dt>
          <dd>
            {POST_STATUS_MEANING.DONE}. 사진이 흑백으로 바뀌어요
          </dd>
        </div>
      </dl>
      <p className={styles.note}>이름표가 하나뿐이면 아직 찾고 있는 글이에요.</p>
    </Toggletip>
  )
}
