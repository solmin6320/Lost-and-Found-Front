import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'

import { useLateFlag } from '@/shared/lib/useLateFlag'
import type { PagedModel } from '@/shared/types/api'
import { MagnifyingGlass, X } from '@/shared/ui/icons'
import { LoadingDots } from '@/shared/ui/LoadingDots'

import type { PostListParams, PostListResponse } from '../api/types'
import { KEYWORD_MAX_LENGTH } from '../model/postListSearch'
import { postSuggestionQueryOptions } from '../model/postQueries'
import {
  SUGGESTION_DEBOUNCE_MS,
  foldLead,
  SUGGESTION_HOLD_EMPTY_MS,
  highlightParts,
  resolveSuggestions,
  suggestTerm,
  suggestionKeyAction,
  titleMatches,
  type SuggestionView,
} from '../model/searchSuggest'
import styles from './PostSearchBar.module.css'
import { StatusBadge } from './StatusBadge'
import { TypeBadge } from './TypeBadge'

interface PostSearchBarProps {
  /** 지금 적용된 검색어. 바뀌면(뒤로가기) 입력칸을 새로 시작하도록 연 쪽이 `key` 로 준다 */
  keyword: string
  /**
   * 검색어를 적용한다(지울 때는 `''`). 입력칸은 `key` 때문에 새로 그려져 포커스를 잃으므로,
   * 포커스는 연 쪽이 결과 제목으로 옮긴다 — 휴대폰 키보드도 그때 내려간다
   */
  onSearch: (keyword: string) => void
  /**
   * 찾을 말 → 추천 요청 조건. 연 쪽이 지금 목록 조건으로 만든다 — **그 말로 Enter 를 눌렀을 때 나올 목록의 앞 5건**
   * (`suggestionParams` — 새 검색어는 분실 · 습득을 함께, 상태는 목록과 같은 기준)
   */
  suggestionParams: (term: string) => PostListParams
  /** 추천 글을 골랐다(누름 · 화살표로 가리키고 Enter). 연 쪽이 상세로 데려간다 */
  onOpenPost: (postId: number) => void
}

/** 휴대폰 키보드 위로 남은 높이가 이보다 작으면 검색칸을 위로 올려 추천 칸이 키보드에 묻히지 않게 한다 */
const ROOM_MIN_PX = 200

/**
 * 제목 · 본문 검색 + 치는 동안의 추천(본인 피드백 2026-10-07).
 *
 * **검색** — Enter(휴대폰 키보드의 [검색]) 또는 왼쪽 돋보기 버튼에서 보낸다. 한 글자마다 목록을 바꾸지 않는다 —
 * 뒤로가기 기록이 글자 수만큼 쌓이지 않는다. 보낸 뒤 포커스는 결과 제목으로 간다(연 쪽이 옮긴다).
 * 새 검색어는 분실 · 습득 글을 함께 찾는다(골라 둔 칸을 푼다 — `withKeyword`).
 *
 * **추천** — WAI-ARIA 콤보박스(목록 자동완성, 고르기는 직접). 포커스는 늘 입력칸에 있고 가리키는 칸은
 * `aria-activedescendant` 로 알린다. 치는 대로(0.12초 멈추면) 맞는 글 다섯 개를 칸 아래에 띄운다(본인 피드백 2026-10-14 — 바로바로).
 *   - **한글 조합 중에도** 지금 보이는 글자로 찾는다("지" → "직" → "지가" → "지갑"). 끝에 매달린 낱자모("지ㄱ")로는 찾지 않는다
 *   - **치는 순간(0ms) 앞 결과를 지금 친 말로 걸러 먼저 보이고**, 서버 응답이 오면 바꾼다. 늦게 온 앞 말의 응답도 지금 말의
 *     앞부분이면 걸러 쓴다(`resolveSuggestions`, QA-D-1 · P-1). 음절을 확정할 때마다 칸이 닫혔다 열리지 않는다
 *   - "맞는 글이 없어요"는 **서버가 지금 말로 0건을 확정했을 때만**. 조합 중인 끝 글자("직" · "지가")의 0건은 손이 0.6초 멈춘 뒤
 *   - 빈칸 · 공백뿐이면 띄우지 않는다
 *   - 앞 요청은 끊지 않는다 — 늦게 온 앞 말의 응답은 캐시에 남아 지금 말의 앞부분이면 걸러 쓰인다. 지금 보이는 것을 덮지는 않는다
 *     (그리는 것은 늘 지금 친 말로 고른다 — `resolveSuggestions`)
 *   - 요청이 0.3초를 넘기면 그때만 **검색칸 안 지우기 [X] 왼쪽에 점 셋**(찾는 말이 바뀌면 0.3초를 새로 센다, QA-D-4 · P-2).
 *     추천 칸 높이는 바뀌지 않는다
 *   - 제목에서 **맞는 조각만** 강조한다(`<mark>`, React 노드 — HTML 문자열로 만들지 않는다)
 *   - ↑ ↓ 로 가리키고 Enter 로 연다. 가리킨 칸이 없으면 Enter 는 보통 검색이다
 *   - **Esc · 칸 바깥 누름은 추천 칸만 닫는다 — 친 글자는 남는다**(본인 피드백 2026-10-14). 칸을 다시 누르면 다시 펼친다
 *   - 몇 개를 찾았는지 스크린리더에 조용히 알린다
 *   - 추천은 거들 뿐이다 — 실패하면 칸을 띄우지 않고, 검색은 그대로 된다
 */
