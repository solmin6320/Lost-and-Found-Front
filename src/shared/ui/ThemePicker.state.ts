import type { ThemeName, ThemePreference } from '@/shared/lib/theme'

/**
 * 화면 모드 칸 하나의 표시(회의 RV-11 · ⑤-a).
 *   fixed      사용자가 이 모드로 고정했다 — 선 두 겹 + **채운** 모서리 표시
 *   following  고른 적이 없고, 기기 설정을 따라 지금 이 모드로 그려진다 — 선 두 겹 + **빈 테** 모서리 표시 + `기기 설정` 이름표
 *   off        고르지 않은 칸
 * 고른 적이 없는데 "밝게"에 채운 표시를 두면, 사용자는 이미 고정된 줄 알고 밤에 앱이 흰 채로 남는 이유를 모른다
 */
export type ThemeOptionState = 'fixed' | 'following' | 'off'

export function themeOptionState(
  option: ThemeName,
  preference: ThemePreference,
  resolved: ThemeName,
): ThemeOptionState {
  if (preference !== null) return preference === option ? 'fixed' : 'off'
  return resolved === option ? 'following' : 'off'
}
