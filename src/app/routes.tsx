import { Route, createBrowserRouter, createRoutesFromElements } from 'react-router-dom'

import { RootLayout } from '@/app/layouts/RootLayout'
import { LoginPage } from '@/pages/login/LoginPage'
import { MyPage } from '@/pages/my-page/MyPage'
import { NotFoundPage } from '@/pages/not-found/NotFoundPage'
import { PostCreatePage } from '@/pages/post-create/PostCreatePage'
import { PostDetailPage } from '@/pages/post-detail/PostDetailPage'
import { PostEditPage } from '@/pages/post-edit/PostEditPage'
import { PostListPage } from '@/pages/post-list/PostListPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { SignupPage } from '@/pages/signup/SignupPage'

/**
 * 라우트 표 — 기능명세서 3~6장과 1:1로 맞춘다.
 *
 * | 경로                | 화면                    | 명세서       |
 * |---------------------|-------------------------|--------------|
 * | /                   | 게시글 목록(검색·필터)  | [4.2]        |
 * | /posts/new          | 게시글 등록             | [4.1] [4.5]  |
 * | /posts/:postId      | 게시글 상세 + 댓글      | [4.3] [5.1]  |
 * | /posts/:postId/edit | 게시글 수정             | [4.4] [4.5]  |
 * | /login              | 로그인                  | [3.2]        |
 * | /signup             | 회원가입                | [3.1]        |
 * | /me                 | 마이페이지(내 글)       | [6.1]        |
 * | /settings           | 설정(화면 모드 · 프로필 · 비밀번호) | [3.6] [3.7] |
 * | 그 외               | 없는 화면               | 9장          |
 *
 * 화면이 없는 기능은 동작으로만 존재한다.
 *   [3.3] 재발급 : API 클라이언트의 401 인터셉터
 *   [3.4] 로그아웃 : 헤더 버튼
 *   [3.5] JWT 필터 : 백엔드 전용
 *   [4.6] 상태 변경 : 상세·마이페이지의 배지 옆 컨트롤
 *
 * 목록의 검색·필터는 화면을 나누지 않고 `/` 의 쿼리스트링에 싣는다
 * (`/?keyword=지갑&type=LOST&page=1`). 뒤로가기·새로고침·링크 공유가
 * 그대로 동작하고, 백엔드 [4.2] 의 쿼리 파라미터와 이름이 같아진다.
 *
 * 데이터 라우터(`createBrowserRouter`)로 만든다(2026-09-27, 단계 4). 등록 · 수정 화면이 작성 중 이탈을
 * `useBlocker` 로 막는데, 이 훅은 데이터 라우터 안에서만 동작한다. 로더 · 액션은 쓰지 않는다 —
 * 데이터는 여전히 TanStack Query 가 맡고, 표는 같은 `<Route>` 요소로 적는다.
 */
export function createAppRouter() {
  return createBrowserRouter(
    createRoutesFromElements(
      <Route element={<RootLayout />}>
        <Route path="/" element={<PostListPage />} />

        {/* 정적 세그먼트가 동적 세그먼트보다 우선 매칭되므로
            /posts/new 가 /posts/:postId 에 먹히지 않는다 */}
        <Route path="/posts/new" element={<PostCreatePage />} />
        <Route path="/posts/:postId" element={<PostDetailPage />} />
        <Route path="/posts/:postId/edit" element={<PostEditPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route path="/me" element={<MyPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>,
    ),
  )
}
