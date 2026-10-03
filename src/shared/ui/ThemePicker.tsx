import { useId, useRef } from 'react'

import { useTheme, type ThemeName } from '@/shared/lib/theme'

import { Moon, Sun, type Icon } from './icons'
import styles from './ThemePicker.module.css'
import { themeOptionState } from './ThemePicker.state'

const OPTIONS: { value: ThemeName; label: string; icon: Icon }[] = [
  { value: 'light', label: '밝게', icon: Sun },
  { value: 'dark', label: '어둡게', icon: Moon },
]

const SCREEN: Record<ThemeName, string> = { light: '밝은 화면', dark: '어두운 화면' }

interface ThemePickerProps {
  /** 이 선택의 이름이 되는 제목 요소 id(섹션 제목 "화면 모드") */
  labelledBy: string
}

/**
 * 화면 모드 — "밝게" · "어둡게" 두 칸. 칸마다 그 모드로 그린 화면 축소 도식이 들어간다.
 *
 * 진짜 라디오 두 개다 — 화살표 키로 옮기고, 스크린리더가 "2개 중 1번째, 선택됨" 으로 읽는다.
 * 고른 칸은 색이 아니라 **선 두 겹 + 모서리 표시**로 보인다(그림 칸의 선택 표시 — 종류 칸과 같은 접힌 귀퉁이, 회의 ⑤-a).
 * 동그라미 체크는 쓰지 않는다 — 그건 "완료"의 표시다.
 * 바꾸는 즉시 화면 전체에 적용한다. 되돌릴 수 있는 일이라 확인 창을 띄우지 않는다.
 *
 * 한 번도 고르지 않았으면 기기 설정을 따른다. 그때는 지금 그려지는 모드의 칸에 **빈 테** 모서리 표시와
 * `기기 설정` 이름표가 붙는다(회의 RV-11). 그 칸을 누르면 그 모드로 고정되고 표시가 **채워진다** — 겉모습이 바뀌어야
 * 고정됐다는 것을 안다(밤에 기기가 어둡게 바뀌어도 앱이 흰 채로 남는 까닭).
 */
export function ThemePicker({ labelledBy }: ThemePickerProps) {
  const { preference, resolved, setPreference } = useTheme()
  const selected = preference ?? resolved
  const name = useId()
  const statusId = useId()
  const groupRef = useRef<HTMLDivElement>(null)

  function followSystem() {
    setPreference(null)
    // 누른 버튼이 사라진다. 지금 선택된 칸으로 포커스를 옮긴다
    requestAnimationFrame(() => {
      groupRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
    })
  }

  return (
    <div className={styles.picker}>
      <div
        ref={groupRef}
        className={styles.options}
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-describedby={statusId}
      >
        {OPTIONS.map(({ value, label, icon: OptionIcon }) => {
          const checked = selected === value
          const state = themeOptionState(value, preference, resolved)
          return (
            <label key={value} className={styles.option} data-state={state}>
              <input
                className={styles.input}
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={() => setPreference(value)}
                // 기기 설정을 따르는 중에 지금 모드의 칸을 누르면 change 가 나지 않는다. 그때는 "이 모드로 고정" 이다
                onClick={() => {
                  if (preference === null && checked) setPreference(value)
                }}
              />
              <span className={styles.preview} data-theme={value} aria-hidden="true">
                <ThemePreview />
              </span>
              <span className={styles.caption}>
                <OptionIcon className={styles.captionIcon} />
                <span className={styles.captionText}>{label}</span>
                {state === 'following' ? <span className={styles.systemTag}>기기 설정</span> : null}
              </span>
              <svg className={styles.corner} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M14.5 3v9.5a2 2 0 0 1-2 2H3Z" />
              </svg>
            </label>
          )
        })}
      </div>

      <p id={statusId} className={styles.status}>
        {preference === null
          ? `기기 설정에 맞춰 지금은 ${SCREEN[resolved]}이에요.`
          : `기기 설정과 상관없이 늘 ${SCREEN[preference]}으로 보여요.`}
        {preference !== null ? (
          <button type="button" className={styles.follow} onClick={followSystem}>
            기기 설정 따르기
          </button>
        ) : null}
      </p>
    </div>
  )
}

/** 앞 네 칸만 보인다(아래는 잘린다). 분실 · 습득 포스터와 사진 한 장을 섞는다 */
const TILES = ['LOST', 'FOUND', 'PHOTO', 'FOUND', 'LOST', 'LOST'] as const

/**
 * 목록 화면을 줄인 도식 — 헤더 · 제목 · 두 색 면 · 검색창 · 카드 격자. 비율은 실제 375px 화면을 따른다.
 * 그림이나 캡처가 아니라 **실제 토큰으로 그린다.** 감싼 칸의 `data-theme` 이 그 모드의 토큰을 연다.
 * 장식이다 — 이름은 칸의 "밝게" · "어둡게" 가 맡는다.
 */
function ThemePreview() {
  return (
    <span className={styles.screen}>
      <span className={styles.bar}>
        <span className={styles.brand}>
          <span className={styles.tagLost} />
          <span className={styles.tagFound} />
          <span className={styles.word} />
        </span>
        <span className={styles.barActions}>
          <span className={styles.chipSquare} />
          <span className={styles.chipRound} />
          <span className={styles.chipWide} />
        </span>
      </span>
      <span className={styles.content}>
        <span className={styles.headline} />
        <span className={styles.panels}>
          <span className={styles.panel} data-concept="LOST">
            <span className={styles.panelLine} />
            <span className={styles.panelLineShort} />
          </span>
          <span className={styles.panel} data-concept="FOUND">
            <span className={styles.panelLine} />
            <span className={styles.panelLineShort} />
          </span>
        </span>
        <span className={styles.search} />
        <span className={styles.tiles}>
          {TILES.map((kind, index) => (
            <span key={index} className={styles.tile}>
              <span className={styles.photo} data-kind={kind} />
              <span className={styles.tileLine} />
              <span className={styles.tileLineShort} />
            </span>
          ))}
        </span>
      </span>
    </span>
  )
}
