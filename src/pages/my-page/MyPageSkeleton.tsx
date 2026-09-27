import { PostCardSkeleton, PostStatusTabs, useMyPostsSearch } from '@/features/posts'

import styles from './MyPage.module.css'

/** 로딩 스켈레톤 개수 — 2 · 4열에서 줄이 채워진다. 내 글은 목록보다 적다 */
const SKELETON_COUNT = 8

/** 아직 숫자를 모르는 탭 — 자리만 잡는다 */
const UNKNOWN_COUNTS = { ALL: undefined, OPEN: undefined, IN_PROGRESS: undefined, DONE: undefined }

/** 카드 격자 자리표시. 글을 받는 동안(내가 쓴 글 화면 안)과 화면 코드를 받는 동안이 같이 쓴다 */
export function MyPostsGridSkeleton() {
  return (
    <ul className={styles.grid} role="list" aria-busy="true">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <li key={i}>
          <PostCardSkeleton />
        </li>
      ))}
    </ul>
  )
}

/**
 * 내가 쓴 글 화면의 코드를 처음 받는 동안(라우트의 대체 화면). 화면이 로그인을 확인하며 그리는 첫 모습과 같다 —
 * 제목 · 한 줄 · 숫자 없는 탭 · 카드 격자. 코드가 도착해도 자리가 바뀌지 않는다.
 * 탭은 진짜 링크다(주소만 있으면 된다). 기다리는 동안 다른 탭을 눌러도 그대로 간다.
 */
export function MyPageSkeleton() {
  const { search, hrefForStatus } = useMyPostsSearch()
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>내가 쓴 글</h1>
        <p className={styles.hint}>글을 열면 ‘내 글 관리’에서 상태를 바꾸거나 고칠 수 있어요.</p>
      </header>
      <div className={styles.tabs}>
        <PostStatusTabs selected={search.status} counts={UNKNOWN_COUNTS} hrefFor={hrefForStatus} />
      </div>
      <p className="sr-only" role="status">
        내가 쓴 글을 불러오는 중입니다
      </p>
      <div className={styles.body}>
        <MyPostsGridSkeleton />
      </div>
    </div>
  )
}
