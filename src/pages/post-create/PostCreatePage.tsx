import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'

import { paths } from '@/app/paths'
import { usePostWritePage } from '@/app/usePostWritePage'
import {
  PostForm,
  PostFormSkeleton,
  PostWriteHeader,
  emptyPostFormValues,
  postDraftKey,
  postTypeFromQuery,
  useCreatePost,
} from '@/features/posts'
import { showFlash } from '@/shared/lib/flash'
import { useDocumentTitle } from '@/shared/lib/useDocumentTitle'

/**
 * SCR-02 게시글 등록 · `/posts/new?type=LOST|FOUND` — [4.1] 등록 + [4.5] 사진(multipart 한 요청)
 *
 * - 로그인 필요. 비로그인은 로그인으로 보내고(`?redirect=`), 로그인하면 이 화면으로 돌아온다
 * - `?type=` 이 있으면 유형을 미리 고른다(목록의 "분실 글 올리기" · "습득 글 올리기")
 * - 성공(201) → 새 글 상세로 **기록을 바꿔** 간다(뒤로가기가 빈 폼으로 오지 않는다) + 짧은 알림
 * - 폼 · 사진 · 이탈 확인 · 임시 보관은 `PostForm` 이 맡는다. 이 화면은 조립만 한다
 */
export function PostCreatePage() {
  const page = usePostWritePage()
  const [searchParams] = useSearchParams()
  const create = useCreatePost()
  // 처음 한 번만 만든다. 바뀌면 폼이 "고친 것이 있다"로 읽는다
  const [initialValues] = useState(() => emptyPostFormValues(postTypeFromQuery(searchParams.get('type'))))

  useDocumentTitle('글 올리기')

  if (page.gate === 'pending') return <PostFormSkeleton label="로그인을 확인하는 중이에요" />
  if (page.gate === 'login' || page.memberId === null) return <Navigate to={page.loginHref} replace />

  return (
    <PostForm
      mode="create"
      intro={<PostWriteHeader title="글 올리기" lead="사진만 빼고 모두 채워야 올라가요." {...page.guide} />}
      initialValues={initialValues}
      draftKey={postDraftKey()}
      memberId={page.memberId}
      signedIn={page.signedIn}
      pending={create.isPending}
      phase={create.phase}
      onSubmit={async (body, photos) => {
        const post = await create.mutateAsync({
          body,
          images: photos.kind === 'replace' ? photos.files : [],
        })
        return post.id
      }}
      onDone={(postId, leave) => {
        showFlash('글을 올렸어요.')
        leave(paths.postDetail(postId), { replace: true })
      }}
      onSessionLost={page.onSessionLost}
      loginHref={page.loginHref}
      cancelTo={paths.postList}
    />
  )
}
