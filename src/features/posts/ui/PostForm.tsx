import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate, type NavigateOptions, type To } from 'react-router-dom'

import { todayIsoDate } from '@/shared/lib/date'
import { ClientValidationError, getErrorMessage, hasErrorCode } from '@/shared/lib/http'
import { useObjectUrls } from '@/shared/lib/image'
import { useLeaveGuard } from '@/shared/lib/useLeaveGuard'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { FormAlert } from '@/shared/ui/FormAlert'
import { Check, ClockCounterClockwise } from '@/shared/ui/icons'
import { TextArea } from '@/shared/ui/TextArea'
import { TextField } from '@/shared/ui/TextField'

import {
  POST_CONTENT_MAX_LENGTH,
  POST_LOCATION_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  type PostCreateRequest,
  type PostImageChange,
  type PostImageResponse,
  type PostListResponse,
  type PostStatus,
} from '../api/types'
import {
  POST_FORM_FIELDS,
  checkPostField,
  checkPostForm,
  clearPostDraft,
  dateFieldLabel,
  fieldOfServerMessage,
  loadPostDraft,
  samePostFormValues,
  savePostDraft,
  toPostRequest,
  type PostDraft,
  type PostFormErrors,
  type PostFormField,
  type PostFormValues,
} from '../model/postForm'
import type { PostSubmitPhase } from '../model/postMutations'
import { PostCard } from './PostCard'
import { PostCategoryChoice } from './PostCategoryChoice'
import styles from './PostForm.module.css'
import { PostPhotoField, type PhotoItem } from './PostPhotoField'
import { PostTypeChoice } from './PostTypeChoice'

/** 화면을 떠나는 길 — 이탈 확인을 거치지 않는다(저장이 끝났거나, 끝낼 수밖에 없다) */
export type LeaveFn = (to: To, options?: NavigateOptions) => void

interface PostFormProps {
  mode: 'create' | 'edit'
  /** 제목 · 안내 — 폼 칸의 맨 위(넓은 화면에서 미리보기 칸과 나란히 선다) */
  intro: ReactNode
  /** 처음 값. 렌더마다 새로 만들지 않는다(바뀌면 "고친 것이 있다"로 읽는다) */
  initialValues: PostFormValues
  /** 수정 — 지금 사진. 등록은 비운다 */
  existingImages?: readonly PostImageResponse[]
  /** 수정 — 지금 상태. 미리보기 카드가 연락중 · 완료 이름표를 그대로 보여 준다 */
  status?: PostStatus
  /** 임시 보관 키(`postDraftKey`) */
  draftKey: string
  /** 로그인한 회원. 임시 보관은 이 회원에게만 되살려 준다 */
  memberId: number
  /** 로그인이 끊기면 거짓이 된다 — 쓰던 글자를 보관하고 `onSessionLost` 를 부른다 */
  signedIn: boolean
  pending: boolean
  phase: PostSubmitPhase
  /** 보낸다. 성공하면 글 id. 실패하면 오류를 던진다(`useCreatePost` · `useUpdatePost` 의 `mutateAsync`) */
  onSubmit: (body: PostCreateRequest, photos: PostImageChange) => Promise<number>
  /** 저장 끝 — 어디로 갈지는 화면이 정한다 */
  onDone: (postId: number, leave: LeaveFn) => void
  /** 화면이 따로 다루는 실패(수정의 403 · 404). 다뤘으면 `true` */
  onFailure?: (error: unknown, leave: LeaveFn) => boolean
  /** 로그인이 끊겼다. `draftSaved` 면 쓰던 글자를 보관해 두었다 */
  onSessionLost: (draftSaved: boolean, leave: LeaveFn) => void
  /** [작성 취소] — 앱 안에서 들어왔으면 뒤로, 바로 들어왔으면 여기로 */
  cancelTo: To
}

