import { useQuery } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'

import { PostThumbnail, type PostDetailResponse } from '@/features/posts'
import { formatDate } from '@/shared/lib/date'
import { getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { ArrowSquareOut, Buildings, Check, MapPin, WarningCircle } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { PublicMatchResponse } from '../api/publicMatchTypes'
import { PUBLIC_MATCH_STALE_CODES, useDismissPublicMatch } from '../model/publicMatchMutations'
import { publicMatchesQueryOptions } from '../model/publicMatchQueries'
import {
  PUBLIC_DISMISS,
  PUBLIC_MATCHES_ANCHOR_ID,
  PUBLIC_MATCHES_COPY,
  PUBLIC_PORTAL,
  nextFocusPublicItem,
  publicItemDetail,
  publicItemPhoto,
  publicMatchReasons,
  publicSourceLabel,
} from '../model/publicMatchView'
import styles from './PublicMatchCandidates.module.css'

interface PublicMatchCandidatesProps {
  /** 글쓴이의 **게시중 분실** 글. 부른 쪽이 `showsPublicMatches` 로 판정한다 — 습득 글 · 남의 글 · 비로그인에는 그리지 않는다 */
  post: PostDetailResponse
}

/** 받기 전 카드 수 — 우리 사이트 추천 묶음과 같다(넓은 칸에서도 셋째 카드가 끝에 걸린다) */
const SKELETON_CARDS = 3

/**
 * SCR-11 확장 · 공공 습득물 후보 — 내 분실 글 상세에서 우리 사이트 추천 묶음(`#matches`) 바로 아래. 글쓴이에게만.
 *
 * - 카드 = 추천 카드와 같은 말 : 1:1 그림 자리 + 왼쪽 위 이름표(`경찰서 보관` · `기관 보관`) + 물품명 2줄 + 색상 · 원문 분류명 +
 *   맞은 이유(`%` 없이 말로) + 보관 장소(자르지 않음) · 습득일 + `출처: 경찰청`.
 * - **카드는 링크가 아니다** — 우리 사이트의 글이 아니라 열 상세가 없고, 경찰민원24 습득물 한 건의 상세 주소는 확인하지 못했다.
 *   그래서 Tab 은 카드마다 `[내 물건 아니에요]` 하나에만 닿는다. 경찰민원24 홈 링크는 묶음 머리에 **한 번만**(새 창)
 * - 사진은 경찰민원24 출처만 그린다(`publicItemPhoto` — CSP `img-src` 와 같은 출처 하나). 없음 · `no_img` 자리표시 · 다른 출처 · 받기 실패는
 *   카테고리 포스터. 종류는 내 글과 같다(서버가 같은 종류만 고른다)
 * - `[내 물건 아니에요]` — 되돌리는 API 가 없어 확인 창(1.6). 숨긴 뒤 포커스는 다음 카드 이름(없으면 앞 카드, 하나뿐이면 머리)
 * - 네 상태 : 로딩(같은 틀 스켈레톤) · 빈(한 줄로 접은 문장 둘) · 오류(**그리지 않는다** — 덤 요소) · 권한(부른 쪽)
 */
export function PublicMatchCandidates({ post }: PublicMatchCandidatesProps) {
  const items = useQuery(publicMatchesQueryOptions(post.id))
  const dismiss = useDismissPublicMatch(post.id)
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const [target, setTarget] = useState<PublicMatchResponse | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // 숨긴 뒤 포커스를 둘 카드 — 확인 창이 닫히며 연 단추(사라진 카드)로 못 돌아갈 때 이것을 찾는다
  const focusAfter = useRef<number | null>(null)

  // 덤 요소의 실패는 그리지 않는다(디자인품질기준 "덤 요소의 실패"). 받은 것이 있으면 그것을 그대로 둔다
  if (items.isError && !items.data) return null

  const list = items.data ?? []
  const loading = items.isPending
  const empty = !loading && list.length === 0

  function ask(item: PublicMatchResponse) {
    if (dismiss.isPending) return
    setDialogError(null)
    setTarget(item)
  }

  function submit() {
    if (!target) return
    const removed = target
    setDialogError(null)
    setNotice(null)
    setAnnouncement('')
    focusAfter.current = nextFocusPublicItem(list, removed.itemId)
    dismiss.mutate(removed.itemId, {
      onSuccess: () => {
        setTarget(null)
        setAnnouncement(PUBLIC_DISMISS.done)
      },
      onError: (error) => {
        // 그사이 후보가 사라졌다(지워짐 · 다른 탭에서 숨김 · 내 글이 아니게 됨) — 창을 닫고 묶음 위에 서버 문장. 훅이 다시 받는다
        if (PUBLIC_MATCH_STALE_CODES.some((code) => hasErrorCode(error, code))) {
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
    const name = id === null ? null : trackRef.current?.querySelector<HTMLElement>(`[data-public-item="${id}"]`)
    return name ?? headingRef.current
  }

  return (
    <section
      id={PUBLIC_MATCHES_ANCHOR_ID}
      className={styles.panel}
      aria-labelledby={headingId}
      aria-busy={loading || undefined}
      data-empty={empty || undefined}
    >
      <div className={styles.head}>
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className={styles.heading} data-public-matches-heading>
          {empty ? (
            PUBLIC_MATCHES_COPY.emptyTitle
          ) : (
            <>
              {PUBLIC_MATCHES_COPY.heading}
              {loading ? null : (
                <span className={styles.count}>
                  {' '}
                  {list.length.toLocaleString('ko-KR')}건
                </span>
              )}
            </>
          )}
        </h2>
        <p className={styles.lead}>{empty ? PUBLIC_MATCHES_COPY.emptyDescription : PUBLIC_MATCHES_COPY.lead}</p>
        {/* 경찰민원24 — 묶음에 한 번만(카드는 링크가 아니다). 상세 경로를 확인하지 못해 홈 주소. 새 창 · 우리 주소를 넘기지 않는다 */}
        <a className={styles.portal} href={PUBLIC_PORTAL.href} target="_blank" rel="noopener noreferrer">
          {PUBLIC_PORTAL.label}
          <ArrowSquareOut className={styles.portalIcon} />
          <span className="sr-only">{PUBLIC_PORTAL.newWindow}</span>
        </a>
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
              <PublicItemSkeleton />
            </li>
          ))}
        </ul>
      ) : empty ? null : (
        <ul ref={trackRef} className={styles.track} role="list">
          {list.map((item) => (
            <li key={item.itemId}>
              <PublicItemCard item={item} post={post} busy={dismiss.isPending} onDismiss={ask} />
            </li>
          ))}
        </ul>
      )}
      {loading ? <span className="sr-only">{PUBLIC_MATCHES_COPY.loading}</span> : null}

      <p className="sr-only" role="status">
        {announcement}
      </p>

      <ConfirmDialog
        open={target !== null}
        title={PUBLIC_DISMISS.title}
        confirmLabel={PUBLIC_DISMISS.confirm}
        pendingLabel={PUBLIC_DISMISS.pending}
        pending={dismiss.isPending}
        error={target ? dialogError : null}
        onConfirm={submit}
        onClose={() => setTarget(null)}
        fallbackFocus={focusTarget}
      >
        {target ? (
          <p>
            {/* 어느 물건인지 — 공공 데이터 원문은 글자로만(보안명세서 · XSS) */}
            <bdi className={styles.dialogTitle}>「{target.itemName}」</bdi> {PUBLIC_DISMISS.body}
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  )
}

interface PublicItemCardProps {
  item: PublicMatchResponse
  /** 내 분실 글 — 포스터 그림(종류)을 여기서 받는다. 공공 후보는 서버가 같은 종류만 고른다 */
  post: PostDetailResponse
  busy: boolean
  onDismiss: (item: PublicMatchResponse) => void
}

/**
 * 공공 후보 카드 한 장. 문서 순서는 물품명 → 이름표 → 맞은 이유 → 보관 장소 · 습득일 → 출처 → 숨기기(그림은 CSS `order` 로 위에) —
 * 스크린리더가 물품명부터 읽는다(추천 카드와 같은 규칙). 링크가 없어 덮개도 없다
 */
function PublicItemCard({ item, post, busy, onDismiss }: PublicItemCardProps) {
  const titleId = useId()
  const reasons = publicMatchReasons(item)
  const detail = publicItemDetail(item)
  // 경찰민원24 사진만(`no_img` 자리표시 · 다른 출처 · 없음은 포스터). 받다가 실패하면 `PostThumbnail` 이 포스터로 바꾼다
  const photo = publicItemPhoto(item)

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.body}>
        <div className={styles.naming}>
          <h3 id={titleId} tabIndex={-1} className={styles.title} data-public-item={item.itemId}>
            <span className={styles.titleText}>{item.itemName}</span>
          </h3>
          {detail ? <p className={styles.detail}>{detail}</p> : null}
        </div>

        <p className={styles.flags}>
          <span className={styles.source} data-source={item.source}>
            <Buildings className={styles.sourceIcon} />
            {publicSourceLabel(item.source)}
          </span>
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
              <span className="sr-only">보관 장소</span>
            </dt>
            <dd data-missing={item.storagePlace?.trim() ? undefined : true}>
              {item.storagePlace?.trim() || PUBLIC_MATCHES_COPY.noPlace}
            </dd>
          </div>
          <div className={styles.date}>
            <dt>습득일</dt>
            <dd>
              <time dateTime={item.foundDate}>{formatDate(item.foundDate)}</time>
            </dd>
          </div>
        </dl>

        <p className={styles.credit}>{PUBLIC_MATCHES_COPY.credit}</p>
      </div>

      <div className={styles.media}>
        <PostThumbnail
          className={styles.visual}
          category={post.category}
          type="FOUND"
          src={photo ?? undefined}
          alt=""
          seed={item.itemId}
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
          onClick={() => !busy && onDismiss(item)}
        >
          {PUBLIC_DISMISS.label}
        </Button>
      </div>
    </article>
  )
}

/** 받기 전 카드 — 받은 카드와 같은 칸(같은 최소 높이)에 자리만 둔다. 받는 순간 아래 본문이 밀리지 않게 */
function PublicItemSkeleton() {
  return (
    <div className={`${styles.card} ${styles.skeletonCard}`}>
      <div className={styles.body}>
        <div className={styles.naming}>
          <div className={styles.title}>
            <Skeleton shape="text" width="88%" />
          </div>
          <div className={styles.detail}>
            <Skeleton shape="text" width="70%" />
          </div>
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
        <div className={styles.credit}>
          <Skeleton shape="text" width="45%" />
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
