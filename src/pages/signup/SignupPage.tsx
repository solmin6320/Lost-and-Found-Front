import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { describeReturnTarget, isPostDetailPath, isPostFormPath, loginPath, safeRedirectPath } from '@/app/authRedirect'
import { readReturnEntry, type AuthReturnState, type LoginNoticeState } from '@/app/paths'
import {
  AuthLayout,
  AuthPhrase,
  AuthReturnNote,
  AuthSwitch,
  SignupForm,
  AuthTextLink,
  useAuth,
  useSignup,
} from '@/features/auth'
import { showFlash } from '@/shared/lib/flash'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'

/**
 * SCR-06 회원가입 · `/signup?redirect=`
 *
 * 가입에 성공하면 **방금 입력한 값으로 바로 로그인**하고 돌아갈 곳(없으면 목록)으로 간다 — 같은 값을 다시 치게 하지 않는다.
 * 가입은 됐는데 이어진 로그인만 실패하면 로그인 화면으로 보내며 "가입했어요. 로그인해 주세요." + 이메일을 채운다.
 * 상세에서 왔으면 상세의 진입 상태(`returnEntry`)를 들고 다닌다 — 로그인 화면과 같다(API2-2 · API2-13)
 *
 * 가입하고 넘어간 화면에는 짧은 알림 `가입했어요.`를 띄운다(QA P-3) — 화면만 바뀌면 가입이 됐는지 모른다.
 * 글 폼(등록 · 수정)으로 넘어갈 때는 띄우지 않는다 — 폼에서는 짧은 알림이 뜨지 않는다(화면정의서 1.10).
 * 그때는 폼의 제목이 이어서 할 일을 말한다
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

  // 이 화면에서 막 가입해 로그인됐다. 로그인은 가입 요청 안에서 먼저 끝나므로(`useSignup`) 요청이 아직 끝나는 중일 수 있다.
  // 원래 로그인돼 있던 채로 들어온 것과 가른다 — 그때는 가입 요청이 없다(idle)
  const justSignedUp = auth.status === 'authenticated' && (signup.isPending || signup.isSuccess)
  useEffect(() => {
    // 아래 <Navigate> 와 같은 그리기에서 돈다 — 알림 저장소는 화면 밖(레이아웃)이라 화면을 옮겨도 남는다
    if (justSignedUp && !isPostFormPath(redirect)) showFlash('가입했어요.')
  }, [justSignedUp, redirect])

  // 로그인 상태가 되면 떠난다 — 막 가입했든 원래 로그인돼 있었든 같다(가입 직후 3단계 안내는 2026-10-11 뺐다)
  if (auth.status === 'authenticated') {
    return <Navigate to={redirect} replace state={returnEntry} />
  }

  const target = describeReturnTarget(redirect)

  return (
    <AuthLayout
      title="회원가입"
      // 서비스 낱말(분실 글 · 습득 글)을 처음 보는 사람에게 쉬운 말을 먼저(QA P-9) — 목록 칸 이름(잃어버린 물건 · 주운 물건)과 같은 말이다.
      // 줄은 묶음 사이에서만 바뀐다 — "물건 / (습득 글)"로 갈리면 괄호가 무엇을 가리키는지 흐려진다
      lead={
        <>
          <AuthPhrase>잃어버린 물건(분실 글)이나</AuthPhrase> <AuthPhrase>주운 물건(습득 글)을 올리고,</AuthPhrase>{' '}
          <AuthPhrase>댓글로 연락할 수 있어요.</AuthPhrase>
        </>
      }
      returnNote={target ? <AuthReturnNote lead="가입하면" {...target} /> : null}
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
