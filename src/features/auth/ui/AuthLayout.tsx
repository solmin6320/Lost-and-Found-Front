import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

import { particle } from '@/shared/lib/particle'
import { ArrowUUpLeft, CheckCircle } from '@/shared/ui/icons'

import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  /**
   * 머리 — 서비스 꼬리표 + 이름(헤더 로고와 같은 짝, 부른 쪽이 넣는다). 화면 제목(h1)의 보이는 부분이다.
   * 흔한 큰 `로그인` 글자 대신 "어느 서비스에 들어가는지"를 가장 먼저 보인다(QA 2026-10-11 — 큰 제목만 있는 틀은 AI 티)
   */
  brand: ReactNode
  /** 화면 이름 — `로그인` · `회원가입`. 제목(h1) 안에서 읽기 전용으로만 둔다(보이는 말은 안내 문장 첫 낱말이 한다) */
  title: string
  /**
   * 이 화면에서 무엇을 하게 되는지 한 줄. 화면 이름으로 시작한다(`로그인하면 …` · `가입하면 …`) — 보이는 화면 이름이 여기 있다.
   * 끊기면 안 되는 말 묶음은 `AuthPhrase` 로 감싼다
   */
  lead: ReactNode
  /** 돌아갈 곳 안내(`AuthReturnNote`). 제목 아래에 둔다 — "왜 여기 왔는지"에 붙는 정보다 */
  returnNote?: ReactNode
  /** 폼 위 안내 한 줄(비밀번호를 바꾼 뒤 · 가입 직후). 서버 오류가 아니라 확인 문장이다 */
  notice?: string | null
  /** 이메일 · 비밀번호 폼 */
  children: ReactNode
  /**
   * 다른 방법으로 로그인 · 가입 — 추후 OAuth(구글 · 네이버) 버튼 묶음 자리. **지금은 넘기지 않는다**(미구현).
   * 넘기면 폼 아래에 `또는` 구분선과 함께 끼워진다. 폼 · 전환 링크의 자리는 그대로다
   */
  alternatives?: ReactNode
  /** 로그인 ↔ 가입 전환(`AuthSwitch`) */
  footer: ReactNode
}

/**
 * 로그인 · 가입의 공통 틀(SCR-05 · SCR-06) — 가운데 한 칸(본인 피드백 2026-10-11).
 *
 * 위에서 아래로 한 줄 : 머리(꼬리표 + 서비스 이름) → 한 줄 안내 → 돌아갈 곳 → (확인 문장) → 폼 → (다른 방법) → 전환 링크.
 * 머리가 이 화면의 "이 서비스만의 것" 하나다 — 그림을 새로 그리지 않고 헤더 로고를 크게 쓴다. 제목(h1)은 머리 + 읽기 전용 화면 이름이라
 * 화면 읽기 프로그램은 "분실물 찾기 로그인"으로 읽고, 화면을 옮기면 포커스가 여기로 온다(RouteFocus).
 * 옆 칸 안내(글 두 갈래)는 뺐다 — 로그인 화면에서 할 일은 폼 하나라, 눈이 갈 곳을 하나로 둔다.
 * 휴대폰은 여백 안을 꽉 채우고 위에서 시작한다(키보드가 아래를 덮는다).
 * 넓은 화면(48rem~)은 가는 선을 두른 한 장(폼 칸 27rem)을 위에 맞춰 둔다 — 위 여백은 화면 높이로만 정해, 오류 · 안내 줄이 생겨도
 * 제목과 그 위가 움직이지 않는다. 칸 · 버튼 · 이 화면의 짧은 문장(오류 · 안내)은 기본보다 크다(CSS).
 */
export function AuthLayout({ brand, title, lead, returnNote, notice, children, alternatives, footer }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <header className={styles.intro}>
          <h1 className={styles.brand}>
            {brand}
            <span className="sr-only"> {title}</span>
          </h1>
          <p className={styles.lead}>{lead}</p>
          {returnNote}
        </header>

        <div className={styles.panel}>
          {notice ? (
            <p className={styles.notice} role="status">
              <CheckCircle />
              {notice}
            </p>
          ) : null}

          {children}

          {alternatives ? (
            <div className={styles.alternatives}>
              <p className={styles.or}>또는</p>
              {alternatives}
            </div>
          ) : null}

          <div className={styles.footer}>{footer}</div>
        </div>
      </div>
    </div>
  )
}

/**
 * 안내 한 줄 안에서 줄이 갈리지 않는 말 묶음 — "주운 물건(습득 글)을"이 "주운 물건 / (습득 글)을"로 갈리지 않게.
 * 줄은 묶음 사이(띄어쓰기)에서만 바뀐다. 묶음이 한 줄보다 길면(크게 확대) 묶음 안에서도 접힌다 — 화면 밖으로 넘치지 않는다
 */
export function AuthPhrase({ children }: { children: ReactNode }) {
  return <span className={styles.phrase}>{children}</span>
}

interface AuthReturnNoteProps {
  /** 문장 앞머리 — 지금은 두 화면 모두 `끝나면`. 바로 위 안내 문장이 `로그인하면` · `가입하면`으로 시작해 같은 말을 되풀이하지 않는다 */
  lead: string
  /** 돌아갈 화면 이름 */
  label: string
  /** 한쪽 개념에 묶인 곳이면 그 색(분실 마리골드 · 습득 코발트)을 옅게 입힌다 */
  concept?: 'LOST' | 'FOUND'
}

/** "끝나면 분실 글 올리기로 돌아가요" — 로그인 · 가입이 끝난 뒤 어디로 가는지 누르기 전에 알린다 */
export function AuthReturnNote({ lead, label, concept }: AuthReturnNoteProps) {
  return (
    <p className={styles.returnNote} data-concept={concept}>
      <ArrowUUpLeft />
      <span>
        {lead} <strong>{label}</strong>
        {particle(label, '으로')} 돌아가요.
      </span>
    </p>
  )
}

interface AuthSwitchProps {
  prompt: string
  children: ReactNode
}

/** "처음이세요? [회원가입]" — 링크는 부른 쪽이 넣는다(경로는 app 이 정한다) */
export function AuthSwitch({ prompt, children }: AuthSwitchProps) {
  return (
    <p className={styles.switch}>
      {prompt} {children}
    </p>
  )
}

/** 전환 링크 · 잠금 안내 안의 글자 링크 — 밑줄 + 굵게, 누르는 면적 44px */
export function AuthTextLink(props: LinkProps) {
  return <Link className={styles.textLink} {...props} />
}
