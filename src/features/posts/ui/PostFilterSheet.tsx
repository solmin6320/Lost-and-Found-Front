import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { useMediaQuery } from '@/shared/lib/useMediaQuery'
import { Button } from '@/shared/ui/Button'
import { Sheet } from '@/shared/ui/Sheet'

import {
  EMPTY_PERIOD_DRAFT,
  POST_FILTER_FIELD_NAME,
  applyLocation,
  applyPeriodDraft,
  periodDraftFromSearch,
  periodError,
  withChoice,
  type PostFilterField,
  type PostListSearch,
  type PostPeriodDraft,
} from '../model/postListSearch'
import { FilterChoiceMenu, LocationField, PeriodFields } from './PostFilterFields'
import styles from './PostFilterFields.module.css'
import { PostFilterPopover } from './PostFilterPopover'

/** 좁은 화면은 바텀 시트, 이 폭부터는 칩 바로 아래 펼침 칸 */
const WIDE = '(min-width: 48rem)'

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
 * **칩 하나 = 묶음 하나 = 칸 하나**(2026-10-03 회의 ③, 본인 피드백 2026-10-07로 장소 · 기간도 나눔). 칩이 무엇을 여는지가 칩 이름 그대로다.
 *
 *   카테고리 · 상태 : 그 묶음의 칸만. 누르면 **바로 걸리고 닫힌다**. 맨 앞 기본값(전체 · 진행 중)이 지우기다
 *   장소            : 글자 칸 하나. 바로 걸지 않는다 — [지우기] · [적용하기](Enter 도 적용)
 *   기간            : 시작 · 끝 날짜. [지우기] · [적용하기]
 * 예전에는 장소 칩과 기간 칩이 같은 "장소 · 기간" 판을 열어, 두 칩이 같은 일을 하는 것처럼 보였다.
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

  const frame = { wide, anchor, sheetOpen, onClose }

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

  if (field === 'location') {
    return <LocationFilter {...frame} search={search} onApply={(next) => finish(next)} />
  }
  return <PeriodFilter {...frame} search={search} onApply={(next) => finish(next)} />
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

interface InputFilterFrame {
  wide: boolean
  anchor: HTMLElement | null
  sheetOpen: boolean
  onClose: () => void
}

interface InputFilterProps extends InputFilterFrame {
  title: string
  /** 열리자마자 포커스를 줄 칸 */
  firstInput: string
  onSubmit: (event: FormEvent<HTMLFormElement>, form: HTMLFormElement | null) => void
  onClear: (form: HTMLFormElement | null) => void
  children: ReactNode
}

/**
 * 글자 · 날짜를 치는 묶음(장소 · 기간)의 틀 — 한 판에 칸 + [지우기] · [적용하기].
 * [지우기]는 **이 판에 보이는 칸만** 비운다(적용 전 입력값). 다른 조건은 그대로다 — 지우기는 보이는 것만 지운다.
 * [적용하기]에서 건다. 칠 때마다 목록이 뒤에서 다시 그려지면 무엇이 바뀌었는지 볼 수 없다.
 * 넓은 화면의 펼침 칸은 머리에 묶음 이름을 쓴다(좁은 화면은 시트 머리가 맡는다)
 */
function InputFilter({ wide, anchor, sheetOpen, onClose, title, firstInput, onSubmit, onClear, children }: InputFilterProps) {
  const formId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const focusFirst = (root: ParentNode | null | undefined) =>
    root?.querySelector<HTMLElement>(`input[name="${firstInput}"]`) ?? null

  const form = (
    <form id={formId} ref={formRef} onSubmit={(event) => onSubmit(event, formRef.current)} noValidate>
      {children}
    </form>
  )

  const actions = (
    <>
      <Button onClick={() => onClear(formRef.current)}>지우기</Button>
      <Button type="submit" form={formId} variant="primary" block>
        적용하기
      </Button>
    </>
  )

  if (wide) {
    return (
      <PostFilterPopover anchor={anchor} label={title} role="dialog" size="form" initialFocus={focusFirst} onClose={onClose}>
        <p className={styles.panelTitle} aria-hidden="true">
          {title}
        </p>
        {form}
        <div className={styles.panelActions}>{actions}</div>
      </PostFilterPopover>
    )
  }

  return (
    <Sheet open={sheetOpen} onClose={onClose} title={title} initialFocus={() => focusFirst(formRef.current)} footer={actions}>
      {form}
    </Sheet>
  )
}

interface FieldFilterProps extends InputFilterFrame {
  search: PostListSearch
  onApply: (next: PostListSearch) => void
}

/** 장소 — 칸 하나. 칸에서 Enter 도 [적용하기]다(폼 제출) */
function LocationFilter({ search, onApply, ...frame }: FieldFilterProps) {
  const [draft, setDraft] = useState(search.location)

  return (
    <InputFilter
      {...frame}
      title={POST_FILTER_FIELD_NAME.location}
      firstInput="location"
      onSubmit={(event) => {
        event.preventDefault()
        onApply(applyLocation(search, draft))
      }}
      onClear={(form) => {
        setDraft('')
        form?.querySelector<HTMLInputElement>('input[name="location"]')?.focus()
      }}
    >
      <LocationField value={draft} onChange={setDraft} />
    </InputFilter>
  )
}

/** 기간 — 시작 · 끝. 거꾸로면 걸지 않고 끝 날짜 칸으로 데려간다 */
function PeriodFilter({ search, onApply, ...frame }: FieldFilterProps) {
  const [draft, setDraft] = useState<PostPeriodDraft>(() => periodDraftFromSearch(search))
  const error = periodError(draft)

  return (
    <InputFilter
      {...frame}
      title={POST_FILTER_FIELD_NAME.period}
      firstInput="period-from"
      onSubmit={(event, form) => {
        event.preventDefault()
        if (error) {
          form?.querySelector<HTMLInputElement>('input[name="period-to"]')?.focus()
          return
        }
        onApply(applyPeriodDraft(search, draft))
      }}
      onClear={(form) => {
        setDraft(EMPTY_PERIOD_DRAFT)
        form?.querySelector<HTMLInputElement>('input[name="period-from"]')?.focus()
      }}
    >
      <PeriodFields
        value={draft}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        error={error}
      />
    </InputFilter>
  )
}
