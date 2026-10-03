import { useEffect, useRef, useState, type RefObject } from 'react'

import { useBottomInset } from '@/shared/lib/useBottomInset'
import { useMediaQuery } from '@/shared/lib/useMediaQuery'
import { Button } from '@/shared/ui/Button'
import { ChatCircleDots } from '@/shared/ui/icons'

import styles from './CommentBar.module.css'

/**
 * 하단 줄을 쓰는 화면 — 휴대폰 폭이고 **높이가 넉넉할 때만**(40rem 이상).
 * 짧은 화면 · 가로 모드 · 크게 확대한 화면에서는 붙는 줄이 본문을 가리는 몫이 커서 저절로 꺼진다(디자인 회의 총량 규칙)
 */
const BAR_MEDIA = '(max-width: 48rem) and (min-height: 40rem)'

interface CommentBarProps {
  count: number
  /** 완료된 글 — 채움 대신 선 버튼. "이미 돌아간 물건" 에 연락을 재촉하지 않는다 */
  done: boolean
  onOpen: () => void
  /** 배지 줄의 흐름 안 입구. 없으면 쓰는 칸 · 제목 옆 입구만으로 판정한다 */
  flowEntry: HTMLElement | null
  /** 댓글 제목 옆 입구(댓글이 없으면 없다) */
  headingEntry: HTMLElement | null
  /** 쓰는 칸 · 로그인 권유 칸 · 복구 중 자리를 감싼 칸 */
  targetRef: RefObject<HTMLElement | null>
}

interface Seen {
  /** 흐름 안 입구가 화면 위로 나갔다 */
  flowPassed: boolean
  headingEntry: boolean
  target: boolean
}

/**
 * 휴대폰 하단 댓글 줄(①). 첫 화면에는 없다 — 배지 줄의 `댓글 쓰기 N` 이 **화면 위로 나간 뒤**에야 나타나고,
 * 진짜 쓰는 칸(또는 로그인 권유 칸)이나 댓글 제목 옆 입구가 화면에 들어오면 숨는다. 같은 입구가 동시에 둘 보이는 순간이 없다.
 *
 * - 판정은 `IntersectionObserver` 로만 한다. 스크롤 방향 · 댓글 수 같은 값으로 하면 다시 받는 사이 깜빡인다
 * - 그림자 없이 위 1px 선, 채움은 버튼 하나 — 이 화면에서 채운 강조는 이것 하나다(쓰는 칸의 [댓글 남기기]와 동시에 보이지 않는다)
 * - 기기 아래 여백(safe-area)만큼 줄이 길어진다. 높이는 문서에 알린다 — 짧은 알림이 그 위로 비켜 뜬다(`useBottomInset`)
 * - 숨은 동안은 `inert` — Tab · 스크린리더가 보이지 않는 버튼에 닿지 않는다
 */
export function CommentBar(props: CommentBarProps) {
  const enabled = useMediaQuery(BAR_MEDIA)
  return enabled ? <Bar {...props} /> : null
}

function Bar({ count, done, onOpen, flowEntry, headingEntry, targetRef }: CommentBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState<Seen>({ flowPassed: false, headingEntry: false, target: false })
  // 지켜볼 입구가 없으면 그 조건은 늘 통과로 본다
  const flowPassed = flowEntry ? seen.flowPassed : true
  const headingEntryVisible = headingEntry ? seen.headingEntry : false
  const visible = flowPassed && !headingEntryVisible && !seen.target

  useEffect(() => {
    const flow = flowEntry
    const target = targetRef.current
    // 헤더(붙어 있는 56px) 밑으로 들어간 것은 보이지 않는 것이다
    const headerPx = parseFloat(getComputedStyle(document.documentElement).fontSize) * 3.5
    const observer = new IntersectionObserver(
      (entries) => {
        setSeen((before) => {
          const next = { ...before }
          for (const entry of entries) {
            if (entry.target === flow) {
              const top = entry.rootBounds?.top ?? headerPx
              next.flowPassed = !entry.isIntersecting && entry.boundingClientRect.bottom <= top
            } else if (entry.target === headingEntry) {
              next.headingEntry = entry.isIntersecting
            } else if (entry.target === target) {
              next.target = entry.isIntersecting
            }
          }
          return next.flowPassed === before.flowPassed &&
            next.headingEntry === before.headingEntry &&
            next.target === before.target
            ? before
            : next
        })
      },
      { rootMargin: `-${Math.round(headerPx)}px 0px 0px 0px` },
    )
    for (const element of [flow, headingEntry, target]) {
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [flowEntry, headingEntry, targetRef])

  useBottomInset(barRef, visible)

  return (
    <div ref={barRef} className={styles.bar} data-visible={visible || undefined} inert={!visible}>
      <Button variant={done ? 'secondary' : 'primary'} block onClick={onOpen} className={styles.button}>
        <ChatCircleDots />
        댓글 쓰기
        {count > 0 ? (
          <span className={styles.count} data-numeric>
            <span className="sr-only">, 지금 댓글 </span>
            {count.toLocaleString('ko-KR')}
            <span className="sr-only">개</span>
          </span>
        ) : null}
      </Button>
    </div>
  )
}
