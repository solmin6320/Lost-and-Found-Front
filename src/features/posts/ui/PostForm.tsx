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
import { ClientValidationError, getErrorMessage, hasErrorCode, subscribeSessionExpired } from '@/shared/lib/http'
import { allowLeave, isSelfLogout, useDirtyField, type LeaveCopy } from '@/shared/lib/dirtyRegistry'
import { useObjectUrls } from '@/shared/lib/image'
import { usePersonalInfoCheck } from '@/shared/lib/usePersonalInfoCheck'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { FormAlert } from '@/shared/ui/FormAlert'
import { Check, ClockCounterClockwise, LockSimple } from '@/shared/ui/icons'
import { SafetyNote } from '@/shared/ui/SafetyNote'
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
import { remainingFieldCount, remainingMessage } from './PostForm.remaining'
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
  /**
   * 로그인이 끊기면 거짓이 된다 — `onSessionLost` 를 부른다. 쓰던 글자는 **세션이 만료됐을 때만** 보관한다.
   * 직접 로그아웃했으면 보관하지 않는다(공용 기기 — 로그아웃이 보관을 모두 지운다, 보안명세서 3장)
   */
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
  /** 다른 창에서 로그아웃돼 이 화면에 머물 때 [로그인]이 갈 곳(돌아올 곳을 싣는다) */
  loginHref: To
}

/** 앱 안 이동을 막을 때의 문장 — 레이아웃의 막는 곳 하나가 띄운다(쓰던 칸 등록부). 렌더마다 새로 만들지 않게 밖에 둔다 */
const LEAVE_COPY: Record<'create' | 'edit', LeaveCopy> = {
  create: { title: '쓰던 글을 두고 나갈까요?', body: '나가면 쓰던 내용은 저장되지 않아요.' },
  edit: { title: '고치던 글을 두고 나갈까요?', body: '나가면 고친 내용은 저장되지 않아요. 글은 고치기 전 그대로 남아요.' },
}

