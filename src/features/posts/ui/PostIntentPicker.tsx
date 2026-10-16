import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, type MouseEvent } from 'react'
import { Link, type To } from 'react-router-dom'

import { isPlainClick } from '@/shared/lib/events'
import { isPressNear, isTouchOutside } from '@/shared/lib/strictTap'
import { X } from '@/shared/ui/icons'

import type { PostType } from '../api/types'
import { POST_INTENTS, intentHintTail, type PostIntent } from '../model/postIntent'
import { DEFAULT_LIST_STATUSES } from '../model/postListSearch'
import { postListQueryOptions } from '../model/postQueries'
import styles from './PostIntentPicker.module.css'

interface PostIntentPickerProps {
  /** 지금 목록에 걸린 유형. 칸 이름이 곧 이 유형이다(분실 글 · 습득 글) */
  selected: PostType | undefined
  /** 유형 → 주소. `undefined` 는 분실 · 습득 둘 다([×]). 검색어 · 필터는 그대로 두고 1쪽으로 간다 */
  hrefFor: (type: PostType | undefined) => To
  /**
   * 처음 목록(`/` — 칸 · 검색어 · 필터를 모두 푼 첫 화면). **고른 칸 자체**를 누르면 여기로 간다
   * (본인 피드백 · 결정 2026-10-14 "카테고리 상관없이 모든 게시글 보여 주던 화면으로", [×]는 칸만 푼다 — QA-P-6)
   */
  resetTo: To
  /**
   * 선택지에 건수를 붙이나. 검색어 · 필터가 걸려 있으면 `false` —
   * 건수는 유형 전체라 결과 제목 옆의 수(조건이 걸린 수)와 어긋난다. 수는 한 곳에서만 말한다
   */
  showCounts: boolean
  /** 고른 칸으로 처음 목록으로 돌아간다(같은 탭에서 연 누름만). 연 쪽이 검색칸을 비우고 맨 위로 올린다 */
  onReset?: () => void
}

/**
 * 첫 화면의 두 갈래 — `잃어버린 물건`(분실 글, 분실 색) / `주운 물건`(습득 글, 습득 색).
 * **칸 이름 = 보여 주는 글의 종류**(본인 결정 2026-10-07). 칸의 색과 결과 카드 이름표의 색이 같다 —
 * 주황 칸을 누르면 주황 이름표(분실)의 글만, 파란 칸을 누르면 파란 이름표(습득)의 글만 나온다.
 * 분실/습득은 필터 하나가 아니라 이 서비스의 구조라 맨 위에 큰 색 면으로 둔다.
 * 면에는 글자만 둔다. 귀퉁이 장식(흐린 꼬리표)은 뺐다 — 뜻 없이 로고 모양을 되풀이하는 워터마크였다.
 *
 * 둘 다 링크다(새 탭 열기 · 주소 공유). 고른 쪽은 `aria-current` 로 알린다. 다른 쪽을 누르면 바로 갈아탄다.
 * 되돌리는 길이 둘이고 하는 일이 다르다(본인 결정 2026-10-14, QA-P-6)
 *   - **고른 칸(면 어디든)** → 처음 목록(`/`) — 칸뿐 아니라 검색어 · 카테고리 · 상태 · 장소 · 기간도 풀리고 맨 위로
 *   - **[×]** → 분실 · 습득 선택만 푼다. 검색어 · 필터는 그대로(무엇을 지우는지가 눈앞의 [×], 2026-10-07 결정 그대로)
 * 검색어나 필터가 걸려 있으면 고른 칸의 둘째 줄이 "누르면 처음 목록으로"가 된다(QA-P-4 — 누르면 무엇이 함께 풀리는지 누르기 전에).
 * [×]는 고른 칸 **안** 오른쪽 위에 겹쳐 있다. [×]를 노린 누름이 조금 빗나가 칸에 떨어지면 검색어 · 필터까지 풀리므로,
 * **[×] 누르는 면(44px) 둘레 8px 띠는 칸이 받지 않는다**(누름 시작 좌표로 거른다 — QA-P-8, `isPressNear`). 띠 안의 누름은 아무 일도 하지 않는다.
 * 칸 바깥(배경 · 빈 곳 · 두 칸 사이 틈)을 누르는 것은 아무 일도 하지 않는다. 휴대폰 브라우저가 칸 가장자리 바깥 누름을 칸으로
 * 끌어당기는 것은 `isTouchOutside` 로 버린다(칸 상자 밖에 닿은 손가락).
 * 고른 칸은 같은 자리의 링크 그대로다(토글 버튼으로 바꾸지 않는다 — 주소가 바뀌는 이동이고 새 탭 열기 · 뒤로가기 1번 복귀가 된다).
 * 무엇을 하는지는 보이는 이름 뒤 설명(`aria-describedby`)이 말한다.
 * 칸을 고르면 검색어와 함께 쓴다 — 검색은 두 종류를 함께 찾고, 칸을 누르면 검색어는 그대로 둔 채 한쪽만 남긴다.
 */