export function PostSearchBar({ keyword, onSearch, suggestionParams, onOpenPost }: PostSearchBarProps) {
  const inputId = useId()
  const listboxId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(keyword)
  /** 한글 조합 중인가 */
  const [composing, setComposing] = useState(false)
  /** 추천을 찾은 말 — 입력이 멈춘 뒤에만 바뀐다 */
  const [term, setTerm] = useState('')
  /** 사용자가 이 칸에서 치고 있다(추천을 보여도 된다). 칸을 벗어나거나 Esc · 보내기 · 고르기에서 닫는다 */
  const [open, setOpen] = useState(false)
  const [activeState, setActiveState] = useState<{ list: string; index: number }>({ list: '', index: -1 })

  const typed = suggestTerm(text, composing)

  // 입력이 멈추면 찾는다. 비우는 것은 입력 이벤트가 바로 한다(`changeText`) — 빈 칸에는 추천 칸이 없다
  useEffect(() => {
    if (typed === '') return
    const timer = setTimeout(() => setTerm(typed), SUGGESTION_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [typed])

  /** 손이 멈춘 말 — 조합 중 0건을 미루는 것은 이 말이 될 때까지다 */
  const [restedOn, setRestedOn] = useState('')
  useEffect(() => {
    if (typed === '') return
    const timer = setTimeout(() => setRestedOn(typed), SUGGESTION_HOLD_EMPTY_MS)
    return () => clearTimeout(timer)
  }, [typed])

  /** 글자가 바뀌었다. 찾을 말이 없어지면 추천을 바로 거둔다 — 다시 칠 때 앞의 추천이 잠깐 비치지 않게 */
  function changeText(value: string, composingNow: boolean) {
    setText(value)
    if (suggestTerm(value, composingNow) === '') setTerm('')
  }

  const query = useQuery({
    ...postSuggestionQueryOptions(suggestionParams(term)),
    enabled: term !== '',
    // 거드는 기능이다 — 실패를 되풀이해 묻지 않는다. 사용자는 이미 다음 글자를 치고 있다
    retry: false,
  })

  // 서버가 어떤 말이든 답을 주면 다시 그린다 — 늦게 온 앞 말의 응답도 지금 말의 앞부분이면 걸러 쓴다
  const queryClient = useQueryClient()
  const [, setCacheTick] = useState(0)
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && event.action.type === 'success') setCacheTick((tick) => tick + 1)
      }),
    [queryClient],
  )
  const lookup = (word: string) =>
    queryClient.getQueryData<PagedModel<PostListResponse>>(postSuggestionQueryOptions(suggestionParams(word)).queryKey)?.content

  /** 직전에 그린 결과 — 새 말의 결과를 아직 모를 때 그대로 둔다(칸이 닫혔다 열리지 않게) */
  const [last, setLast] = useState<{ key: string; view: SuggestionView<PostListResponse> } | null>(null)
  const view = resolveSuggestions({
    typed,
    composing,
    rested: restedOn === typed,
    lookup,
    last: last?.view ?? null,
  })
  const viewKey = view && view.items.length > 0 ? `${view.term}|${view.items.map((post) => post.id).join(',')}` : null
  if (viewKey && view && last?.key !== viewKey) setLast({ key: viewKey, view })
  if (typed === '' && last !== null) setLast(null)

  const items: readonly PostListResponse[] = view?.items ?? []
  const shownTerm = view?.term ?? ''
  const listKey = items.map((post) => post.id).join(',')
  const active = activeState.list === listKey ? activeState.index : -1

  const showing = open && typed !== ''
  const expanded = showing && items.length > 0
  // 0건은 서버가 지금 친 말로 확정했을 때만 말한다(치는 도중에 "없어요"가 깜빡이지 않게)
  const empty = showing && items.length === 0 && view?.confirmed === true
  /** 요청이 0.3초를 넘었다 — 검색칸 안 점 셋(LoadingDots 가 0.3초 · 최소 0.45초를 센다). 찾는 말이 바뀌면 새로 센다 */
  const fetching = showing && query.isFetching
  /** 보일 것이 아직 하나도 없는데 0.3초가 넘었다 — 스크린리더에 "찾는 중" */
  const loading = useLateFlag(fetching && !expanded && !empty, undefined, { resetKey: term })

  // 알림은 건수가 바뀔 때만 — 확정된 결과(또는 처음 기다림)로만 바꾸고, 치는 도중 거른 결과로는 바꾸지 않는다
  const [announcement, setAnnouncement] = useState('')
  const nextAnnouncement = !showing
    ? ''
    : view?.confirmed
      ? items.length > 0
        ? `추천 글 ${items.length}개가 있어요. 위아래 화살표로 고를 수 있어요.`
        : '맞는 글이 없어요.'
      : loading && !expanded
        ? '찾는 중이에요.'
        : announcement
  if (nextAnnouncement !== announcement) setAnnouncement(nextAnnouncement)

  const popup = expanded || empty
  const room = useRoomBelow(formRef, popup)
  useOutsidePress(formRef, popup || open, () => close())

  function close() {
    setOpen(false)
    setActiveState({ list: '', index: -1 })
  }

  function pick(post: PostListResponse) {
    close()
    onOpenPost(post.id)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = expanded && active >= 0 ? items[active] : undefined
    if (target) {
      pick(target)
      return
    }
    const next = text.trim()
    close()
    // 찾을 말도, 지울 검색어도 없다 — 돋보기를 눌렀으면 칠 자리로 데려간다
    if (!next && !keyword) {
      inputRef.current?.focus()
      return
    }
    onSearch(next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 조합을 끝내는 키(Safari 는 keyCode 229)는 칸 이동으로 읽지 않는다
    const composingNow = event.nativeEvent.isComposing || event.keyCode === 229
    const action = suggestionKeyAction({
      key: event.key,
      open: expanded,
      popup,
      active,
      count: items.length,
      composing: composingNow,
    })
    if (action.type === 'move') {
      event.preventDefault()
      setOpen(true)
      setActiveState({ list: listKey, index: action.active })
    } else if (action.type === 'close') {
      event.preventDefault()
      close()
    } else if (action.type === 'keep') {
      // 검색칸(type=search)의 브라우저 기본 Esc 는 글자를 지운다 — 친 글자는 남긴다
      event.preventDefault()
    } else if (event.key === 'ArrowDown' && !composingNow && !expanded && typed !== '') {
      // 닫아 둔 추천을 다시 연다(APG — ↓는 목록을 연다). 아직 찾지 않은 말이면 지금 찾는다
      event.preventDefault()
      setOpen(true)
      setTerm(typed)
    }
  }

  function handleCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    setComposing(false)
    // 조합이 끝난 마지막 글자까지 담는다(브라우저마다 input 이벤트와 순서가 다르다)
    changeText(event.currentTarget.value, false)
  }

  /** 닫아 둔 추천을 칸을 다시 눌러 연다(Esc · 바깥 누름 뒤) — 친 글자가 있을 때만 */
  function reopen() {
    if (open || typed === '') return
    setOpen(true)
    setTerm(typed)
  }

  // 적용된 검색어를 지우면 목록이 바뀐다 — 결과로 간다. 치던 글자만 지우면 그 자리에서 다시 친다
  function handleClear() {
    changeText('', false)
    close()
    if (keyword) {
      onSearch('')
    } else {
      inputRef.current?.focus()
    }
  }

  const optionId = (index: number) => `${listboxId}-option-${index}`

  return (
    <form ref={formRef} role="search" className={styles.form} onSubmit={handleSubmit}>
      <label htmlFor={inputId} className="sr-only">
        검색어
      </label>
      {/* 돋보기도 보내기다(본인 피드백 2026-10-07). 보이는 아이콘 20px, 누르는 면 44px. Enter 와 같은 일을 한다 */}
      <button type="submit" className={styles.submit} aria-label="검색">
        <MagnifyingGlass />
      </button>
      <input
        ref={inputRef}
        id={inputId}
        className={styles.input}
        type="search"
        name="keyword"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        value={text}
        onChange={(event) => {
          changeText(event.target.value, composing)
          setOpen(true)
        }}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        onClick={reopen}
        onBlur={close}
        placeholder="물건 이름으로 검색"
        maxLength={KEYWORD_MAX_LENGTH}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {/* 요청이 0.3초를 넘으면 지우기 [X] 왼쪽에 점 셋 — 추천 칸 높이를 바꾸지 않는다. 읽기는 아래 알림 줄이 맡는다 */}
      <LoadingDots
        active={fetching}
        resetKey={term}
        variant="inline"
        announce={false}
        className={styles.fetching}
      />
      {text ? (
        <button type="button" className={styles.clear} aria-label="검색어 지우기" onClick={handleClear}>
          <X />
        </button>
      ) : null}

      <div
        className={styles.popup}
        hidden={!popup}
        style={room === null ? undefined : { maxHeight: room }}
      >
        <ul id={listboxId} role="listbox" aria-label="추천 글" className={styles.listbox} hidden={!expanded}>
          {items.map((post, index) => {
            const matched = titleMatches(post.title, shownTerm)
            // 맞는 조각이 한 줄 끝 너머로 잘리지 않게 앞을 접는다. 접은 글은 스크린리더가 그대로 읽는다
            const { folded, parts } = foldLead(highlightParts(post.title, shownTerm))
            return (
              <li
                key={post.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                className={styles.option}
                data-done={post.status === 'DONE' || undefined}
                // 누르는 동안 포커스를 입력칸에 둔다 — 칸을 벗어나며 추천이 닫혀 누름이 허공에 떨어지지 않게
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(post)}
              >
                <TypeBadge type={post.type} />
                <span className="sr-only">, </span>
                <span className={styles.optionTitle}>
                  {folded ? (
                    <>
                      <span className="sr-only">{folded}</span>
                      <span aria-hidden="true">…</span>
                    </>
                  ) : null}
                  {parts.map((part, at) =>
                    part.match ? (
                      <mark key={at} className={styles.match}>
                        {part.text}
                      </mark>
                    ) : (
                      <Fragment key={at}>{part.text}</Fragment>
                    ),
                  )}
                </span>
                {matched ? null : (
                  <>
                    <span className="sr-only">, </span>
                    <span className={styles.optionWhere}>내용에서 찾음</span>
                  </>
                )}
                <span className="sr-only">, </span>
                <StatusBadge status={post.status} />
              </li>
            )
          })}
        </ul>
        {empty ? <p className={styles.note}>맞는 글이 없어요.</p> : null}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </form>
  )
}

