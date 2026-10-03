import { useEffect, useId, useRef, type Ref } from 'react'
import { useNavigate } from 'react-router-dom'

import { STAY_SIGNED_IN_NOTE, useGuardedLogout } from '@/app/layouts/useGuardedLogout'
import { paths, type LoginNoticeState } from '@/app/paths'
import { PasswordChangeForm, useAuth } from '@/features/auth'
import { ProfileSection, ProfileSectionSkeleton, useMe } from '@/features/members'
import { allowLeave } from '@/shared/lib/dirtyRegistry'
import { getErrorMessage } from '@/shared/lib/http'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { ErrorState } from '@/shared/ui/ErrorState'
import { ThemePicker } from '@/shared/ui/ThemePicker'

import styles from './SettingsPage.module.css'

/** 비밀번호를 바꾼 뒤 로그인 화면 폼 위에 띄울 한 줄(화면정의서 SCR-05). 로그인 화면이 체크 아이콘과 함께 보인다 */
const PASSWORD_CHANGED_NOTICE: LoginNoticeState = { notice: '비밀번호를 바꿨어요. 다시 로그인해 주세요.' }

/**
 * SCR-08 설정 · `/settings` — 위에서부터 프로필 · 화면 모드 · 비밀번호 변경 · (끝에) 조용한 [로그아웃].
 *
 * 닉네임 · 비밀번호 칸은 쓰던 칸 등록부에 "쓰던 글자 있음"만 알린다 — 레이아웃의 이탈 확인 하나가 모든 출구를 막는다(회의 AR2-3).
 * [로그아웃]은 계정 메뉴와 같은 동작이다(쓰던 글자가 있으면 묻는다, SE-5). 바로 아래 7일 유지 한 줄(SE-9).
 * 비밀번호 바꾸기와 다른 묶음 — 선 하나와 24px 위로 떼어 둔다(되돌릴 수 없는 결과가 있는 버튼 곁에 붙이지 않는다).
 *
 * 누구나 들어온다. 화면 모드는 기기 설정이라 로그인하지 않아도 바꿀 수 있어야 한다.
 * 프로필 · 비밀번호는 로그인했을 때만 그린다. 비로그인에게는 프로필 자리에 로그인 권유 한 장,
 * 비밀번호 칸은 두지 않는다(숨김 — 누를 수 없는 폼을 남기지 않는다).
 */
export function SettingsPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const signedIn = auth.status === 'authenticated'
  // 로그인했을 때만 부른다. 비로그인으로 부르면 401 을 받고 재발급까지 헛걸음한다
  const me = useMe({ enabled: signedIn })
  useDocumentTitle('설정')

  // 이 화면에서 로그아웃하면 프로필 자리가 로그인 권유로 바뀐다 — 누르던 버튼이 사라지니 그 [로그인]으로 포커스를 옮긴다
  const signInRef = useRef<HTMLAnchorElement>(null)
  const focusSignIn = useRef(false)
  useEffect(() => {
    if (auth.status !== 'anonymous' || !focusSignIn.current) return
    focusSignIn.current = false
    signInRef.current?.focus()
  }, [auth.status])

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>설정</h1>

      <section className={styles.section} aria-labelledby="settings-profile">
        <h2 id="settings-profile" className={styles.heading}>
          프로필
        </h2>
        {auth.status === 'unknown' || (signedIn && me.isPending) ? (
          <ProfileSectionSkeleton />
        ) : !signedIn ? (
          <SignInPrompt linkRef={signInRef} />
        ) : me.data ? (
          <ProfileSection me={me.data} />
        ) : (
          <div className={styles.stateBox}>
            <ErrorState
              titleAs="h3"
              message={getErrorMessage(me.error)}
              onRetry={() => void me.refetch()}
              retrying={me.isFetching}
            />
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="settings-theme">
        <h2 id="settings-theme" className={styles.heading}>
          화면 모드
        </h2>
        <ThemePicker labelledBy="settings-theme" />
      </section>

      {signedIn ? (
        <section className={styles.section} aria-labelledby="settings-password">
          <h2 id="settings-password" className={styles.heading}>
            비밀번호 변경
          </h2>
          <PasswordChangeForm
            email={auth.me.email}
            // 이 기기의 세션은 이미 끝났다(토큰 · 캐시 · 로그인 상태). 다시 로그인하게 보낸다.
            // 기록을 바꿔치기하지 않는다 — 뒤로가기를 누르면 설정(비로그인 모습)으로 예상대로 돌아온다
            onChanged={() => {
              // 바꾼 비밀번호 칸이 아직 차 있다 — 이 이동은 막지 않는다(이미 끝난 일이다)
              allowLeave()
              navigate(paths.login, { state: PASSWORD_CHANGED_NOTICE })
            }}
          />
        </section>
      ) : null}

      {signedIn ? (
        <SignOutRow
          logout={async () => {
            focusSignIn.current = true
            await auth.logout()
          }}
        />
      ) : null}
    </div>
  )
}

/** 화면 끝의 조용한 [로그아웃] — 테 없는 버튼 하나와 그 아래 흐린 한 줄. 제목을 달지 않는다(섹션이 아니라 나가는 문) */
function SignOutRow({ logout }: { logout: () => Promise<void> }) {
  const guarded = useGuardedLogout(logout)
  const noteId = useId()
  return (
    <div className={styles.signOut}>
      <Button
        variant="secondary"
        onClick={guarded.request}
        aria-disabled={guarded.loggingOut || undefined}
        aria-describedby={noteId}
      >
        {guarded.loggingOut ? '로그아웃하는 중…' : '로그아웃'}
      </Button>
      <p id={noteId} className={styles.signOutNote}>
        {STAY_SIGNED_IN_NOTE}
      </p>
      {guarded.dialog}
    </div>
  )
}

/** 비로그인 — 프로필 자리에 한 장. 로그인하면 이 화면으로 돌아온다 */
function SignInPrompt({ linkRef }: { linkRef: Ref<HTMLAnchorElement> }) {
  return (
    <div className={styles.signIn}>
      <p className={styles.signInText}>로그인하면 프로필과 비밀번호를 바꿀 수 있어요.</p>
      <ButtonLink ref={linkRef} to={paths.loginThenReturn(paths.settings)} variant="secondary">
        로그인
      </ButtonLink>
    </div>
  )
}
