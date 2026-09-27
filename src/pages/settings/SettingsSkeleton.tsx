import { ProfileSectionSkeleton } from '@/features/members'
import { Skeleton } from '@/shared/ui/Skeleton'

import styles from './SettingsPage.module.css'
import skeleton from './SettingsSkeleton.module.css'

/**
 * 설정 화면의 코드를 처음 받는 동안(라우트의 대체 화면). 위에서부터 같은 순서 · 같은 제목이다 —
 * 제목 · 프로필(화면이 로그인을 확인하며 그리는 자리표시와 같다) · 화면 모드 두 칸.
 * 비밀번호 칸은 두지 않는다. 로그인했을 때만 그리는 칸이라 아직 모르고, 맨 아래라 나중에 붙어도 위가 밀리지 않는다.
 */
export function SettingsSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <p className="sr-only" role="status">
        설정을 불러오는 중입니다
      </p>
      <h1 className={styles.title}>설정</h1>

      <section className={styles.section} aria-hidden="true">
        <h2 className={styles.heading}>프로필</h2>
        <ProfileSectionSkeleton />
      </section>

      <section className={styles.section} aria-hidden="true">
        <h2 className={styles.heading}>화면 모드</h2>
        <div className={skeleton.picker}>
          <div className={skeleton.options}>
            {[0, 1].map((i) => (
              <div key={i} className={skeleton.option}>
                <Skeleton className={skeleton.preview} />
                <span className={skeleton.caption}>
                  <Skeleton shape="text" width="3rem" />
                </span>
              </div>
            ))}
          </div>
          <Skeleton shape="text" width="16rem" />
        </div>
      </section>
    </div>
  )
}