const COPY = {
  create: {
    submit: '올리기',
    submitting: '올리는 중…',
    cancel: '작성 취소',
    cancelTitle: '작성을 취소할까요?',
    cancelBody: '쓰던 내용이 사라져요.',
    draftTitle: '로그인이 끊기기 전에 쓰던 글이 있어요.',
  },
  edit: {
    submit: '저장하기',
    submitting: '저장하는 중…',
    cancel: '수정 취소',
    cancelTitle: '수정을 취소할까요?',
    cancelBody: '고친 내용이 사라져요. 글은 고치기 전 그대로 남아요.',
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
 * - 작성 중 이탈 : 쓰던 칸 등록부에 "쓰던 글자 있음"만 알린다. 막는 곳 · 확인 창은 레이아웃에 하나다(`useDirtyField`, 회의 AR2-3)
 * - 제출이 막히면 제출 줄 위 한 줄 "N곳을 더 채워야 올라가요"가 유일한 알림이다. 칸 오류는 포커스가 간 칸이 읽는다(AR-10 · UI2-9)
 * - 다른 창에서 로그아웃했는데 쓰던 글자가 있으면 바로 떠나지 않는다 — 글자를 읽기 전용으로 두고 한 줄 + [로그인](SE2-10).
 *   이 창에서 로그아웃을 골랐으면(확인을 거쳤다, SE-5) 지금처럼 로그인 화면으로 간다. 어느 쪽이든 보관하지 않는다
 * - [작성 취소] : 쓴 게 있을 때만 "쓰던 내용이 사라져요." 확인(수정은 "고친 내용이 사라져요. …"). 없으면 바로 떠난다
 * - 로그인이 끊기면 쓰던 **글자만** 이 탭에 잠시 보관한다(사진은 못 한다). 다시 로그인해 돌아오면 이어서 쓸지 묻는다
 * - 넓은 화면(64rem 이상)은 오른쪽에 **목록에서 이렇게 보여요** 미리보기 카드 — 첫 장이 대표 사진이 된다는 것을 그대로 본다
 * - 휴대폰(48rem 미만)에서 화면 높이가 40rem 이상이면 제출 줄이 화면 아래에 붙어 따라온다 — 긴 설명을 쓰다가도 [올리기]를 찾지 않는다.
 *   그보다 낮은 화면(가로 모드 · 확대)은 폼 끝 제자리다(붙는 것은 헤더 + 줄 하나까지, 둘째 줄은 높이 40rem 부터)
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
  loginHref,
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
  /** 방금 칸을 벗어나며 생긴 오류 — 이 칸 오류만 바로 읽어 준다. 제출이 막혀 한꺼번에 붙은 오류는 읽어 주지 않는다 */
  const [liveField, setLiveField] = useState<PostFormField | null>(null)
  // 제출이 막혀 첫 칸으로 포커스를 옮기는 동안 생기는 blur 는 "칸을 벗어난 것"이 아니다 — 그 칸 오류를 따로 읽어 주지 않는다
  // (iOS 처럼 버튼이 포커스를 받지 않거나 Enter 로 제출하면, 쓰던 칸의 blur 가 제출 뒤에 온다)
  const movingFocus = useRef(false)
  /** 보내기 전 검사에서 막혔다 — 제출 줄 위에 남은 수를 센다 */
  const [blocked, setBlocked] = useState(false)
  /** 다른 창에서 로그아웃했는데 쓰던 글자가 있다 — 화면에 남아 읽기 전용(SE2-10) */
  const [stranded, setStranded] = useState(false)
  const strandedRef = useRef<HTMLDivElement>(null)
  /**
   * 연락처 감지 줄(SE-3) — 제목 · 장소 · 설명. 댓글과 같은 판정 · 같은 때 : **입력이 0.6초 멈췄을 때 + 칸을 벗어날 때**.
   * 막지 않는다(올릴지는 쓰는 사람이 정한다). 설명 칸은 제출 줄 바로 위라 줄 자리를 미리 비워 둔다
   */
  const titleInfo = usePersonalInfoCheck(values.title)
  const locationInfo = usePersonalInfoCheck(values.location)
  const contentInfo = usePersonalInfoCheck(values.content)
  const today = useMemo(() => todayIsoDate(), [])

  const dirty = !samePostFormValues(values, initialValues) || items.length > 0 || removeExisting
  useDirtyField(dirty || pending, LEAVE_COPY[mode])

  function leave(to: To, options?: NavigateOptions) {
    allowLeave()
    navigate(to, options)
  }

  // 붙은 제출 줄의 높이만큼 스크롤 여백 — 포커스가 간 칸이 줄 밑에 가리지 않게(RV2-7, WCAG 2.4.11).
  // 줄은 남은 수 · 보내는 단계 · 오류 한 줄로 높이가 바뀐다. 고정값(6rem)이면 넘친다
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = barRef.current
    if (!bar || typeof ResizeObserver === 'undefined') return
    const root = document.documentElement
    const observer = new ResizeObserver(() => root.style.setProperty('--form-bar-h', `${bar.offsetHeight}px`))
    observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--form-bar-h')
    }
  }, [])

  // 방금 나타난 것(폼 위 오류)으로 포커스. 그리기 전에는 요소가 없다
  const focusAfterRender = useRef<(() => void) | null>(null)
  useEffect(() => {
    focusAfterRender.current?.()
    focusAfterRender.current = null
  })

  // 로그인이 끊겼다(재발급 거절 · 로그아웃) — 화면에 알린다. 한 번만.
  // 쓰던 글자는 **만료**일 때만 보관한다. 만료 알림은 로그아웃 상태가 그려지기 전에 온다
  const latest = useRef({ values, items, removeExisting, dirty, memberId, onSessionLost })
  useEffect(() => {
    latest.current = { values, items, removeExisting, dirty, memberId, onSessionLost }
  })
  const expired = useRef(false)
  useEffect(() => subscribeSessionExpired(() => (expired.current = true)), [])
  const lostHandled = useRef(false)
  useEffect(() => {
    if (signedIn || lostHandled.current) return
    lostHandled.current = true
    const now = latest.current
    // 다른 창에서 로그아웃했고(만료도 아니고 이 창에서 고른 것도 아니다) 쓰던 글자가 있다 — 떠나지 않는다.
    // 글자는 화면에만 둔다(저장소에 넣지 않는다). 쓰던 칸 등록부는 그대로라 실수로 떠나려 하면 묻는다
    if (!expired.current && !isSelfLogout() && now.dirty) {
      setStranded(true)
      focusAfterRender.current = () => {
        strandedRef.current?.scrollIntoView({ block: 'nearest' })
        strandedRef.current?.focus({ preventScroll: true })
      }
      return
    }
    const saved =
      expired.current &&
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
  }, [signedIn, draftKey, navigate])

  function focusField(field: PostFormField | 'photos') {
    const box = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)
    const target =
      box?.querySelector<HTMLElement>('input:checked') ??
      box?.querySelector<HTMLElement>('input:not([type="file"]), textarea, button')
    movingFocus.current = true
    try {
      target?.focus()
    } finally {
      movingFocus.current = false
    }
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

  /** 벗어날 때 — 비어 있으면 기다린다(지나가는 중일 수 있다). 날짜는 늘 값이 있어 바로 본다. 생긴 오류는 바로 읽어 준다 */
  function checkOnBlur(field: PostFormField) {
    const raw = values[field]
    if (field !== 'lostFoundDate' && typeof raw === 'string' && !raw.trim()) return
    const message = checkPostField(field, values, today)
    setErrors((old) => ({ ...old, [field]: message }))
    if (message && !movingFocus.current) setLiveField(field)
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
    if (pending || stranded) return

    const found = checkPostForm(values, todayIsoDate())
    setErrors(found)
    setFormError(null)
    setPhotoError(undefined)
    // 한꺼번에 붙은 오류는 칸마다 읽지 않는다 — 포커스가 간 첫 칸이 읽고, 남은 수는 제출 줄 한 줄이 알린다
    setLiveField(null)
    const firstInvalid = POST_FORM_FIELDS.find((field) => found[field])
    setBlocked(Boolean(firstInvalid))
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
      setLiveField(null)
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
  const readOnly = pending || stranded
  const change = items.length > 0 ? 'replace' : removeExisting ? 'remove' : 'keep'
  const remaining = blocked ? remainingMessage(remainingFieldCount(values, today), mode) : null

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
        {stranded ? (
          <div ref={strandedRef} className={styles.stranded} role="alert" tabIndex={-1}>
            <LockSimple className={styles.strandedIcon} />
            <div className={styles.strandedBody}>
              <p className={styles.strandedTitle}>다른 창에서 로그아웃했어요. 쓰던 글은 이 기기에 남기지 않아요.</p>
              <p className={styles.strandedText}>아래 글자는 읽기만 할 수 있어요. 필요한 내용은 옮겨 두고 다시 로그인해 주세요.</p>
              <ButtonLink to={loginHref} size="sm" variant="primary" onClick={() => allowLeave()}>
                로그인
              </ButtonLink>
            </div>
          </div>
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
            category={values.category}
          />
        </div>

        <div data-field="title">
          <TextField
            label="제목"
            name="title"
            value={values.title}
            count={{ value: values.title.trim().length, max: POST_TITLE_MAX_LENGTH }}
            // 예시는 칸 안 안내 글로(회의 UI-9 b). 칸 이름은 위에 그대로 — 안내 글을 이름 대신 쓰지 않는다
            placeholder={values.type === 'FOUND' ? '예: 에어팟 프로 왼쪽 한 짝' : '예: 검은색 가죽 반지갑'}
            error={errors.title}
            announceError={liveField === 'title'}
            detected={<DetectedLine notice={titleInfo.notice} />}
            autoComplete="off"
            enterKeyHint="next"
            readOnly={readOnly}
            onChange={(event) => setField('title', event.target.value)}
            onBlur={() => {
              checkOnBlur('title')
              titleInfo.check()
            }}
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
            placeholder={values.type === 'FOUND' ? '예: 강남역 2번 출구 고객센터' : '예: 강남역 2번 출구'}
            hint={
              values.type === 'FOUND'
                ? '주운 곳이나 지금 맡겨 둔 곳을 적어 주세요.'
                : values.type === 'LOST'
                  ? '잃어버린 것 같은 곳이면 돼요.'
                  : undefined
            }
            error={errors.location}
            announceError={liveField === 'location'}
            detected={<DetectedLine notice={locationInfo.notice} />}
            autoComplete="off"
            enterKeyHint="next"
            readOnly={readOnly}
            onChange={(event) => setField('location', event.target.value)}
            onBlur={() => {
              checkOnBlur('location')
              locationInfo.check()
            }}
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
            // "주운 날이에요" · "오늘 이후 날짜는 고를 수 없어요"는 칸 이름과 날짜 칸(max)이 이미 말한다(UI-9 a)
            hint={values.type === 'LOST' ? '정확하지 않으면 마지막으로 본 날을 골라 주세요.' : undefined}
            error={errors.lostFoundDate}
            announceError={liveField === 'lostFoundDate'}
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
            announceError={liveField === 'content'}
            detected={<DetectedLine notice={contentInfo.notice} />}
            // 제출 줄 바로 위 칸 — 감지 줄이 떠도 버튼이 밀리지 않게 글자가 있으면 자리를 잡아 둔다(SE-3)
            reserveDetected={values.content.trim().length > 0}
            autoComplete="off"
            readOnly={readOnly}
            rows={5}
            onChange={(event) => setField('content', event.target.value)}
            onBlur={() => {
              checkOnBlur('content')
              contentInfo.check()
            }}
            hint={
              values.type === 'FOUND'
                ? '어떤 상태로 어디에 두었는지 적어 주세요. 주인만 알 만한 특징 한두 가지는 적지 말고 남겨 두세요. 진짜 주인인지 물어볼 때 쓸 수 있어요.'
                : '색, 브랜드, 흠집, 안에 든 것처럼 사진에 안 보이는 특징을 적어 주세요.'
            }
            // 개인정보 줄은 오류가 떠 있어도 남는다(결과 고지). 한 줄로 줄였다 — 연락처를 적으면 감지 줄이 따로 알린다(SE-3).
            // 빨간 글자 + 경고 세모(본인 피드백 2026-10-07). 막지 않는다
            note={<SafetyNote>전화번호 · 집 주소를 적으면 누구나 봐요.</SafetyNote>}
          />
        </div>

        <div ref={barRef} className={styles.bar}>
          {formError ? (
            <FormAlert ref={alertRef} message={formError} />
          ) : null}
          {pending ? <SubmitSteps phase={phase} withPhotos={change === 'replace'} /> : null}
          {/* 제출이 막혔을 때 남은 수 — 이 화면의 유일한 알림(칸 오류는 포커스가 간 칸이 읽는다). 비어 있어도 자리를 두어야 읽힌다 */}
          <p className={styles.remaining} role="status">
            {remaining}
          </p>
          <div className={styles.buttons}>
            <Button
              className={styles.cancel}
              aria-disabled={pending || undefined}
              unavailable={stranded}
              onClick={handleCancel}
            >
              {copy.cancel}
            </Button>
            <Button
              type="submit"
              variant="primary"
              className={styles.submit}
              aria-disabled={pending || undefined}
              unavailable={stranded}
            >
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

    </div>
  )
}

/** 로그인 뒤 돌아왔다 — 이어서 쓸지 묻는다. 고르기 전에는 빈 폼을 건드려도 이 칸이 남아 있다 */
/**
 * 연락처 감지 한 줄의 글자(SE-3). 없으면 아무것도 그리지 않는다 — 줄(`detected`)은 비어 있어도 알림 영역으로 남아 처음 뜰 때 한 번 읽힌다.
 * 개인정보 · 안전 경고 — 빨간 글자 + 경고 세모(본인 피드백 2026-10-07, 댓글 칸과 같은 모양). 막지 않는다.
 * 문장이 바뀌면(`key`) 새로 나타난다
 */
function DetectedLine({ notice }: { notice: string | null }) {
  if (!notice) return null
  return (
    <SafetyNote key={notice} appear>
      {notice}
    </SafetyNote>
  )
}

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

/**
 * [오늘] [어제] — 날짜 칸을 여는 것보다 한 번에. 기본값이 오늘이라 대개 한 번 누르거나 안 누른다.
 * 하나만 고르기라 고른 쪽은 **채운 점**(회의 ⑤-a). 잉크로 칠한 알약은 주 버튼과 무게를 다퉈 뺐다
 */
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
          <span className={styles.quickDot} aria-hidden="true" />
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
