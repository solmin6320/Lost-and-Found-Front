import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'

import type { PostListResponse } from '@/features/posts'
import { cx } from '@/shared/lib/cx'
import { Button } from '@/shared/ui/Button'
import { ErrorState } from '@/shared/ui/ErrorState'
import { ArrowsOut, MapTrifold, SquaresFour, X } from '@/shared/ui/icons'
import { LoadingDots } from '@/shared/ui/LoadingDots'
import { Skeleton } from '@/shared/ui/Skeleton'

import type { LabState, LabVariant } from '../labSwitch'
import { LAB_ERROR_MESSAGE } from '../useLabResource'
import { pointOf, type MapPoint } from './coords'
import { LeafletMap } from './LeafletMap'
import { MapPostCard } from './MapPostCard'
import styles from './NearbyMap.module.css'

interface NearbyMapProps {
  variant: LabVariant
  state?: LabState
  posts: readonly PostListResponse[] | undefined
  /** 원래 목록(사진 피드 · 빈 상태 · 오류) */
  children: ReactNode
}

/**
 * (나) 주변 분실물 지도 — 결과 제목 아래 목록 자리. 위치는 목 데이터(`coords.ts`), 나중에 `POST.latitude · longitude`.
 *   a 사진 ↔ 지도 전환 : 결과 줄 아래 두 칸 전환. 지도를 고르면 피드 자리를 지도가 대신한다. 핀 = 둥근 점 + 한 글자
 *   b 나란히 : 넓은 화면은 목록 오른쪽에 붙어 따라오는 지도, 카드에 올리면 그 핀이 커진다. 휴대폰은 위에 작은 미리보기 → 누르면 지도 화면
 *   c 지도 띠 + 지역으로 좁히기 : 목록 위 넓은 지도, "지도 안 글만 보기"를 켜면 목록이 지도 안 글로 줄어든다. 핀 = 지시대로 빨강 · 파랑 물방울
 */
export function NearbyMap({ variant, state, posts, children }: NearbyMapProps) {
  const points = useMemo(() => (state === 'empty' ? [] : (posts ?? []).map(pointOf).filter((p): p is MapPoint => p !== null)), [posts, state])
  const loading = state === 'loading' || posts === undefined
  const failed = state === 'error'
  const common = { points, loading, failed, children }
  if (variant === 'a') return <ToggleMap {...common} />
  if (variant === 'b') return <SplitMap {...common} />
  return <BandMap {...common} />
}

interface VariantProps {
  points: MapPoint[]
  loading: boolean
  failed: boolean
  children: ReactNode
}

/** 지도 자리의 로딩 · 오류 · 빈 상태 — 지도 틀과 같은 크기 */
function MapStates({ loading, failed, empty, className, onRetry, compact }: { loading: boolean; failed: boolean; empty: boolean; className?: string; onRetry?: () => void; compact?: boolean }) {
  if (loading) {
    return (
      <div className={cx(styles.mapBox, styles.mapSkeleton, className)} aria-busy="true">
        <Skeleton className={styles.mapSkeletonFill} />
        <span className={styles.mapSkeletonDots}>
          <LoadingDots label="지도를 불러오는 중" />
        </span>
      </div>
    )
  }
  if (failed && compact) {
    // 작은 미리보기 자리 — 큰 오류 판 대신 한 줄 + [다시 시도]
    return (
      <p className={styles.mapEmpty}>
        <MapTrifold />
        <span>
          <strong>지도를 불러오지 못했어요.</strong> {LAB_ERROR_MESSAGE}
        </span>
        <Button size="sm" onClick={onRetry ?? (() => undefined)}>
          다시 시도
        </Button>
      </p>
    )
  }
  if (failed) {
    return (
      <div className={cx(styles.mapBox, styles.mapState, className)}>
        <ErrorState titleAs="h3" message={LAB_ERROR_MESSAGE} onRetry={onRetry ?? (() => undefined)} />
      </div>
    )
  }
  if (empty) {
    return (
      <p className={styles.mapEmpty}>
        <MapTrifold />
        <span>
          <strong>지도에 올릴 글이 없어요.</strong> 위치를 찍은 글이 생기면 여기에 보여요.
        </span>
      </p>
    )
  }
  return null
}

/* ── a 사진 ↔ 지도 전환 ── */

function ToggleMap({ points, loading, failed, children }: VariantProps) {
  const [mode, setMode] = useState<'feed' | 'map'>('map')
  const [picked, setPicked] = useState<number | null>(null)
  const pickedPost = points.find((p) => p.id === picked)?.post

  return (
    <div className={styles.toggleWrap}>
      <div className={styles.viewSwitch} role="group" aria-label="보기 방식">
        <button type="button" aria-pressed={mode === 'feed'} onClick={() => setMode('feed')}>
          <SquaresFour />
          사진으로
        </button>
        <button type="button" aria-pressed={mode === 'map'} onClick={() => setMode('map')}>
          <MapTrifold />
          지도로
        </button>
      </div>
      {mode === 'feed' ? (
        children
      ) : loading || failed ? (
        <MapStates loading={loading} failed={failed} empty={false} className={styles.toggleMap} />
      ) : (
        <>
          <LeafletMap className={styles.toggleMap} points={points} look="dot" label="글 위치 지도" selectedId={picked} onSelect={setPicked}>
            {pickedPost ? <MapPostCard post={pickedPost} onClose={() => setPicked(null)} /> : null}
          </LeafletMap>
          {points.length === 0 ? <MapStates loading={false} failed={false} empty /> : <p className={styles.mapNote}>위치를 찍은 글 {points.length}건이 지도에 있어요. 핀을 누르면 글이 떠요.</p>}
        </>
      )}
    </div>
  )
}

