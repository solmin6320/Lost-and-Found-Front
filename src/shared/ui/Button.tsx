import type { ButtonHTMLAttributes, Ref } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

import { cx } from '@/shared/lib/cx'

import styles from './Button.module.css'

/** `danger` · `dangerQuiet` 는 되돌릴 수 없는 삭제에만. 빨강은 이 자리 전용이다 */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerQuiet'
type ButtonSize = 'md' | 'sm'

interface ButtonLookProps {
  /** primary 는 화면의 주 동작 하나에만 */
  variant?: ButtonVariant
  /** sm 도 터치 면적은 44px 이다 */
  size?: ButtonSize
  /** 부모 폭을 채운다 */
  block?: boolean
}

function buttonClassName({ variant = 'secondary', size = 'md', block }: ButtonLookProps, extra?: string) {
  return cx(styles.button, styles[variant], size === 'sm' && styles.sm, block && styles.block, extra)
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonLookProps & {
    /** 다이얼로그가 열릴 때 [취소]에 포커스를 주는 것처럼, 밖에서 이 버튼을 잡을 때 */
    ref?: Ref<HTMLButtonElement>
    /**
     * 지금은 할 수 없다(바꾼 게 없음 · 계정 잠김). 흐리게 그리고 누름 · 제출을 무시한다.
     * `disabled` 를 쓰지 않는다 — 누르던 버튼이 잠기면 포커스가 문서 맨 앞으로 빠지고, 이유(`aria-describedby`)도 읽히지 않는다.
     * 요청 중("…하는 중")에는 이것 대신 `aria-disabled` 만 준다. 흐리지 않고 누름은 부른 쪽이 무시한다
     */
    unavailable?: boolean
  }

/** `type` 기본값은 `button` 이다. 폼 안에서 의도치 않게 제출되지 않게 한다 */
export function Button({
  variant,
  size,
  block,
  className,
  type = 'button',
  unavailable = false,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, block }, cx(unavailable && styles.unavailable, className))}
      {...rest}
      aria-disabled={unavailable || rest['aria-disabled']}
      // 제출 버튼이면 누름을 막는 것으로 제출도 막힌다(입력칸에서 Enter 를 쳐도 같다)
      onClick={unavailable ? (event) => event.preventDefault() : onClick}
    />
  )
}

export type ButtonLinkProps = LinkProps &
  ButtonLookProps & {
    /** 로그아웃 뒤 헤더의 [로그인]처럼, 밖에서 이 링크로 포커스를 옮길 때 */
    ref?: Ref<HTMLAnchorElement>
  }

/** 이동은 버튼이 아니라 링크다. 모양만 버튼과 같다(새 탭 열기·주소 복사가 된다) */
export function ButtonLink({ variant, size, block, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClassName({ variant, size, block }, className)} {...rest} />
}
