import { Route, createBrowserRouter, createRoutesFromElements } from 'react-router-dom'

import { RootLayout } from '@/app/layouts/RootLayout'
import { RouteLoadError } from '@/app/RouteLoadError'
import { PostFormSkeleton } from '@/features/posts'
import { LoginPage } from '@/pages/login/LoginPage'
import { MyPageSkeleton } from '@/pages/my-page/MyPageSkeleton'
import { NotFoundPage } from '@/pages/not-found/NotFoundPage'
import { PostDetailSkeleton } from '@/pages/post-detail/PostDetailSkeleton'
import { PostListPage } from '@/pages/post-list/PostListPage'
import { SettingsSkeleton } from '@/pages/settings/SettingsSkeleton'
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
 *
 * **처음 받는 코드를 줄인다(2026-09-27, 단계 6).** 첫 방문은 대부분 목록이다(검색 · 공유 링크도 목록부터).
 * 목록 · 로그인 · 회원가입 · 없는 화면은 바로 싣고, 등록 · 수정 · 상세 · 설정 · 내가 쓴 글은 들어갈 때 받는다(`lazy`).
 * 지금 나뉘어 나가는 것은 화면 코드와 그 화면에서만 쓰는 조각(댓글 · 설정의 화면 모드 · 내가 쓴 글 등)이다.
 * 폼 · 사진 줄이기처럼 `@/features/posts` 입구(index.ts)로 내보내는 것은 목록이 같은 입구를 쓰는 탓에 아직 첫 묶음에 남는다 —
 * 번들러가 CSS 를 가져오는 모듈을 "부수 효과 있음"으로 보고 입구의 모든 모듈을 싣기 때문이다.
 *
 * - 화면 안에서 옮겨 갈 때 : 라우터가 조각을 받은 뒤에 화면을 바꾼다. 받는 동안은 보던 화면 그대로다
 * - 그 주소로 바로 들어왔을 때(새로고침 · 공유 링크) : 헤더는 바로 그리고, 본문 자리에 **그 화면의 스켈레톤**을 둔다
 *   (`hydrateFallbackElement`). 화면이 데이터를 받는 동안 그리는 스켈레톤과 같은 것이라, 코드 → 데이터로 넘어가도
 *   모양이 바뀌지 않는다. 대체 화면은 조각 밖에 있어야 해서 스켈레톤을 따로 뗀 파일에서 가져온다
 * - 조각을 받지 못하면(연결 끊김 · 새 버전 배포로 옛 조각이 사라짐) 본문 자리에 [다시 시도](새로고침)
 */
export function createAppRouter() {
  return createBrowserRouter(
    createRoutesFromElements(
      <Route element={<RootLayout />}>
        <Route path="/" element={<PostListPage />} />

        {/* 정적 세그먼트가 동적 세그먼트보다 우선 매칭되므로
            /posts/new 가 /posts/:postId 에 먹히지 않는다 */}
        <Route
          path="/posts/new"
          lazy={() => import('@/pages/post-create/PostCreatePage').then((m) => ({ Component: m.PostCreatePage }))}
          hydrateFallbackElement={<PostFormSkeleton label="글 올리기 화면을 불러오는 중입니다" />}
          errorElement={<RouteLoadError />}
        />
        <Route
          path="/posts/:postId"
          lazy={() => import('@/pages/post-detail/PostDetailPage').then((m) => ({ Component: m.PostDetailPage }))}
          hydrateFallbackElement={<PostDetailSkeleton />}
          errorElement={<RouteLoadError />}
        />
        <Route
          path="/posts/:postId/edit"
          lazy={() => import('@/pages/post-edit/PostEditPage').then((m) => ({ Component: m.PostEditPage }))}
          hydrateFallbackElement={<PostFormSkeleton label="글 수정 화면을 불러오는 중입니다" />}
          errorElement={<RouteLoadError />}
        />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route
          path="/me"
          lazy={() => import('@/pages/my-page/MyPage').then((m) => ({ Component: m.MyPage }))}
          hydrateFallbackElement={<MyPageSkeleton />}
          errorElement={<RouteLoadError />}
        />
        <Route
          path="/settings"
          lazy={() => import('@/pages/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage }))}
          hydrateFallbackElement={<SettingsSkeleton />}
          errorElement={<RouteLoadError />}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>,
    ),
  )
}
