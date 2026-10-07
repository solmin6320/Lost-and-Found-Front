import { useId, type KeyboardEvent } from 'react'

import { cx } from '@/shared/lib/cx'
import { todayIsoDate } from '@/shared/lib/date'
import { WarningCircle } from '@/shared/ui/icons'

import { POST_CATEGORIES, POST_STATUSES } from '../api/types'
import { POST_CATEGORY_LABEL, POST_STATUS_LABEL } from '../model/labels'
import {
  DEFAULT_STATUS_LABEL,
  LOCATION_MAX_LENGTH,
  POST_FILTER_FIELD_NAME,
  type PostListSearch,
  type PostPeriodDraft,
} from '../model/postListSearch'
import styles from './PostFilterFields.module.css'

/** 하나만 고르는 묶음. 칩 하나가 이 묶음 하나를 연다 */
export type PostChoiceField = 'category' | 'status'

interface ChoiceOption<F extends PostChoiceField> {
  value: PostListSearch[F]
  label: string
  /** 이름 옆의 작은 설명 — 기본값이 무엇을 묶는지 */
  note?: string
}

/**
 * 묶음마다의 칸. **맨 앞은 기본값**(`undefined`)이다 — 카테고리는 "전체", 상태는 "진행 중"(게시중 + 연락중, 회의 ⑧).
 * 상태에는 "전체"가 없다 — 완료 글까지 한꺼번에 보는 일은 드물고, 완료만 보고 싶으면 "완료"를 고른다
 */
const CHOICES: { [F in PostChoiceField]: ChoiceOption<F>[] } = {
  category: [
    { value: undefined, label: '전체' },
    ...POST_CATEGORIES.map((value) => ({ value, label: POST_CATEGORY_LABEL[value] })),
  ],
  status: [
    { value: undefined, label: DEFAULT_STATUS_LABEL, note: `${POST_STATUS_LABEL.OPEN}, ${POST_STATUS_LABEL.IN_PROGRESS}` },
    ...POST_STATUSES.map((value) => ({ value, label: POST_STATUS_LABEL[value] })),
  ],
}

/** 칸에는 이름만. 뜻은 그 조건을 고르는 자리에서 한 줄로(온보딩 2층) */
const CHOICE_HINT: Partial<Record<PostChoiceField, string>> = {
  status: '연락중은 연락이 닿은 글, 완료는 물건이 주인에게 돌아간 글이에요. 완료 글은 완료를 골라야 보여요.',
}

interface FilterChoiceMenuProps<F extends PostChoiceField> {
  field: F
  value: PostListSearch[F]
  /** 고른 값을 **바로** 건다. `undefined` 는 그 묶음의 기본값(전체 · 진행 중) */
  onPick: (value: PostListSearch[F]) => void
}

/**
 * 카테고리 · 상태 고르기 — 누르면 바로 반영하고 닫힌다([적용하기] · [초기화] 없음, 2026-10-03 회의 ③).
 * 맨 앞의 기본값(카테고리 "전체" · 상태 "진행 중")이 지우기다.
 *
 * 메뉴 버튼 패턴(`menu` + `menuitemradio`)이다. **화살표는 옮기기만 한다** — 고르는 것은 Enter · Space · 누름뿐이다.
 * 네이티브 라디오는 화살표로 옮기는 순간 값이 바뀌어, 키보드 사용자가 지나가기만 해도 목록이 다시 불러와진다(WCAG 3.2.2).
 * 고른 칸은 **채운 점**으로 표시한다(하나만 고르기). 동그라미 ✓는 완료 표시 전용이라 쓰지 않는다.
 */
export function FilterChoiceMenu<F extends PostChoiceField>({ field, value, onPick }: FilterChoiceMenuProps<F>) {
  const hintId = useId()
  const hint = CHOICE_HINT[field]
  const options = CHOICES[field] as ChoiceOption<F>[]

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
              key={option.value ?? 'default'}
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
              {option.note ? (
                // 스크린리더가 "진행 중게시중"으로 붙여 읽지 않게 쉼표를 끼운다(화면에는 줄 끝으로 떨어져 보인다)
                <span className={styles.choiceNote}>
                  <span className="sr-only">, </span>
                  {option.note}
                </span>
              ) : null}
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

interface LocationFieldProps {
  value: string
  onChange: (value: string) => void
}

/**
 * 장소 — 글자를 치는 칸 하나. 입력만 한다. 언제 적용할지는 감싼 쪽([적용하기] · Enter)이 정한다.
 * 이름은 펼침 칸 · 시트의 제목("장소")이 맡는다 — 같은 말을 칸 위에 한 번 더 쓰지 않고 스크린리더 이름으로만 둔다
 */
export function LocationField({ value, onChange }: LocationFieldProps) {
  const id = useId()
  return (
    <div className={styles.group}>
      <label className="sr-only" htmlFor={id}>
        {POST_FILTER_FIELD_NAME.location}
      </label>
      <input
        id={id}
        className={styles.input}
        type="text"
        name="location"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={LOCATION_MAX_LENGTH}
        placeholder="예: 강남역"
        autoComplete="off"
        enterKeyHint="done"
      />
      <p className={styles.hint}>장소 이름의 일부만 적어도 찾아요.</p>
    </div>
  )
}

interface PeriodFieldsProps {
  value: PostPeriodDraft
  onChange: (patch: Partial<PostPeriodDraft>) => void
  /** 기간이 거꾸로일 때의 문구. 있으면 날짜 아래에 붙는다 */
  error?: string | null
}

/**
 * 기간 — 시작 · 끝 날짜. 입력만 한다. 언제 적용할지는 감싼 쪽([적용하기])이 정한다.
 * 등록일과 헷갈리지 않게 기준 날짜(분실·습득일)를 밝힌다(화면정의서 1.1)
 */
export function PeriodFields({ value, onChange, error }: PeriodFieldsProps) {
  const id = useId()
  const today = todayIsoDate()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  return (
    <fieldset className={styles.group} aria-describedby={hintId}>
      <legend className="sr-only">{POST_FILTER_FIELD_NAME.period}</legend>
      <p id={hintId} className={styles.hint}>
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
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onChange({ to: event.target.value })}
          />
        </label>
      </div>
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          <WarningCircle />
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
