import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'

import { useObjectUrls } from '@/shared/lib/image'
import { useMediaQuery } from '@/shared/lib/useMediaQuery'
import { Button } from '@/shared/ui/Button'
import { ArrowUUpLeft, Camera, CaretLeft, CaretRight, Plus, Trash, WarningCircle, X } from '@/shared/ui/icons'

import type { PostImageResponse } from '../api/types'
import { POST_IMAGE_ACCEPT, POST_IMAGE_MAX_COUNT, POST_IMAGE_MESSAGES, checkPostImageFile } from '../model/postImages'
import styles from './PostPhotoField.module.css'

/** 새로 고른 사진 한 장. `key` 는 순서를 바꿔도 같은 칸을 가리키게 하는 번호다 */
export interface PhotoItem {
  key: number
  file: File
}

let nextKey = 1

/** 파일을 사진 칸으로 */
function toPhotoItems(files: readonly File[]): PhotoItem[] {
  return files.map((file) => ({ key: nextKey++, file }))
}

interface PostPhotoFieldProps {
  items: readonly PhotoItem[]
  onItemsChange: (items: PhotoItem[]) => void
  /** 수정 화면의 지금 사진. 등록은 빈 배열 */
  existing?: readonly PostImageResponse[]
  /** 수정 — 기존 사진을 전부 지우기로 했나(`removeImages`). 저장 전까지 되돌릴 수 있다 */
  removeExisting?: boolean
  onRemoveExistingChange?: (remove: boolean) => void
  /** 기존 사진의 대체 글(글 제목) */
  title: string
  /** 제출 중 — 고르기 · 순서 · 빼기를 막는다(보내는 사진과 화면이 어긋나지 않게) */
  readOnly?: boolean
  /** 제출 때 막힌 이유(줄여도 너무 큼 · 서버가 거절). 사진을 바꾸면 부른 쪽이 지운다 */
  error?: string
  /** 이어 쓰기로 되살렸지만 보관하지 못한 사진 수. 새로 고르면 부른 쪽이 0 으로 */
  lostCount?: number
}

/** 고른 파일 가운데 넣지 못한 것 */
interface Notice {
  id: number
  name?: string
  message: string
}

let nextNoticeId = 1

/**
 * 사진(선택, 최대 5장) — 등록과 수정이 같이 쓴다.
 *
 * **등록** : 고르기 → 미리보기 격자. 한 장씩 빼기 · 순서 바꾸기(← → 버튼, 키보드 가능). 첫 장이 목록의 대표 사진이다.
 * 넓은 화면 마우스에서는 끌어서 순서를 바꾸고, 파일을 끌어다 놓아도 된다(버튼은 그대로 있다 — 끌기만 되는 조작은 두지 않는다).
 *
 * **수정** : 서버는 "그대로 · 전부 교체 · 전부 삭제" 셋만 안다(`PostImageChange`). 한 장만 빼거나 더할 수 없다.
 *   - 그대로(keep)  : 지금 사진을 보여 주고, 결과를 **누르기 전에** 한 줄로 알린다 —
 *                     "새 사진을 올리면 기존 사진 N장이 모두 교체됩니다. 그대로 두려면 선택하지 마세요."
 *   - 교체(replace) : 새 사진을 고르면 된다. "저장하면 기존 사진 N장 대신 이 사진 M장이 올라가요." + [기존 사진 유지]
 *   - 삭제(remove)  : [사진 전부 삭제]. 저장 전까지는 [기존 사진 유지]로 돌아간다. 되돌릴 수 있으니 다이얼로그 없이 인라인
 *
 * 6장째는 고르는 순간 막는다 — 들어갈 수 있는 만큼만 넣고, 몇 장을 넣지 않았는지 알린다. 확장자 · 크기가 맞지 않는
 * 파일, 브라우저가 읽지 못하는 파일도 그 파일만 거르고 이름과 이유를 알린다. 서버까지 보내고 400 을 받지 않는다.
 */
