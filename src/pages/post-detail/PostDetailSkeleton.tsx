import { CaretLeft } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import styles from './PostDetailPage.module.css'

/**
 * 실제 화면과 같은 자리 · 같은 크기. 불러오면 그 자리에 글이 들어앉는다.
 *
 * 두 곳에서 쓴다 — 글을 받는 동안(상세 화면 안), 그리고 상세 화면 코드를 처음 받는 동안(라우트의 대체 화면).
 * 따로 떼어 둔 까닭이 뒤쪽이다 : 상세 화면은 나중에 받는 조각(lazy)이라, 대체 화면이 그 조각 안에 있으면 쓸 수 없다.
 * 두 단계가 같은 모양이라 코드 → 데이터로 넘어가도 화면이 한 번도 바뀌지 않는다.
 */
export function PostDetailSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <p className="sr-only" role="status">
        글을 불러오는 중입니다
      </p>
      <div className={styles.back}>
        <span className={styles.backLink} aria-hidden="true">
          <CaretLeft />
          목록으로
        </span>
      </div>
      <div className={styles.head}>
        <div className={styles.title}>
          <Skeleton shape="text" width="92%" />
          <Skeleton shape="text" width="54%" />
        </div>
        <div className={styles.badges}>
          <p className={styles.flags}>
            <Skeleton width="2.5rem" height="1.375rem" />
            <Skeleton width="3.75rem" height="1.375rem" />
          </p>
        </div>
      </div>
      <div className={styles.gallery}>
        <Skeleton className={styles.skeletonPhoto} />
      </div>
      <div className={styles.info}>
        <div className={styles.facts}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.fact}>
              <Skeleton shape="text" width="3.5rem" />
              <Skeleton shape="text" width={i === 0 ? '80%' : '40%'} />
            </div>
          ))}
        </div>
        <div className={styles.content}>
          <Skeleton shape="text" width="100%" />
          <Skeleton shape="text" width="96%" />
          <Skeleton shape="text" width="88%" />
          <Skeleton shape="text" width="62%" />
        </div>
      </div>
    </div>
  )
}
