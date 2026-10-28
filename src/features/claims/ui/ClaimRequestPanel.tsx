import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { postKeys, type PostDetailResponse, type PostStatus, type PostType } from '@/features/posts'
import { useDirtyField, type LeaveCopy } from '@/shared/lib/dirtyRegistry'
import { getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { usePersonalInfoCheck } from '@/shared/lib/usePersonalInfoCheck'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import {
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  HandHeart,
  HandWaving,
  Info,
  PaperPlaneRight,
  WarningCircle,
  XCircle,
  type Icon,
} from '@/shared/ui/icons'
import { SafetyNote } from '@/shared/ui/SafetyNote'
import { Skeleton } from '@/shared/ui/Skeleton'
import { TextArea } from '@/shared/ui/TextArea'

import { CLAIM_ANSWER_MAX_LENGTH, type ClaimStatus } from '../api/types'
import { CLAIM_STALE_CODES, useCreateClaim, useDecideClaim } from '../model/claimMutations'
import {
  CLAIM_MEETING_SAFETY,
  CLAIM_PERSONAL_INFO_NOTICE,
  CLAIMS_ANCHOR_ID,
  claimAnswerLabel,
  claimAskHeading,
  myClaimLine,
  validateClaimAnswer,
  type ClaimPanelMode,
} from '../model/claimView'
import { CLAIM_CONSEQUENCE, claimEntryLabel } from '../model/labels'
import styles from './claims.module.css'

interface ClaimRequestPanelProps {
  post: PostDetailResponse
  /** `claimPanelMode()` — 부른 쪽이 칸 자리(그리드)를 잡을지 같은 판정으로 정한다 */
  mode: ClaimPanelMode
  /** 로그인 화면 주소(돌아올 곳 `#claims` 를 실어서). 경로는 app 이 정한다 */
  loginHref: string
  loginState?: unknown
  /** 내가 보낸 요청 목록 주소 */
  myClaimsHref: string
}

/**
 * 보낸 요청 상태마다 앞에 서는 아이콘 — 알림 줄 · 보낸 확인 요청과 같은 표지(요청 `HandWaving` · 승인 `HandHeart` · 거절 `XCircle`).
 * 채운 동그라미 ✓는 "끝남(받음)" 에만. 글 상태 때문에 멈춘 대기 요청은 시계 대신 안내(`Info`) — 기다리는 중이 아니다
 */
const STATUS_ICON: Record<ClaimStatus, Icon> = {
  PENDING: Clock,
  APPROVED: HandHeart,
  REJECTED: XCircle,
  RECEIVED: CheckCircle,
}

/**
 * 칸 설명 한 줄 — 질문이 있든 없든 같은 문장(질문 · 특징 안내는 펼친 칸이 한다). 글이 오기 전 자리표시(`ClaimPanelSkeleton`)가
 * 같은 글자로 같은 높이를 잡는다 — 응답 뒤 사진이 밀리지 않게
 */
const CLAIM_ASK_LEAD = '요청을 보내면 글쓴이가 확인한 뒤 승인하거나 거절해요.'

const LEAVE_COPY: LeaveCopy = {
  title: '쓰던 답을 두고 나갈까요?',
  body: '나가면 보내지 않은 답은 저장되지 않아요.',
}

/**
 * SCR-12 ① 확인 요청 — **글쓴이가 아닌 사람**의 칸. 상세의 제목 · 이름표 바로 아래(글쓴이의 내 글 관리 자리).
 *
 * - 게시중 · 회원 : `[내 물건이에요]`(분실 글 `[제가 주웠어요]`) → 그 자리에서 펼침(확인 질문 + 답 칸 + 결과 고지 + `[요청 보내기]`).
 *   되돌릴 수 없는 결과(한 번만 · 거절돼도 다시 못 보냄)는 보내기 버튼 바로 위 인라인 한 줄 — 답을 쓰는 동안 이미 읽었으니 확인 창을 또 띄우지 않는다(1.6 "한 번만")
 * - 게시중 · 비로그인 : 같은 제목 + 로그인 링크(돌아오면 `#claims` 로 이 칸에 온다)
 * - 내 요청이 있다 : 지금 상태 한 줄 + 다음에 할 일. 승인됐으면 만날 곳 안전 경고(`SafetyNote`), 내가 받는 쪽(습득 글)이면 `[받았어요]`(확인 창).
 *   대기 중인데 글이 게시중이 아니면(연락중 · 완료) 기다림 대신 멈춘 까닭(`stalledPendingLine`)
 * - 연락중 · 내 요청 없음 : 받지 않는다는 흐린 한 줄
 *
 * 보내기 · 받았어요가 그사이 바뀐 상태로 실패하면(이미 보냄 · 게시중 아님) 서버 `message` 를 칸 위에 남기고 상세를 다시 받는다(훅).
 */
export function ClaimRequestPanel({ post, mode, loginHref, loginState, myClaimsHref }: ClaimRequestPanelProps) {
  const queryClient = useQueryClient()
  const createClaim = useCreateClaim(post.id)
  const decide = useDecideClaim(post.id)
  const headingId = useId()
  const formId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const entryRef = useRef<HTMLButtonElement>(null)
  const answerRef = useRef<HTMLTextAreaElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)

  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  // 그사이 상태가 바뀌어 막힌 요청의 서버 문장 — 칸이 다른 모양(상태 줄 · 받지 않음)으로 바뀌어도 남긴다
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmReceive, setConfirmReceive] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  // 보낸 직후 한 번 — 상태 줄이 나타나면 그 줄로 포커스(렌더와 상관없는 표시라 ref)
  const justSent = useRef(false)

  const personal = usePersonalInfoCheck(open ? answer : '')
  useDirtyField(open && mode === 'ask' && answer.trim().length > 0, LEAVE_COPY)

  const question = post.verificationQuestion?.trim() || null
  const label = claimAnswerLabel(question !== null)
  const sending = createClaim.isPending

  // 펼치면 답 칸으로, 접으면 연 단추로 — 둘 다 그 요소가 그려진 뒤에 옮긴다
  const focusAfterToggle = useRef<'answer' | 'entry' | 'heading' | null>(null)
  useEffect(() => {
    const target = focusAfterToggle.current
    focusAfterToggle.current = null
    if (target === 'answer') answerRef.current?.focus()
    else if (target === 'entry') entryRef.current?.focus()
    else if (target === 'heading') headingRef.current?.focus({ preventScroll: true })
  }, [open])

  // 보낸 직후 상태 줄이 나타나면 그 줄로 — 스크린리더가 "보냈어요" 를 읽는다
  useEffect(() => {
    if (!justSent.current || mode !== 'mine') return
    justSent.current = false
    statusRef.current?.focus({ preventScroll: true })
  }, [mode])

  if (mode === 'none') return null

  function openForm() {
    focusAfterToggle.current = 'answer'
    setOpen(true)
    setNotice(null)
  }

  function closeForm() {
    if (sending) return
    focusAfterToggle.current = 'entry'
    setOpen(false)
    setFieldError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return
    const problem = validateClaimAnswer(answer, label)
    if (problem) {
      setFieldError(problem)
      answerRef.current?.focus()
      return
    }
    setFieldError(null)
    setNotice(null)
    createClaim.mutate(answer, {
      onSuccess: (claim) => {
        // 다시 받는 상세를 기다리지 않고 내 요청을 바로 그린다(받아 오면 서버 값으로 바뀐다)
        queryClient.setQueryData<PostDetailResponse>(postKeys.detail(post.id), (prev) =>
          prev ? { ...prev, myClaim: { id: claim.id, status: claim.status } } : prev,
        )
        setOpen(false)
        setAnswer('')
        justSent.current = true
      },
      onError: (error) => {
        if (hasErrorCode(error, 'INVALID_INPUT')) {
          setFieldError(getErrorMessage(error))
          answerRef.current?.focus()
          return
        }
        if (CLAIM_STALE_CODES.some((code) => hasErrorCode(error, code)) || hasErrorCode(error, 'CLAIM_OWN_POST')) {
          focusAfterToggle.current = 'heading'
          setOpen(false)
          setNotice(getErrorMessage(error))
          return
        }
        // 연결 · 서버 오류 — 쓴 답은 그대로 두고 다시 보낼 수 있게
        setFieldError(getErrorMessage(error))
      },
    })
  }

  function submitReceive() {
    if (!post.myClaim) return
    setDialogError(null)
    decide.mutate(
      { claimId: post.myClaim.id, decision: 'receive' },
      {
        onSuccess: () => setConfirmReceive(false),
        onError: (error) => {
          if (CLAIM_STALE_CODES.some((code) => hasErrorCode(error, code))) {
            setConfirmReceive(false)
            setNotice(getErrorMessage(error))
            return
          }
          setDialogError(getErrorMessage(error))
        },
      },
    )
  }

  const noticeLine = notice ? (
    <p className={styles.error} role="alert">
      <WarningCircle />
      {notice}
    </p>
  ) : null

  // 연락중 · 내 요청 없음 — 할 수 있는 일이 없어 면 없이 한 줄
  if (mode === 'closed') {
    return (
      <div id={CLAIMS_ANCHOR_ID} className={styles.quietWrap}>
        {noticeLine}
        <ClosedLine />
      </div>
    )
  }

  if (mode === 'mine' && post.myClaim) {
    const line = myClaimLine(post.myClaim.status, post.type, post.status)
    const StatusIcon = line.stalled ? Info : STATUS_ICON[post.myClaim.status]
    return (
      <section id={CLAIMS_ANCHOR_ID} className={styles.panel} aria-labelledby={headingId}>
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className={styles.heading} data-claims-heading>
          내 확인 요청
        </h2>
        {noticeLine}
        <div className={styles.status} key={post.myClaim.status}>
          <p ref={statusRef} tabIndex={-1} className={styles.statusLine}>
            <StatusIcon />
            {line.text}
          </p>
          {/* 만날 곳을 정하는 일이 받는 일보다 먼저라 경고가 다음 할 일 앞에 선다 */}
          {line.safety ? (
            <p className={styles.statusNext}>
              <SafetyNote>{CLAIM_MEETING_SAFETY}</SafetyNote>
            </p>
          ) : null}
          {line.next ? <p className={styles.statusNext}>{line.next}</p> : null}
        </div>
        {/* 댓글로 가는 입구는 바로 위 이름표 줄의 [댓글 쓰기]가 맡는다 — 같은 뜻의 단추를 하나 더 두지 않는다 */}
        {line.canReceive ? (
          <div className={styles.actions}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setDialogError(null)
                setConfirmReceive(true)
              }}
            >
              <Check />
              받았어요
            </Button>
          </div>
        ) : null}
        <Link to={myClaimsHref} className={styles.textLink}>
          내가 보낸 요청 보기
          <CaretRight />
        </Link>

        <ConfirmDialog
          open={confirmReceive}
          title="물건을 받았나요?"
          confirmLabel="받았어요"
          pendingLabel="알리는 중"
          pending={decide.isPending}
          error={confirmReceive ? dialogError : null}
          onConfirm={submitReceive}
          onClose={() => setConfirmReceive(false)}
          fallbackFocus={() => headingRef.current}
        >
          <p>{CLAIM_CONSEQUENCE.receive}</p>
        </ConfirmDialog>
      </section>
    )
  }

  // 게시중 — 묻는 칸(로그인 확인 전 · 비로그인 · 회원)
  return (
    <section id={CLAIMS_ANCHOR_ID} className={styles.panel} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className={styles.heading} data-claims-heading>
          {claimAskHeading(post.type)}
        </h2>
        <p className={styles.lead}>{CLAIM_ASK_LEAD}</p>
      </div>
      {noticeLine}

      {mode === 'checking' ? (
        <ButtonSkeleton />
      ) : mode === 'sign-in' ? (
        <div className={styles.actions}>
          <ButtonLink to={loginHref} replace state={loginState} variant="primary" size="sm">
            로그인하고 요청하기
          </ButtonLink>
        </div>
      ) : !open ? (
        <div className={styles.actions}>
          <Button
            ref={entryRef}
            variant="primary"
            size="sm"
            aria-expanded={false}
            aria-controls={formId}
            onClick={openForm}
          >
            <HandWaving />
            {claimEntryLabel(post.type)}
          </Button>
        </div>
      ) : (
        <form id={formId} className={styles.form} noValidate onSubmit={handleSubmit} aria-busy={sending || undefined}>
          {question ? (
            <div className={styles.question}>
              <span className={styles.questionLabel}>글쓴이의 확인 질문</span>
              <p className={styles.questionText}>{question}</p>
            </div>
          ) : null}
          <TextArea
            ref={answerRef}
            label={label}
            name="answer"
            value={answer}
            max={CLAIM_ANSWER_MAX_LENGTH}
            rows={3}
            autoComplete="off"
            onChange={(event) => {
              setAnswer(event.target.value)
              if (fieldError) setFieldError(null)
            }}
            onBlur={personal.check}
            error={fieldError}
            detected={
              personal.kind ? (
                <SafetyNote key={personal.kind} appear>
                  {CLAIM_PERSONAL_INFO_NOTICE[personal.kind]}
                </SafetyNote>
              ) : null
            }
            reserveDetected={answer.trim().length > 0}
            hint={
              question
                ? '답은 글쓴이와 나만 봐요.'
                : post.type === 'FOUND'
                  ? '흠집, 안에 든 것, 붙은 스티커처럼 사진에 없는 특징을 적어 주세요. 글쓴이와 나만 봐요.'
                  : '주운 곳과 때, 사진에 없는 특징을 적어 주세요. 글쓴이와 나만 봐요.'
            }
            note={CLAIM_CONSEQUENCE.send}
          />
          <div className={styles.actions}>
            <Button type="submit" variant="primary" size="sm" pending={sending} pendingLabel="보내는 중">
              <PaperPlaneRight />
              요청 보내기
            </Button>
            <Button variant="ghost" size="sm" aria-disabled={sending || undefined} onClick={closeForm}>
              취소
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

function ButtonSkeleton() {
  return (
    <div className={styles.actions} aria-hidden="true">
      <Skeleton width="8.5rem" height="2.25rem" />
    </div>
  )
}

function ClosedLine() {
  return (
    <p className={styles.quiet}>
      <Info />
      다른 분과 연락하고 있어서 지금은 확인 요청을 받지 않아요.
    </p>
  )
}

/**
 * 글을 받기 전(목록 카드로 머리를 먼저 그린 상세)의 확인 요청 칸 자리. 진짜 칸과 같은 제목 · 같은 설명 · 같은 높이라
 * 응답 뒤 사진이 밀리지 않는다. 게시중이면 묻는 칸, 연락중이면 흐린 한 줄. 스크린리더에는 숨긴다(상세가 "불러오는 중"을 읽는다)
 */
export function ClaimPanelSkeleton({ type, status }: { type: PostType; status: PostStatus }) {
  if (status === 'DONE') return null
  if (status === 'IN_PROGRESS') {
    return (
      <div className={styles.quietWrap} aria-hidden="true">
        <ClosedLine />
      </div>
    )
  }
  return (
    <div className={styles.panel} aria-hidden="true">
      <div className={styles.head}>
        <p className={styles.heading}>{claimAskHeading(type)}</p>
        <p className={styles.lead}>{CLAIM_ASK_LEAD}</p>
      </div>
      <ButtonSkeleton />
    </div>
  )
}