export function PostPhotoField({
  items,
  onItemsChange,
  existing = [],
  removeExisting = false,
  onRemoveExistingChange,
  title,
  readOnly = false,
  error,
  lostCount = 0,
}: PostPhotoFieldProps) {
  const id = useId()
  const labelId = `${id}-label`
  const errorId = `${id}-error`
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const [live, setLive] = useState('')
  const [dragKey, setDragKey] = useState<number | null>(null)
  const [overKey, setOverKey] = useState<number | null>(null)
  const [fileOver, setFileOver] = useState(false)
  // 넓은 화면 · 마우스에서만 끌어다 놓기. 휴대폰에서는 끌기가 스크롤과 싸운다
  const canDrag = useMediaQuery('(hover: hover) and (pointer: fine) and (min-width: 48rem)')

  // 칸 목록이 바뀔 때만 새 배열 — 미리보기 주소는 파일마다 하나라 순서를 바꿔도 다시 만들지 않는다
  const files = useMemo(() => items.map((item) => item.file), [items])
  const previews = useObjectUrls(files)

  // 칸이 사라지거나 옮겨진 뒤 포커스를 둘 곳. 그리기 전에는 요소가 없다
  const focusAfter = useRef<string | null>(null)
  useEffect(() => {
    const selector = focusAfter.current
    if (!selector) return
    focusAfter.current = null
    rootRef.current?.querySelector<HTMLElement>(selector)?.focus()
  })

  // 사진이 읽히지 않을 때(onError)는 그린 뒤에 불린다. 여러 장이 한꺼번에 실패해도 서로를 되살리지 않게 최신 목록을 본다
  const latestItems = useRef(items)
  useEffect(() => {
    latestItems.current = items
  })

  const mode: 'empty' | 'existing' | 'remove' | 'new' =
    items.length > 0 ? 'new' : existing.length > 0 ? (removeExisting ? 'remove' : 'existing') : 'empty'
  const room = POST_IMAGE_MAX_COUNT - items.length

  function openPicker() {
    if (readOnly) return
    inputRef.current?.click()
  }

  function addFiles(picked: readonly File[]) {
    if (readOnly || picked.length === 0) return
    const added: File[] = []
    const next: Notice[] = []
    let overflow = 0

    for (const file of picked) {
      if (items.some((item) => sameFile(item.file, file)) || added.some((other) => sameFile(other, file))) {
        next.push({ id: nextNoticeId++, name: file.name, message: '이미 고른 사진이에요' })
        continue
      }
      const problem = checkPostImageFile(file)
      if (problem) {
        next.push({ id: nextNoticeId++, name: file.name, message: problem })
        continue
      }
      if (added.length >= room) {
        overflow += 1
        continue
      }
      added.push(file)
    }

    if (overflow > 0) {
      next.unshift({
        id: nextNoticeId++,
        message: `사진은 ${POST_IMAGE_MAX_COUNT}장까지예요. ${overflow}장은 넣지 않았어요.`,
      })
    }
    setNotices(next)
    if (added.length > 0) {
      const nextItems = [...items, ...toPhotoItems(added)]
      onItemsChange(nextItems)
      setLive(`사진 ${added.length}장을 넣었어요. 모두 ${nextItems.length}장이에요.`)
      // 5장이 차서 [사진 추가]가 사라지면 마지막 사진의 빼기 버튼으로
      focusAfter.current =
        nextItems.length >= POST_IMAGE_MAX_COUNT ? `[data-key="${nextItems[nextItems.length - 1].key}"] [data-action="remove"]` : '[data-action="add"]'
    }
  }

  function move(index: number, delta: -1 | 1, focusAction: string | null) {
    const target = index + delta
    if (readOnly || target < 0 || target >= items.length) return
    const nextItems = [...items]
    const [moved] = nextItems.splice(index, 1)
    nextItems.splice(target, 0, moved)
    onItemsChange(nextItems)
    setNotices([])
    setLive(target === 0 ? '옮긴 사진이 첫 장이 됐어요. 이제 대표 사진이에요.' : `사진을 ${target + 1}번째로 옮겼어요.`)
    // 옮긴 사진을 계속 따라간다 — 같은 버튼을 한 번 더 누르면 한 칸 더 간다
    if (focusAction) focusAfter.current = `[data-key="${moved.key}"] [data-action="${focusAction}"]`
  }

  function remove(key: number, reason?: Notice) {
    if (readOnly && !reason) return
    const current = latestItems.current
    const index = current.findIndex((item) => item.key === key)
    if (index < 0) return
    const nextItems = current.filter((item) => item.key !== key)
    latestItems.current = nextItems
    onItemsChange(nextItems)
    if (reason) {
      // 방금 고른 묶음의 다른 알림(확장자 · 개수)을 지우지 않고 덧붙인다
      setNotices((prev) => [...prev, reason])
      setLive(`${reason.name ?? '사진'}: ${reason.message}`)
      return
    }
    setNotices([])
    setLive(nextItems.length === 0 ? '고른 사진을 모두 뺐어요.' : `사진을 뺐어요. ${nextItems.length}장 남았어요.`)
    const neighbour = nextItems[index] ?? nextItems[index - 1]
    focusAfter.current = neighbour ? `[data-key="${neighbour.key}"] [data-action="remove"]` : '[data-action="pick"]'
  }

  function keepExisting() {
    if (readOnly) return
    onItemsChange([])
    onRemoveExistingChange?.(false)
    setNotices([])
    setLive(`기존 사진 ${existing.length}장을 그대로 둬요.`)
    focusAfter.current = '[data-action="remove-all"]'
  }

  function removeAll() {
    if (readOnly) return
    onRemoveExistingChange?.(true)
    setNotices([])
    setLive(`저장하면 기존 사진 ${existing.length}장이 모두 지워져요.`)
    focusAfter.current = '[data-action="keep"]'
  }

  /* ── 끌어다 놓기(넓은 화면 · 마우스) ── */

  function handleZoneDragOver(event: DragEvent) {
    if (!canDrag || readOnly || !event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setFileOver(true)
  }

  function handleZoneDragLeave(event: DragEvent) {
    const next = event.relatedTarget
    if (!(next instanceof Node) || !event.currentTarget.contains(next)) setFileOver(false)
  }

  function handleZoneDrop(event: DragEvent) {
    if (!canDrag || readOnly || !event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    setFileOver(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  function handleTileDrop(event: DragEvent, index: number) {
    if (dragKey === null) return
    event.preventDefault()
    event.stopPropagation()
    const from = items.findIndex((item) => item.key === dragKey)
    setDragKey(null)
    setOverKey(null)
    if (from < 0 || from === index) return
    const nextItems = [...items]
    const [moved] = nextItems.splice(from, 1)
    nextItems.splice(index, 0, moved)
    onItemsChange(nextItems)
    setNotices([])
    setLive(index === 0 ? '첫 장으로 옮겼어요. 이제 대표 사진이에요.' : `사진을 ${index + 1}번째로 옮겼어요.`)
  }

  const count =
    mode === 'new' || mode === 'empty'
      ? `${items.length}/${POST_IMAGE_MAX_COUNT}`
      : mode === 'existing'
        ? `지금 ${existing.length}장`
        : null

  return (
    <div
      ref={rootRef}
      className={styles.field}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={error ? errorId : undefined}
      data-file-over={fileOver || undefined}
      onDragOver={handleZoneDragOver}
      onDragLeave={handleZoneDragLeave}
      onDrop={handleZoneDrop}
    >
      <div className={styles.labelRow}>
        <p id={labelId} className={styles.label}>
          사진 <span className={styles.optional}>선택</span>
        </p>
        {count ? (
          <span className={styles.count} data-numeric>
            {count}
          </span>
        ) : null}
      </div>

      {mode === 'empty' ? (
        <button type="button" className={styles.zone} data-action="pick" aria-disabled={readOnly || undefined} onClick={openPicker}>
          <Camera className={styles.zoneIcon} />
          <span className={styles.zoneTitle}>사진 고르기</span>
          <span className={styles.zoneText}>
            {POST_IMAGE_MAX_COUNT}장까지 고를 수 있어요{canDrag ? '. 여기로 끌어다 놓아도 돼요' : ''}
          </span>
        </button>
      ) : null}

      {mode === 'existing' || mode === 'remove' ? (
        <ul className={styles.grid} data-dimmed={mode === 'remove' || undefined} aria-label="지금 사진">
          {existing.map((image, index) => (
            <li key={image.id} className={styles.tile}>
              <img
                className={styles.photo}
                src={image.url}
                alt={existing.length > 1 ? `${title} (사진 ${index + 1}/${existing.length})` : title}
                loading="lazy"
                decoding="async"
              />
              {index === 0 && mode === 'existing' ? <span className={styles.lead}>대표</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {mode === 'new' ? (
        <ul className={styles.grid} aria-label="고른 사진">
          {items.map((item, index) => (
            <li
              key={item.key}
              className={styles.tile}
              data-key={item.key}
              data-dragging={dragKey === item.key || undefined}
              data-over={overKey === item.key && dragKey !== item.key ? '' : undefined}
              draggable={canDrag && !readOnly}
              onDragStart={(event) => {
                setDragKey(item.key)
                event.dataTransfer.effectAllowed = 'move'
                // 파일 끌어다 놓기와 가른다 — 이건 칸 옮기기다
                event.dataTransfer.setData('text/plain', String(item.key))
              }}
              onDragEnd={() => {
                setDragKey(null)
                setOverKey(null)
              }}
              onDragOver={(event) => {
                if (dragKey === null) return
                event.preventDefault()
                event.stopPropagation()
                event.dataTransfer.dropEffect = 'move'
                if (overKey !== item.key) setOverKey(item.key)
              }}
              onDrop={(event) => handleTileDrop(event, index)}
            >
              <img
                className={styles.photo}
                src={previews.get(item.file)}
                alt={`고른 사진 ${index + 1}${index === 0 ? ', 대표 사진' : ''}`}
                draggable={false}
                // 브라우저가 그리지 못하는 파일(이름만 .jpg 인 HEIC 등)은 보내기 전에 뺀다
                onError={() =>
                  remove(item.key, { id: nextNoticeId++, name: item.file.name, message: POST_IMAGE_MESSAGES.unreadable })
                }
              />
              {index === 0 ? <span className={styles.lead}>대표</span> : null}
              <TileButton
                action="remove"
                place="remove"
                label={`${index + 1}번 사진 빼기`}
                disabled={readOnly}
                onClick={() => remove(item.key)}
              >
                <X />
              </TileButton>
              {items.length > 1 ? (
                <>
                  <TileButton
                    action="earlier"
                    place="earlier"
                    label={`${index + 1}번 사진을 앞으로`}
                    disabled={readOnly || index === 0}
                    onClick={() => move(index, -1, index - 1 === 0 ? 'later' : 'earlier')}
                  >
                    <CaretLeft />
                  </TileButton>
                  <TileButton
                    action="later"
                    place="later"
                    label={`${index + 1}번 사진을 뒤로`}
                    disabled={readOnly || index === items.length - 1}
                    onClick={() => move(index, 1, index + 1 === items.length - 1 ? 'earlier' : 'later')}
                  >
                    <CaretRight />
                  </TileButton>
                </>
              ) : null}
            </li>
          ))}
          {room > 0 ? (
            <li className={styles.addCell}>
              <button
                type="button"
                className={styles.add}
                data-action="add"
                aria-disabled={readOnly || undefined}
                onClick={openPicker}
              >
                <Plus />
                <span>사진 추가</span>
                <span className={styles.addLeft} data-numeric>
                  {room}장 더
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* 결과 고지 · 되돌리기 — 상태마다 한 줄. 같은 말을 두 곳에서 하지 않는다 */}
      {mode === 'existing' ? (
        <>
          <div className={styles.actions}>
            <Button size="sm" data-action="pick" aria-disabled={readOnly || undefined} onClick={openPicker}>
              <Camera />새 사진으로 바꾸기
            </Button>
            <Button
              size="sm"
              variant="dangerQuiet"
              data-action="remove-all"
              aria-disabled={readOnly || undefined}
              onClick={removeAll}
            >
              <Trash />
              사진 전부 삭제
            </Button>
          </div>
          <p className={styles.hint}>
            새 사진을 올리면 기존 사진 {existing.length}장이 모두 교체됩니다. 그대로 두려면 선택하지 마세요.
          </p>
        </>
      ) : null}

      {mode === 'remove' ? (
        <StateNote tone="warn">
          <p>
            저장하면 기존 사진 {existing.length}장이 모두 지워져요. 저장한 뒤에는 되돌릴 수 없어요.
          </p>
          <div className={styles.actions}>
            <Button size="sm" data-action="keep" aria-disabled={readOnly || undefined} onClick={keepExisting}>
              <ArrowUUpLeft />
              기존 사진 유지
            </Button>
            <Button size="sm" variant="ghost" data-action="pick" aria-disabled={readOnly || undefined} onClick={openPicker}>
              <Camera />새 사진 고르기
            </Button>
          </div>
        </StateNote>
      ) : null}

      {mode === 'new' && existing.length > 0 ? (
        <StateNote>
          <p>
            저장하면 기존 사진 {existing.length}장 대신 이 사진 {items.length}장이 올라가요.
          </p>
          <div className={styles.actions}>
            <Button size="sm" data-action="keep" aria-disabled={readOnly || undefined} onClick={keepExisting}>
              <ArrowUUpLeft />
              기존 사진 유지
            </Button>
          </div>
        </StateNote>
      ) : null}

      {mode === 'new' ? (
        <p className={styles.hint}>
          첫 장이 목록에 보이는 대표 사진이에요.{' '}
          {items.length > 1 ? (canDrag ? '끌어서 옮기거나 화살표로 순서를 바꿔요.' : '화살표로 순서를 바꿔요.') : null}
        </p>
      ) : null}

      {mode === 'empty' && lostCount > 0 ? (
        <StateNote tone="warn">
          <p>전에 고른 사진 {lostCount}장은 보관하지 못했어요. 다시 골라 주세요.</p>
        </StateNote>
      ) : mode === 'empty' ? (
        <p className={styles.hint}>사진이 있으면 한눈에 알아볼 수 있어요.</p>
      ) : null}

      {notices.length > 0 ? (
        <ul className={styles.notices} role="status">
          {notices.map((notice) => (
            <li key={notice.id}>
              <WarningCircle />
              <span>
                {notice.name ? <strong className={styles.fileName}>{notice.name}</strong> : null}
                {notice.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          <WarningCircle />
          {error}
        </p>
      ) : null}

      <input
        ref={inputRef}
        className={styles.fileInput}
        type="file"
        accept={POST_IMAGE_ACCEPT}
        multiple
        tabIndex={-1}
        aria-hidden="true"
        data-photo-input=""
        onChange={(event) => {
          const picked = Array.from(event.currentTarget.files ?? [])
          // 같은 파일을 다시 골라도 change 가 오도록 비운다
          event.currentTarget.value = ''
          addFiles(picked)
        }}
      />

      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  )
}

function TileButton({
  action,
  place,
  label,
  disabled,
  onClick,
  children,
}: {
  action: string
  place: 'remove' | 'earlier' | 'later'
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={styles.tileButton}
      data-place={place}
      data-action={action}
      aria-label={label}
      // 끝 칸에서도 포커스가 빠지지 않게 잠그지 않고 누름만 무시한다
      aria-disabled={disabled || undefined}
      // 끝 칸의 화살표는 누를 수 없으니 Tab 에서 건너뛴다. 포커스가 있던 버튼이 끝에 닿으면 반대 버튼으로 옮겨 둔다
      tabIndex={disabled && place !== 'remove' ? -1 : undefined}
      onClick={() => {
        if (!disabled) onClick()
      }}
    >
      {children}
    </button>
  )
}

function StateNote({ tone, children }: { tone?: 'warn'; children: ReactNode }) {
  return (
    <div className={styles.state} data-tone={tone} role="status">
      {tone === 'warn' ? <WarningCircle className={styles.stateIcon} /> : null}
      <div className={styles.stateBody}>{children}</div>
    </div>
  )
}

/** 같은 파일을 두 번 고른 것 — 이름 · 크기 · 수정 시각이 모두 같다 */
function sameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
}
