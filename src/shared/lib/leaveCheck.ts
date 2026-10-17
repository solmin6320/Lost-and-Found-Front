import type { FocusEvent } from 'react'

/**
 * 칸을 벗어날 때의 검사 — **그 폼의 제출 버튼을 누르러 가는 길이면 미룬다**(QA-P-15, 2026-10-17).
 *
 * 칸에 커서를 둔 채 바로 [저장] · [로그인]을 누르면, 버튼을 누르는 순간(mousedown · 탭) 칸이 blur 되고, 그때 생긴 오류 한 줄이
 * 버튼을 20~50px 아래로 민다. 손을 떼는 자리에는 이제 버튼이 없어 click 이 사라진다 — 제출 0번, 포커스는 버튼에 남고 칸은 화면에 그대로
 * (설정 닉네임 · 로그인 이메일 · 비밀번호 확인 실측). 벗어날 때의 검사는 "제출 전에 미리 알려 주기"가 목적인데, 바로 제출하는 사람에게는
 * 제출 검사가 **같은 문장을 띄우고 그 칸으로 데려간다**(focusAndReveal). 그러니 그 경우만 벗어날 때의 검사를 미뤄도 잃는 것이 없다.
 *
 * 어떻게 아나 — 문서에서 누름(pointerdown)을 지켜본다. 버튼이 포커스를 받지 않는 브라우저(iOS)는 `relatedTarget` 이 비어 있어
 * 그것만으로는 알 수 없다. 누름이 이 폼의 제출 버튼에서 시작됐고 **아직 누르는 중이거나 손을 뗀 지 0.3초 안**이면 미룬다.
 * 예전엔 "누름을 시작한 지 1초 안"으로 세어, 터치를 1초 넘게 누르면(손을 뗀 뒤에야 blur 가 온다) 바로 검사해 오류가 버튼을 밀고
 * 제출이 0번이었다(QA-D-23). 손 뗀 시각부터 세면 누른 시간과 상관없다
 * 키보드로 Tab 해서 버튼에 온 것은 누름이 없으니 바로 검사한다(키보드는 자리가 밀려도 빗나가지 않는다).
 *
 * 미룬 뒤 — 누름이 끝나고(손을 뗌 → click) 그 폼이 제출됐으면 검사를 버린다(제출 검사가 이미 같은 오류를 붙였다).
 * 제출되지 않았으면(버튼 밖으로 끌어 놓음 · 잠긴 버튼) 그때 검사한다 — 누름이 끝난 뒤라 밀려도 빗나갈 누름이 없다.
 */

interface Press {
  button: HTMLButtonElement | HTMLInputElement
  /** 손을 뗀 시각(`pointerup` · `pointercancel`). 누르는 중이면 `null` */
  releasedAt: number | null
}

/** 손을 뗀 뒤 "방금"으로 볼 시간. 탭은 손을 뗀 뒤에야 blur 가 온다(터치 → 합성 mousedown) — 보통 0.1초 안 */
export const RELEASE_FRESH_MS = 300
/** 손을 뗀 뒤 click 을 기다리는 시간. click 은 보통 같은 작업 안에서 바로 온다 — 끌어 놓아 click 이 없을 때의 상한 */
export const CLICK_WAIT_MS = 400

let press: Press | null = null

function submitButtonOf(target: EventTarget | null): HTMLButtonElement | HTMLInputElement | null {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return null
  const control = target.closest('button, input')
  if (control instanceof HTMLButtonElement && control.type === 'submit') return control
  if (control instanceof HTMLInputElement && control.type === 'submit') return control
  return null
}

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (event) => {
      const button = submitButtonOf(event.target)
      press = button ? { button, releasedAt: null } : null
    },
    true,
  )
  const release = () => {
    if (press && press.releasedAt === null) press.releasedAt = performance.now()
  }
  document.addEventListener('pointerup', release, true)
  document.addEventListener('pointercancel', release, true)
}

/** 지금 이 폼의 제출 버튼을 누르는 중(또는 방금 눌렀다)인가. 순수 판정 — 시험용으로 꺼내 둔다 */
export function isPressingSubmit(
  current: { form: HTMLFormElement | null; releasedAt: number | null } | null,
  form: HTMLFormElement | null,
  now: number,
): boolean {
  if (!current || !form || current.form !== form) return false
  return current.releasedAt === null || now - current.releasedAt < RELEASE_FRESH_MS
}

function formOf(field: Element): HTMLFormElement | null {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) return field.form
  return field.closest('form')
}

/** 누름이 끝나고(click 까지) 그 폼이 제출됐는지 알려 준다 */
function afterPress(form: HTMLFormElement, stillDown: boolean, done: (submitted: boolean) => void) {
  let submitted = false
  let finished = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const onSubmit = () => {
    submitted = true
  }
  const finish = () => {
    if (finished) return
    finished = true
    clearTimeout(timer)
    document.removeEventListener('click', finish, true)
    document.removeEventListener('pointerup', armClick, true)
    document.removeEventListener('pointercancel', armClick, true)
    // click 이 막 왔다 — 버튼의 기본 동작(폼 제출)은 click 처리가 끝난 뒤에 돈다. 그다음 작업에서 본다
    setTimeout(() => {
      form.removeEventListener('submit', onSubmit, true)
      done(submitted)
    }, 0)
  }
  function armClick() {
    document.removeEventListener('pointerup', armClick, true)
    document.removeEventListener('pointercancel', armClick, true)
    document.addEventListener('click', finish, true)
    timer = setTimeout(finish, CLICK_WAIT_MS)
  }
  form.addEventListener('submit', onSubmit, true)
  if (stillDown) {
    // 마우스를 누른 채 — 손을 뗄 때까지 기다린다(오래 누르고 있어도 그동안 버튼을 밀지 않는다)
    document.addEventListener('pointerup', armClick, true)
    document.addEventListener('pointercancel', armClick, true)
  } else {
    armClick()
  }
}

/**
 * 칸의 `onBlur` 를 이것으로 감싼다(`TextField` · `TextArea` 가 한다 — 폼마다 따로 하지 않는다).
 * 미룬 검사에 넘기는 이벤트는 `currentTarget` · `target` 을 붙들어 둔 사본이다(React 는 처리가 끝나면 `currentTarget` 을 비운다)
 */
export function checkOnLeave<E extends HTMLElement>(event: FocusEvent<E>, check: (event: FocusEvent<E>) => void): void {
  const field = event.currentTarget
  const form = formOf(field)
  const current = press ? { form: press.button.form, releasedAt: press.releasedAt } : null
  if (!form || !isPressingSubmit(current, form, performance.now())) {
    check(event)
    return
  }
  const kept = { ...event, currentTarget: field, target: event.target } as FocusEvent<E>
  afterPress(form, current?.releasedAt === null, (submitted) => {
    if (!submitted) check(kept)
  })
}