/* ── b 나란히 ── */

function SplitMap({ points, loading, failed, children }: VariantProps) {
  const [highlight, setHighlight] = useState<number | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [full, setFull] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const pickedPost = points.find((p) => p.id === picked)?.post
  const titleId = useId()

  // 지도에서 고른 글의 카드를 목록에서도 표시(넓은 화면)
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    for (const li of list.querySelectorAll<HTMLElement>('[data-post-id]')) {
      if (Number(li.dataset.postId) === picked) li.dataset.labPicked = ''
      else delete li.dataset.labPicked
    }
  }, [picked])

  const hoverCard = (target: EventTarget) => {
    const li = (target as Element).closest<HTMLElement>('[data-post-id]')
    setHighlight(li ? Number(li.dataset.postId) : null)
  }

  return (
    <div className={styles.split}>
      <div className={styles.splitGrid}>
      <div ref={listRef} className={styles.splitList} onMouseOver={(e) => hoverCard(e.target)} onMouseLeave={() => setHighlight(null)} onFocus={(e) => hoverCard(e.target)}>
        {/* 휴대폰 · 좁은 칸 : 목록 위 작은 미리보기. 움직이지 않고, 누르면 지도 화면 */}
        <div className={styles.splitPreview}>
          {loading || failed ? (
            <MapStates loading={loading} failed={failed} empty={false} className={styles.previewMap} compact />
          ) : points.length === 0 ? (
            <MapStates loading={false} failed={false} empty />
          ) : (
            <button type="button" className={styles.previewButton} onClick={() => setFull(true)} aria-haspopup="dialog">
              <LeafletMap className={styles.previewMap} points={points} look="tag" label="글 위치 미리보기" interactive={false} />
              <span className={styles.previewLabel}>
                <ArrowsOut />
                지도 크게 보기 · {points.length}건
              </span>
            </button>
          )}
        </div>
        {children}
      </div>
      {/* 넓은 칸 : 오른쪽에 붙어 따라오는 지도 */}
      <aside className={styles.splitMap} aria-label="글 위치 지도">
        {loading || failed ? (
          <MapStates loading={loading} failed={failed} empty={false} className={styles.sideMap} />
        ) : (
          <LeafletMap className={styles.sideMap} points={points} look="tag" label="글 위치 지도" selectedId={picked} highlightId={highlight} onSelect={setPicked}>
            {pickedPost ? <MapPostCard post={pickedPost} onClose={() => setPicked(null)} /> : null}
            {points.length === 0 ? (
              <div className={styles.overlayNote}>
                <MapStates loading={false} failed={false} empty />
              </div>
            ) : null}
          </LeafletMap>
        )}
      </aside>
      </div>
      {full ? (
        <div className={styles.fullMap} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={(e) => e.key === 'Escape' && setFull(false)}>
          <div className={styles.fullHead}>
            <h2 id={titleId} className={styles.fullTitle}>
              지도에서 보기 <span>{points.length}건</span>
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setFull(false)} autoFocus>
              <X />
              목록으로
            </Button>
          </div>
          <LeafletMap className={styles.fullMapBody} points={points} look="tag" label="글 위치 지도" selectedId={picked} onSelect={setPicked}>
            {pickedPost ? <MapPostCard post={pickedPost} onClose={() => setPicked(null)} /> : null}
          </LeafletMap>
        </div>
      ) : null}
    </div>
  )
}

/* ── c 지도 띠 + 지역으로 좁히기 ── */

function BandMap({ points, loading, failed, children }: VariantProps) {
  const [picked, setPicked] = useState<number | null>(null)
  const [onlyInside, setOnlyInside] = useState(false)
  const [visible, setVisible] = useState<number[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const pickedPost = points.find((p) => p.id === picked)?.post
  const switchId = useId()

  const onView = (ids: number[]) => setVisible((prev) => (prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids))

  // 시안 — 지도 밖 카드를 숨긴다(실제로는 지도 범위를 API 조건으로 보낸다 : `?bbox=` 또는 `?lat&lng&radius`)
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    for (const li of list.querySelectorAll<HTMLElement>('[data-post-id]')) {
      li.hidden = onlyInside && !visible.includes(Number(li.dataset.postId))
    }
  }, [onlyInside, visible])

  return (
    <div className={styles.band}>
      {loading || failed ? (
        <MapStates loading={loading} failed={failed} empty={false} className={styles.bandMap} />
      ) : (
        <LeafletMap className={styles.bandMap} points={points} look="signal" label="글 위치 지도" selectedId={picked} onSelect={setPicked} onViewChange={onView}>
          {pickedPost ? <MapPostCard post={pickedPost} onClose={() => setPicked(null)} /> : null}
          {points.length === 0 ? (
            <div className={styles.overlayNote}>
              <MapStates loading={false} failed={false} empty />
            </div>
          ) : null}
        </LeafletMap>
      )}
      <div className={styles.bandBar}>
        <label className={styles.onlyInside} htmlFor={switchId}>
          <input id={switchId} type="checkbox" role="switch" checked={onlyInside} onChange={(e) => setOnlyInside(e.target.checked)} disabled={loading || failed || points.length === 0} />
          <span className={styles.switchTrack} aria-hidden="true" />
          지도 안 글만 보기
        </label>
        <p className={styles.bandCount} aria-live="polite">
          {loading ? '' : `지도 안 ${visible.length}건`}
        </p>
      </div>
      <div ref={listRef}>{children}</div>
    </div>
  )
}
