import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { LabMatchSource } from '@/app/lab/LabSlot'
import { paths } from '@/app/paths'
import { PostThumbnail, TypeBadge, postListQueryOptions } from '@/features/posts'
import { cx } from '@/shared/lib/cx'
import { getErrorMessage } from '@/shared/lib/http'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { CalendarBlank, CaretLeft, CaretRight, Check, MapPin, Tag, X } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { LabState, LabVariant } from '../labSwitch'
import { LAB_ERROR_MESSAGE } from '../useLabResource'
import { scoreCandidates, scoreWord, type MatchCandidate, type MatchReason } from './matchScore'
import styles from './MatchRail.module.css'

/** /me 에서는 기준 글을 따로 받지 않는다 — 목 서버의 내 분실 글(검은색 가죽 반지갑) */
const ME_SOURCE: LabMatchSource = { id: 25, type: 'LOST', title: '검은색 가죽 반지갑 잃어버렸어요', category: 'WALLET', location: '강남역 2번 출구 앞 버스정류장', lostFoundDate: '2026-09-23' }

interface MatchRailProps {
  variant: LabVariant
  state?: LabState
  context: 'detail' | 'me'
  source?: LabMatchSource
}

/**
 * (다) '이거 아닐까요?' 추천 — 내 분실 글 상세(글쓴이에게만, 내 글 관리 바로 아래) · 내가 쓴 글 위.
 * 후보는 지금 목록 API 의 습득 글을 화면에서 흉내 점수로 고른 것(시안). 실제로는 `GET /api/posts/{id}/matches`.
 *   a 사진 카드 띠 : 사진이 큰 카드를 옆으로 넘긴다. 일치율 = 숫자 + 바탕 없는 막대, 맞은 이유 세 줄
 *   b 비교 카드 띠 : 사진은 작게, "내 글 ↔ 이 글"을 종류 · 날짜 · 장소 줄로 견준다. 일치율은 말(높음 · 보통)
 *   c 한 장씩 크게 : 가장 높은 후보 하나를 크게 + [아니에요](이 후보 숨기기) · 다음 후보. 나머지는 아래 작은 줄
 */
