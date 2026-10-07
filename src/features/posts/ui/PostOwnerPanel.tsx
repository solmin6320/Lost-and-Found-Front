import { useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'

import { getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import {
  ChatCircleDots,
  Check,
  CheckCircle,
  MegaphoneSimple,
  PencilSimple,
  Trash,
  WarningCircle,
  type Icon,
} from '@/shared/ui/icons'
import { SafetyNote } from '@/shared/ui/SafetyNote'

import type { PostDetailResponse, PostStatus, PostType } from '../api/types'
import { POST_STATUS_LABEL } from '../model/labels'
import { useChangePostStatus, useDeletePost } from '../model/postMutations'
import { postKeys } from '../model/postQueries'
import { isIrreversibleStatus } from '../model/postStatus'
import styles from './PostOwnerPanel.module.css'

interface PostOwnerPanelProps {
  post: PostDetailResponse
  /** 수정 화면 주소(SCR-04). 경로는 app 이 정한다 */
  editHref: string
  /**
   * 지웠다(또는 이미 지워져 있었다). 부른 쪽이 목록으로 옮기고 이 문장을 짧게 알린다.
   * `tone` — 지웠으면 `done`(체크), 이미 지워져 있었으면 `info`(하려던 일이 안 됐고 그 이유)
   */
  onDeleted: (message: string, tone: 'done' | 'info') => void
}

/** 게시중 ↔ 연락중은 되돌릴 수 있어 바로 바꾼다. 완료는 따로 둔다(확인을 받는다) */
const REVERSIBLE: { status: PostStatus; icon: Icon }[] = [
  { status: 'OPEN', icon: MegaphoneSimple },
  { status: 'IN_PROGRESS', icon: ChatCircleDots },
]

/** "…으로 바꿨어요" 의 조사까지 */
const CHANGED_TO: Record<PostStatus, string> = {
  OPEN: '게시중으로',
  IN_PROGRESS: '연락중으로',
  DONE: '완료로',
}

/**
 * 연락중으로 바꾼 **직후 한 번만** 상태 줄 아래에 띄우는 한 줄(SE-4). 연락을 시작하는 순간이 판단하는 순간이다.
 *   습득 글 — 주인을 가장해 물건을 가로채는 일 · 분실 글 — 사례금 · 택배비를 먼저 요구하는 일
 * 목록 · 첫 화면 경고로 넓히지 않는다(겁주는 예고는 읽히지 않는다)
 */
const CONTACT_TIP: Record<PostType, string> = {
  FOUND: '물건을 넘기기 전에 사진에 없는 특징을 물어 주인인지 확인해 주세요.',
  LOST: '돈을 먼저 보내 달라는 요청은 받지 마세요.',
}

/** 화면이 틀렸다는 뜻인 실패 — 이미 완료됨 · 남의 글 · 지워진 글. 상세를 다시 받아 맞춘다(훅이 409 · 404 를, 여기서 403 을) */
const STALE_CODES = ['INVALID_STATUS_TRANSITION', 'FORBIDDEN_ACCESS', 'POST_NOT_FOUND'] as const

/**
 * 내 글 관리 — **작성자 본인에게만** 그린다(부른 쪽이 판정한다. 비활성으로 남기지 않는다).
 * 상태 · 수정 · 삭제. 되돌릴 수 있는 것은 바로, 되돌릴 수 없는 것(완료 · 삭제)은 결과를 문장으로 보여 주고 한 번 묻는다.
 * 상세는 이 칸을 제목 · 이름표 바로 아래에 둔다(AR-4) — 글쓴이가 들어온 까닭이 첫 화면에 있다.
 *
 * - 두 묶음(상태 / 수정 · 삭제)은 구분선 없이 24px 로 가른다. "상태" 이름은 스크린리더만 읽는다 — 두 칸 스위치가 스스로 말한다(UI-5)
 * - [수정]–[삭제] 16px. [삭제]는 줄 끝으로 옮기지 않는다 — 확인 창의 [삭제하기] 자리로 가면 두 번 누름이 통과한다(RV-3 · SE-1)
 * - 완료된 글은 "주인에게 돌아간 물건이에요." 를 여기서 한 번만 말한다(상세 머리의 같은 줄은 글쓴이에게 그리지 않는다)
 * - 연락중으로 바꾼 직후 한 번, 사칭 · 선입금 요구를 막는 한 줄(SE-4)
 *
 * - 요청 중에는 버튼을 `disabled` 로 잠그지 않고 누름만 무시한다(`aria-disabled`) — 누른 버튼이 잠기면 포커스가 빠진다
 * - 서버가 거절하면(409 · 403) 상태 줄 아래에 `message` 를 그대로 보여 주고 상세를 다시 받는다
 */
export function PostOwnerPanel({ post, editHref, onDeleted }: PostOwnerPanelProps) {
  const queryClient = useQueryClient()
  const changeStatus = useChangePostStatus(post.id)
  const deletePost = useDeletePost()
  const [confirm, setConfirm] = useState<'done' | 'delete' | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [contactTip, setContactTip] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const headingId = useId()
  const statusLabelId = useId()
  const hintId = useId()

  const busy = changeStatus.isPending || deletePost.isPending
  const done = post.status === 'DONE'

  function openConfirm(kind: 'done' | 'delete') {
    setDialogError(null)
    setConfirm(kind)
  }

  function requestStatus(next: PostStatus) {
    if (busy || next === post.status) return
    if (isIrreversibleStatus(next)) {
      openConfirm('done')
      return
    }
    submitStatus(next)
  }

  function submitStatus(next: PostStatus) {
    setStatusError(null)
    setAnnouncement('')
    changeStatus.mutate(next, {
      onSuccess: (result) => {
        setConfirm(null)
        const tip = result.status === 'IN_PROGRESS'
        setContactTip(tip)
        setAnnouncement(`${CHANGED_TO[result.status]} 바꿨어요.${tip ? ` ${CONTACT_TIP[post.type]}` : ''}`)
      },
      onError: (error) => {
        const stale = STALE_CODES.some((code) => hasErrorCode(error, code))
        if (hasErrorCode(error, 'FORBIDDEN_ACCESS')) {
          void queryClient.invalidateQueries({ queryKey: postKeys.detail(post.id), exact: true })
        }
        // 다이얼로그 안에서 난 실패 중 다시 눌러 볼 만한 것(연결 · 서버 오류)은 그 자리에 둔다
        if (confirm === 'done' && !stale) {
          setDialogError(getErrorMessage(error))
          return
        }
        setConfirm(null)
        setStatusError(getErrorMessage(error))
      },
    })
  }

  function submitDelete() {
    setDialogError(null)
    deletePost.mutate(post.id, {
      onSuccess: () => onDeleted('글을 삭제했어요.', 'done'),
      onError: (error) => {
        // 다른 탭에서 이미 지웠다 — 결과는 같지만 내가 지운 것은 아니다(체크 대신 안내). 훅이 캐시를 정리했다
        if (hasErrorCode(error, 'POST_NOT_FOUND')) {
          onDeleted(getErrorMessage(error), 'info')
          return
        }
        if (hasErrorCode(error, 'FORBIDDEN_ACCESS')) {
          void queryClient.invalidateQueries({ queryKey: postKeys.detail(post.id), exact: true })
        }
        setDialogError(getErrorMessage(error))
      },
    })
  }

  const photoCount = post.images.length
  const commentCount = post.totalCommentCount
  const showContactTip = contactTip && post.status === 'IN_PROGRESS' && !(changeStatus.isPending && !confirm)

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <div className={styles.group}>
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className={styles.heading}>
          내 글 관리
        </h2>

        <div className={styles.status}>
          <span id={statusLabelId} className="sr-only">
            상태
          </span>
          {done ? (
            <p className={styles.doneNote}>
              <CheckCircle />
              <span>
                주인에게 돌아간 물건이에요. <span className={styles.doneMore}>상태는 더 바꿀 수 없어요.</span>
              </span>
            </p>
          ) : (
            <div className={styles.statusControls}>
              <div
                role="group"
                aria-labelledby={statusLabelId}
                aria-describedby={hintId}
                aria-busy={changeStatus.isPending || undefined}
                className={styles.segmented}
              >
                {REVERSIBLE.map(({ status, icon: StatusIcon }) => (
                  <button
                    key={status}
                    type="button"
                    className={styles.segment}
                    aria-pressed={post.status === status}
                    aria-disabled={busy || undefined}
                    onClick={() => requestStatus(status)}
                  >
                    <StatusIcon />
                    {POST_STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
              <Button size="sm" aria-disabled={busy || undefined} onClick={() => requestStatus('DONE')}>
                <Check />
                완료로 바꾸기
              </Button>
            </div>
          )}
        </div>

        {done ? null : showContactTip ? (
          // 사칭 · 선입금을 막는 안전 경고 — 빨간 글자 + 경고 세모(본인 피드백 2026-10-07)
          <p id={hintId} className={styles.tip}>
            <SafetyNote appear>{CONTACT_TIP[post.type]}</SafetyNote>
          </p>
        ) : (
          <p id={hintId} className={styles.hint}>
            {changeStatus.isPending && !confirm ? '바꾸는 중…' : '게시중과 연락중은 언제든 서로 바꿀 수 있어요.'}
          </p>
        )}

        {statusError ? (
          <p className={styles.error} role="alert">
            <WarningCircle />
            {statusError}
          </p>
        ) : null}
        <p className="sr-only" role="status">
          {announcement}
        </p>
      </div>

      <div className={styles.actions}>
        <ButtonLink to={editHref} size="sm">
          <PencilSimple />
          수정
        </ButtonLink>
        <Button size="sm" variant="dangerQuiet" aria-disabled={busy || undefined} onClick={() => !busy && openConfirm('delete')}>
          <Trash />
          삭제
        </Button>
      </div>

      <ConfirmDialog
        open={confirm === 'done'}
        title="완료로 바꿀까요?"
        confirmLabel="완료로 바꾸기"
        pendingLabel="바꾸는 중…"
        pending={changeStatus.isPending}
        error={confirm === 'done' ? dialogError : null}
        onConfirm={() => submitStatus('DONE')}
        onClose={() => setConfirm(null)}
        fallbackFocus={() => headingRef.current}
      >
        <p>완료로 바꾸면 다시 게시중이나 연락중으로 되돌릴 수 없어요.</p>
        {/* 목록 기본값이 "진행 중"이라 완료 글은 기본 목록에서 빠진다(회의 ⑧ · AR2-8). 누르기 전에 한 번만 말한다 */}
        <p>기본 목록에서는 빠지고, 상태에서 완료를 고르면 보여요.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'delete'}
        title="이 글을 삭제할까요?"
        tone="danger"
        confirmLabel="삭제하기"
        pendingLabel="삭제하는 중…"
        pending={deletePost.isPending}
        error={confirm === 'delete' ? dialogError : null}
        onConfirm={submitDelete}
        onClose={() => setConfirm(null)}
        fallbackFocus={() => headingRef.current}
      >
        <p>{deleteConsequence(photoCount, commentCount)}</p>
      </ConfirmDialog>
    </section>
  )
}

/**
 * 무엇이 함께 사라지는지 숫자로(화면정의서 SCR-03 ①). 0인 것은 문장에서 뺀다.
 * 삭제는 댓글(`commentRepository.deleteByPostId`)과 S3 사진까지 지운다 — 사용자가 예상하지 못하는 결과다
 */
function deleteConsequence(photos: number, comments: number): string {
  const lost = [photos > 0 ? `사진 ${photos}장` : null, comments > 0 ? `댓글 ${comments.toLocaleString('ko-KR')}개` : null]
    .filter(Boolean)
    .join('과 ')
  if (!lost) return '이 게시글을 삭제하면 되돌릴 수 없어요.'
  const particle = comments > 0 ? '가' : '이'
  return `이 게시글을 삭제하면 ${lost}${particle} 함께 사라져요. 되돌릴 수 없어요.`
}
