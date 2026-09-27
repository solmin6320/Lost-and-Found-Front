import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { hasErrorCode } from '@/shared/lib/http'

import { changePostStatus, createPost, deletePost, updatePost } from '../api/postApi'
import type {
  PostCreateRequest,
  PostDetailResponse,
  PostImageChange,
  PostResponse,
  PostStatus,
  PostUpdateRequest,
} from '../api/types'
import { preparePostImages } from './postImages'
import { postKeys } from './postQueries'

/**
 * [4.6] 상태 변경. `mutate(nextStatus)`.
 *
 * **낙관적 업데이트를 하지 않는다.** 응답이 빠르고(한 행 UPDATE), 실패하는 경우는 전부
 * 화면이 틀렸다는 뜻이다(이미 완료됨 · 남의 글 · 지워진 글). 배지를 먼저 바꿨다가 되돌리면
 * 특히 `DONE` 에서 "완료됐다"가 잠깐 보였다 사라진다. 버튼은 `isPending` 동안 잠근다.
 *
 * 성공하면
 * - 상세 캐시의 `status` · `updatedAt` 을 응답으로 고친다(상세를 다시 받지 않는다 — 조회수 집계 요청이다)
 * - 목록은 무효화한다. 상태 필터(`status=OPEN`)가 걸린 목록에서 빠져야 할 수 있어 값만 고치면 틀린다
 *
 * 실패하면 `INVALID_STATUS_TRANSITION`(409, 다른 탭에서 이미 완료) · `POST_NOT_FOUND`(404) 는
 * 캐시가 낡았다는 뜻이라 상세를 다시 받는다. `FORBIDDEN_ACCESS`(403) 는 그대로 둔다.
 */
export function useChangePostStatus(postId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (status: PostStatus) => changePostStatus(postId, { status }),
    retry: 0,
    onSuccess: (result) => {
      queryClient.setQueryData<PostDetailResponse>(postKeys.detail(postId), (detail) =>
        detail ? { ...detail, status: result.status, updatedAt: result.updatedAt } : detail,
      )
      void queryClient.invalidateQueries({ queryKey: postKeys.lists() })
    },
    onError: (error) => {
      if (hasErrorCode(error, 'INVALID_STATUS_TRANSITION') || hasErrorCode(error, 'POST_NOT_FOUND')) {
        // 댓글까지 다시 받을 이유는 없다
        void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId), exact: true })
      }
    },
  })
}

/**
 * [4.4] 게시글 삭제. `mutate(postId)`. 되돌릴 수 없으니 부르기 전에 확인을 받는다.
 *
 * 성공하면 그 글의 상세 · 댓글 캐시를 지우고 목록을 무효화한다.
 * 화면 이동은 부른 쪽의 `onSuccess` 에서 **바로** 한다. 이 훅의 정리가 먼저 끝난 뒤에 불린다.
 *
 * ```ts
 * deletePost.mutate(post.id, { onSuccess: () => navigate(paths.postList, { replace: true }) })
 * ```
 *
 * `replace` 로 가야 뒤로가기가 지워진 글로 돌아가지 않는다.
 *
 * 실패 code : `FORBIDDEN_ACCESS`(403) · `POST_NOT_FOUND`(404, 이미 지워짐 — 목록으로 보내면 된다)
 */
export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePost,
    retry: 0,
    onSuccess: (_result, postId) => forgetPost(postId),
    onError: (error, postId) => {
      // 다른 탭에서 이미 지웠다. 결과는 성공과 같으니 캐시도 똑같이 정리한다
      if (hasErrorCode(error, 'POST_NOT_FOUND')) {
        forgetPost(postId)
      }
    },
  })

  function forgetPost(postId: number) {
    // 앞부분 일치라 댓글(`[..., 'detail', id, 'comments']`)도 같이 지워진다
    queryClient.removeQueries({ queryKey: postKeys.detail(postId) })
    void queryClient.invalidateQueries({ queryKey: postKeys.lists() })
  }
}

/**
 * 등록 · 수정 제출의 진행 단계. 버튼 문구와 안내에 쓴다.
 *   `preparing` — 사진 줄이는 중(브라우저 안, 한 장에 수백 ms)
 *   `uploading` — 서버로 보내는 중
 *
 * 업로드 **진행률(%)은 없다.** `fetch` 는 올리는 진행률을 알려 주지 않고, XHR 로 따로 보내면
 * 인증 헤더 · 401 재발급 · 오류 해석을 http 레이어 밖에서 한 벌 더 만들어야 한다.
 * 줄인 사진은 장당 수백 KB 라 5장이어도 보통 몇 초 안에 끝난다. 단계 안내로 충분하다고 봤다.
 */
export type PostSubmitPhase = 'idle' | 'preparing' | 'uploading'

