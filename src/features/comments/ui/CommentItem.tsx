import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { formatDateTime } from '@/shared/lib/date'
import { getErrorMessage } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { WarningCircle } from '@/shared/ui/icons'

import { COMMENT_MAX_LENGTH, type CommentResponse } from '../api/types'
import { useDeleteComment, useUpdateComment } from '../model/commentMutations'
import { checkCommentContent } from '../model/validation'
import { CommentField } from './CommentField'
import styles from './CommentItem.module.css'

interface CommentItemProps {
  postId: number
  comment: CommentResponse
  /** 내 댓글이면 수정 · 삭제가 보인다. 남의 것 · 비로그인은 **숨긴다** */
  mine: boolean
  /** 게시글 작성자가 단 댓글. 이름 옆에 `글쓴이` — 주인과 주운 사람의 대화를 한눈에 가린다 */
  byPostAuthor: boolean
  /** 방금 남긴 댓글. 제자리에서 옅게 떠오른다 */
  fresh?: boolean
  onUpdated: (comment: CommentResponse) => void
  onDeleted: (commentId: number) => void
}

/**
 * 댓글 한 건. 본문은 사용자 입력 원문 — 텍스트로만 그린다(줄바꿈은 살리고, 링크로 바꾸지 않는다).
 *
 * - 수정은 **그 자리에서**. 저장하면 `(수정됨)` 이 붙는다. Esc 로 그만둔다
 * - 삭제는 되돌릴 수 없지만 잃는 것이 300자 한 줄뿐이라 다이얼로그 대신 **그 자리에서 한 번 더** 묻는다
 *   (`[삭제]` → `이 댓글을 삭제할까요? [삭제하기] [취소]`, 포커스는 [취소]).
 *   다이얼로그를 남발하면 게시글 삭제 다이얼로그를 읽지 않게 된다(화면정의서 SCR-03 ③)
 * - 요청 중에는 입력을 읽기 전용으로, 버튼은 누름만 무시한다 — 누른 버튼이 잠기면 포커스가 빠진다
 */
export function CommentItem({ postId, comment, mine, byPostAuthor, fresh, onUpdated, onDeleted }: CommentItemProps) {
  const update = useUpdateComment(postId)
  const remove = useDeleteComment(postId)
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view')
  const [draft, setDraft] = useState(comment.content)
  const [error, setError] = useState<string | null>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const nameId = useId()

  const busy = update.isPending || remove.isPending

  function focusLater(target: { current: HTMLElement | null }) {
    requestAnimationFrame(() => target.current?.focus())
  }

  function startEdit() {
    setDraft(comment.content)
    setError(null)
    setMode('edit')
    requestAnimationFrame(() => {
      const input = textareaRef.current
      if (!input) return
      input.focus()
      input.setSelectionRange(input.value.length, input.value.length)
    })
  }

  function cancelEdit() {
    if (update.isPending) return
    setMode('view')
    setError(null)
    focusLater(editButtonRef)
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (update.isPending) return
    const problem = checkCommentContent(draft)
    if (problem) {
      setError(problem)
      textareaRef.current?.focus()
      return
    }
    if (draft === comment.content) {
      cancelEdit()
      return
    }
    update.mutate(
      { commentId: comment.id, content: draft },
      {
        onSuccess: (updated) => {
          setMode('view')
          onUpdated(updated)
          focusLater(editButtonRef)
        },
        onError: (failure) => setError(getErrorMessage(failure)),
      },
    )
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelEdit()
    }
  }

  function askDelete() {
    setError(null)
    setMode('confirm-delete')
    focusLater(cancelDeleteRef)
  }

  function cancelDelete() {
    if (remove.isPending) return
    setMode('view')
    focusLater(deleteButtonRef)
  }

  function confirmDelete() {
    if (remove.isPending) return
    remove.mutate(comment.id, {
      onSuccess: () => onDeleted(comment.id),
      onError: (failure) => setError(getErrorMessage(failure)),
    })
  }

  const overLimit = draft.length > COMMENT_MAX_LENGTH

  return (
    <article className={styles.comment} aria-labelledby={nameId} data-fresh={fresh || undefined}>
      <header className={styles.meta}>
        <span id={nameId} className={styles.name}>
          {comment.nickname}
        </span>
        {byPostAuthor ? <span className={styles.authorTag}>글쓴이</span> : null}
        <span className={styles.time}>
          <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
          {comment.updatedAt ? <span className={styles.edited}> (수정됨)</span> : null}
        </span>
      </header>

      {mode === 'edit' ? (
        <form className={styles.editForm} onSubmit={save} onKeyDown={handleEditKeyDown} noValidate>
          <CommentField
            ref={textareaRef}
            label="댓글 고치기"
            hideLabel
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              if (error) setError(null)
            }}
            readOnly={update.isPending}
            error={overLimit ? checkCommentContent(draft) : error}
          />
          <div className={styles.editActions}>
            <Button size="sm" aria-disabled={update.isPending || undefined} onClick={cancelEdit}>
              취소
            </Button>
            <Button type="submit" size="sm" variant="primary" aria-disabled={update.isPending || undefined}>
              {update.isPending ? '저장하는 중…' : '저장'}
            </Button>
          </div>
        </form>
      ) : (
        <p className={styles.content}>{comment.content}</p>
      )}

      {mine && mode === 'view' ? (
        <div className={styles.actions}>
          <Button ref={editButtonRef} size="sm" variant="ghost" onClick={startEdit} aria-describedby={nameId}>
            수정
          </Button>
          <Button ref={deleteButtonRef} size="sm" variant="ghost" onClick={askDelete} aria-describedby={nameId}>
            삭제
          </Button>
        </div>
      ) : null}

      {mine && mode === 'confirm-delete' ? (
        <div className={styles.confirm} role="group" aria-label="댓글 삭제 확인" aria-busy={remove.isPending || undefined}>
          <p className={styles.confirmText}>이 댓글을 삭제할까요? 되돌릴 수 없어요.</p>
          <div className={styles.confirmActions}>
            <Button ref={cancelDeleteRef} size="sm" aria-disabled={busy || undefined} onClick={cancelDelete}>
              취소
            </Button>
            <Button size="sm" variant="danger" aria-disabled={busy || undefined} onClick={confirmDelete}>
              {remove.isPending ? '삭제하는 중…' : '삭제하기'}
            </Button>
          </div>
        </div>
      ) : null}

      {error && mode !== 'edit' ? (
        <p className={styles.error} role="alert">
          <WarningCircle />
          {error}
        </p>
      ) : null}
    </article>
  )
}
