import { keepPreviousData, useQuery } from '@tanstack/react-query'
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

import { MagnifyingGlass, X } from '@/shared/ui/icons'

import type { PostListParams, PostListResponse } from '../api/types'
import { KEYWORD_MAX_LENGTH } from '../model/postListSearch'
import { postListQueryOptions } from '../model/postQueries'
import {
  SUGGESTION_DEBOUNCE_MS,
  foldLead,
  highlightParts,
  suggestTerm,
  suggestionKeyAction,
  titleMatches,
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

/** 첫 응답이 이보다 늦으면 "찾는 중…"을 보인다. 빠른 응답에는 아무것도 깜빡이지 않는다 */
const LOADING_SHOW_MS = 400
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
 * `aria-activedescendant` 로 알린다. 치다가 0.3초 멈추면 맞는 글 다섯 개를 칸 아래에 띄운다.
 *   - 빈칸 · 공백뿐이면 띄우지 않는다. 한글 조합 중 끝에 매달린 낱자모("지ㄱ")로는 찾지 않는다
 *   - 앞 요청은 새 말이 오면 버린다(쿼리 키에 말이 들어 있다 — 안 쓰게 된 요청은 TanStack Query 가 취소한다)
 *   - 새 결과를 받는 동안 앞 결과를 그대로 둔다 — 칸이 비었다 찼다 깜빡이지 않는다. 첫 응답이 늦을 때만 "찾는 중…"
 *   - 제목에서 **맞는 조각만** 강조한다(`<mark>`, React 노드 — HTML 문자열로 만들지 않는다)
 *   - ↑ ↓ 로 가리키고 Enter 로 연다. 가리킨 칸이 없으면 Enter 는 보통 검색이다. Esc · 칸 밖을 누르면 닫힌다
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

  /** 글자가 바뀌었다. 찾을 말이 없어지면 추천을 바로 거둔다 — 다시 칠 때 앞의 추천이 잠깐 비치지 않게 */
  function changeText(value: string, composingNow: boolean) {
    setText(value)
    if (suggestTerm(value, composingNow) === '') setTerm('')
  }

  const query = useQuery({
    ...postListQueryOptions(suggestionParams(term)),
    enabled: term !== '',
    placeholderData: keepPreviousData,
    // 거드는 기능이다 — 실패를 되풀이해 묻지 않는다. 사용자는 이미 다음 글자를 치고 있다
    retry: false,
  })

  /** 지금 보이는 결과가 어떤 말의 것인가 — 강조는 그 말로 한다(새 결과를 받는 동안 앞 결과를 그대로 그린다) */
  const [shownTerm, setShownTerm] = useState('')
  if (query.data && !query.isPlaceholderData && term !== '' && shownTerm !== term) {
    setShownTerm(term)
  }

  const items: PostListResponse[] = term !== '' && query.data && !query.isError ? query.data.content : []
  const listKey = items.map((post) => post.id).join(',')
  const active = activeState.list === listKey ? activeState.index : -1

  const showing = open && typed !== '' && term !== ''
  const expanded = showing && items.length > 0
  // 0건은 지금 친 말의 결과가 확정됐을 때만 말한다(치는 도중에 "없어요"가 깜빡이지 않게)
  const empty = showing && items.length === 0 && query.isSuccess && !query.isPlaceholderData && term === typed
  const loading = useLate(showing && query.isFetching && !query.data, LOADING_SHOW_MS)

  const announcement = expanded
    ? `추천 글 ${items.length}개가 있어요. 위아래 화살표로 고를 수 있어요.`
    : empty
      ? '맞는 글이 없어요.'
      : ''

  const room = useRoomBelow(formRef, expanded || empty || loading)

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
        onBlur={close}
        placeholder="물건 이름으로 검색"
        maxLength={KEYWORD_MAX_LENGTH}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
      />
      {text ? (
        <button type="button" className={styles.clear} aria-label="검색어 지우기" onClick={handleClear}>
          <X />
        </button>
      ) : null}

      <div
        className={styles.popup}
        hidden={!(expanded || empty || loading)}
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
        {loading && !expanded && !empty ? <p className={styles.note}>찾는 중…</p> : null}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </form>
  )
}

/** `flag` 가 `ms` 넘게 이어졌는가. 짧게 켜졌다 꺼지면 끝까지 `false` — 빠른 응답에 "찾는 중…"이 깜빡이지 않는다 */
function useLate(flag: boolean, ms: number): boolean {
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (!flag) return
    const timer = setTimeout(() => setLate(true), ms)
    return () => {
      clearTimeout(timer)
      setLate(false)
    }
  }, [flag, ms])
  return flag && late
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