export interface CreatePostVariables {
  body: PostCreateRequest
  /** 사용자가 고른 **원본** 파일(0~5장). 줄이는 건 훅이 한다 */
  images: readonly File[]
}

export interface UpdatePostVariables {
  body: PostUpdateRequest
  /** `replace` 의 `files` 는 고른 **원본**이다. 줄이는 건 훅이 한다 */
  images: PostImageChange
}

/**
 * [4.1] 게시글 등록. `mutate({ body, images })`. 로그인 필요.
 *
 * 1. 사진을 줄인다(`phase: 'preparing'`) — 실패하면 `ClientValidationError`, 요청은 나가지 않는다
 * 2. multipart 로 보낸다(`phase: 'uploading'`) — 토큰이 곧 끝나면 먼저 재발급한다(http 레이어)
 *
 * **자동 재시도하지 않는다**(`retry: 0`). 다시 보내면 글이 두 개 생긴다. 제출 버튼은 `isPending` 동안 잠근다.
 * 성공하면 목록을 무효화한다. 상세 캐시는 채우지 않는다 — 응답에 사진 · 댓글이 없어 상세 화면이 새로 받는다.
 * 화면 이동은 부른 쪽 `onSuccess` 에서 한다(`navigate(paths.postDetail(post.id), { replace: true })`).
 *
 * 오류 문장은 `getErrorMessage(error)`. 400 `INVALID_INPUT` 의 문장은 필드 이름으로 시작한다("제목은 …").
 */
export function useCreatePost() {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<PostSubmitPhase>('idle')

  const mutation = useMutation({
    mutationFn: async ({ body, images }: CreatePostVariables): Promise<PostResponse> => {
      setPhase('preparing')
      const prepared = await preparePostImages(images)
      setPhase('uploading')
      return createPost(body, prepared)
    },
    retry: 0,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: postKeys.lists() })
    },
    onSettled: () => setPhase('idle'),
  })

  return { ...mutation, phase }
}

/**
 * [4.4] 게시글 수정. `mutate({ body, images })`. 작성자 본인만.
 *
 * 사진은 `images.kind` 로 정한다(`keep` · `replace` · `remove`, `PostImageChange` 참고).
 * `replace` · `remove` 는 기존 사진을 **되돌릴 수 없이** 지우니 부르기 전에 확인을 받는다.
 *
 * 성공하면
 * - 상세 캐시의 글 칸(제목 · 본문 · 유형 · 분류 · 장소 · 날짜 · `updatedAt`)을 응답으로 고친다. 댓글은 그대로 둔다
 * - 사진 : `keep` 은 그대로, `remove` 는 빈 배열로 고친다. `replace` 는 새 주소를 응답이 주지 않으므로
 *   상세를 무효화해 다시 받는다(조회수는 같은 날 다시 오르지 않는다)
 * - 목록은 무효화한다(제목 · 대표 사진 · 필터 결과가 바뀐다)
 *
 * 실패 code : `FORBIDDEN_ACCESS`(403) · `POST_NOT_FOUND`(404, 상세를 다시 받는다) · 그 밖에는 `useCreatePost` 와 같다.
 * `retry: 0` — 사진 교체는 같은 요청을 두 번 보내도 결과는 같지만, 몇 MB 를 말없이 다시 올리지 않는다.
 */
export function useUpdatePost(postId: number) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<PostSubmitPhase>('idle')

  const mutation = useMutation({
    mutationFn: async ({ body, images }: UpdatePostVariables): Promise<PostResponse> => {
      let change = images
      if (images.kind === 'replace') {
        setPhase('preparing')
        change = { kind: 'replace', files: await preparePostImages(images.files) }
      }
      setPhase('uploading')
      return updatePost(postId, body, change)
    },
    retry: 0,
    onSuccess: (post, { images }) => {
      queryClient.setQueryData<PostDetailResponse>(postKeys.detail(postId), (detail) =>
        detail ? mergeIntoDetail(detail, post, images.kind) : detail,
      )
      if (images.kind === 'replace') {
        void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId), exact: true })
      }
      void queryClient.invalidateQueries({ queryKey: postKeys.lists() })
    },
    onError: (error) => {
      if (hasErrorCode(error, 'POST_NOT_FOUND')) {
        void queryClient.invalidateQueries({ queryKey: postKeys.detail(postId), exact: true })
      }
    },
    onSettled: () => setPhase('idle'),
  })

  return { ...mutation, phase }
}

function mergeIntoDetail(
  detail: PostDetailResponse,
  post: PostResponse,
  imageChange: PostImageChange['kind'],
): PostDetailResponse {
  return {
    ...detail,
    nickname: post.nickname,
    type: post.type,
    title: post.title,
    content: post.content,
    category: post.category,
    location: post.location,
    lostFoundDate: post.lostFoundDate,
    status: post.status,
    updatedAt: post.updatedAt,
    images: imageChange === 'remove' ? [] : detail.images,
  }
}
