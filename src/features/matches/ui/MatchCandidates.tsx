import { useQuery } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { paths } from '@/app/paths'
import {
  PostThumbnail,
  TypeBadge,
  lostFoundDateLabel,
  type PostDetailResponse,
} from '@/features/posts'
import { formatDate } from '@/shared/lib/date'
import { getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { Check, MapPin, WarningCircle } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { MatchResponse } from '../api/types'
import { MATCH_STALE_CODES, useDismissMatch } from '../model/matchMutations'
import { matchesQueryOptions } from '../model/matchQueries'
import {
  DISMISS_DIALOG,
  MATCHES_ANCHOR_ID,
  dismissLabel,
  matchReasons,
  matchesEmpty,
  matchesHeading,
  matchesLead,
  nextFocusCandidate,
} from '../model/matchView'
import styles from './MatchCandidates.module.css'

interface MatchCandidatesProps {
  /** 글쓴이의 **게시중** 글. 부른 쪽이 `showsMatches` 로 판정한다 — 남의 글 · 비로그인에는 그리지 않는다 */
  post: PostDetailResponse
  /** 후보 글 상세로 넘길 기록 상태(상세의 [목록으로]가 이것을 본다) */
  linkState?: unknown
}

/** 받기 전 카드 수 — 넓은 칸(30rem)에서도 셋째 카드가 끝에 걸린다 */
const SKELETON_CARDS = 3

/**
 * SCR-11 추천 후보 — 내 글 상세의 내 글 관리 · 받은 확인 요청 아래(본문 앞). 글쓴이에게만.
 *
 * - 카드 = 목록 카드와 같은 1:1 사진(없으면 포스터) + 사진 위 유형 이름표 + 제목 2줄 + **맞은 이유**(`%` 없이 말로) + 장소(자르지 않음) · 날짜.
 *   카드 하나 = 링크 하나(제목 링크의 덮개가 카드를 덮는다) → 후보 글 상세, 거기서 `[내 물건이에요]`(SCR-12 ①)
 * - 옆으로 밀어 보는 목록(`ul`) — 휴대폰 첫 화면에 두 장 남짓 + 다음 카드 끝이 걸려 더 있다는 것을 말한다. Tab 으로 카드마다 닿는다
 * - `[내 물건 아니에요]`(습득 글이면 `[다른 물건이에요]`) — **되돌리는 API 가 없어** 확인 창(1.6). 숨긴 뒤 포커스는 다음 카드(없으면 제목)
 * - 네 상태 : 로딩(같은 틀의 카드 스켈레톤) · 빈(한 줄로 접은 문장 둘) · 오류(**그리지 않는다** — 덤 요소, 다음 방문에 다시) · 권한(부른 쪽)
 */
export function MatchCandidates({ post, linkState }: MatchCandidatesProps) {
  const matches = useQuery(matchesQueryOptions(post.id))
  const dismiss = useDismissMatch(post.id)
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const [target, setTarget] = useState<MatchResponse | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // 숨긴 뒤 포커스를 둘 카드 — 확인 창이 닫히며 연 단추(사라진 카드)로 못 돌아갈 때 이것을 찾는다
  const focusAfter = useRef<number | null>(null)

  // 덤 요소의 실패는 그리지 않는다(디자인품질기준 "덤 요소의 실패" · QA-D-L18). 받은 것이 있으면 그것을 그대로 둔다
  if (matches.isError && !matches.data) return null

  const list = matches.data ?? []
  const loading = matches.isPending
  const empty = !loading && list.length === 0
  const copy = matchesEmpty(post.type)

  function ask(match: MatchResponse) {
    if (dismiss.isPending) return
    setDialogError(null)
    setTarget(match)
  }

  function submit() {
    if (!target) return
    const removed = target
    setDialogError(null)
    setNotice(null)
    setAnnouncement('')
    focusAfter.current = nextFocusCandidate(list, removed.postId)
    dismiss.mutate(removed.postId, {
      onSuccess: () => {
        setTarget(null)
        setAnnouncement(DISMISS_DIALOG.done)
      },
      onError: (error) => {
        // 그사이 후보가 사라졌다(글이 끝남 · 다른 탭에서 숨김) — 창을 닫고 묶음 위에 서버 문장. 훅이 다시 받는다
        if (MATCH_STALE_CODES.some((code) => hasErrorCode(error, code))) {
          setTarget(null)
          setNotice(getErrorMessage(error))
          return
        }
        setDialogError(getErrorMessage(error))
      },
    })
  }

  function focusTarget(): HTMLElement | null {
    const id = focusAfter.current
    focusAfter.current = null
    const link = id === null ? null : trackRef.current?.querySelector<HTMLElement>(`[data-match-link="${id}"]`)
    return link ?? headingRef.current
  }

  return (
    <section
      id={MATCHES_ANCHOR_ID}
      className={styles.panel}
      aria-labelledby={headingId}
      aria-busy={loading || undefined}
      data-empty={empty || undefined}
    >
      <div className={styles.head}>
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className={styles.heading} data-matches-heading>
          {empty ? (
            copy.title
          ) : (
            <>
              {matchesHeading(post.type)}
              {loading ? null : (
                <span className={styles.count}>
                  {' '}
                  {list.length.toLocaleString('ko-KR')}건
                </span>
              )}
            </>
          )}
        </h2>
        <p className={styles.lead}>{empty ? copy.description : matchesLead(post.type)}</p>
      </div>

      {notice ? (
        <p className={styles.error} role="alert">
          <WarningCircle />
          {notice}
        </p>
      ) : null}

      {loading ? (
        <ul className={styles.track} role="list" aria-hidden="true">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <li key={index}>
              <CandidateSkeleton />
            </li>
          ))}
        </ul>
      ) : empty ? null : (
        <ul ref={trackRef} className={styles.track} role="list">
          {list.map((match) => (
            <li key={match.postId}>
              <CandidateCard
                match={match}
                dismissText={dismissLabel(post.type)}
                linkState={linkState}
                busy={dismiss.isPending}
                onDismiss={ask}
              />
            </li>
          ))}
        </ul>
      )}
      {loading ? <span className="sr-only">비슷한 글을 불러오는 중이에요.</span> : null}

      <p className="sr-only" role="status">
        {announcement}
      </p>

      <ConfirmDialog
        open={target !== null}
        title={DISMISS_DIALOG.title}
        confirmLabel={DISMISS_DIALOG.confirm}
        pendingLabel={DISMISS_DIALOG.pending}
        pending={dismiss.isPending}
        error={target ? dialogError : null}
        onConfirm={submit}
        onClose={() => setTarget(null)}
        fallbackFocus={focusTarget}
      >
        {target ? (
          <p>
            {/* 어느 글인지 — 사용자 입력 원문은 글자로만(보안명세서 · XSS) */}
            <bdi className={styles.dialogTitle}>「{target.title}」</bdi> {DISMISS_DIALOG.body}
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  )
}

