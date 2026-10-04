import { Navigate, useLocation, useSearchParams } from 'react-router-dom'

import { describeReturnTarget, isPostDetailPath, safeRedirectPath, signupPath } from '@/app/authRedirect'
import { paths, readReturnEntry, type AuthReturnState, type LoginNoticeState } from '@/app/paths'
import { AuthLayout, AuthReturnNote, AuthSwitch, LoginForm, AuthTextLink, useAuth } from '@/features/auth'
import { PostTypeGuide } from '@/features/posts'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'

/**
 * SCR-05 로그인 · `/login?redirect=`
 *
 * - 돌아갈 곳은 `?redirect=` 의 **우리 앱 안 경로만** 따른다(열린 리다이렉트 방지, `safeRedirectPath`). 없으면 목록
 * - 로그인에 성공하면 로그인 상태가 바뀌고, 아래 첫 줄이 돌아갈 곳으로 보낸다(기록을 바꿔치기 — 뒤로가기가 로그인 화면으로 오지 않는다).
 *   이미 로그인한 채로 들어와도 같은 줄이 되돌려 보낸다
 * - 설정에서 비밀번호를 바꾼 뒤에는 `location.state.notice` 를 폼 위에 띄운다
 * - 상세에서 왔으면 상세의 진입 상태(`returnEntry`)를 모양 검사 뒤 그대로 돌려준다 — 돌아온 상세의 [목록으로]가 보던 목록으로 간다(API2-2).
 *   가입 화면으로 건너갈 때도 바꿔치기(replace)하며 같이 넘긴다. 기록에 로그인 칸이 남지 않게(API2-13)
 */
export function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const redirect = safeRedirectPath(searchParams.get('redirect'))
  useDocumentTitle('로그인')

  const returnEntry = isPostDetailPath(redirect) ? readReturnEntry(location.state) : undefined
  const carry: AuthReturnState | undefined = returnEntry ? { returnEntry } : undefined

  if (auth.status === 'authenticated') {
    return <Navigate to={redirect} replace state={returnEntry} />
  }

  const state = readNotice(location.state)
  const target = describeReturnTarget(redirect)

  return (
    <AuthLayout
      title="로그인"
      lead="글을 올리거나 댓글을 남기려면 로그인해 주세요."
      returnNote={target ? <AuthReturnNote lead="로그인하면" {...target} /> : null}
      aside={<PostTypeGuide />}
      notice={state?.notice}
      // 추후 OAuth(구글 · 네이버) — alternatives 에 버튼 묶음을 넘긴다. 미구현이라 두지 않는다
      footer={
        <AuthSwitch prompt="처음이세요?">
          <AuthTextLink to={signupPath(redirect)} replace state={carry}>
            회원가입
          </AuthTextLink>
        </AuthSwitch>
      }
    >
      <LoginForm
        initialEmail={state?.email}
        lockedExit={
          <AuthTextLink to={paths.postList}>
            로그인 없이 목록 보기
          </AuthTextLink>
        }
      />
    </AuthLayout>
  )
}

/** 기록(history)의 state 는 무엇이든 들어올 수 있다. 모양이 맞을 때만 쓴다 */
function readNotice(state: unknown): LoginNoticeState | null {
  if (typeof state !== 'object' || state === null) return null
  const { notice, email } = state as Record<string, unknown>
  if (typeof notice !== 'string') return null
  return { notice, email: typeof email === 'string' ? email : undefined }
}
