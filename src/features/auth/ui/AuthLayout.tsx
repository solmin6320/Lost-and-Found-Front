import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

import { particle } from '@/shared/lib/particle'
import { ArrowUUpLeft, CheckCircle } from '@/shared/ui/icons'

import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  /** 화면 제목(h1) — `로그인` · `회원가입` */
  title: string
  /** 이 화면에서 무엇을 하게 되는지 한 줄 */
  lead: string
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
 * 위에서 아래로 한 줄 : 제목 → 한 줄 안내 → 돌아갈 곳 → (확인 문장) → 폼 → (다른 방법) → 전환 링크.
 * 옆 칸 안내(글 두 갈래)는 뺐다 — 로그인 화면에서 할 일은 폼 하나라, 눈이 갈 곳을 하나로 둔다.
 * 휴대폰은 여백 안을 꽉 채우고 위에서 시작한다(키보드가 아래를 덮는다).
 * 넓은 화면(48rem~)은 가는 선을 두른 한 장(폼 칸 27rem)을 화면 높이 가운데에 둔다. 칸 · 버튼은 기본보다 크다(CSS).
 */
export function AuthLayout({ title, lead, returnNote, notice, children, alternatives, footer }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <header className={styles.intro}>
          <h1 className={styles.title}>{title}</h1>
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

interface AuthReturnNoteProps {
  /** `로그인하면` · `가입하면` */
  lead: string
  /** 돌아갈 화면 이름 */
  label: string
  /** 한쪽 개념에 묶인 곳이면 그 색(분실 마리골드 · 습득 코발트)을 옅게 입힌다 */
  concept?: 'LOST' | 'FOUND'
}

/** "로그인하면 분실 글 올리기로 돌아가요" — 로그인이 끝난 뒤 어디로 가는지 누르기 전에 알린다 */
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
