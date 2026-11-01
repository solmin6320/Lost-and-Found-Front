import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

import { useDirtyField, type LeaveCopy } from '@/shared/lib/dirtyRegistry'
import { detectPersonalInfo } from '@/shared/lib/personalInfo'
import { useMediaQuery } from '@/shared/lib/useMediaQuery'
import { Button } from '@/shared/ui/Button'
import { PaperPlaneRight, ShieldCheck } from '@/shared/ui/icons'

import { CHAT_MESSAGE_MAX_LENGTH } from '../api/types'
import styles from './chat.module.css'

/** 글자 수를 보이기 시작하는 지점 — 한도의 80%(폼 규칙) */
const COUNT_FROM = Math.floor(CHAT_MESSAGE_MAX_LENGTH * 0.8)

const LEAVE_COPY: LeaveCopy = {
  title: '보내지 않은 메시지를 두고 나갈까요?',
  body: '나가면 쓰던 메시지는 저장되지 않아요.',
}

interface ChatComposerProps {
  /** 연결이 열려 있지 않다 — 보내기 단추를 잠그고 까닭(끊김 줄)을 가리킨다 */
  offline: boolean
  /** 끊김 줄 id(`aria-describedby`) */
  offlineNoteId?: string
  onSend: (content: string) => void
}

/**
 * 입력 줄 — 화면 아래에 붙는 유일한 줄(붙는 것 총량). 칸 16px(iOS 확대 방지) · 보내기 48×48.
 *
 * - 휴대폰(`pointer: coarse`)은 **Enter = 줄바꿈**, 보내기는 단추만. 넓은 화면(마우스)은 Enter = 보내기 · Shift+Enter = 줄바꿈.
 *   한글 조합 중 Enter 는 보내지 않는다(`isComposing`)
 * - 보내면 칸을 바로 비우고 말풍선이 "보내는 중"으로 선다 — 같은 말이 두 번 가지 않는다(칸이 비어 두 번째 누름은 아무것도 안 한다)
 * - 번호 모양을 치면 그때만 한 줄 : 보내면 가려진다는 사실(막지 않는다, 빨강 아님 — 잉크 굵게). 평소 안내는 방이 열릴 때의 안내 메시지가 한 번 한다
 * - 쓰던 글자가 있으면 이탈 확인(쓰던 칸 등록부)
 */
export function ChatComposer({ offline, offlineNoteId, onSend }: ChatComposerProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  const touch = useMediaQuery('(pointer: coarse)')
  const trimmed = text.trim()
  const hit = trimmed ? detectPersonalInfo(text) : null
  useDirtyField(trimmed.length > 0, LEAVE_COPY)

  function submit() {
    if (!trimmed || offline) return
    onSend(trimmed)
    setText('')
    inputRef.current?.focus()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || touch) return
    event.preventDefault()
    submit()
  }

  const describedBy = [hit ? `${id}-hit` : null, text.length >= COUNT_FROM ? `${id}-count` : null, offline ? offlineNoteId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      {hit ? (
        <p className={styles.composerNote} id={`${id}-hit`} aria-live="polite">
          <ShieldCheck />
          보내면 이 번호는 가려져서 상대에게 보이지 않아요.
        </p>
      ) : null}
      <div className={styles.composerRow}>
        <label className="sr-only" htmlFor={id}>
          메시지
        </label>
        <textarea
          ref={inputRef}
          id={id}
          className={styles.input}
          rows={1}
          value={text}
          placeholder="메시지를 적어 주세요"
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint={touch ? 'enter' : 'send'}
          aria-describedby={describedBy || undefined}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="submit"
          variant="primary"
          className={styles.send}
          unavailable={!trimmed || offline}
          aria-label="보내기"
        >
          <PaperPlaneRight />
        </Button>
      </div>
      {text.length >= COUNT_FROM ? (
        <p className={styles.count} id={`${id}-count`}>
          {text.length.toLocaleString('ko-KR')} / {CHAT_MESSAGE_MAX_LENGTH.toLocaleString('ko-KR')}
        </p>
      ) : null}
    </form>
  )
}
