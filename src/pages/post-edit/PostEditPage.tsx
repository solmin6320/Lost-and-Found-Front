import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { paths } from '@/app/paths'
import { usePostWritePage } from '@/app/usePostWritePage'
import {
  MissingPost,
  PostForm,
  PostFormSkeleton,
  PostWriteHeader,
  postDraftKey,
  postFormValuesOf,
  toPostId,
  usePostDetail,
  useUpdatePost,
  type LeaveFn,
  type PostDetailResponse,
} from '@/features/posts'
import { showFlash } from '@/shared/lib/flash'
import { getErrorMessage, hasErrorCode, isApiError } from '@/shared/lib/http'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'
import { ErrorState } from '@/shared/ui/ErrorState'
import { CaretLeft } from '@/shared/ui/icons'

import styles from './PostEditPage.module.css'

/** 서버 `FORBIDDEN_ACCESS` 문장과 같다 — 남의 글 수정 주소로 들어왔을 때(보내기 전이라 서버 문장이 없다) */
const FORBIDDEN_MESSAGE = '본인이 작성한 게시글, 댓글만 처리할 수 있습니다'

/**
 * SCR-04 게시글 수정 · `/posts/:postId/edit` — [4.4] 수정 + [4.5] 사진(유지 · 교체 · 전부 삭제)
 *
 * - 작성자 본인만. 불러온 글의 `memberId` 가 내가 아니면 **폼을 그리지 않고** 상세로 되돌린다(+ 서버와 같은 문장의 알림)
 * - 로딩 : 폼 모양 스켈레톤(빈 폼을 먼저 보여 주지 않는다) · 없는 글 : 빈 상태 + [목록으로] ·
 *   오류 : message + [다시 시도] + [글로 돌아가기](다시 시도해도 안 되면 나갈 문 — 막다른 길을 만들지 않는다)
 * - 저장 중 403 → 상세 + message, 404(다른 기기에서 지움) → 목록 + message
 * - 성공(200) → 상세로 기록을 바꿔 간다 + 짧은 알림. 상세 캐시는 `useUpdatePost` 가 응답으로 고친다
 */
export function PostEditPage() {
  const postId = toPostId(useParams().postId)
  const page = usePostWritePage()
  const navigate = useNavigate()
  const detail = usePostDetail(page.gate === 'form' ? postId : null)

  // 한 번 불러온 글을 붙잡아 둔다. 로그인이 끊기면(재발급 거절 · 로그아웃) `forgetMember` 는 개인 캐시(회원 · 내가 쓴 글)만 지우고
  // 이 글의 상세는 지우지 않고 다시 받게만 한다(공개 데이터). 다시 받는 사이에도, 받은 값이 바뀌어도 폼이 흔들리지 않아야
  // 떠나기 전에 쓰던 글자를 보관한다(`onSessionLost`)
  const [kept, setKept] = useState<PostDetailResponse | null>(null)
  if (detail.data && kept === null) setKept(detail.data)
  const post = kept ?? detail.data ?? null

  const notOwner = post !== null && page.signedIn && page.memberId !== null && post.memberId !== page.memberId
  useEffect(() => {
    if (!notOwner || !post) return
    showFlash(FORBIDDEN_MESSAGE, 'info')
    navigate(paths.postDetail(post.id), { replace: true })
  }, [notOwner, post, navigate])

  const missing =
    postId === null ||
    hasErrorCode(detail.error, 'POST_NOT_FOUND') ||
    (isApiError(detail.error) && detail.error.status === 400)

  // 없는 글이면 상세와 같은 탭 제목. 바로 들어왔든 불러온 뒤 404 든 같게
  useDocumentTitle(missing ? '없는 글' : '글 수정')

  if (missing) return <MissingPost listHref={paths.postList} className={styles.stateBox} />
  if (page.gate === 'pending') return <PostFormSkeleton label="로그인을 확인하는 중이에요" />
  if (page.gate === 'login' || page.memberId === null) return <Navigate to={page.loginHref} replace />
  if (post === null) {
    if (detail.isError) {
      return (
        <div className={styles.stateBox}>
          <ErrorState
            className={styles.errorPanel}
            titleAs="h1"
            message={getErrorMessage(detail.error)}
            onRetry={() => void detail.refetch()}
            retrying={detail.isFetching}
          />
          <p className={styles.exit}>
            <Link to={postId === null ? paths.postList : paths.postDetail(postId)} className={styles.exitLink}>
              <CaretLeft />
              글로 돌아가기
            </Link>
          </p>
        </div>
      )
    }
    return <PostFormSkeleton label="고칠 글을 불러오는 중이에요" />
  }
  if (notOwner) return <PostFormSkeleton label="이 글로 돌아가는 중이에요" />

  return (
    <EditForm
      key={post.id}
      post={post}
      memberId={page.memberId}
      signedIn={page.signedIn}
      intro={<PostWriteHeader title="글 수정" lead="사진만 빼고 모두 채워져 있어야 저장돼요." {...page.guide} />}
      onSessionLost={page.onSessionLost}
      loginHref={page.loginHref}
    />
  )
}

interface EditFormProps {
  post: PostDetailResponse
  memberId: number
  signedIn: boolean
  intro: ReactNode
  onSessionLost: (draftSaved: boolean, leave: LeaveFn) => void
  /** 다른 창에서 로그아웃돼 이 화면에 머물 때 [로그인]이 갈 곳 */
  loginHref: string
}

function EditForm({ post, memberId, signedIn, intro, onSessionLost, loginHref }: EditFormProps) {
  const update = useUpdatePost(post.id)
  // 처음 값은 이 화면에 들어온 순간의 글 그대로. 뒤에서 다시 받아도 쓰던 칸을 덮지 않는다
  const [initialValues] = useState(() => postFormValuesOf(post))

  return (
    <PostForm
      mode="edit"
      intro={intro}
      initialValues={initialValues}
      existingImages={post.images}
      status={post.status}
      draftKey={postDraftKey(post.id)}
      memberId={memberId}
      signedIn={signedIn}
      pending={update.isPending}
      phase={update.phase}
      onSubmit={async (body, images) => {
        const saved = await update.mutateAsync({ body, images })
        return saved.id
      }}
      onDone={(postId, leave) => {
        showFlash('고친 내용을 저장했어요.')
        leave(paths.postDetail(postId), { replace: true })
      }}
      onFailure={(error, leave) => {
        if (hasErrorCode(error, 'FORBIDDEN_ACCESS')) {
          showFlash(getErrorMessage(error), 'info')
          leave(paths.postDetail(post.id), { replace: true })
          return true
        }
        if (hasErrorCode(error, 'POST_NOT_FOUND')) {
          showFlash(getErrorMessage(error), 'info')
          leave(paths.postList, { replace: true })
          return true
        }
        return false
      }}
      onSessionLost={onSessionLost}
      loginHref={loginHref}
      cancelTo={paths.postDetail(post.id)}
    />
  )
}
