import { Skeleton } from '@/shared/ui/Skeleton'

import styles from './MyClaims.module.css'
import { MY_CLAIMS_PAGE_SIZE } from './myClaimsModel'

/** 머리 문장 — 화면과 대체 화면이 같은 글자를 쓴다(자리가 바뀌지 않게) */
export const MY_CLAIMS_HINT = '다른 사람 글에 보낸 요청이에요. 보낸 내용은 글쓴이와 나만 봐요.'

/**
 * 요청 칸 자리표시 — 받은 칸과 같은 구조(이름표 줄 · 제목 · 상태 줄 · 다음 행동 줄 · `내가 보낸 답` 줄).
 * 줄마다 받은 글자와 같은 크기 · 행간을 써서 칸 높이가 받은 뒤와 같다
 */
export function MyClaimsListSkeleton({ count = MY_CLAIMS_PAGE_SIZE }: { count?: number }) {
  return (
    <ul className={styles.list} role="list" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} aria-hidden="true">
          <div className={styles.item}>
            <div className={styles.top}>
              <div className={styles.meta}>
                <Skeleton className={styles.badgeSkeleton} />
                <Skeleton className={styles.badgeSkeleton} />
                <span className={styles.sent}>
                  <Skeleton shape="text" width="5.5rem" />
                </span>
              </div>
              <p className={styles.postTitle}>
                <Skeleton shape="text" width={i % 2 === 0 ? '72%' : '54%'} />
              </p>
            </div>
            <div className={styles.state}>
              <p className={styles.claimStatus} data-tone="wait">
                <Skeleton shape="text" width="7rem" />
              </p>
              <p className={styles.next}>
                <Skeleton shape="text" width="88%" />
                {/* 좁은 칸에서는 다음 행동 문장이 대개 두 줄이다 */}
                <span className={styles.narrowLine}>
                  <Skeleton shape="text" width="46%" />
                </span>
              </p>
            </div>
            <div className={styles.answer}>
              <span className={styles.summary}>
                <Skeleton shape="text" width="6rem" />
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** 화면 코드를 처음 받는 동안(라우트의 대체 화면). 화면이 로그인을 확인하며 그리는 첫 모습과 같다 */
export function MyClaimsSkeleton() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>보낸 확인 요청</h1>
        <p className={styles.hint}>{MY_CLAIMS_HINT}</p>
      </header>
      <p className={styles.count} aria-hidden="true">
        <Skeleton shape="text" width="5rem" />
      </p>
      <p className="sr-only" role="status">
        보낸 확인 요청을 불러오는 중이에요
      </p>
      <MyClaimsListSkeleton />
    </div>
  )
}
