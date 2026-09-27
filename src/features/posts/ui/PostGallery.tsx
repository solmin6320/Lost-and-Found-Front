import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cx } from '@/shared/lib/cx'
import { useSnapTrack } from '@/shared/lib/useSnapTrack'
import { ArrowsOut, CaretLeft, CaretRight } from '@/shared/ui/icons'

import type { PostCategory, PostImageResponse, PostType } from '../api/types'
import { PhotoViewer } from './PhotoViewer'
import styles from './PostGallery.module.css'
import { PostThumbnail } from './PostThumbnail'

interface PostGalleryProps {
  images: PostImageResponse[]
  /** 게시글 제목 — 사진의 `alt` 가 된다. "이미지" 라고 쓰지 않는다 */
  title: string
  /** 사진이 없을 때의 포스터 */
  type: PostType
  category: PostCategory
  seed: number
  className?: string
}

/**
 * 상세의 사진. 1:1 비율 상자 안에 **자르지 않고**(contain) 놓는다 — 목록 썸네일은 스캔용이라 잘랐지만,
 * 상세는 이름표 글씨 · 흠집처럼 "내 물건인가" 를 가릴 단서를 봐야 한다. 세로 사진이 와도 상자가 같아 아래가 밀리지 않는다.
 *
 * - 0장 : 목록과 같은 포스터(유형 색 바탕 + 칠한 카테고리 그림)
 * - 1장 : 누르면 크게 본다
 * - 2장 이상 : 손가락으로 넘긴다(스크롤 스냅). 아래 줄에 작은 사진 · 몇 번째인지 · 이전 / 다음.
 *   키보드는 사진에 머문 채 ← → · Home · End. Tab 은 사진 하나 → 이전 → 다음, 세 번이면 지나간다
 */
export function PostGallery({ images, title, type, category, seed, className }: PostGalleryProps) {
  if (images.length === 0) {
    return (
      <div className={cx(styles.gallery, className)}>
        <PostThumbnail className={styles.poster} category={category} type={type} alt="" seed={seed} />
      </div>
    )
  }
  return <PhotoGallery images={images} title={title} type={type} category={category} seed={seed} className={className} />
}

