/** 서비스 이름. 헤더 로고 글자와 로그인 · 가입 화면 안내 문장 첫머리가 같은 말을 쓴다 */
export const SERVICE_NAME = '분실물 찾기'

/**
 * 꼬리표 두 장. 보관소에서 물건에 다는 이름표다 — 잃어버린 쪽(마리골드)과 주운 쪽(코발트)이 겹친다.
 * 서비스의 표지라 헤더 로고 · 로그인 · 가입 화면 머리(화면 이름 앞의 그림, 2026-10-11)와 파비콘에만 쓴다. 다른 화면의 장식으로 되풀이하지 않는다.
 * 크기는 부른 쪽이 `className` 으로 정한다(가로 : 세로 = 30 : 24)
 */
export function BrandMark({ className }: { className?: string }) {
  const tag =
    'M12 1.8 17.3 6.3a1.6 1.6 0 0 1 .6 1.23V20.4a1.6 1.6 0 0 1-1.6 1.6H7.7a1.6 1.6 0 0 1-1.6-1.6V7.53a1.6 1.6 0 0 1 .6-1.23Z'
  return (
    <svg className={className} viewBox="0 0 30 24" aria-hidden="true" focusable="false">
      <g transform="translate(7.5 0.4) rotate(14 12 12)">
        <path d={tag} fill="var(--found-face)" />
        <circle cx="12" cy="7.9" r="1.65" fill="var(--surface)" />
      </g>
      <g transform="translate(-0.5 0.6) rotate(-12 12 12)">
        <path d={tag} fill="var(--lost-face)" stroke="var(--surface)" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="7.9" r="1.65" fill="var(--surface)" />
      </g>
    </svg>
  )
}