export function MatchRail({ variant, state, context, source }: MatchRailProps) {
  const base = source ?? ME_SOURCE
  const query = useQuery({ ...postListQueryOptions({ type: base.type === 'LOST' ? 'FOUND' : 'LOST', size: 60 }), enabled: state === undefined || state === 'empty' })
  const titleId = useId()
  const [hidden, setHidden] = useState<number[]>([])

  const candidates = useMemo(() => {
    if (!query.data || state === 'empty') return []
    const seen = new Set<string>()
    const unique = query.data.content.filter((post) => {
      const key = post.title.replace(/ #\d+$/, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return scoreCandidates(base, unique, 5)
  }, [query.data, state, base])

  const shown = candidates.filter((c) => !hidden.includes(c.post.id))
  const loading = state === 'loading' || (state === undefined && query.isPending)
  const error = state === 'error' ? LAB_ERROR_MESSAGE : query.isError ? getErrorMessage(query.error) : null
  const ready = !loading && !error && shown.length > 0

  return (
    <section className={styles.rail} data-variant={variant} data-context={context} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          이거 아닐까요?
        </h2>
        <p className={styles.lead}>
          {context === 'me' ? (
            <>
              내 분실 글 <b>{base.title}</b>
              {ready ? `과 비슷한 습득 글 ${shown.length}건` : '과 비슷한 습득 글'}
            </>
          ) : ready ? (
            `비슷한 습득 글 ${shown.length}건을 찾았어요. 일치율이 높은 순서예요.`
          ) : (
            '비슷한 습득 글을 찾고 있어요.'
          )}
        </p>
      </div>

      {loading ? (
        <RailSkeleton variant={variant} />
      ) : error ? (
        <div className={styles.state}>
          <p className={styles.stateText}>
            추천을 불러오지 못했어요. <span className={styles.muted}>{error}</span>
          </p>
          <Button size="sm" onClick={() => void query.refetch()} pending={query.isFetching} pendingLabel="다시 불러오는 중">
            다시 시도
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <div className={styles.state}>
          <p className={styles.stateText}>
            <strong>아직 비슷한 습득 글이 없어요.</strong> 비슷한 글이 올라오면 알림으로 알려 드릴게요.
          </p>
          {hidden.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setHidden([])}>
              숨긴 후보 {hidden.length}건 다시 보기
            </Button>
          ) : null}
        </div>
      ) : variant === 'a' ? (
        <ul className={styles.track} role="list">
          {shown.map((c) => (
            <li key={c.post.id}>
              <PhotoCard candidate={c} />
            </li>
          ))}
        </ul>
      ) : variant === 'b' ? (
        <ul className={styles.track} role="list">
          {shown.map((c) => (
            <li key={c.post.id}>
              <CompareCard candidate={c} />
            </li>
          ))}
        </ul>
      ) : (
        <FocusCandidate candidates={shown} onHide={(id) => setHidden((h) => [...h, id])} />
      )}
    </section>
  )
}

const REASON_ICON = { CATEGORY: Tag, DATE: CalendarBlank, PLACE: MapPin, WORDS: Check } as const

function ReasonList({ reasons, className }: { reasons: MatchReason[]; className?: string }) {
  return (
    <ul role="list" className={cx(styles.reasons, className)} aria-label="맞은 이유">
      {reasons.map((r) => {
        const Icon = REASON_ICON[r.kind]
        return (
          <li key={r.kind} data-matched={r.matched || undefined}>
            <Icon />
            {r.text}
          </li>
        )
      })}
    </ul>
  )
}

/** 일치율 — 숫자 + 바탕 트랙 없는 막대(길이 = 점수). 막대는 장식, 숫자가 말한다 */
function ScoreBar({ score }: { score: number }) {
  return (
    <p className={styles.score}>
      <span className={styles.scoreNum}>
        <b data-numeric>{score}%</b> 일치
      </span>
      <span className={styles.scoreBar} aria-hidden="true">
        <span style={{ width: `${score}%` }} />
      </span>
    </p>
  )
}

/* ── a 사진 카드 ── */

function PhotoCard({ candidate: c }: { candidate: MatchCandidate }) {
  return (
    <article className={styles.photoCard}>
      <PostThumbnail className={styles.photo} category={c.post.category} type={c.post.type} src={c.post.thumbnailUrl ?? undefined} alt="" seed={c.post.id} />
      <div className={styles.cardBody}>
        <ScoreBar score={c.score} />
        <h3 className={styles.cardTitle}>
          <Link className={styles.cardLink} to={paths.postDetail(c.post.id)}>
            {c.post.title}
          </Link>
        </h3>
        <ReasonList reasons={c.reasons.filter((r) => r.matched).slice(0, 3)} />
      </div>
    </article>
  )
}

/* ── b 비교 카드 ── */

function CompareCard({ candidate: c }: { candidate: MatchCandidate }) {
  const word = scoreWord(c.score)
  return (
    <article className={styles.compareCard}>
      <div className={styles.compareHead}>
        <PostThumbnail className={styles.compareThumb} category={c.post.category} type={c.post.type} src={c.post.thumbnailUrl ?? undefined} alt="" seed={c.post.id} />
        <div className={styles.compareTitleBox}>
          <p className={styles.level} data-level={word}>
            일치 {word} <span data-numeric>{c.score}%</span>
          </p>
          <h3 className={styles.cardTitle}>
            <Link className={styles.cardLink} to={paths.postDetail(c.post.id)}>
              {c.post.title}
            </Link>
          </h3>
        </div>
      </div>
      <dl className={styles.compare}>
        <div className={styles.compareRow} aria-hidden="true">
          <dt />
          <dd>내 글</dd>
          <dd>이 글</dd>
        </div>
        {c.reasons
          .filter((r) => r.mine !== undefined)
          .map((r) => (
            <div key={r.kind} className={styles.compareRow} data-matched={r.matched || undefined}>
              <dt>
                {r.matched ? <Check aria-hidden={false} aria-label="맞음" /> : <X aria-hidden={false} aria-label="다름" />}
                {r.kind === 'CATEGORY' ? '종류' : r.kind === 'DATE' ? '날짜' : '장소'}
              </dt>
              <dd>{r.mine}</dd>
              <dd>{r.theirs}</dd>
            </div>
          ))}
      </dl>
    </article>
  )
}

/* ── c 한 장씩 크게 ── */

function FocusCandidate({ candidates, onHide }: { candidates: MatchCandidate[]; onHide: (id: number) => void }) {
  const [index, setIndex] = useState(0)
  const at = Math.min(index, candidates.length - 1)
  const c = candidates[at]!
  const rest = candidates.filter((_, i) => i !== at)
  return (
    <div className={styles.focus}>
      <article className={styles.focusCard}>
        <PostThumbnail className={styles.focusPhoto} category={c.post.category} type={c.post.type} src={c.post.thumbnailUrl ?? undefined} alt="" seed={c.post.id} />
        <div className={styles.focusBody}>
          <TypeBadge type={c.post.type} />
          <h3 className={styles.focusTitle}>{c.post.title}</h3>
          <ScoreBar score={c.score} />
          <ReasonList reasons={c.reasons} className={styles.focusReasons} />
          <div className={styles.focusActions}>
            <ButtonLink to={paths.postDetail(c.post.id)} variant="primary">
              글 보고 확인하기
            </ButtonLink>
            {/* 되돌릴 수 있다 — 숨긴 후보는 빈 상태에서 다시 본다. 확인 창 없이 */}
            <Button variant="ghost" onClick={() => onHide(c.post.id)}>
              내 물건 아니에요
            </Button>
          </div>
        </div>
      </article>
      {candidates.length > 1 ? (
        <div className={styles.others}>
          <p className={styles.othersLabel}>다른 후보</p>
          <ul className={styles.otherList} role="list">
            {rest.map((o) => (
              <li key={o.post.id}>
                <button type="button" className={styles.other} onClick={() => setIndex(candidates.indexOf(o))}>
                  <PostThumbnail className={styles.otherThumb} category={o.post.category} type={o.post.type} src={o.post.thumbnailUrl ?? undefined} alt="" seed={o.post.id} />
                  <span className={styles.otherText}>
                    <span className={styles.otherTitle}>{o.post.title}</span>
                    <span className={styles.muted} data-numeric>
                      {o.score}% 일치
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.stepper}>
            <Button size="sm" variant="ghost" onClick={() => setIndex((at - 1 + candidates.length) % candidates.length)} aria-label="이전 후보">
              <CaretLeft />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIndex((at + 1) % candidates.length)} aria-label="다음 후보">
              <CaretRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ── 로딩 — 받은 띠와 같은 틀 ── */

function RailSkeleton({ variant }: { variant: LabVariant }) {
  if (variant === 'c') {
    return (
      <div className={styles.focus} aria-busy="true">
        <div className={styles.focusCard}>
          <Skeleton className={styles.focusPhoto} />
          <div className={styles.focusBody}>
            <Skeleton shape="text" width="3rem" />
            <Skeleton shape="text" width="80%" />
            <Skeleton shape="text" width="60%" />
            <Skeleton shape="text" width="70%" />
          </div>
        </div>
        <span className="sr-only">추천을 불러오는 중이에요</span>
      </div>
    )
  }
  return (
    <ul className={styles.track} role="list" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <div className={variant === 'a' ? styles.photoCard : styles.compareCard}>
            {variant === 'a' ? <Skeleton className={styles.photo} /> : null}
            <div className={styles.cardBody}>
              <Skeleton shape="text" width="45%" />
              <Skeleton shape="text" width="90%" />
              <Skeleton shape="text" width="70%" />
              {variant === 'b' ? <Skeleton shape="text" width="80%" /> : null}
            </div>
          </div>
        </li>
      ))}
      <li className="sr-only">추천을 불러오는 중이에요</li>
    </ul>
  )
}
