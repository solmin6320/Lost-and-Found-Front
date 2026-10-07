# 분실물 찾기 — 프론트엔드

잃어버린 물건과 주운 물건을 올리고 찾는 서비스의 React 클라이언트.
백엔드는 별도 리포지토리([Lost-and-Found](https://github.com/solmin6320/Lost-and-Found))의 REST API를 그대로 쓴다.

## 실행

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

백엔드(`localhost:8080`)와 Docker Compose(MariaDB·Redis)가 떠 있어야 API가 응답한다.

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (5173 고정) |
| `npm run build` | 타입 검사 후 `dist/` 로 빌드 |
| `npm run preview` | 빌드 결과를 로컬에서 확인 |
| `npm run typecheck` | 타입 검사만 |
| `npm run lint` | oxlint |
| `npm test` | vitest 단위 테스트(순수 로직, 한 번 실행) |

## API 주소를 잡는 방식

기본값은 **상대경로**다(`VITE_API_BASE_URL` 이 빈 문자열).
요청이 `/api/posts` 로 나가고, 개발에서는 Vite 프록시가, 배포에서는 CloudFront가
백엔드로 넘긴다. 두 환경 모두 브라우저가 보는 오리진이 하나다.

그래서 얻는 것

- CORS preflight 가 없다 — 로컬에서만 통과하고 배포에서 깨지는 일이 생기지 않는다
- `SameSite=Strict` 리프레시 토큰 쿠키가 실린다. 오리진이 갈리면 재발급(`[3.3]`)이 통째로 막힌다
- 로컬 구성이 배포 구성(기능명세서 11장)과 같은 모양이 된다

백엔드 CORS 설정을 직접 확인하고 싶을 때만 `.env` 에
`VITE_API_BASE_URL=http://localhost:8080` 을 채운다. 프록시를 건너뛰고 크로스 오리진으로 나간다.

프록시가 넘겨줄 백엔드 주소는 `DEV_PROXY_TARGET`(기본 `http://localhost:8080`)이다.
개발 서버만 읽는 값이라 `VITE_` 를 붙이지 않는다 — 붙은 값은 브라우저 번들에 실릴 수 있다(보안명세서 5장).

```bash
DEV_PROXY_TARGET=http://localhost:8090 npm run dev   # 다른 포트의 백엔드 · 목 서버로 붙일 때
```

운영 빌드는 `index.html`에 CSP meta를 심는다(보안명세서 4장). 사진 출처(`img-src`)는 빌드 환경변수 `CSP_IMAGE_ORIGINS`이고,
배포 때는 사진 CloudFront 도메인을 넣는다. 비우면 같은 도메인(`build/csp.ts`의 `DEFAULT_IMAGE_ORIGINS`)을 쓰고 경고한다.

```bash
CSP_IMAGE_ORIGINS=https://d1xmzetvs0f1oh.cloudfront.net npm run build
```

## 폴더

```
src/
  app/            부팅 · 라우팅 · 공통 레이아웃
  pages/          라우트 1:1 화면. 조립만 하고 로직은 두지 않는다
  features/       도메인 단위 (auth · posts · comments · members)
  shared/         도메인이 없는 것 (ui · lib · styles · config · types)
build/            빌드가 쓰는 코드 (CSP 정책 문자열)
deploy/           배포에만 쓰는 것 — CloudFront Function(spa-rewrite.js) · S3 업로드 스크립트(docs/배포.md)
```

자세한 규칙은 `src/features/README.md`, `src/shared/README.md` 에 있다.

## 화면과 명세서

| 경로 | 화면 | 기능명세서 |
|---|---|---|
| `/` | 게시글 목록(검색·필터) | `[4.2]` |
| `/posts/new` | 게시글 등록 | `[4.1]` `[4.5]` |
| `/posts/:postId` | 게시글 상세 · 댓글 · 상태 변경 | `[4.3]` `[5.1]` `[4.6]` |
| `/posts/:postId/edit` | 게시글 수정 | `[4.4]` `[4.5]` |
| `/login` | 로그인 | `[3.2]` |
| `/signup` | 회원가입 | `[3.1]` |
| `/me` | 내가 쓴 글 | `[6.1]` |
| `/settings` | 설정 — 화면 모드(누구나) · 프로필 · 비밀번호(로그인) | `[3.6]` `[3.7]` |

목록의 검색·필터·페이지는 화면을 나누지 않고 `/` 의 쿼리스트링에 싣는다.
뒤로가기·새로고침·링크 공유가 그대로 동작하고, 백엔드 `[4.2]` 의 쿼리 파라미터와 이름이 같다.

라우터는 History API 를 쓰는 데이터 라우터(`createBrowserRouter`)다. 배포에서 `/posts/3` 직접 접근은
기본 동작(`/*`)에만 붙인 CloudFront Function(`deploy/cloudfront/spa-rewrite.js`)이 `/index.html` 로 돌린다(기능명세서 11장).
커스텀 오류 응답(403/404 → `/index.html`)은 쓰지 않는다 — `/api/*` 의 403 · 404 까지 HTML 이 된다. 배포 절차는 `docs/배포.md`.

## 디자인

**색은 개념에 붙는다.** 이 서비스에는 두 갈래뿐이다 — 잃어버림과 주움.
두 색을 배지뿐 아니라 면(첫 화면의 의도 선택 · 사진 없는 글의 포스터 · 등록 권유)으로 크게 쓰고,
나머지(글자 · 선 · 공통 버튼)는 중성 잉크와 흰 종이로 조용히 둔다.

- 분실 = 마리골드 면 `#FFBF2E`(넓은 면 `#F5BE3D`), 습득 = 코발트 면 `#2F5FB1`. 노랑 ↔ 파랑이라 적록색각이상에서도, 흑백에서도 갈린다
- 밝게 · 어둡게 두 모드. 사용자가 설정 화면에서 고르고, 고르지 않으면 기기 설정을 따른다
- 글꼴은 Pretendard 하나. `pretendard` 패키지의 가변 동적 서브셋을 번들로 싣는다(`src/main.tsx`) — 화면에 뜬 글자가 속한 woff2 조각만 같은 출처에서 받고, 외부 CDN 요청이 없다
- 아이콘은 Phosphor(`@phosphor-icons/react`) 한 벌, 반경은 4 · 8 · 12 · 알약 네 단계
- 상태 — 외곽선 배지. 색을 쓰지 않고 라벨 · 아이콘 · 선 굵기로 가른다. 완료는 가장 약하게
- 빨강은 "멈춰서 볼 것"에만 쓴다 — 방금 틀린 칸의 오류 문장 · 되돌릴 수 없는 동작(삭제) · 개인정보 · 안전 경고(빨간 글자 + 경고 세모, 2026-10-07). 빨간 채움은 삭제 확인 버튼 하나

토큰은 `src/shared/styles/tokens.css` 한 파일에 있다.
