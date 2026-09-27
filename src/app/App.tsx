import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'

import { createQueryClient } from '@/app/queryClient'
import { createAppRouter } from '@/app/routes'
import { AuthProvider } from '@/features/auth'
import { IconProvider } from '@/shared/ui/icons'

/**
 * 앱의 가장 바깥. 전역 프로바이더는 전부 여기에 쌓는다.
 *
 * 라우터는 History API 를 쓰는 데이터 라우터(`createBrowserRouter`)다. 해시 라우터가 아니다.
 * 작성 중 이탈 확인(`useBlocker`)이 데이터 라우터에서만 동작해서 단계 4 에서 BrowserRouter 에서 옮겼다.
 * 배포에서 `/posts/3` 직접 접근은 CloudFront 커스텀 오류 응답
 * (403/404 → /index.html, 200)이 받아 준다 (기능명세서 11장).
 */
export function App() {
  // 모듈 최상단이 아니라 useState 로 만든다. 모듈 스코프에 두면 개발 중 HMR 이
  // 파일을 다시 평가할 때 캐시가 통째로 날아가고, 테스트에서 클라이언트를 분리할 수 없다.
  const [queryClient] = useState(createQueryClient)
  const [router] = useState(createAppRouter)

  return (
    <QueryClientProvider client={queryClient}>
      {/* 로그아웃·세션 만료 때 회원 캐시를 지워야 해서 QueryClientProvider 안쪽에 둔다 */}
      <AuthProvider>
        <IconProvider>
          <RouterProvider router={router} />
        </IconProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