const COPY = {
  create: {
    submit: '올리기',
    submitting: '올리는 중…',
    cancel: '작성 취소',
    cancelTitle: '작성을 취소할까요?',
    cancelBody: '작성 중인 내용이 사라집니다.',
    leaveTitle: '쓰던 글을 두고 나갈까요?',
    leaveBody: '작성 중인 내용이 있습니다. 나가면 저장되지 않습니다.',
    draftTitle: '로그인이 끊기기 전에 쓰던 글이 있어요.',
  },
  edit: {
    submit: '저장하기',
    submitting: '저장하는 중…',
    cancel: '수정 취소',
    cancelTitle: '수정을 취소할까요?',
    cancelBody: '고친 내용이 사라집니다. 글은 고치기 전 그대로 남아요.',
    leaveTitle: '고치던 글을 두고 나갈까요?',
    leaveBody: '수정 중인 내용이 있습니다. 나가면 저장되지 않습니다.',
    draftTitle: '로그인이 끊기기 전에 고치던 내용이 있어요.',
  },
} as const

/** 보내는 동안 보이는 단계. 사진이 없으면 "올리는 중" 하나 */
const STEPS: { phase: Exclude<PostSubmitPhase, 'idle'>; label: string }[] = [
  { phase: 'preparing', label: '사진 줄이는 중' },
  { phase: 'uploading', label: '올리는 중' },
]

/**
 * 게시글 등록 · 수정 폼(SCR-02 · SCR-04). 입력 순서 : 유형 → 사진 → 제목 → 종류 → 장소 → 날짜 → 설명.
 *
 * - 이름은 위, 오류는 아래. 칸을 **벗어날 때** 검사하고(비어 있으면 지나가는 중일 수 있어 제출 때까지 기다린다),
 *   칸을 고치면 그 칸의 오류가 걷힌다. 제출이 막히면 첫 번째로 틀린 칸으로 포커스
 * - 보내는 동안 모든 칸은 읽기 전용, 제출 · 취소는 누름만 무시한다(`aria-disabled`). 두 번 눌러도 글은 하나다
 * - 작성 중 이탈 : 앱 안 이동은 확인 창, 새로고침 · 탭 닫기는 브라우저 확인(`useLeaveGuard`)
 * - [작성 취소] : 쓴 게 있을 때만 "작성 중인 내용이 사라집니다" 확인. 없으면 바로 떠난다
 * - 로그인이 끊기면 쓰던 **글자만** 이 탭에 잠시 보관한다(사진은 못 한다). 다시 로그인해 돌아오면 이어서 쓸지 묻는다
 * - 넓은 화면(64rem 이상)은 오른쪽에 **목록에서 이렇게 보여요** 미리보기 카드 — 첫 장이 대표 사진이 된다는 것을 그대로 본다
 * - 휴대폰에서는 제출 줄이 화면 아래에 붙어 따라온다. 긴 설명을 쓰다가도 [올리기]를 찾지 않는다
 */
