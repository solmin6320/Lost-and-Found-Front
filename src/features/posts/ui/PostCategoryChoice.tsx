import { useId } from 'react'

import { WarningCircle } from '@/shared/ui/icons'

import { POST_CATEGORIES, type PostCategory, type PostType } from '../api/types'
import { POST_CATEGORY_LABEL } from '../model/labels'
import { CategoryArt } from './CategoryArt'
import styles from './PostCategoryChoice.module.css'

interface PostCategoryChoiceProps {
  value: PostCategory | null
  onChange: (category: PostCategory) => void
  /** 고른 유형. 그림이 그 색으로 칠해진다 — 사진이 없으면 목록에 이 그림이 포스터로 들어간다 */
  type: PostType | null
  readOnly?: boolean
  error?: string
}

/**
 * 물건 종류 다섯 칸 — 목록 포스터와 **같은 그림**이다. 사진 없이 올리면 이 그림이 목록에 대신 들어간다는 것을
 * 고르는 자리에서 먼저 본다(도움말 한 줄). 유형을 고르기 전에는 그림이 무채색이다.
 * 진짜 라디오 다섯 개(화살표 키로 옮긴다). 고른 칸은 선 두 겹 + 오른쪽 위 모서리 표시 — 색만으로 알리지 않는다.
 * 그림 칸의 선택 표시다(화면 모드 칸과 같다, 회의 ⑤-a). 동그라미 체크는 "완료"에만 쓴다.
 *
 * 오류는 제출이 막혔을 때만 붙는다 — 바로 읽어 주지 않는다(`role="alert"` 없음). 제출 줄 한 줄이 남은 수를 알리고,
 * 포커스가 이 칸으로 오면 `aria-describedby` 로 읽힌다(알림 다섯 겹 방지, 회의 UI2-9)
 */
export function PostCategoryChoice({ value, onChange, type, readOnly = false, error }: PostCategoryChoiceProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <fieldset className={styles.group} aria-describedby={[error ? errorId : null, hintId].filter(Boolean).join(' ')}>
      <legend className={styles.legend}>종류</legend>
      <div className={styles.choices} data-type={type ?? undefined}>
        {POST_CATEGORIES.map((category) => {
          const checked = value === category
          return (
            <label key={category} className={styles.choice} data-checked={checked || undefined}>
              <input
                className={styles.input}
                type="radio"
                name="category"
                value={category}
                checked={checked}
                aria-disabled={readOnly || undefined}
                onChange={() => {
                  if (!readOnly) onChange(category)
                }}
              />
              <CategoryArt category={category} className={styles.art} />
              <span className={styles.label}>{POST_CATEGORY_LABEL[category]}</span>
              {checked ? (
                <svg className={styles.corner} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M3 1.5h9.5a2 2 0 0 1 2 2V13Z" />
                </svg>
              ) : null}
            </label>
          )
        })}
      </div>
      {error ? (
        <p id={errorId} className={styles.error}>
          <WarningCircle />
          {error}
        </p>
      ) : null}
      <p id={hintId} className={styles.hint}>
        사진 없이 올리면 목록에 이 그림이 대신 보여요.
      </p>
    </fieldset>
  )
}
