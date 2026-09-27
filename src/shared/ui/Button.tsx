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
  }

/** `type` 기본값은 `button` 이다. 폼 안에서 의도치 않게 제출되지 않게 한다 */
export function Button({ variant, size, block, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClassName({ variant, size, block }, className)} {...rest} />
  )
}

export type ButtonLinkProps = LinkProps & ButtonLookProps

/** 이동은 버튼이 아니라 링크다. 모양만 버튼과 같다(새 탭 열기·주소 복사가 된다) */
export function ButtonLink({ variant, size, block, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClassName({ variant, size, block }, className)} {...rest} />
}
