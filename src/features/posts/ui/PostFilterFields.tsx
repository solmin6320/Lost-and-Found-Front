import { useId, type KeyboardEvent } from 'react'

import { cx } from '@/shared/lib/cx'
import { todayIsoDate } from '@/shared/lib/date'
import { WarningCircle } from '@/shared/ui/icons'

import { POST_CATEGORIES, POST_STATUSES } from '../api/types'
import { POST_CATEGORY_LABEL, POST_STATUS_LABEL } from '../model/labels'
import {
  LOCATION_MAX_LENGTH,
  POST_FILTER_FIELD_NAME,
  type PostListSearch,
  type PostPlaceDraft,
} from '../model/postListSearch'
import styles from './PostFilterFields.module.css'

/** 하나만 고르는 묶음. 칩 하나가 이 묶음 하나를 연다 */
export type PostChoiceField = 'category' | 'status'

const CHOICES: {
  [F in PostChoiceField]: { value: NonNullable<PostListSearch[F]>; label: string }[]
} = {
  category: POST_CATEGORIES.map((value) => ({ value, label: POST_CATEGORY_LABEL[value] })),
  status: POST_STATUSES.map((value) => ({ value, label: POST_STATUS_LABEL[value] })),
}

/** 칸에는 이름만. 뜻은 그 조건을 고르는 자리에서 한 줄로(온보딩 2층) */
const CHOICE_HINT: Partial<Record<PostChoiceField, string>> = {
  status: '연락중은 주인으로 보이는 사람과 이야기하는 글, 완료는 주인에게 돌아간 글이에요.',
}

interface FilterChoiceMenuProps<F extends PostChoiceField> {
  field: F
  value: PostListSearch[F]
  /** 고른 값을 **바로** 건다. `undefined` 는 "전체"(조건 없음) */
  onPick: (value: PostListSearch[F]) => void
}

/**
 * 카테고리 · 상태 고르기 — 누르면 바로 반영하고 닫힌다([적용하기] · [초기화] 없음, 2026-10-03 회의 ③).
 * 맨 앞의 "전체"가 지우기다.
 *
 * 메뉴 버튼 패턴(`menu` + `menuitemradio`)이다. **화살표는 옮기기만 한다** — 고르는 것은 Enter · Space · 누름뿐이다.
 * 네이티브 라디오는 화살표로 옮기는 순간 값이 바뀌어, 키보드 사용자가 지나가기만 해도 목록이 다시 불러와진다(WCAG 3.2.2).
 * 고른 칸은 **채운 점**으로 표시한다(하나만 고르기). 동그라미 ✓는 완료 표시 전용이라 쓰지 않는다.
 */
export function FilterChoiceMenu<F extends PostChoiceField>({ field, value, onPick }: FilterChoiceMenuProps<F>) {
  const hintId = useId()
  const hint = CHOICE_HINT[field]
  const options: { value: PostListSearch[F]; label: string }[] = [
    { value: undefined as PostListSearch[F], label: '전체' },
    ...(CHOICES[field] as { value: PostListSearch[F]; label: string }[]),
  ]

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
    const at = items.indexOf(document.activeElement as HTMLElement)
    let next = -1
    if (event.key === 'ArrowDown') next = (at + 1) % items.length
    else if (event.key === 'ArrowUp') next = (at - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next < 0) return
    event.preventDefault()
    items[next]?.focus()
  }

  return (
    <div className={styles.choiceGroup}>
      <div
        role="menu"
        aria-label={POST_FILTER_FIELD_NAME[field]}
        aria-describedby={hint ? hintId : undefined}
        className={styles.menu}
        data-field={field}
        onKeyDown={handleKeyDown}
      >
        {options.map((option) => {
          const checked = option.value === value
          return (
            <button
              key={option.value ?? 'all'}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              // 들어오면 고른 칸에 선다. 나머지는 화살표로 닿는다
              tabIndex={checked ? 0 : -1}
              className={styles.choice}
              onClick={() => onPick(option.value)}
            >
              <span className={styles.dot} aria-hidden="true" />
              {option.label}
            </button>
          )
        })}
      </div>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface PostPlaceFieldsProps {
  value: PostPlaceDraft
  onChange: (patch: Partial<PostPlaceDraft>) => void
  /** 기간이 거꾸로일 때의 문구. 있으면 기간 아래에 붙는다 */
  periodError?: string | null
}

/**
 * 장소 · 기간 — 글자 · 날짜를 치는 칸. 입력만 한다. 언제 적용할지는 감싼 쪽([적용하기])이 정한다.
 * 각 묶음에 `data-field` 를 달아, 칩에서 열 때 그 칸으로 바로 포커스를 옮긴다.
 */
export function PostPlaceFields({ value, onChange, periodError }: PostPlaceFieldsProps) {
  const id = useId()
  const today = todayIsoDate()
  const errorId = `${id}-period-error`

  return (
    <div className={styles.fields}>
      <div className={styles.group} data-field="location">
        <label className={styles.legend} htmlFor={`${id}-location`}>
          {POST_FILTER_FIELD_NAME.location}
        </label>
        <input
          id={`${id}-location`}
          className={styles.input}
          type="text"
          name="location"
          value={value.location}
          onChange={(event) => onChange({ location: event.target.value })}
          maxLength={LOCATION_MAX_LENGTH}
          placeholder="예: 강남역"
          autoComplete="off"
          enterKeyHint="done"
        />
      </div>

      <fieldset className={styles.group} data-field="period" aria-describedby={`${id}-period-hint`}>
        <legend className={styles.legend}>{POST_FILTER_FIELD_NAME.period}</legend>
        {/* 등록일과 헷갈리지 않게 기준 날짜를 밝힌다(화면정의서 1.1) */}
        <p id={`${id}-period-hint`} className={styles.hint}>
          분실·습득일 기준
        </p>
        <div className={styles.period}>
          <label className={styles.dateField}>
            <span className={styles.dateLabel}>시작</span>
            <input
              className={cx(styles.input, styles.dateInput)}
              type="date"
              name="period-from"
              value={value.from}
              max={value.to || today}
              onChange={(event) => onChange({ from: event.target.value })}
            />
          </label>
          <label className={styles.dateField}>
            <span className={styles.dateLabel}>끝</span>
            <input
              className={cx(styles.input, styles.dateInput)}
              type="date"
              name="period-to"
              value={value.to}
              min={value.from || undefined}
              max={today}
              aria-invalid={periodError ? true : undefined}
              aria-describedby={periodError ? errorId : undefined}
              onChange={(event) => onChange({ to: event.target.value })}
            />
          </label>
        </div>
        {periodError ? (
          <p id={errorId} className={styles.error} role="alert">
            <WarningCircle />
            {periodError}
          </p>
        ) : null}
      </fieldset>
    </div>
  )
}
