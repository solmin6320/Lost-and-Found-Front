import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'
import { startThemeSync } from '@/shared/lib/theme'
// Pretendard — 패키지에서 번들로 싣는다(외부 CDN 요청 없음). 동적 서브셋이라 화면에 뜬 글자가 속한 조각(woff2)만 받는다.
// 가변 글꼴이라 굵기(400~800)가 조각 하나에 다 들어 있다. `font-display: swap` — 조각이 오기 전에도 글자는 바로 보인다
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import '@/shared/styles/global.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('#root 엘리먼트를 찾지 못했습니다. index.html을 확인하세요.')
}

// 화면 모드 — 첫 적용은 public/theme-init.js 가 했다. 여기부터는 다른 탭 · 기기 설정의 변경을 따른다
startThemeSync()

// self-XSS 경고 — "콘솔에 이 코드를 붙여 넣으면 …" 에 속는 사용자를 위해 운영 빌드에서만 한 번 찍는다(보안명세서 1장).
// 개발자 도구를 막지는 않는다. 막을 수 없고 정상 사용자만 불편하다. 진짜 방어선은 서버의 소유자 검증이다.
// 색은 삭제 전용 빨강(tokens.css `--danger`)과 같다. 콘솔은 CSS 변수를 읽지 못해 값을 그대로 쓴다
if (import.meta.env.PROD) {
  console.log('%c잠깐!', 'color:#b3251b;font-size:32px;font-weight:bold')
  console.log(
    '%c누군가 여기에 코드를 붙여 넣으라고 했다면 사기예요.\n계정을 통째로 빼앗길 수 있어요.',
    'font-size:14px',
  )
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
