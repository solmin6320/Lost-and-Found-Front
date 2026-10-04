import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { describeReturnTarget, isPostDetailPath, loginPath, safeRedirectPath } from '@/app/authRedirect'
import {
  paths,
  readReturnEntry,
  type AuthReturnState,
  type LoginNoticeState,
  type PostListEntryState,
} from '@/app/paths'
import { AuthLayout, AuthReturnNote, AuthSwitch, SignupForm, AuthTextLink, useAuth, useSignup } from '@/features/auth'
import { PostTypeGuide } from '@/features/posts'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'

const JUST_SIGNED_UP: PostListEntryState = { justSignedUp: true }

/**
 * SCR-06 회원가입 · `/signup?redirect=`
 *
 * 가입에 성공하면 **방금 입력한 값으로 바로 로그인**하고 돌아갈 곳(없으면 목록)으로 간다 — 같은 값을 다시 치게 하지 않는다.
 * 목록으로 갈 때는 온보딩 신호(`PostListEntryState`)를 싣는다. 목록이 이것을 보고 안내를 한 번 띄운다.
 * 가입은 됐는데 이어진 로그인만 실패하면 로그인 화면으로 보내며 "가입했어요. 로그인해 주세요." + 이메일을 채운다.
 * 상세에서 왔으면 상세의 진입 상태(`returnEntry`)를 들고 다닌다 — 로그인 화면과 같다(API2-2 · API2-13)
 */
export function SignupPage() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = safeRedirectPath(searchParams.get('redirect'))
  const signup = useSignup()
  useDocumentTitle('회원가입')

  const returnEntry = isPostDetailPath(redirect) ? readReturnEntry(location.state) : undefined
  const carry: AuthReturnState | undefined = returnEntry ? { returnEntry } : undefined

  // 로그인 상태가 되면 떠난다. 가입 요청이 나가 있었다면 막 가입한 것이고, 아니면 원래 로그인돼 있던 것이다
  if (auth.status === 'authenticated') {
    const justSignedUp = !signup.isIdle && redirect === paths.postList
    return <Navigate to={redirect} replace state={justSignedUp ? JUST_SIGNED_UP : returnEntry} />
  }

  const target = describeReturnTarget(redirect)

  return (
    <AuthLayout
      title="회원가입"
      lead="분실 글과 습득 글을 올리고, 댓글로 연락할 수 있어요."
      returnNote={target ? <AuthReturnNote lead="가입하면" {...target} /> : null}
      aside={<PostTypeGuide />}
      // 추후 OAuth(구글 · 네이버) — alternatives 에 버튼 묶음을 넘긴다. 미구현이라 두지 않는다
      footer={
        <AuthSwitch prompt="이미 계정이 있나요?">
          <AuthTextLink to={loginPath(redirect)} replace state={carry}>
            로그인
          </AuthTextLink>
        </AuthSwitch>
      }
    >
      <SignupForm
        signup={signup}
        onSignedUpWithoutLogin={(email) => {
          const state: LoginNoticeState = { notice: '가입했어요. 로그인해 주세요.', email, ...carry }
          navigate(loginPath(redirect), { replace: true, state })
        }}
      />
    </AuthLayout>
  )
}
