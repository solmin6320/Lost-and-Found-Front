import { useEffect, useRef, useState } from 'react'

import { cx } from '@/shared/lib/cx'
import { CaretDown, X } from '@/shared/ui/icons'

import {
  POST_FILTER_FIELDS,
  POST_FILTER_FIELD_NAME,
  filterValueLabel,
  postListSearchKey,
  type PostFilterField,
  type PostListSearch,
} from '../model/postListSearch'
import styles from './FilterChips.module.css'
import { PostFilterSheet } from './PostFilterSheet'

interface PostFilterBarProps {
  search: PostListSearch
  /** 조건을 건다(칩에서 고름 · 장소 · 기간 적용 · 칩의 ×). 첫 묶음으로 돌아가고 기록을 쌓는다 */
  onApply: (next: PostListSearch) => void
  onRemove: (field: PostFilterField) => void
  /**
   * 있으면 줄 맨 앞에 [전체 해제] 를 둔다. 필터가 걸렸을 때만 넘긴다.
   * 같은 일을 하는 버튼이 화면에 이미 있으면(조건 검색 0건의 [필터 초기화]) 넘기지 않는다
   */
  onClearAll?: () => void
}

/** 칩이 여는 것. 고르기 묶음은 메뉴, 장소 · 기간은 입력 판 */
const POPUP: Record<PostFilterField, 'menu' | 'dialog'> = {
  category: 'menu',
  status: 'menu',
  location: 'dialog',
  period: 'dialog',
}

/**
 * 필터의 입구 — 모든 폭에서 이 한 줄이다. **칩 하나 = 묶음 하나**, 무엇으로 좁힐 수 있는지가 한 줄에 보인다.
 * 칩을 누르면 그 묶음만 연다(좁은 화면은 작은 바텀 시트, 넓은 화면은 칩 바로 아래).
 * 걸린 칩은 값을 보여주고(`카테고리: 지갑`) 옆에 지우기 버튼이 붙는다.
 * 걸린 칩을 앞으로 모은다. 좁은 화면에서는 칩 몇 개만 보여, 뒤쪽에 걸린 조건이 화면 밖에 숨으면
 * "왜 결과가 적지" 를 풀 수 없다. 걸리지 않은 칩끼리의 순서는 그대로다.
 *
 * [전체 해제] 는 줄 맨 앞이다. 결과 제목 줄에 두면 생길 때마다 그 줄이 접혀 피드가 밀렸다.
 */
export function PostFilterBar({ search, onApply, onRemove, onClearAll }: PostFilterBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const refocusField = useRef<PostFilterField | null>(null)
  const [panel, setPanel] = useState<{ field: PostFilterField; anchor: HTMLElement; key: number } | null>(null)
  const panelKey = useRef(0)
  const searchKey = postListSearchKey(search)

  // 조건이 바뀌면 칩이 다른 모양의 버튼으로 바뀐다(값이 든 칩 ↔ 빈 칩). 바뀐 칩이 그려진 뒤에 같은 묶음의 칩으로
  // 포커스를 되돌린다. 주소 변경은 transition 으로 늦게 그려져, 누른 직후에는 아직 옛 칩이 남아 있다
  useEffect(() => {
    const field = refocusField.current
    if (!field) return
    refocusField.current = null
    barRef.current?.querySelector<HTMLElement>(`[data-filter-field="${field}"]`)?.focus()
  }, [searchKey])

  function handleRemove(field: PostFilterField) {
    refocusField.current = field
    onRemove(field)
  }

  function handleApply(field: PostFilterField, next: PostListSearch) {
    if (postListSearchKey(next) === searchKey) return
    refocusField.current = field
    onApply(next)
  }

  function toggle(field: PostFilterField, anchor: HTMLElement) {
    // 같은 칩을 다시 누르면 닫는다(넓은 화면 펼침 칸). 바텀 시트는 바깥이 가려져 이 칩을 누를 수 없다
    if (panel?.field === field) {
      setPanel(null)
      return
    }
    panelKey.current += 1
    setPanel({ field, anchor, key: panelKey.current })
  }

  const fields = [...POST_FILTER_FIELDS].sort(
    (a, b) => Number(filterValueLabel(search, b) !== null) - Number(filterValueLabel(search, a) !== null),
  )

  return (
    <div className={styles.root}>
      <div ref={barRef} className={styles.bar} role="group" aria-label="필터">
        {onClearAll ? (
          <button type="button" className={styles.clearAll} onClick={onClearAll}>
            전체 해제
          </button>
        ) : null}

        {fields.map((field) => {
          const name = POST_FILTER_FIELD_NAME[field]
          const value = filterValueLabel(search, field)
          const open = panel?.field === field

          if (!value) {
            return (
              <button
                key={field}
                type="button"
                className={styles.trigger}
                data-filter-field={field}
                aria-haspopup={POPUP[field]}
                aria-expanded={open}
                onClick={(event) => toggle(field, event.currentTarget)}
              >
                {name}
                <CaretDown />
              </button>
            )
          }

          // 값이 길면(장소 100자) 칩 안에서 자른다. 전체 값은 마우스를 올리면(title) · 칩을 누르면 보인다
          return (
            <span key={field} className={cx(styles.trigger, styles.triggerActive)}>
              <button
                type="button"
                className={styles.triggerMain}
                data-filter-field={field}
                aria-haspopup={POPUP[field]}
                aria-expanded={open}
                title={`${name}: ${value}`}
                onClick={(event) => toggle(field, event.currentTarget)}
              >
                {name}: <span className={styles.value}>{value}</span>
              </button>
              <button
                type="button"
                className={styles.triggerClear}
                aria-label={`${name}: ${value} 조건 지우기`}
                onClick={() => handleRemove(field)}
              >
                <X />
              </button>
            </span>
          )
        })}
      </div>

      {panel ? (
        <PostFilterSheet
          key={panel.key}
          field={panel.field}
          anchor={panel.anchor}
          search={search}
          onApply={(next) => handleApply(panel.field, next)}
          onClose={() => setPanel((current) => (current?.key === panel.key ? null : current))}
        />
      ) : null}
    </div>
  )
}