function PhotoGallery({ images, title, type, category, seed, className }: PostGalleryProps) {
  const count = images.length
  const [index, setIndex] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const { trackRef, scrollToIndex } = useSnapTrack(count, setIndex)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  function go(next: number, { focus = false, smooth = true } = {}) {
    const clamped = Math.min(Math.max(next, 0), count - 1)
    setIndex(clamped)
    scrollToIndex(clamped, smooth)
    if (focus) buttonRefs.current[clamped]?.focus({ preventScroll: true })
  }

  function handlePhotoKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: count - 1 }
    const next = moves[event.key]
    if (next === undefined || count < 2) return
    event.preventDefault()
    go(next, { focus: true })
  }

  function closeViewer() {
    setViewerOpen(false)
    // 크게 보며 넘긴 자리에서 이어 본다. 포커스도 그 사진으로
    go(index, { focus: true, smooth: false })
  }

  const many = count > 1

  return (
    <section
      className={cx(styles.gallery, className)}
      aria-roledescription={many ? '사진 넘겨 보기' : undefined}
      aria-label={`사진 ${count}장`}
    >
      <div className={styles.stage}>
        <ul ref={trackRef} className={styles.track} role="list">
          {images.map((image, i) => (
            <li key={image.id} className={styles.slide} data-index={i}>
              <button
                ref={(node) => {
                  buttonRefs.current[i] = node
                }}
                type="button"
                className={styles.photoButton}
                // 한 번에 하나만 Tab 에 걸린다. 나머지는 ← → 로 간다
                tabIndex={i === index ? 0 : -1}
                onClick={() => {
                  go(i, { smooth: false })
                  setViewerOpen(true)
                }}
                onKeyDown={handlePhotoKeyDown}
              >
                <DetailPhoto
                  src={image.url}
                  alt={many ? `${title} (사진 ${i + 1}/${count})` : title}
                  eager={i === 0}
                  type={type}
                  category={category}
                  seed={seed}
                />
                <span className="sr-only">, 크게 보기</span>
              </button>
            </li>
          ))}
        </ul>
        {/* 누르면 커진다는 표시. 조작이 아니라 표시라 누르는 면은 사진 전체다 */}
        <span className={styles.expand} aria-hidden="true">
          <ArrowsOut />
        </span>
      </div>

      {many ? (
        <div className={styles.controls}>
          {/* 작은 사진 — 손 · 마우스로 바로 가는 길. 키보드는 사진의 ← → 와 이전 / 다음이 맡아 Tab 에 걸지 않는다 */}
          <div className={styles.thumbs} aria-hidden="true">
            {images.map((image, i) => (
              <button
                key={image.id}
                type="button"
                tabIndex={-1}
                className={styles.thumb}
                aria-current={i === index || undefined}
                onClick={() => go(i)}
              >
                <img src={image.url} alt="" width={96} height={96} loading="lazy" decoding="async" />
              </button>
            ))}
          </div>

          <div className={styles.pager}>
            <PagerButton label="이전 사진" disabled={index === 0} onClick={() => go(index - 1)}>
              <CaretLeft />
            </PagerButton>
            <p className={styles.counter} aria-live="polite" aria-atomic="true">
              <span className="sr-only">사진 </span>
              <strong>{index + 1}</strong>
              <span aria-hidden="true"> / </span>
              <span className="sr-only">번째, 전체 </span>
              {count}
              <span className="sr-only">장</span>
            </p>
            <PagerButton label="다음 사진" disabled={index === count - 1} onClick={() => go(index + 1)}>
              <CaretRight />
            </PagerButton>
          </div>
        </div>
      ) : null}

      <PhotoViewer
        open={viewerOpen}
        images={images}
        title={title}
        index={index}
        onIndexChange={setIndex}
        onClose={closeViewer}
      />
    </section>
  )
}

interface PagerButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}

/**
 * 끝에 닿아도 `disabled` 로 만들지 않는다 — 누르던 버튼이 잠기면 포커스가 문서 맨 앞으로 빠진다.
 * `aria-disabled` 로 "더 없음" 만 알리고 누름은 무시한다
 */
function PagerButton({ label, disabled, onClick, children }: PagerButtonProps) {
  return (
    <button
      type="button"
      className={styles.pagerButton}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick()
      }}
    >
      {children}
    </button>
  )
}

interface DetailPhotoProps {
  src: string
  alt: string
  eager: boolean
  type: PostType
  category: PostCategory
  seed: number
}

/** 받는 동안은 옅은 면, 다 받으면 제자리에서 떠오른다. 주소가 깨졌으면 포스터로 바꾼다 */
function DetailPhoto({ src, alt, eager, type, category, seed }: DetailPhotoProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <PostThumbnail className={styles.fallback} category={category} type={type} alt="" seed={seed} />
  }

  return (
    <>
      {/* 남는 칸을 같은 사진을 흐리게 깔아 채운다 — 가로 사진 위아래 · 세로 사진 양옆이 빈 회색 띠로 남지 않게.
          같은 주소라 한 번만 받는다. 뜻이 없는 배경이라 읽지 않는다 */}
      <img className={styles.backdrop} data-loaded={loaded || undefined} src={src} alt="" aria-hidden="true" decoding="async" loading={eager ? 'eager' : 'lazy'} />
      <img
      ref={(img) => {
        if (img?.complete && img.naturalWidth > 0 && !loaded) setLoaded(true)
      }}
      className={styles.photo}
      data-loaded={loaded || undefined}
      src={src}
      alt={alt}
      width={800}
      height={800}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      />
    </>
  )
}
