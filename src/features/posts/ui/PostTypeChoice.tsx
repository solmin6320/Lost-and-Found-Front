import { useId } from 'react'

import { CheckCircle, WarningCircle } from '@/shared/ui/icons'

import { POST_TYPES, type PostType } from '../api/types'
import styles from './PostTypeChoice.module.css'

interface PostTypeChoiceProps {
  value: PostType | null
  onChange: (type: PostType) => void
  /** 제출 중 — 고른 것을 바꾸지 못하게 한다(보내는 값과 화면이 어긋나지 않게) */
  readOnly?: boolean
  error?: string
}

const CHOICES: Record<PostType, { label: [string, string]; posts: string; reader: string }> = {
  LOST: {
    label: ['물건을', '잃어버렸어요'],
    posts: '분실 글로 올라가요',
    reader: '물건을 주운 사람이 이 글을 찾아봐요.',
  },
  FOUND: {
    label: ['물건을', '주웠어요'],
    posts: '습득 글로 올라가요',
    reader: '물건을 잃어버린 사람이 이 글을 찾아봐요.',
  },
}

/**
 * 등록의 첫 질문 — 잃어버렸나, 주웠나. 목록 첫 화면의 의도 칸과 같은 말 · 같은 색 면이다(색은 개념에 붙는다).
 * 진짜 라디오 두 개라 화살표 키로 옮기고 스크린리더가 선택을 읽는다. 칸 전체가 누르는 면이다.
 *
 * 고르기 전에는 두 칸 다 제 색 면이고, 고르면 고른 칸만 면으로 남고 다른 칸은 옅어진다(목록의 의도 칸과 같다).
 * 고른 칸에는 체크가 붙는다 — 색만으로 고른 것을 알리지 않는다.
 * 아래 한 줄이 **누가 이 글을 보게 되는지** 말한다(온보딩 2층 "등록 화면 유형 선택").
 */
export function PostTypeChoice({ value, onChange, readOnly = false, error }: PostTypeChoiceProps) {
  const id = useId()
  const errorId = `${id}-error`
  const noteId = `${id}-note`

  return (
    <fieldset
      className={styles.group}
      aria-invalid={error ? true : undefined}
      aria-describedby={[error ? errorId : null, noteId].filter(Boolean).join(' ')}
    >
      <legend className={styles.legend}>어떤 글인가요?</legend>
      <div className={styles.choices}>
        {POST_TYPES.map((type) => {
          const choice = CHOICES[type]
          const checked = value === type
          return (
            <label
              key={type}
              className={styles.choice}
              data-concept={type}
              data-state={checked ? 'on' : value ? 'off' : 'idle'}
            >
              <input
                className={styles.input}
                type="radio"
                name="type"
                value={type}
                checked={checked}
                // 읽기 전용 라디오는 없다. 바꾸는 것만 무시한다(disabled 는 포커스가 빠진다)
                aria-disabled={readOnly || undefined}
                onChange={() => {
                  if (!readOnly) onChange(type)
                }}
              />
              <span className={styles.label}>
                <span>{choice.label[0]}</span> <span>{choice.label[1]}</span>
              </span>
              <span className={styles.posts}>{choice.posts}</span>
              {checked ? <CheckCircle className={styles.check} weight="fill" /> : null}
            </label>
          )
        })}
      </div>
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          <WarningCircle />
          {error}
        </p>
      ) : null}
      <p id={noteId} className={styles.note}>
        {value ? CHOICES[value].reader : '고르면 누가 이 글을 보게 되는지 알려 드려요.'}
      </p>
    </fieldset>
  )
}
