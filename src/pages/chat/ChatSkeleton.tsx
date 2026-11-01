import { Skeleton } from '@/shared/ui/Skeleton'

import styles from './ChatPage.module.css'

/**
 * 채팅 화면 코드를 받는 동안(주소로 바로 들어옴 — 라우트 대체 화면). 받은 화면과 같은 틀 : 머리 · 말풍선 자리 · 입력 줄 자리.
 * 화면 코드 조각 밖에 있어야 해서 따로 둔다(스타일은 화면과 같은 모듈)
 */
export function ChatSkeleton() {
  return (
    <div className={styles.page} data-chat-screen="" aria-busy="true">
      <section className={styles.conversation} aria-label="대화">
        <div className={styles.top}>
          <span className={styles.back} aria-hidden="true" />
          <div className={styles.who}>
            <h1 className={styles.partner}>
              <Skeleton shape="text" width="6rem" />
              <span className="sr-only">대화를 불러오는 중이에요</span>
            </h1>
            <p className={styles.about}>
              <span className={styles.aboutText}>
                <Skeleton shape="text" width="12rem" />
              </span>
            </p>
          </div>
        </div>
        <div className={styles.skeletonBody} aria-hidden="true" />
        <div className={styles.composerSkeleton} aria-hidden="true">
          <Skeleton height="3rem" />
        </div>
      </section>
    </div>
  )
}
