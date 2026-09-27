import { IconContext, type IconProps } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

/**
 * 아이콘 — Phosphor(`@phosphor-icons/react`) 한 벌만 쓴다. 직접 그리지 않는다.
 *
 * - 굵기는 `bold` 하나. Pretendard 굵은 제목(700 · 800) 옆에서 획이 가늘어 보이지 않는 굵기다
 * - 크기는 CSS 에서 `--icon-*` 토큰으로 준다(`width` · `height`). 컴포넌트에서 `size` 를 넘기지 않는다
 * - **기본이 장식이다**(`aria-hidden`). 이름은 버튼의 글자나 `aria-label` 이 맡는다.
 *   뜻을 혼자 전하는 아이콘이 생기면 그 자리에서 `aria-hidden={false}` + `alt` 로 푼다
 *
 * 쓰는 아이콘은 여기서만 다시 내보낸다. 화면마다 다른 모양이 섞이지 않게, 새 아이콘은 이 목록에 더한다.
 */
export {
  Archive,
  ArrowClockwise,
  ArrowUUpLeft,
  ArrowsOut,
  CalendarBlank,
  Camera,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChatCircleDots,
  Check,
  CheckCircle,
  ClockCounterClockwise,
  Eye,
  EyeSlash,
  Gear,
  Info,
  LockSimple,
  MagnifyingGlass,
  MapPin,
  MegaphoneSimple,
  Moon,
  PencilSimple,
  Plus,
  Question,
  Sun,
  Tag,
  Trash,
  User,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
export type { Icon } from '@phosphor-icons/react'

const ICON_DEFAULTS: IconProps = {
  weight: 'bold',
  size: '1em',
  'aria-hidden': true,
  focusable: false,
}

/** 앱 맨 바깥에서 한 번 감싼다. 모든 아이콘이 같은 굵기 · 같은 접근성 기본값을 갖는다 */
export function IconProvider({ children }: { children: ReactNode }) {
  return <IconContext.Provider value={ICON_DEFAULTS}>{children}</IconContext.Provider>
}
