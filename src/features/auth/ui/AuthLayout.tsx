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
  /**
   * 보조 안내(글 두 갈래). 휴대폰에서는 두지 않는다(폼이 먼저) · 태블릿은 폼 아래 · 넓은 화면은 제목 칸 아래.
   * 문서 순서는 늘 폼 뒤다 — 키보드 · 스크린리더가 폼을 먼저 만난다
   */
  aside?: ReactNode
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
 * 로그인 · 가입의 공통 틀(SCR-05 · SCR-06).
 *
 * 좁은 화면 : 제목 → 돌아갈 곳 → 안내 → 폼 → (다른 방법) → 전환 링크, 한 줄로 쌓는다. 태블릿은 그 아래 글 두 갈래 안내.
 * 넓은 화면(60rem~) : 왼쪽에 제목 · 돌아갈 곳 · 글 두 갈래 안내, 오른쪽에 폼. 가운데 좁은 칸만 덩그러니 남지 않게
 * 두 칸으로 벌리고 화면 높이 가운데에 둔다. 폼은 읽기 좋은 폭(26rem)을 지킨다. 장식 도형은 두지 않는다.
 */
export function AuthLayout({ title, lead, returnNote, aside, notice, children, alternatives, footer }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
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

      {aside ? <div className={styles.aside}>{aside}</div> : null}
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
