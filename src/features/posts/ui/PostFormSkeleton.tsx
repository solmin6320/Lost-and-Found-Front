import { Skeleton } from '@/shared/ui/Skeleton'

import styles from './PostFormSkeleton.module.css'

/**
 * 폼 모양의 자리표시 — 로그인 확인 중 · 수정할 글을 불러오는 중. **빈 폼을 먼저 보여 주지 않는다**
 * (사용자가 입력을 시작해 버리면 불러온 값이 덮거나, 로그인 화면으로 가며 잃는다).
 * 실제 폼과 같은 순서 · 비슷한 높이 : 제목 → 두 칸 → 사진 → 한 줄 칸들 → 설명.
 */
export function PostFormSkeleton({ label }: { label: string }) {
  return (
    <div className={styles.layout}>
    <div className={styles.page} aria-busy="true">
      <p className="sr-only" role="status">
        {label}
      </p>
      <div className={styles.head}>
        <Skeleton shape="text" width="9rem" height="2rem" />
        <Skeleton shape="text" width="15rem" />
      </div>
      <div className={styles.choices}>
        <Skeleton className={styles.choice} />
        <Skeleton className={styles.choice} />
      </div>
      <div className={styles.field}>
        <Skeleton shape="text" width="3rem" />
        <Skeleton className={styles.photos} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.field}>
          <Skeleton shape="text" width="3rem" />
          <Skeleton className={styles.input} />
        </div>
      ))}
      <div className={styles.field}>
        <Skeleton shape="text" width="3rem" />
        <Skeleton className={styles.textarea} />
      </div>
    </div>
    </div>
  )
}
