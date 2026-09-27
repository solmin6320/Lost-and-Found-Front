import { useId, useRef, useState, type FormEvent } from 'react'

import { formatDate } from '@/shared/lib/date'
import { getErrorMessage } from '@/shared/lib/http'
import { Button } from '@/shared/ui/Button'
import { Check } from '@/shared/ui/icons'
import { Skeleton } from '@/shared/ui/Skeleton'
import { TextField } from '@/shared/ui/TextField'

import { NICKNAME_MAX_LENGTH, type MemberResponse } from '../api/types'
import { useUpdateNickname } from '../model/memberMutations'
import styles from './ProfileSection.module.css'

/** 결과 고지 — 누르기 전에, 한 번(화면정의서 1.6). 입력 아래 상시 */
const NICKNAME_NOTICE = '닉네임을 바꾸면 지금까지 쓴 글과 댓글의 이름도 함께 바뀝니다.'
/** 서버 `@NotBlank` 문구와 같다. 보내기 전에 화면이 먼저 막는다 */
const NICKNAME_REQUIRED = '닉네임은 필수입니다'

/**
 * [3.7] 내 정보 + [3.6] 닉네임 바꾸기. 로그인했을 때만 그린다.
 * 이메일은 읽기 전용 글자다 — 로그인 식별자라 바꿀 수 없다. 프로필 사진 · 이메일 변경은 백엔드에 없어 두지 않는다.
 */
export function ProfileSection({ me }: { me: MemberResponse }) {
  return (
    <div className={styles.profile}>
      <dl className={styles.facts}>
        <div>
          <dt>이메일</dt>
          <dd>{me.email}</dd>
        </div>
        {me.createdAt ? (
          <div>
            <dt>가입일</dt>
            <dd>
              <time dateTime={me.createdAt}>{formatDate(me.createdAt)}</time>
            </dd>
          </div>
        ) : null}
      </dl>
      <NicknameForm current={me.nickname} />
    </div>
  )
}

/** 불러오는 동안 — 빈 입력칸을 먼저 보여주지 않는다(사용자가 치기 시작해 버린다) */
export function ProfileSectionSkeleton() {
  return (
    <div className={styles.profile} aria-hidden="true">
      <div className={styles.facts}>
        <Skeleton shape="text" width="15rem" />
        <Skeleton shape="text" width="9rem" />
      </div>
      <div className={styles.skeletonField}>
        <Skeleton shape="text" width="3rem" />
        <Skeleton height="2.75rem" />
      </div>
    </div>
  )
}

/**
 * 닉네임 — 20자까지, 보내기 전에 앞뒤 공백을 잘라 낸다(서버는 자르지 않고 그대로 저장한다).
 * 바꾼 게 없으면 [저장]을 흐리게 두고 누름을 무시한다(`unavailable`). `disabled` 로 잠그면 저장한 순간
 * 누르던 버튼에서 포커스가 빠져 "닉네임을 바꿨어요" 다음을 문서 맨 앞부터 다시 찾아야 한다.
 * 성공하면 이 화면에 머물고 헤더 닉네임이 바로 바뀐다(AuthProvider 가 캐시를 따라간다).
 */
function NicknameForm({ current }: { current: string }) {
  const mutation = useUpdateNickname()
  const [value, setValue] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const trimmed = value.trim()
  const changed = trimmed !== current
  const validate = (text: string) => (text.trim() ? null : NICKNAME_REQUIRED)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const problem = validate(value)
    if (problem) {
      setError(problem)
      inputRef.current?.focus()
      return
    }
    if (!changed) return

    mutation.mutate(
      { nickname: trimmed },
      {
        onSuccess: (me) => {
          setValue(me.nickname)
          setError(null)
          setSaved(true)
        },
        // 409 DUPLICATE_NICKNAME · 400 INVALID_INPUT — 입력이 하나뿐이라 전부 이 입력 아래에 붙인다
        onError: (failure) => {
          setError(getErrorMessage(failure))
          inputRef.current?.focus()
        },
      },
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        ref={inputRef}
        inputId={inputId}
        label="닉네임"
        name="nickname"
        autoComplete="nickname"
        value={value}
        maxLength={NICKNAME_MAX_LENGTH}
        count={{ value: value.length, max: NICKNAME_MAX_LENGTH }}
        readOnly={mutation.isPending}
        error={error}
        hint={NICKNAME_NOTICE}
        onChange={(event) => {
          setValue(event.target.value)
          setSaved(false)
          if (error) setError(null)
        }}
        onBlur={(event) => setError(validate(event.currentTarget.value))}
      />
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          unavailable={!changed && !mutation.isPending}
          aria-disabled={mutation.isPending || undefined}
          aria-describedby={`${inputId}-hint`}
        >
          {mutation.isPending ? '저장하는 중…' : '닉네임 저장'}
        </Button>
        <p className={styles.saved} role="status">
          {saved ? (
            <>
              <Check />
              닉네임을 바꿨어요.
            </>
          ) : null}
        </p>
      </div>
    </form>
  )
}