export function PostIntentPicker({ selected, hrefFor, resetTo, showCounts, onReset }: PostIntentPickerProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const resetRef = useRef<HTMLAnchorElement>(null)
  const resetHintId = useId()
  /** [×] 는 누르면 사라진다. 전체로 돌아간 뒤 방금 풀린 선택지로 포커스를 옮긴다 */
  const refocus = useRef<PostType | null>(null)

  useEffect(() => {
    const concept = refocus.current
    if (!concept) return
    refocus.current = null
    listRef.current?.querySelector<HTMLElement>(`[data-concept="${concept}"] a`)?.focus()
  }, [selected])

  return (
    <ul ref={listRef} className={styles.intents} role="list" aria-label="글 종류">
      {POST_INTENTS.map((intent) => {
        const on = selected === intent.concept
        return (
          <li
            key={intent.concept}
            className={styles.item}
            data-concept={intent.concept}
            data-state={on ? 'on' : selected ? 'off' : 'idle'}
          >
            <Link
              className={styles.choice}
              to={on ? resetTo : hrefFor(intent.concept)}
              aria-current={on ? 'true' : undefined}
              aria-describedby={on ? resetHintId : undefined}
              onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                // 손가락이 칸 상자 밖에 닿았는데 브라우저가 끌어당긴 누름 — 버린다(검색어 · 필터가 한꺼번에 풀리지 않게)
                if (isTouchOutside(event.currentTarget, event)) {
                  event.preventDefault()
                  return
                }
                // [×]를 노리다 빗나간 누름 — [×] 누르는 면 둘레 띠 안이면 칸도 받지 않는다(처음 목록으로 가지 않는다, QA-P-8)
                if (on && resetRef.current && isPressNear(resetRef.current, event.nativeEvent, resetGuard(resetRef.current))) {
                  event.preventDefault()
                  return
                }
                if (on && isPlainClick(event)) onReset?.()
              }}
            >
              <span className={styles.label}>
                <span>{intent.label[0]}</span> <span>{intent.label[1]}</span>
              </span>
              {on && !showCounts ? (
                // 검색어 · 필터가 걸려 있다 — 누르면 그것까지 풀린다는 것을 둘째 줄이 먼저 말한다(칸 크기는 그대로)
                <span className={styles.hint} data-single="">
                  누르면 처음 목록으로
                </span>
              ) : (
                <IntentHint intent={intent} on={on} showCount={showCounts} />
              )}
            </Link>
            {on ? (
              <Link
                ref={resetRef}
                className={styles.reset}
                to={hrefFor(undefined)}
                aria-label="선택 풀고 분실 글과 습득 글 모두 보기"
                onClick={(event: MouseEvent) => {
                  // 새 탭으로 여는 클릭은 이 화면을 바꾸지 않는다. 포커스 이동을 예약하면 나중에 엉뚱할 때 튄다
                  if (isPlainClick(event)) refocus.current = intent.concept
                }}
              >
                <X />
              </Link>
            ) : null}
            {on ? (
              <span id={resetHintId} hidden>
                {showCounts
                  ? '누르면 선택을 풀고 처음 목록으로 돌아가요.'
                  : '누르면 선택을 풀고 처음 목록으로 돌아가요. 검색어와 조건도 풀려요.'}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * [×] 상자(보이는 원)에서 칸이 받지 않을 띠까지의 거리(px) — 누르는 면(::after, 44px)까지 + 8px(0.5rem, 글자를 키우면 같이 큰다).
 * 보이는 원 32px 이면 6 + 8 = 14px
 */
function resetGuard(reset: HTMLElement): number {
  const visible = reset.getBoundingClientRect().width
  const hit = parseFloat(getComputedStyle(reset, '::after').width) || visible
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return Math.max(hit - visible, 0) / 2 + rem * 0.5
}

/**
 * 무엇을 보게 되는지 한 줄 — "분실 글 · 12건 보기". 카드 이름표와 같은 말이다. 좁은 칸에서는 두 조각을 두 줄로 끊는다
 * (넓은 칸에서는 면 오른쪽 끝에 한 줄로 선다 — CSS).
 * 건수는 목록과 별개로 불러온다 — 목록을 막지 않는다. **기준은 기본 목록과 같은 "진행 중"**(게시중 + 연락중, 회의 ⑧) —
 * 칸을 눌러 나오는 건수와 같다.
 * 불러오는 동안 숫자 자리를 비워 두어 글자가 밀리지 않고, 실패하면 숫자 대신 "모두" 를 쓴다.
 * 검색어 · 필터가 걸려 있으면 숫자를 빼고 **한 줄로 이어 쓴다**("분실 글 보기") —
 * 두 줄로 끊으면 "보기" 한 단어가 둘째 줄에 홀로 남는다.
 */
function IntentHint({ intent, on, showCount }: { intent: PostIntent; on: boolean; showCount: boolean }) {
  const count = useQuery({
    ...postListQueryOptions({ type: intent.concept, status: DEFAULT_LIST_STATUSES, size: 1 }),
    select: (data) => data.page.totalElements,
  })

  if (!showCount) {
    return (
      <span className={styles.hint} data-single="">
        {intent.sees} {intentHintTail(null, on)}
      </span>
    )
  }

  if (count.isPending) {
    return (
      <span className={styles.hint}>
        <span className="sr-only">
          {intent.sees} {intentHintTail(undefined, on)}
        </span>
        <span aria-hidden="true">{intent.sees}</span>{' '}
        <span aria-hidden="true">
          <span className={styles.countPending} />건 {on ? '보는 중' : '보기'}
        </span>
      </span>
    )
  }

  return (
    <span className={styles.hint}>
      <span>{intent.sees}</span> <span>{intentHintTail(count.isSuccess ? count.data : undefined, on)}</span>
    </span>
  )
}
