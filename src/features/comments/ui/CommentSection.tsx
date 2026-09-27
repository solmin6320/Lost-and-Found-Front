import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import type { PostDetailResponse } from '@/features/posts'
import { getErrorMessage } from '@/shared/lib/http'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { ChatCircleDots, WarningCircle } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import { COMMENT_MAX_LENGTH, type CommentResponse } from '../api/types'
import { useCreateComment } from '../model/commentMutations'
import { usePostComments } from '../model/commentQueries'
import { checkCommentContent } from '../model/validation'
import { CommentField } from './CommentField'
import { CommentItem } from './CommentItem'
import styles from './CommentSection.module.css'

interface CommentSectionProps {
  post: PostDetailResponse
  /** 로그인한 사람의 회원 id. 비로그인이면 `null` — 쓰기 · 수정 · 삭제가 숨는다 */
  viewerId: number | null
  /** 앱 시작 직후 세션을 되살리는 중. 입력칸 자리만 잡는다(로그인 권유를 먼저 그렸다가 바꾸지 않게) */
  authPending: boolean
  /** 로그인하고 이 글로 돌아오는 주소 */
  loginHref: string
}

/** 누구나 읽는 곳이라는 안내 — 연락처를 적기 전에 알린다(결과 고지 : 누르기 전에, 한 번) */
const PUBLIC_HINT = '누구나 보는 댓글이에요. 전화번호를 적으면 모두에게 보여요.'

/**
 * 댓글 — 오래된 순. 상세 응답의 첫 20건으로 바로 그리고, 나머지는 [댓글 더 보기]로 20건씩(page=1부터).
 *
 * 방금 남긴 댓글은 **목록 끝에 바로** 보인다. 마지막 페이지까지 펼쳐 두지 않았으면 캐시에는 개수만 늘므로,
 * 등록 응답을 따로 들고 있다가 [더 보기] 아래에 붙인다. 나중에 그 페이지를 받으면 하나만 남긴다(id).
 */
