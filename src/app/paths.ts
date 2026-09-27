/**
 * 경로 문자열을 한곳에 모은다.
 *
 * `<Link to="/posts/3">` 처럼 문자열을 흩어 놓으면 경로를 바꿀 때
 * 바뀌지 않은 링크가 조용히 404 로 간다. 여기서만 만든다.
 */
export const paths = {
  /** [4.2] 목록. 검색·필터·페이지는 쿼리스트링으로 붙인다 */
  postList: '/',
  /** [4.1] 등록 */
  postCreate: '/posts/new',
  /** [4.1] 등록 — 유형을 미리 골라 둔다. 목록의 "분실 글 올리기" 같은 동선이 쓴다(SCR-02 가 읽는 것은 단계 4) */
  postCreateAs: (type: 'LOST' | 'FOUND') => `/posts/new?type=${type}`,
  /** [4.3] 상세 (+ [5.1] 댓글) */
  postDetail: (postId: number | string) => `/posts/${postId}`,
  /** [4.4] 수정 */
  postEdit: (postId: number | string) => `/posts/${postId}/edit`,

  /** [3.2] 로그인 */
  login: '/login',
  /**
   * 로그인 후 `redirect` 로 되돌아온다(화면정의서 1.5).
   * 받는 쪽(로그인 화면)은 `/` 로 시작하고 `//` 가 아닌 내부 경로만 따라가야 한다 — 열린 리다이렉트
   */
  loginThenReturn: (redirect: string) => `/login?redirect=${encodeURIComponent(redirect)}`,
  /** [3.1] 회원가입 */
  signup: '/signup',
  /** 가입 후 `redirect` 로 이어진다. 로그인 ↔ 가입을 오가도 돌아갈 곳을 잃지 않게 링크가 물고 다닌다 */
  signupThenReturn: (redirect: string) => `/signup?redirect=${encodeURIComponent(redirect)}`,

  /** [6.1] 마이페이지 — 내가 쓴 글 */
  myPage: '/me',
  /**
   * 설정 — 화면 모드(누구나) + [3.7] 프로필 · [3.6] 닉네임 · 비밀번호(로그인했을 때만).
   * 비로그인도 화면 모드를 바꿀 수 있어야 해서 `/me` 아래가 아니다
   */
  settings: '/settings',
} as const

/**
 * 로그인 화면에 넘기는 안내 한 줄(`navigate(paths.login, { state })`). 로그인 화면이 폼 위에 띄운다(SCR-05).
 * 설정의 비밀번호 변경 뒤 · 가입은 됐는데 이어진 로그인만 실패했을 때 쓴다
 */
export interface LoginNoticeState {
  notice: string
  /** 이메일 칸을 미리 채운다(가입 직후). 비밀번호는 싣지 않는다 — 기록(history)에 남는다 */
  email?: string
}

/**
 * 가입 직후 목록으로 갈 때 붙인다. 목록이 온보딩 1층(docs/온보딩설계.md 3장)을 한 번 띄우는 신호다.
 * 목록(`app/onboarding` 의 `usePostListGuide`)이 읽자마자 기록에서 지운다
 */
export interface PostListEntryState {
  justSignedUp: true
}

/**
 * 목록 카드로 상세에 들어갈 때 붙인다. 상세의 [목록으로]가 이것이 있으면 **뒤로 가기**를 한다 —
 * 새로 목록을 여는 것과 달리 보던 필터 · 페이지 · 스크롤 위치가 그대로 돌아온다.
 * 공유 링크처럼 바로 들어왔으면 없다. 그때는 목록 첫 화면으로 간다
 */
export interface PostDetailEntryState {
  fromList: true
  /**
   * 내가 쓴 글(SCR-07)의 카드로 들어왔다. 상세의 되돌아가기 링크가 `목록으로` 대신 `내가 쓴 글` 이 되고,
   * 글을 지운 뒤에는 목록이 아니라 보던 탭으로 돌아간다
   */
  from?: 'mine'
  /** `from: 'mine'` 일 때 보던 탭 · 쪽(`?status=OPEN&page=2`). 없으면 전체 첫 쪽 */
  search?: string
}

export const POST_DETAIL_FROM_LIST: PostDetailEntryState = { fromList: true }

/** 내가 쓴 글 카드가 상세로 넘기는 기록 상태 */
export function postDetailFromMine(search: string): PostDetailEntryState {
  return { fromList: true, from: 'mine', search }
}

/**
 * 상세가 기록 상태를 읽는다. 기록(history)의 state 는 무엇이든 들어올 수 있어 모양이 맞을 때만 쓴다.
 * `search` 는 `?` 로 시작하는 쿼리만 받는다 — 경로를 바꿔치기하는 값(`//evil`)이 끼어들 수 없다
 */
export function readPostDetailEntry(state: unknown): { fromList: boolean; mineHref: string | null } {
  if (typeof state !== 'object' || state === null) return { fromList: false, mineHref: null }
  const { fromList, from, search } = state as Record<string, unknown>
  if (fromList !== true) return { fromList: false, mineHref: null }
  if (from !== 'mine') return { fromList: true, mineHref: null }
  const query = typeof search === 'string' && /^\?[\w=&%-]*$/.test(search) ? search : ''
  return { fromList: true, mineHref: `${paths.myPage}${query}` }
}