export function PostForm({
  mode,
  intro,
  initialValues,
  existingImages = [],
  status = 'OPEN',
  draftKey,
  memberId,
  signedIn,
  pending,
  phase,
  onSubmit,
  onDone,
  onFailure,
  onSessionLost,
  cancelTo,
}: PostFormProps) {
  const copy = COPY[mode]
  const navigate = useNavigate()
  const location = useLocation()
  const formRef = useRef<HTMLFormElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const formId = useId()

  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<PostFormErrors>({})
  const [items, setItems] = useState<PhotoItem[]>([])
  const [removeExisting, setRemoveExisting] = useState(false)
  const [photoError, setPhotoError] = useState<string>()
  const [formError, setFormError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [draft, setDraft] = useState<PostDraft | null>(() => loadPostDraft(draftKey, memberId))
  const [restoredNote, setRestoredNote] = useState<string | null>(null)
  /** 이어 쓰기로 되살렸는데 사진은 보관하지 못했다 — 사진 칸 안에서 다시 골라 달라고 한다 */
  const [lostPhotos, setLostPhotos] = useState(0)
  const today = useMemo(() => todayIsoDate(), [])

  const dirty = !samePostFormValues(values, initialValues) || items.length > 0 || removeExisting
  const guard = useLeaveGuard(dirty || pending)
  const { allowLeave } = guard

  function leave(to: To, options?: NavigateOptions) {
    allowLeave()
    navigate(to, options)
  }

  // 방금 나타난 것(폼 위 오류)으로 포커스. 그리기 전에는 요소가 없다
  const focusAfterRender = useRef<(() => void) | null>(null)
  useEffect(() => {
    focusAfterRender.current?.()
    focusAfterRender.current = null
  })

  // 로그인이 끊겼다(재발급 거절 · 로그아웃) — 쓰던 글자를 보관하고 화면에 알린다. 한 번만
  const latest = useRef({ values, items, removeExisting, dirty, memberId, onSessionLost })
  useEffect(() => {
    latest.current = { values, items, removeExisting, dirty, memberId, onSessionLost }
  })
  const lostHandled = useRef(false)
  useEffect(() => {
    if (signedIn || lostHandled.current) return
    lostHandled.current = true
    const now = latest.current
    const saved =
      now.dirty &&
      savePostDraft(draftKey, {
        memberId: now.memberId,
        savedAt: Date.now(),
        values: now.values,
        photoCount: now.items.length,
        removeExisting: now.removeExisting,
      })
    allowLeave()
    now.onSessionLost(saved, (to, options) => navigate(to, options))
  }, [signedIn, draftKey, allowLeave, navigate])

  function focusField(field: PostFormField | 'photos') {
    const box = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)
    const target =
      box?.querySelector<HTMLElement>('input:checked') ??
      box?.querySelector<HTMLElement>('input:not([type="file"]), textarea, button')
    target?.focus()
  }

  function setField<K extends PostFormField>(field: K, value: PostFormValues[K]) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (errors[field] || (field === 'type' && errors.lostFoundDate)) {
      const updated: PostFormErrors = { ...errors, [field]: undefined }
      // 유형이 바뀌면 날짜 칸 이름(분실일 · 습득일)이 바뀐다. 떠 있는 날짜 오류도 새 이름으로
      if (field === 'type' && errors.lostFoundDate) {
        updated.lostFoundDate = checkPostField('lostFoundDate', next, today)
      }
      setErrors(updated)
    }
    if (formError) setFormError(null)
  }

  /** 벗어날 때 — 비어 있으면 기다린다(지나가는 중일 수 있다). 날짜는 늘 값이 있어 바로 본다 */
  function checkOnBlur(field: PostFormField) {
    const raw = values[field]
    if (field !== 'lostFoundDate' && typeof raw === 'string' && !raw.trim()) return
    setErrors((old) => ({ ...old, [field]: checkPostField(field, values, today) }))
  }

  /** 한 줄 칸의 Enter 는 제출이 아니라 다음 칸으로 — 한 손으로 칸을 이어 간다. 한글 조합 중 Enter 는 건드리지 않는다 */
  function nextOnEnter(next: PostFormField) {
    return (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
      event.preventDefault()
      focusField(next)
    }
  }

  function photoChange(): PostImageChange {
    if (items.length > 0) return { kind: 'replace', files: items.map((item) => item.file) }
    if (removeExisting && existingImages.length > 0) return { kind: 'remove' }
    return { kind: 'keep' }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const found = checkPostForm(values, todayIsoDate())
    setErrors(found)
    setFormError(null)
    setPhotoError(undefined)
    const firstInvalid = POST_FORM_FIELDS.find((field) => found[field])
    if (firstInvalid) {
      focusField(firstInvalid)
      return
    }

    try {
      const postId = await onSubmit(toPostRequest(values), photoChange())
      clearPostDraft(draftKey)
      onDone(postId, leave)
    } catch (failure) {
      handleFailure(failure)
    }
  }

  function handleFailure(failure: unknown) {
    if (onFailure?.(failure, leave)) return
    const message = getErrorMessage(failure)

    // 사진 — 보내기 전에 막혔거나(줄여도 너무 큼 · 읽지 못함) 서버가 거절했다
    if (
      failure instanceof ClientValidationError ||
      hasErrorCode(failure, 'INVALID_IMAGE_EXTENSION') ||
      hasErrorCode(failure, 'EXCEEDED_IMAGE_COUNT')
    ) {
      setPhotoError(message)
      focusField('photos')
      return
    }
    // 로그인이 끊긴 실패는 위의 signedIn 이 거짓이 되며 따로 다룬다. 화면에 오류를 남기지 않는다
    if (hasErrorCode(failure, 'REFRESH_TOKEN_MISMATCH') || hasErrorCode(failure, 'INVALID_REFRESH_TOKEN')) {
      return
    }
    const field = hasErrorCode(failure, 'INVALID_INPUT') ? fieldOfServerMessage(message) : null
    if (field) {
      setErrors({ [field]: message })
      focusField(field)
      return
    }
    setFormError(message)
    focusAfterRender.current = () => alertRef.current?.focus()
  }

  function goBack() {
    // 앱 안에서 들어왔으면 뒤로(보던 목록 · 글 그대로), 주소로 바로 들어왔으면 정한 곳으로
    allowLeave()
    if (location.key !== 'default') navigate(-1)
    else navigate(cancelTo, { replace: true })
  }

  function handleCancel() {
    if (pending) return
    if (dirty) setCancelOpen(true)
    else goBack()
  }

  function restoreDraft(saved: PostDraft) {
    setValues(saved.values)
    setErrors({})
    if (saved.removeExisting && existingImages.length > 0) setRemoveExisting(true)
    clearPostDraft(draftKey)
    setDraft(null)
    setRestoredNote('쓰던 글을 불러왔어요.')
    setLostPhotos(saved.photoCount)
    // 사진을 다시 골라야 하면 그 자리로, 아니면 이어서 쓸 칸으로
    focusAfterRender.current = () =>
      focusField(saved.photoCount > 0 ? 'photos' : saved.values.type ? 'title' : 'type')
  }

  function discardDraft() {
    clearPostDraft(draftKey)
    setDraft(null)
    focusAfterRender.current = () => focusField('type')
  }

  const dateLabel = dateFieldLabel(values.type)
  const readOnly = pending
  const change = items.length > 0 ? 'replace' : removeExisting ? 'remove' : 'keep'

  return (
    <div className={styles.layout}>
      <form
        ref={formRef}
        id={formId}
        className={styles.form}
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
        aria-busy={pending || undefined}
      >
        <div className={styles.intro}>{intro}</div>

        {draft ? (
          <DraftOffer
            draft={draft}
            title={copy.draftTitle}
            onRestore={() => restoreDraft(draft)}
            onDiscard={discardDraft}
          />
        ) : null}
        {restoredNote ? (
          <p className={styles.restored} role="status">
            <Check />
            {restoredNote}
          </p>
        ) : null}

        <div data-field="type">
          <PostTypeChoice
            value={values.type}
            readOnly={readOnly}
            error={errors.type}
            onChange={(type) => setField('type', type)}
          />
        </div>

        <div data-field="photos">
          <PostPhotoField
            items={items}
            onItemsChange={(next) => {
              setItems(next)
              setPhotoError(undefined)
              if (next.length > 0) setLostPhotos(0)
            }}
            lostCount={lostPhotos}
            existing={existingImages}
            removeExisting={removeExisting}
            onRemoveExistingChange={(remove) => {
              setRemoveExisting(remove)
              setPhotoError(undefined)
            }}
            title={initialValues.title}
            readOnly={readOnly}
            error={photoError}
          />
        </div>

        <div data-field="title">
          <TextField
            label="제목"
            name="title"
            value={values.title}
            count={{ value: values.title.trim().length, max: POST_TITLE_MAX_LENGTH }}
            hint={values.type === 'FOUND' ? '예: 에어팟 프로 왼쪽 한 쪽' : '예: 검은색 가죽 반지갑'}
            error={errors.title}
            autoComplete="off"
            enterKeyHint="next"
            readOnly={readOnly}
            onChange={(event) => setField('title', event.target.value)}
            onBlur={() => checkOnBlur('title')}
            onKeyDown={nextOnEnter('category')}
          />
        </div>

        <div data-field="category">
          <PostCategoryChoice
            value={values.category}
            type={values.type}
            readOnly={readOnly}
            error={errors.category}
            onChange={(category) => setField('category', category)}
          />
        </div>

        <div data-field="location">
          <TextField
            label="장소"
            name="location"
            value={values.location}
            count={{ value: values.location.trim().length, max: POST_LOCATION_MAX_LENGTH }}
            hint={
              values.type === 'FOUND'
                ? '주운 곳이나 지금 맡겨 둔 곳. 예: 강남역 2번 출구 고객센터'
                : values.type === 'LOST'
                  ? '잃어버린 것 같은 곳. 예: 강남역 2번 출구'
                  : '예: 강남역 2번 출구'
            }
            error={errors.location}
            autoComplete="off"
            enterKeyHint="next"
            readOnly={readOnly}
            onChange={(event) => setField('location', event.target.value)}
            onBlur={() => checkOnBlur('location')}
            onKeyDown={nextOnEnter('lostFoundDate')}
          />
        </div>

        <div data-field="lostFoundDate" className={styles.dateField}>
          <TextField
            label={dateLabel}
            name="lostFoundDate"
            type="date"
            max={today}
            value={values.lostFoundDate}
            hint={
              values.type === 'LOST'
                ? '잃어버린 날이에요. 정확하지 않으면 마지막으로 본 날을 골라 주세요.'
                : values.type === 'FOUND'
                  ? '주운 날이에요.'
                  : '오늘 이후 날짜는 고를 수 없어요.'
            }
            error={errors.lostFoundDate}
            readOnly={readOnly}
            onChange={(event) => setField('lostFoundDate', event.target.value)}
            onBlur={() => checkOnBlur('lostFoundDate')}
          />
          <QuickDates
            value={values.lostFoundDate}
            today={today}
            disabled={readOnly}
            onPick={(date) => setField('lostFoundDate', date)}
          />
        </div>

        <div data-field="content">
          <TextArea
            label="설명"
            name="content"
            value={values.content}
            max={POST_CONTENT_MAX_LENGTH}
            error={errors.content}
            autoComplete="off"
            readOnly={readOnly}
            rows={5}
            onChange={(event) => setField('content', event.target.value)}
            onBlur={() => checkOnBlur('content')}
            hint={
              <>
                <p>
                  {values.type === 'FOUND'
                    ? '어떤 상태로 어디에 두었는지 적어 주세요. 주인만 알 만한 특징 한두 가지는 적지 않고 남겨 두면 진짜 주인을 가려낼 수 있어요.'
                    : '색, 브랜드, 흠집, 안에 든 것처럼 사진에 안 보이는 특징을 적어 주세요.'}
                </p>
                <p className={styles.privacy}>누구나 보는 글이에요. 전화번호나 집 주소를 적으면 모두에게 보여요.</p>
              </>
            }
          />
        </div>

        <div className={styles.bar}>
          {formError ? (
            <FormAlert ref={alertRef} message={formError} />
          ) : null}
          {pending ? <SubmitSteps phase={phase} withPhotos={change === 'replace'} /> : null}
          <div className={styles.buttons}>
            <Button className={styles.cancel} aria-disabled={pending || undefined} onClick={handleCancel}>
              {copy.cancel}
            </Button>
            <Button type="submit" variant="primary" className={styles.submit} aria-disabled={pending || undefined}>
              {pending ? copy.submitting : copy.submit}
            </Button>
          </div>
        </div>
      </form>

      <PreviewCard
        values={values}
        status={status}
        items={items}
        existing={existingImages}
        removeExisting={removeExisting}
      />

      <ConfirmDialog
        open={cancelOpen}
        title={copy.cancelTitle}
        confirmLabel={copy.cancel}
        cancelLabel="계속 쓰기"
        onConfirm={() => {
          setCancelOpen(false)
          goBack()
        }}
        onClose={() => setCancelOpen(false)}
      >
        <p>{copy.cancelBody}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={guard.blocker.state === 'blocked'}
        title={copy.leaveTitle}
        confirmLabel="나가기"
        cancelLabel="계속 쓰기"
        onConfirm={() => guard.blocker.proceed?.()}
        onClose={() => {
          if (guard.blocker.state === 'blocked') guard.blocker.reset()
        }}
      >
        <p>{copy.leaveBody}</p>
      </ConfirmDialog>
    </div>
  )
}

