import { cx } from '@/shared/lib/cx'
import { Skeleton } from '@/shared/ui/Skeleton'

import styles from './PostCard.module.css'

/** 카드와 같은 격자 · 같은 줄 높이 · 같은 윤곽 굵기(옅은 색). 데이터가 들어와도 레이아웃이 튀지 않는다 */
export function PostCardSkeleton() {
  return (
    <div className={cx(styles.card, styles.skeletonCard)} aria-hidden="true">
      <div className={styles.body}>
        <div className={styles.skeletonTitle}>
          <Skeleton shape="text" width="92%" />
          <Skeleton shape="text" width="58%" />
        </div>
        <div className={styles.skeletonFacts}>
          <Skeleton shape="text" width="74%" />
          <Skeleton shape="text" width="52%" />
        </div>
      </div>
      <div className={styles.media}>
        <Skeleton className={styles.skeletonMedia} height="auto" />
      </div>
    </div>
  )
}
