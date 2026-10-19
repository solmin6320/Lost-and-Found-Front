/**
 * 시안 스위치 — **개발 모드 전용**(2026-10-19, 본인이 캡처로 비교해 고르기 전까지).
 *
 * 주소에 `?lab=strip-a,map-b,match-c,bell-a` 처럼 요소-시안을 쉼표로 적는다. `state-loading|empty|error` 를 더하면
 * 켠 시안 모두가 그 상태로 그려진다(로딩은 끝나지 않는다 — 캡처용). `?lab=off` 로 끈다.
 * 한 번 적은 값은 이 탭의 sessionStorage 에 남아, 화면을 옮겨 다녀도(목록 → 상세 → 내 글) 같은 시안이 보인다.
 *
 * 운영 빌드에는 들어가지 않는다 — 부르는 곳(`app/lab/LabSlot`)이 `import.meta.env.DEV` 로 막고, 그 갈래가 빌드에서 지워진다.
 */

export const LAB_ELEMENTS = ['strip', 'map', 'match', 'bell'] as const
export type LabElement = (typeof LAB_ELEMENTS)[number]
export const LAB_VARIANTS = ['a', 'b', 'c'] as const
export type LabVariant = (typeof LAB_VARIANTS)[number]
export type LabState = 'loading' | 'empty' | 'error'

export interface LabConfig {
  variants: Partial<Record<LabElement, LabVariant>>
  state?: LabState
}

const STORAGE_KEY = 'design-lab:v1'
const EMPTY: LabConfig = { variants: {} }

export function parseLab(raw: string | null | undefined): LabConfig {
  if (!raw) return EMPTY
  const config: LabConfig = { variants: {} }
  for (const token of raw.split(',')) {
    const [name, value] = token.trim().split('-')
    if (name === 'state' && (value === 'loading' || value === 'empty' || value === 'error')) config.state = value
    if ((LAB_ELEMENTS as readonly string[]).includes(name ?? '') && (LAB_VARIANTS as readonly string[]).includes(value ?? '')) {
      config.variants[name as LabElement] = value as LabVariant
    }
  }
  return config
}

/** 주소의 `?lab=` 이 있으면 저장하고 그것을, 없으면 저장해 둔 것을 쓴다 */
export function readLab(search: string): LabConfig {
  const raw = new URLSearchParams(search).get('lab')
  try {
    if (raw === 'off') {
      sessionStorage.removeItem(STORAGE_KEY)
      return EMPTY
    }
    if (raw) {
      sessionStorage.setItem(STORAGE_KEY, raw)
      return parseLab(raw)
    }
    return parseLab(sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return parseLab(raw)
  }
}
