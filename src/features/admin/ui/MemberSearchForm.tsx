import { useId, useRef, useState, type FormEvent } from 'react'

import { Button } from '@/shared/ui/Button'
import { MagnifyingGlass, X } from '@/shared/ui/icons'

import { ADMIN_KEYWORD_MAX_LENGTH } from '../model/memberSearch'
import styles from './MemberSearchForm.module.css'

interface MemberSearchFormProps {
  /** 지금 적용된 검색어. 바뀌면(뒤로가기) 연 쪽이 `key` 로 칸을 새로 시작한다 */
  keyword: string
  /** 검색어를 적용한다(지울 때는 `''`). 포커스는 연 쪽이 결과 제목으로 옮긴다 — 휴대폰 키보드도 그때 내려간다 */
  onSearch: (keyword: string) => void
}

/**
 * 회원 찾기 — 닉네임 · 이메일의 일부(서버가 대소문자를 가리지 않는다). Enter(휴대폰 키보드의 [검색]) 또는 `[찾기]`로 보낸다.
 * 한 글자마다 찾지 않는다 — 기록이 글자 수만큼 쌓이지 않고, 관리자 API 를 치는 대로 부르지 않는다.
 *
 * - 칸 이름은 늘 위에 보인다(안내 글을 이름 대신 쓰지 않는다, 화면정의서 1.9). 예시는 칸 안 안내 글
 * - 글자가 있으면 칸 오른쪽 끝에 `[×]`(누르는 면 44px). 적용된 검색어가 있을 때 누르면 검색을 푼다 — 칸만 비우고 결과가 그대로면 무엇을 보는지 헷갈린다
 * - `[찾기]`가 이 화면의 잉크 채움 하나다(폰 레스토프 — 줄마다의 임명 · 해임은 선 버튼)
 */
export function MemberSearchForm({ keyword, onSearch }: MemberSearchFormProps) {
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(keyword)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch(text)
  }

  function clear() {
    setText('')
    if (keyword) {
      onSearch('')
      return
    }
    inputRef.current?.focus()
  }

  return (
    <form className={styles.form} role="search" aria-label="회원 찾기" onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor={inputId}>
        회원 찾기
      </label>
      <div className={styles.row}>
        <div className={styles.control}>
          <MagnifyingGlass className={styles.lead} />
          <input
            ref={inputRef}
            id={inputId}
            className={styles.input}
            type="search"
            name="keyword"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="닉네임이나 이메일 일부"
            maxLength={ADMIN_KEYWORD_MAX_LENGTH}
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={hintId}
          />
          {text ? (
            <button type="button" className={styles.clear} aria-label={keyword ? '검색 풀기' : '글자 지우기'} onClick={clear}>
              <X />
            </button>
          ) : null}
        </div>
        <Button type="submit" variant="primary" className={styles.submit}>
          찾기
        </Button>
      </div>
      <p id={hintId} className="sr-only">
        닉네임이나 이메일의 일부로 찾아요. 대문자와 소문자는 가리지 않아요.
      </p>
    </form>
  )
}
