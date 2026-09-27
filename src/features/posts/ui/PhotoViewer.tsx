import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'

import { trapTab } from '@/shared/lib/focusTrap'
import { useSnapTrack } from '@/shared/lib/useSnapTrack'
import { CaretLeft, CaretRight, X } from '@/shared/ui/icons'

import type { PostImageResponse } from '../api/types'
import styles from './PhotoViewer.module.css'

interface PhotoViewerProps {
  open: boolean
  images: PostImageResponse[]
  title: string
  /** 지금 보는 장. 상세의 사진 줄과 같은 값을 나눠 쓴다 — 닫으면 넘긴 자리에서 이어 본다 */
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

/**
 * 사진 크게 보기 — 화면 전체를 어두운 바탕으로 덮고 사진을 자르지 않고 가장 크게 놓는다.
 * 네이티브 `<dialog>` 의 `showModal()` 이라 뒤가 inert 가 되어 포커스가 갇히고 Esc 로 닫힌다.
 * 열리면 [닫기]에 포커스. ← → 로 넘기고, 손가락으로도 넘긴다(스크롤 스냅).
 * 닫은 뒤의 포커스는 부른 쪽(사진 줄)이 지금 장의 사진으로 옮긴다.
 */
export function PhotoViewer({ open, images, title, index, onIndexChange, onClose }: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  // 열 때의 장. 열린 뒤에는 이 화면이 스스로 넘기므로 효과가 index 를 따라 다시 돌지 않게 한다
  const indexRef = useRef(index)
  const count = images.length
  const { trackRef, scrollToIndex } = useSnapTrack(count, onIndexChange)

  // 아래 여는 효과보다 먼저 돈다(같은 커밋의 레이아웃 효과는 선언 순서대로)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
    indexRef.current = index
  })

  // 열리는 순간, 그리기 전에 지금 장으로 옮겨 둔다. 첫 장에서 미끄러져 오지 않게
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      scrollToIndex(indexRef.current, false)
      closeRef.current?.focus()
      document.documentElement.style.overflow = 'hidden'
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, scrollToIndex])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function handleClose() {
      document.documentElement.style.overflow = ''
      onCloseRef.current()
    }
    dialog.addEventListener('close', handleClose)
    return () => {
      dialog.removeEventListener('close', handleClose)
      document.documentElement.style.overflow = ''
    }
  }, [])

  function go(next: number) {
    const clamped = Math.min(Math.max(next, 0), count - 1)
    onIndexChange(clamped)
    scrollToIndex(clamped, true)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    trapTab(event, event.currentTarget)
    const moves: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: count - 1 }
    const next = moves[event.key]
    if (next === undefined || count < 2) return
    event.preventDefault()
    go(next)
  }

  const many = count > 1

  return (
    <dialog ref={dialogRef} className={styles.viewer} aria-label={`${title} 사진 크게 보기`} onKeyDown={handleKeyDown}>
      <div className={styles.bar}>
        {many ? (
          <p className={styles.counter} aria-live="polite" aria-atomic="true">
            <span className="sr-only">사진 </span>
            <strong>{index + 1}</strong>
            <span aria-hidden="true"> / </span>
            <span className="sr-only">번째, 전체 </span>
            {count}
            <span className="sr-only">장</span>
          </p>
        ) : (
          <span />
        )}
        <button ref={closeRef} type="button" className={styles.close} onClick={() => dialogRef.current?.close()}>
          <X />
          <span>닫기</span>
        </button>
      </div>

      <ul ref={trackRef} className={styles.track} role="list">
        {images.map((image, i) => (
          <li key={image.id} className={styles.slide} data-index={i}>
            <img
              className={styles.photo}
              src={image.url}
              alt={many ? `${title} (사진 ${i + 1}/${count})` : title}
              decoding="async"
              // 열기 전에는 받지 않는다. 열면 지금 장과 이웃만 먼저 받는다
              loading={open && Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
            />
          </li>
        ))}
      </ul>

      {many ? (
        <>
          <button
            type="button"
            className={styles.nav}
            data-side="prev"
            aria-label="이전 사진"
            aria-disabled={index === 0 || undefined}
            onClick={() => go(index - 1)}
          >
            <CaretLeft />
          </button>
          <button
            type="button"
            className={styles.nav}
            data-side="next"
            aria-label="다음 사진"
            aria-disabled={index === count - 1 || undefined}
            onClick={() => go(index + 1)}
          >
            <CaretRight />
          </button>
        </>
      ) : null}
    </dialog>
  )
}