/** 로그인 뒤 돌아왔다 — 이어서 쓸지 묻는다. 고르기 전에는 빈 폼을 건드려도 이 칸이 남아 있다 */
function DraftOffer({
  draft,
  title,
  onRestore,
  onDiscard,
}: {
  draft: PostDraft
  title: string
  onRestore: () => void
  onDiscard: () => void
}) {
  const headingId = useId()
  const name = draft.values.title.trim()
  return (
    <section className={styles.draft} aria-labelledby={headingId}>
      <ClockCounterClockwise className={styles.draftIcon} />
      <div className={styles.draftBody}>
        <h2 id={headingId} className={styles.draftTitle}>
          {title}
        </h2>
        {name ? <p className={styles.draftName}>{name}</p> : null}
        {draft.photoCount > 0 ? (
          <p className={styles.draftText}>
            고른 사진 {draft.photoCount}장은 보관하지 못해 다시 골라야 해요.
          </p>
        ) : null}
        <div className={styles.draftActions}>
          <Button size="sm" variant="primary" onClick={onRestore}>
            이어서 쓰기
          </Button>
          <Button size="sm" variant="ghost" onClick={onDiscard}>
            새로 쓰기
          </Button>
        </div>
      </div>
    </section>
  )
}

/** [오늘] [어제] — 날짜 칸을 여는 것보다 한 번에. 기본값이 오늘이라 대개 한 번 누르거나 안 누른다 */
function QuickDates({
  value,
  today,
  disabled,
  onPick,
}: {
  value: string
  today: string
  disabled: boolean
  onPick: (date: string) => void
}) {
  const yesterday = useMemo(() => {
    const date = new Date(`${today}T12:00:00`)
    date.setDate(date.getDate() - 1)
    return todayIsoDate(date)
  }, [today])

  return (
    <div className={styles.quickDates} role="group" aria-label="빠르게 고르기">
      {[
        { label: '오늘', date: today },
        { label: '어제', date: yesterday },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          className={styles.quickDate}
          aria-pressed={value === option.date}
          aria-disabled={disabled || undefined}
          onClick={() => {
            if (!disabled) onPick(option.date)
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** 보내는 동안 — "사진 줄이는 중 → 올리는 중". 진행률(%)은 없다(`PostSubmitPhase`) */
function SubmitSteps({ phase, withPhotos }: { phase: PostSubmitPhase; withPhotos: boolean }) {
  const steps = withPhotos ? STEPS : STEPS.slice(1)
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.phase === phase),
  )
  return (
    <ol className={styles.steps} aria-live="polite">
      {steps.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'now' : 'next'
        return (
          <li key={step.phase} className={styles.step} data-state={state}>
            {state === 'done' ? <Check /> : <span className={styles.stepMark} aria-hidden="true" />}
            {step.label}
            {state === 'done' ? <span className="sr-only"> 끝</span> : null}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * 넓은 화면의 오른쪽 칸 — 이 글이 목록에서 어떻게 보이는지. 목록과 같은 카드(`PostCard`)를 링크 없이 그린다.
 * 첫 사진이 대표로 들어가고, 사진이 없으면 고른 종류의 포스터가 들어간다. 입력과 같은 내용이라 스크린리더에는 숨긴다
 */
function PreviewCard({
  values,
  status,
  items,
  existing,
  removeExisting,
}: {
  values: PostFormValues
  status: PostStatus
  items: readonly PhotoItem[]
  existing: readonly PostImageResponse[]
  removeExisting: boolean
}) {
  const firstNew = useMemo(() => (items[0] ? [items[0].file] : []), [items])
  const previews = useObjectUrls(firstNew)
  const thumbnailUrl = items[0]
    ? (previews.get(items[0].file) ?? null)
    : !removeExisting && existing[0]
      ? existing[0].url
      : null

  // 종류도 사진도 없으면 들어갈 그림이 아직 없다 — 아무 그림(기타)으로 채우면 거짓말이 된다
  const post: PostListResponse | null =
    values.type && (values.category || thumbnailUrl)
    ? {
        id: 0,
        nickname: '',
        type: values.type,
        title: values.title.trim() || '제목을 적으면 여기에 보여요',
        category: values.category ?? 'ETC',
        location: values.location.trim() || '장소',
        lostFoundDate: values.lostFoundDate,
        status,
        viewCount: 0,
        createdAt: '',
        thumbnailUrl,
      }
    : null

  return (
    <aside className={styles.preview} aria-hidden="true">
      <p className={styles.previewLabel}>목록에서 이렇게 보여요</p>
      {post ? (
        <div className={styles.previewCard}>
          <PostCard post={post} thumbnailUrl={thumbnailUrl} priority />
        </div>
      ) : (
        <p className={styles.previewEmpty}>
          {values.type
            ? '사진을 고르거나 종류를 고르면 카드 그림이 들어가요.'
            : '잃어버렸는지 주웠는지 고르면 여기에 카드가 나타나요.'}
        </p>
      )}
    </aside>
  )
}