/**
 * 추천 칸이 떠 있는 동안 검색 폼 **바깥**을 누르면 닫는다(친 글자는 그대로). 칸을 벗어나면(blur) 이미 닫히지만,
 * 휴대폰에서 키보드만 내리고 포커스가 칸에 남은 채 빈 곳을 누르면 blur 가 오지 않아 칸이 남아 있었다.
 * 누름의 시작(`pointerdown`)에서 판단한다 — 스크롤하려고 댄 손가락도 "바깥"이다(관례 : 바깥을 만지면 닫힌다)
 */
function useOutsidePress(ref: RefObject<HTMLElement | null>, active: boolean, onOutside: () => void) {
  const latest = useRef(onOutside)
  useLayoutEffect(() => {
    latest.current = onOutside
  })
  useEffect(() => {
    if (!active) return
    function handle(event: PointerEvent) {
      const root = ref.current
      if (root && event.target instanceof Node && !root.contains(event.target)) latest.current()
    }
    document.addEventListener('pointerdown', handle, true)
    return () => document.removeEventListener('pointerdown', handle, true)
  }, [ref, active])
}

/**
 * 추천 칸이 쓸 수 있는 높이(px). 휴대폰 키보드가 뜨면 화면(visual viewport)이 줄어든다 —
 * 남은 높이 안에서만 펼치고(넘치면 칸 안에서 스크롤), 남은 높이가 너무 작으면 검색칸을 위로 한 번 올린다.
 * 키보드가 없는 큰 화면은 `null`(CSS 기본 높이).
 */
function useRoomBelow(formRef: RefObject<HTMLFormElement | null>, showing: boolean): number | null {
  const [room, setRoom] = useState<number | null>(null)

  useLayoutEffect(() => {
    const viewport = window.visualViewport
    const form = formRef.current
    if (!showing || !viewport || !form || !window.matchMedia('(pointer: coarse)').matches) return

    let lifted = false
    function measure() {
      if (!viewport || !form) return
      const bottom = form.getBoundingClientRect().bottom
      const space = Math.floor(viewport.offsetTop + viewport.height - bottom - 12)
      if (space < ROOM_MIN_PX && !lifted) {
        lifted = true
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        // 위에 붙은 헤더 · 칩 줄 밑으로 숨지 않게 문서의 scroll-padding-top 을 따른다
        form.scrollIntoView({ block: 'start', behavior: reduce ? 'instant' : 'smooth' })
      }
      setRoom(Math.max(space, 120))
    }

    measure()
    viewport.addEventListener('resize', measure)
    viewport.addEventListener('scroll', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      viewport.removeEventListener('resize', measure)
      viewport.removeEventListener('scroll', measure)
      window.removeEventListener('scroll', measure)
      setRoom(null)
    }
  }, [formRef, showing])

  return room
}