interface CandidateCardProps {
  match: MatchResponse
  dismissText: string
  linkState?: unknown
  busy: boolean
  onDismiss: (match: MatchResponse) => void
}

/**
 * 후보 카드 한 장. 문서 순서는 제목 → 이름표 → 맞은 이유 → 장소 · 날짜 → 숨기기(사진은 CSS `order` 로 위에) —
 * 스크린리더가 제목부터 읽는다(목록 카드와 같은 규칙). 숨기기 단추는 덮개 위에 선다
 */
function CandidateCard({ match, dismissText, linkState, busy, onDismiss }: CandidateCardProps) {
  const titleId = useId()
  const reasons = matchReasons(match)

  return (
    <article className={styles.card}>
      <div className={styles.body}>
        <h3 id={titleId} className={styles.title}>
          <Link className={styles.link} to={paths.postDetail(match.postId)} state={linkState} data-match-link={match.postId}>
            <span className={styles.titleText}>{match.title}</span>
          </Link>
        </h3>

        <p className={styles.flags}>
          <TypeBadge type={match.type} surface="photo" />
        </p>

        <ul className={styles.reasons} role="list" aria-label="맞은 이유">
          {reasons.map((reason) => (
            <li key={reason.key} data-same={reason.same || undefined}>
              {reason.same ? <Check /> : null}
              {reason.text}
            </li>
          ))}
        </ul>

        <dl className={styles.facts}>
          <div className={styles.place}>
            <dt>
              <MapPin className={styles.pin} />
              <span className="sr-only">장소</span>
            </dt>
            <dd>{match.location}</dd>
          </div>
          <div className={styles.date}>
            <dt>{lostFoundDateLabel(match.type)}</dt>
            <dd>
              <time dateTime={match.lostFoundDate}>{formatDate(match.lostFoundDate)}</time>
            </dd>
          </div>
        </dl>
      </div>

      <div className={styles.media}>
        <PostThumbnail
          className={styles.visual}
          category={match.category}
          type={match.type}
          src={match.thumbnailUrl ?? undefined}
          alt=""
          seed={match.postId}
        />
      </div>

      <div className={styles.actions}>
        <Button
          size="sm"
          variant="ghost"
          block
          className={styles.dismiss}
          aria-describedby={titleId}
          aria-disabled={busy || undefined}
          onClick={() => !busy && onDismiss(match)}
        >
          {dismissText}
        </Button>
      </div>
    </article>
  )
}

/** 받기 전 카드 — 받은 카드와 같은 칸(같은 최소 높이)에 자리만 둔다. 받는 순간 아래 본문이 밀리지 않게 */
function CandidateSkeleton() {
  return (
    <div className={`${styles.card} ${styles.skeletonCard}`}>
      <div className={styles.body}>
        <div className={styles.title}>
          <Skeleton shape="text" width="92%" />
          <Skeleton shape="text" width="60%" />
        </div>
        <div className={styles.reasons}>
          <Skeleton shape="text" width="5rem" />
        </div>
        <div className={styles.facts}>
          <div className={styles.place}>
            <Skeleton shape="text" width="85%" />
          </div>
          <div className={styles.date}>
            <Skeleton shape="text" width="70%" />
          </div>
        </div>
      </div>
      <div className={styles.media}>
        <Skeleton className={styles.skeletonMedia} />
      </div>
      <div className={styles.actions}>
        <Skeleton className={styles.skeletonButton} />
      </div>
    </div>
  )
}
