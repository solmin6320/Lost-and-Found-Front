import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { useMediaQuery } from '@/shared/lib/useMediaQuery'
import { Button } from '@/shared/ui/Button'
import { Sheet } from '@/shared/ui/Sheet'

import {
  EMPTY_PLACE_DRAFT,
  POST_FILTER_FIELD_NAME,
  applyPlaceDraft,
  periodError,
  placeDraftFromSearch,
  withChoice,
  type PostFilterField,
  type PostListSearch,
  type PostPlaceDraft,
} from '../model/postListSearch'
import { FilterChoiceMenu, PostPlaceFields } from './PostFilterFields'
import styles from './PostFilterFields.module.css'
import { PostFilterPopover } from './PostFilterPopover'

/** 좁은 화면은 바텀 시트, 이 폭부터는 칩 바로 아래 펼침 칸 */
const WIDE = '(min-width: 48rem)'

/** 장소 · 기간은 한 칸을 같이 쓴다. 칩 이름 둘을 이어 부른다 */
const PLACE_TITLE = `${POST_FILTER_FIELD_NAME.location} · ${POST_FILTER_FIELD_NAME.period}`

interface PostFilterSheetProps {
  /** 연 칩이 맡은 묶음 */
  field: PostFilterField
  /** 연 칩. 넓은 화면은 그 바로 아래에 펼치고, 닫히면 포커스를 돌린다 */
  anchor: HTMLElement | null
  search: PostListSearch
  /** 조건을 건다. 주소가 바뀐다 */
  onApply: (next: PostListSearch) => void
  /** 닫혔다. 연 쪽이 이 칸을 치운다 */
  onClose: () => void
}

/**
 * 칩 하나 = 묶음 하나(2026-10-03 회의 ③). 칩이 무엇을 여는지가 칩 이름 그대로다.
 *
 *   카테고리 · 상태 : 그 묶음의 칸만. 누르면 **바로 걸리고 닫힌다**. 맨 앞 "전체"가 지우기다
 *   장소 · 기간     : 글자 · 날짜를 치는 칸이라 바로 걸지 않는다. 두 칸이 한 판을 같이 쓰고 [지우기] · [적용하기]
 *
 * 좁은 화면은 작은 바텀 시트(엄지 자리), 넓은 화면은 누른 칩 바로 아래 펼침 칸이다.
 * 닫기 · Esc · 바깥 누름은 아직 걸지 않은 입력을 버린다. 연 쪽이 열 때마다 `key` 를 바꿔 새로 시작한다.
 */
export function PostFilterSheet({ field, anchor, search, onApply, onClose }: PostFilterSheetProps) {
  const wide = useMediaQuery(WIDE)
  // 바텀 시트는 네이티브 dialog 가 닫히는 것을 기다려야 연 칩으로 포커스가 돌아간다(그 전에는 바깥이 inert 다)
  const [sheetOpen, setSheetOpen] = useState(true)

  function finish(next?: PostListSearch) {
    if (next) onApply(next)
    if (wide) {
      onClose()
      anchor?.focus()
    } else {
      setSheetOpen(false)
    }
  }

  if (field === 'category' || field === 'status') {
    const menu = (
      <FilterChoiceMenu
        field={field}
        value={search[field]}
        onPick={(value) => finish(withChoice(search, field, value))}
      />
    )
    const focusChecked = (root: ParentNode | null | undefined) =>
      root?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]') ?? null

    if (wide) {
      return (
        <PostFilterPopover
          anchor={anchor}
          label={POST_FILTER_FIELD_NAME[field]}
          initialFocus={focusChecked}
          onClose={onClose}
        >
          {menu}
        </PostFilterPopover>
      )
    }
    return (
      <ChoiceSheet title={POST_FILTER_FIELD_NAME[field]} open={sheetOpen} onClose={onClose} focusChecked={focusChecked}>
        {menu}
      </ChoiceSheet>
    )
  }

  return (
    <PlaceFilter
      field={field}
      wide={wide}
      anchor={anchor}
      search={search}
      sheetOpen={sheetOpen}
      onApply={(next) => finish(next)}
      onClose={onClose}
    />
  )
}

function ChoiceSheet({
  title,
  open,
  onClose,
  focusChecked,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  focusChecked: (root: ParentNode | null | undefined) => HTMLElement | null
  children: ReactNode
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  return (
    <Sheet open={open} onClose={onClose} title={title} initialFocus={() => focusChecked(bodyRef.current)}>
      <div ref={bodyRef}>{children}</div>
    </Sheet>
  )
}

interface PlaceFilterProps {
  field: 'location' | 'period'
  wide: boolean
  anchor: HTMLElement | null
  search: PostListSearch
  sheetOpen: boolean
  onApply: (next: PostListSearch) => void
  onClose: () => void
}

/**
 * 장소 · 기간 — 한 판을 같이 쓴다. 누른 칩의 칸으로 포커스가 간다.
 * [지우기]는 **이 판에 보이는 칸만** 비운다(적용 전 입력값). 카테고리 · 상태는 그대로다 — 지우기는 보이는 것만 지운다.
 * [적용하기]에서 한 번에 건다. 칠 때마다 목록이 뒤에서 다시 그려지면 무엇이 바뀌었는지 볼 수 없다.
 */
function PlaceFilter({ field, wide, anchor, search, sheetOpen, onApply, onClose }: PlaceFilterProps) {
  const formId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [draft, setDraft] = useState<PostPlaceDraft>(() => placeDraftFromSearch(search))
  const error = periodError(draft)

  const fieldInput = (root: ParentNode | null | undefined) =>
    root?.querySelector<HTMLElement>(field === 'location' ? 'input[name="location"]' : 'input[name="period-from"]') ??
    null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (error) {
      formRef.current?.querySelector<HTMLInputElement>('input[name="period-to"]')?.focus()
      return
    }
    onApply(applyPlaceDraft(search, draft))
  }

  function handleClear() {
    setDraft(EMPTY_PLACE_DRAFT)
    formRef.current?.querySelector<HTMLInputElement>('input[name="location"]')?.focus()
  }

  const form = (
    <form id={formId} ref={formRef} onSubmit={handleSubmit} noValidate>
      <PostPlaceFields
        value={draft}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        periodError={error}
      />
    </form>
  )

  const actions = (
    <>
      <Button onClick={handleClear}>지우기</Button>
      <Button type="submit" form={formId} variant="primary" block>
        적용하기
      </Button>
    </>
  )

  if (wide) {
    return (
      <PostFilterPopover
        anchor={anchor}
        label={PLACE_TITLE}
        role="dialog"
        size="form"
        initialFocus={fieldInput}
        onClose={onClose}
      >
        <p className={styles.panelTitle} aria-hidden="true">
          {PLACE_TITLE}
        </p>
        {form}
        <div className={styles.panelActions}>{actions}</div>
      </PostFilterPopover>
    )
  }

  return (
    <Sheet
      open={sheetOpen}
      onClose={onClose}
      title={PLACE_TITLE}
      initialFocus={() => fieldInput(formRef.current)}
      footer={actions}
    >
      {form}
    </Sheet>
  )
}