export function CommentSection({ post, viewerId, authPending, loginHref }: CommentSectionProps) {
  const thread = usePostComments(post.id, post)
  const [recent, setRecent] = useState<CommentResponse[]>([])
  const [announcement, setAnnouncement] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const headingId = useId()

  const comments = thread.data?.comments ?? post.comments
  const total = thread.data?.totalCount ?? post.totalCommentCount
  const loadedIds = new Set(comments.map((c) => c.id))
  const fresh = recent.filter((c) => !loadedIds.has(c.id))
  const freshIds = new Set(recent.map((c) => c.id))
  const remaining = Math.max(0, total - comments.length - fresh.length)
  const empty = comments.length === 0 && fresh.length === 0

  async function loadMore() {
    if (thread.isFetchingNextPage) return
    const before = comments.length
    const result = await thread.fetchNextPage()
    if (result.isError) return
    // 새로 받은 첫 댓글에서 이어 읽는다. 마지막이면 버튼이 사라지므로 포커스를 거기로 옮겨 둔다
    requestAnimationFrame(() => {
      listRef.current?.querySelectorAll<HTMLElement>('[data-comment]')[before]?.focus()
    })
  }

  function handleCreated(comment: CommentResponse) {
    setRecent((list) => [...list, comment])
    setAnnouncement('댓글을 남겼어요.')
  }

  function handleUpdated(comment: CommentResponse) {
    setRecent((list) => list.map((c) => (c.id === comment.id ? comment : c)))
    setAnnouncement('댓글을 고쳤어요.')
  }

  function handleDeleted(commentId: number) {
    setRecent((list) => list.filter((c) => c.id !== commentId))
    setAnnouncement('댓글을 지웠어요.')
    // 지운 댓글의 버튼이 사라졌다. 댓글 제목에서 다시 읽기 시작한다
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  const renderItem = (comment: CommentResponse, isFresh: boolean) => (
    <li key={comment.id} className={styles.item} data-comment tabIndex={-1}>
      <CommentItem
        postId={post.id}
        comment={comment}
        mine={viewerId !== null && comment.memberId === viewerId}
        byPostAuthor={comment.memberId === post.memberId}
        fresh={isFresh}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </li>
  )

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
        댓글 <span className={styles.total}>{total.toLocaleString('ko-KR')}</span>
      </h2>

      <div ref={listRef} className={styles.thread}>
        {empty ? (
          <EmptyComments postType={post.type} ownPost={viewerId !== null && viewerId === post.memberId} />
        ) : (
          <ol className={styles.list} role="list">
            {comments.map((comment) => renderItem(comment, freshIds.has(comment.id)))}
          </ol>
        )}

        {thread.hasNextPage && remaining > 0 ? (
          <div className={styles.more}>
            <Button
              aria-disabled={thread.isFetchingNextPage || undefined}
              onClick={() => void loadMore()}
              className={styles.moreButton}
            >
              {thread.isFetchingNextPage ? '불러오는 중…' : `댓글 더 보기`}
              {thread.isFetchingNextPage ? null : (
                <span className={styles.moreCount} data-numeric>
                  {remaining.toLocaleString('ko-KR')}개
                </span>
              )}
            </Button>
            {thread.isFetchNextPageError ? (
              <p className={styles.error} role="alert">
                <WarningCircle />
                {getErrorMessage(thread.error)}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* 아직 펼치지 않은 댓글 뒤에 붙은 새 댓글 — 사이에 [더 보기]가 있어 순서가 거짓말을 하지 않는다 */}
        {!empty && fresh.length > 0 ? (
          <ol className={styles.list} role="list" aria-label="방금 남긴 댓글">
            {fresh.map((comment) => renderItem(comment, true))}
          </ol>
        ) : null}

        {thread.isRefetchError && !thread.isFetchNextPageError ? (
          <div className={styles.refetchError} role="alert">
            <p className={styles.error}>
              <WarningCircle />
              {getErrorMessage(thread.error)}
            </p>
            <Button size="sm" onClick={() => void thread.refetch()}>
              다시 시도
            </Button>
          </div>
        ) : null}
      </div>

      {authPending ? (
        <div className={styles.composerPending} aria-hidden="true">
          <Skeleton shape="text" width="4rem" />
          <Skeleton height="5.75rem" />
        </div>
      ) : viewerId === null ? (
        <div className={styles.signIn}>
          <p className={styles.signInText}>로그인하면 댓글을 남길 수 있어요.</p>
          <ButtonLink to={loginHref} variant="primary" size="sm">
            로그인
          </ButtonLink>
        </div>
      ) : (
        <CommentComposer postId={post.id} onCreated={handleCreated} />
      )}

      <p className="sr-only" role="status">
        {announcement}
      </p>
    </section>
  )
}

/**
 * 댓글 0건 — 온보딩 2층(docs/온보딩설계.md 4장). 무엇을 남기면 되는지 글의 유형에 맞춰 한 줄.
 * 내 글이면 기다리는 쪽이라 권유 대신 "여기에 보여요"
 */
function EmptyComments({ postType, ownPost }: { postType: PostDetailResponse['type']; ownPost: boolean }) {
  const description = ownPost
    ? '누군가 댓글을 남기면 여기에 보여요.'
    : postType === 'LOST'
      ? '이 물건을 본 적 있다면 댓글로 알려 주세요.'
      : '내 물건 같다면 댓글로 알려 주세요.'

  return (
    <div className={styles.empty}>
      <ChatCircleDots className={styles.emptyIcon} />
      <div>
        <p className={styles.emptyTitle}>아직 댓글이 없어요.</p>
        <p className={styles.emptyText}>{description}</p>
      </div>
    </div>
  )
}

interface CommentComposerProps {
  postId: number
  onCreated: (comment: CommentResponse) => void
}

/** 댓글 쓰기. 제출 중에는 입력을 읽기 전용으로 두고 버튼은 누름만 무시한다(두 번 눌러도 한 건). */
function CommentComposer({ postId, onCreated }: CommentComposerProps) {
  const create = useCreateComment(postId)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dirty = value.trim().length > 0

  // 쓰던 댓글이 있으면 창을 닫기 전에 한 번 묻는다
  useEffect(() => {
    if (!dirty) return
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (create.isPending) return
    const problem = checkCommentContent(value)
    if (problem) {
      setError(problem)
      inputRef.current?.focus()
      return
    }
    create.mutate(
      { content: value },
      {
        onSuccess: (comment) => {
          setValue('')
          setError(null)
          onCreated(comment)
        },
        // 입력은 지우지 않는다 — 고쳐서 다시 보낸다
        onError: (failure) => setError(getErrorMessage(failure)),
      },
    )
  }

  const overLimit = value.length > COMMENT_MAX_LENGTH

  return (
    <form className={styles.composer} onSubmit={submit} noValidate>
      <CommentField
        ref={inputRef}
        label="댓글 남기기"
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          if (error) setError(null)
        }}
        readOnly={create.isPending}
        hint={PUBLIC_HINT}
        error={overLimit ? checkCommentContent(value) : error}
      />
      <div className={styles.composerActions}>
        <Button type="submit" variant="primary" aria-disabled={create.isPending || undefined}>
          {create.isPending ? '남기는 중…' : '댓글 남기기'}
        </Button>
      </div>
    </form>
  )
}
