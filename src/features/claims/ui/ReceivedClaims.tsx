import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'

import type { PostDetailResponse } from '@/features/posts'
import { formatDateTime } from '@/shared/lib/date'
import { getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { ArrowClockwise, ArrowUUpLeft, Check, HandHeart, WarningCircle, X } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { ClaimResponse } from '../api/types'
import { CLAIM_STALE_CODES, useDecideClaim, type ClaimDecision } from '../model/claimMutations'
import { receivedClaimsQueryOptions } from '../model/claimQueries'
import {
  CLAIMS_ANCHOR_ID,
  RECEIVED_CLAIM_STATUS_LABEL,
  approveBlockedReason,
  receivedClaimActions,
  sortReceivedClaims,
} from '../model/claimView'
import { CLAIM_CONSEQUENCE } from '../model/labels'
import styles from './claims.module.css'

interface ReceivedClaimsProps {
  /** 글쓴이의 글. **글쓴이에게만** 그린다(부른 쪽이 판정한다) — 답은 글쓴이와 보낸 사람만 본다 */
  post: PostDetailResponse
}

/** 확인 창 하나 — 어떤 요청에 무엇을 할지 */
type Pending = { claim: ClaimResponse; decision: ClaimDecision | 'cancel' }

const DIALOG: Record<Pending['decision'], { title: string; confirm: string; pending: string; body: string }> = {
  approve: { title: '이 요청을 승인할까요?', confirm: '승인하기', pending: '승인하는 중', body: CLAIM_CONSEQUENCE.approve },
  reject: { title: '이 요청을 거절할까요?', confirm: '거절하기', pending: '거절하는 중', body: CLAIM_CONSEQUENCE.reject },
  cancel: { title: '승인을 취소할까요?', confirm: '승인 취소하기', pending: '취소하는 중', body: CLAIM_CONSEQUENCE.cancel },
  receive: { title: '물건을 받았나요?', confirm: '받았어요', pending: '알리는 중', body: CLAIM_CONSEQUENCE.receive },
}

const DONE_ANNOUNCE: Record<Pending['decision'], string> = {
  approve: '승인했어요. 댓글로 만날 곳을 정해 주세요.',
  reject: '거절했어요.',
  cancel: '승인을 취소했어요. 글이 다시 게시중이에요.',
  receive: '받았다고 알렸어요. 주인 확인이 끝났어요.',
}

/**
 * SCR-12 ② 받은 확인 요청 — 글쓴이의 내 글 관리 바로 아래. 요청마다 요청자 · 시각 · 상태 · 질문 · 답, 그리고 지금 할 수 있는 것만.
 *
 * - 대기 중 : `[승인]` `[거절]`(둘 다 확인 창 — 승인은 글을 연락중으로 바꾸고, 거절은 그 사람이 다시 요청할 수 없다).
 *   승인한 요청이 이미 있거나 글이 게시중이 아니면 `[승인]`은 그리지 않고 까닭을 목록 위 한 줄로
 * - 승인함 : `[승인 취소]`(확인 창), 분실 글이면 `[받았어요]`(글쓴이가 받는 쪽 — 이 칸의 유일한 잉크 단추)
 * - 거절함 · 전달 완료 : 할 일 없음
 * - 네 상태 : 로딩(한 건 모양 스켈레톤) · 0건(한 줄 + 다음에 일어날 일) · 오류(서버 문장 + `[다시 시도]`) · 권한(부른 쪽)
 *
 * 승인 · 거절 · 받았어요는 빨강이 아니다 — 빨간 채움은 삭제 확인만(1.2). 되돌릴 수 없는 결과는 확인 창 문장이 말한다.
 * 누르는 면 44px, 두 단추 사이 16px — 같은 줄의 [승인]–[거절]을 잘못 누르지 않게(피츠). 확인 창이 한 번 더 받는다.
 */
export function ReceivedClaims({ post }: ReceivedClaimsProps) {
  const claims = useQuery(receivedClaimsQueryOptions(post.id))
  const decide = useDecideClaim(post.id)
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // 대기 수가 바뀌었다(상세를 다시 받음 — 새 요청이 왔다). 목록도 다시 받는다
  const pendingCount = post.pendingClaimCount ?? 0
  const lastCount = useRef(pendingCount)
  const { refetch } = claims
  useEffect(() => {
    if (lastCount.current === pendingCount) return
    lastCount.current = pendingCount
    void refetch()
  }, [pendingCount, refetch])

  function ask(claim: ClaimResponse, decision: Pending['decision']) {
    if (decide.isPending) return
    setDialogError(null)
    setPending({ claim, decision })
  }

  function submit() {
    if (!pending) return
    const { claim, decision } = pending
    setDialogError(null)
    setNotice(null)
    setAnnouncement('')
    decide.mutate(
      { claimId: claim.id, decision: decision === 'cancel' ? 'reject' : decision },
      {
        onSuccess: () => {
          setPending(null)
          setAnnouncement(DONE_ANNOUNCE[decision])
        },
        onError: (error) => {
          // 그사이 바뀌었다(다른 탭 · 상대가 먼저) — 창을 닫고 칸 위에 서버 문장. 훅이 다시 받는다
          if (CLAIM_STALE_CODES.some((code) => hasErrorCode(error, code))) {
            setPending(null)
            setNotice(getErrorMessage(error))
            return
          }
          setDialogError(getErrorMessage(error))
        },
      },
    )
  }

  const list = sortReceivedClaims(claims.data ?? [])
  const approvedExists = list.some((claim) => claim.status === 'APPROVED')
  const blocked = approveBlockedReason(list, post.status)
  const dialog = pending ? DIALOG[pending.decision] : null

  return (
    <section id={CLAIMS_ANCHOR_ID} className={styles.panel} aria-labelledby={headingId}>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className={styles.heading} data-claims-heading>
        받은 확인 요청
        {pendingCount > 0 ? (
          <span className={styles.count}>
            <span className="sr-only">, 기다리는 요청 </span>
            {pendingCount.toLocaleString('ko-KR')}
            <span className="sr-only">건</span>
          </span>
        ) : null}
      </h2>

      {notice ? (
        <p className={styles.error} role="alert">
          <WarningCircle />
          {notice}
        </p>
      ) : null}

      {claims.isPending ? (
        // 받기 전 — 대기 수(상세가 이미 알려 줌)만큼 한 건 모양을 잡는다(3건까지). 대기 0이면 빈 상태 두 줄 모양
        <div className={styles.list}>
          {pendingCount === 0 ? (
            <div className={styles.head} aria-hidden="true">
              <Skeleton shape="text" width="12rem" />
              <Skeleton shape="text" width="15rem" />
            </div>
          ) : (
            Array.from({ length: Math.min(pendingCount, 3) }, (_, index) => (
              <div key={index} className={`${styles.item} ${styles.skeletonItem}`} aria-hidden="true">
                <Skeleton shape="text" width="9rem" />
                <Skeleton shape="text" width="100%" />
                <Skeleton shape="text" width="70%" />
                <Skeleton width="11.5rem" height="2.25rem" />
              </div>
            ))
          )}
          <span className="sr-only">받은 확인 요청을 불러오는 중이에요.</span>
        </div>
      ) : claims.isError && !claims.data ? (
        <div className={styles.errorBlock}>
          <p className={styles.error} role="alert">
            <WarningCircle />
            {getErrorMessage(claims.error)}
          </p>
          <Button size="sm" pending={claims.isFetching} pendingLabel="다시 불러오는 중" onClick={() => void claims.refetch()}>
            <ArrowClockwise />
            다시 시도
          </Button>
        </div>
      ) : list.length === 0 ? (
        <div className={styles.head}>
          <p className={styles.lead}>
            {post.status === 'OPEN' ? '아직 받은 확인 요청이 없어요.' : '받은 확인 요청이 없어요.'}
          </p>
          {post.status === 'OPEN' ? <p className={styles.muted}>요청이 오면 알림으로 알려 드려요.</p> : null}
        </div>
      ) : (
        <>
          {blocked ? <p className={styles.muted}>{blocked}</p> : null}
          <ol className={styles.list}>
            {list.map((claim) => (
              <ReceivedClaimItem
                key={claim.id}
                claim={claim}
                post={post}
                approvedExists={approvedExists}
                busy={decide.isPending}
                onAsk={ask}
              />
            ))}
          </ol>
        </>
      )}

      <p className="sr-only" role="status">
        {announcement}
      </p>

      <ConfirmDialog
        open={pending !== null}
        title={dialog?.title ?? ''}
        confirmLabel={dialog?.confirm ?? ''}
        pendingLabel={dialog?.pending}
        pending={decide.isPending}
        error={pending ? dialogError : null}
        onConfirm={submit}
        onClose={() => setPending(null)}
        fallbackFocus={() => headingRef.current}
      >
        {pending ? (
          <p>
            <bdi>{pending.claim.claimantNickname}</bdi> 님의 요청이에요. {dialog?.body}
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  )
}

interface ReceivedClaimItemProps {
  claim: ClaimResponse
  post: PostDetailResponse
  approvedExists: boolean
  busy: boolean
  onAsk: (claim: ClaimResponse, decision: Pending['decision']) => void
}

function ReceivedClaimItem({ claim, post, approvedExists, busy, onAsk }: ReceivedClaimItemProps) {
  const actions = receivedClaimActions(claim, post, approvedExists)
  const any = actions.approve || actions.reject || actions.cancel || actions.receive
  const press = (decision: Pending['decision']) => () => !busy && onAsk(claim, decision)

  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <bdi className={styles.who}>{claim.claimantNickname}</bdi>
        <time className={styles.when} dateTime={claim.createdAt}>
          {formatDateTime(claim.createdAt)}
        </time>
        <span className={styles.state} data-status={claim.status}>
          {RECEIVED_CLAIM_STATUS_LABEL[claim.status]}
        </span>
      </div>

      <dl className={styles.qa}>
        {claim.question ? (
          <div>
            <dt>질문</dt>
            <dd>{claim.question}</dd>
          </div>
        ) : null}
        <div>
          <dt>{claim.question ? '답' : '보낸 내용'}</dt>
          {/* 사용자 입력 원문 — 텍스트로만(보안명세서 · XSS) */}
          <dd className={styles.answer}>{claim.answer}</dd>
        </div>
      </dl>

      {claim.status === 'APPROVED' ? (
        <p className={styles.itemNote}>
          {actions.receive
            ? '승인한 요청이에요. 댓글로 만날 곳을 정하고, 물건을 받으면 [받았어요]를 눌러 주세요.'
            : '승인한 요청이에요. 댓글로 만날 곳을 정해 주세요. 상대가 물건을 받으면 주인 확인이 끝나요.'}
        </p>
      ) : null}

      {any ? (
        <div className={styles.actions}>
          {actions.receive ? (
            <Button variant="primary" size="sm" aria-disabled={busy || undefined} onClick={press('receive')}>
              <HandHeart />
              받았어요
            </Button>
          ) : null}
          {actions.approve ? (
            <Button size="sm" aria-disabled={busy || undefined} onClick={press('approve')}>
              <Check />
              승인
            </Button>
          ) : null}
          {actions.reject ? (
            <Button variant="ghost" size="sm" aria-disabled={busy || undefined} onClick={press('reject')}>
              <X />
              거절
            </Button>
          ) : null}
          {actions.cancel ? (
            <Button variant="ghost" size="sm" aria-disabled={busy || undefined} onClick={press('cancel')}>
              <ArrowUUpLeft />
              승인 취소
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
