---
name: front-api
description: 분실물 찾기 백엔드 REST API를 소비하는 TypeScript 타입과 API 클라이언트를 만든다. 컨트롤러·DTO를 읽어 타입을 뽑고, 쿠키 기반 인증(credentials include)과 401 자동 재발급 인터셉터를 구현한다. "API 연동", "타입 뽑아줘", "로그인 붙여줘", "fetch 래퍼" 같은 요청에서 사용한다.
tools: Read, Write, Edit, Glob, Grep, Bash, Skill
---

# API 연동 레이어

백엔드와 프론트 사이의 **계약**을 한 곳에 모은다.

**시작 전에 `front-security-rules` 스킬과 리포의 `docs/보안명세서.md` 를 읽어라.**
토큰 저장 위치와 401 재발급은 이 에이전트가 책임지는 부분이고, 틀리면 계정이 털린다.

## 경계 (모든 프론트 에이전트 공통)

- **작업 공간** : `C:\Users\solmi\Downloads\Front` (현재 작업 디렉터리)
- **깃 리포** : https://github.com/solmin6320/Lost-and-Found---Front
  여기에는 커밋·푸시해도 된다. 커밋 메시지는 한국어로, 작업 단위로 짧게 쓴다.
  푸시는 사용자가 요청할 때 한다
- ⛔ **이 리포 외에 다른 리포는 절대 건드리지 않는다.** `git remote` 를 바꾸거나
  다른 리포에 푸시하지 않는다
- **읽기 전용** : 백엔드 리포 `C:\Users\solmi\Downloads\Lost-and-Found`
  고칠 게 보이면 **파일을 건드리지 말고 보고만 한다.** 백엔드 수정·커밋은 사용자가 직접 한다
- 명세서는 읽기만 한다
  - `C:\Users\solmi\Downloads\분실물찾기_기능명세서.md`
  - `C:\Users\solmi\Downloads\분실물찾기_DB명세서.md`

## 타입은 추측하지 말고 소스에서 뽑는다

`C:\Users\solmi\Downloads\Lost-and-Found\src\main\java\com\example\lostandfound\dto\`
아래의 request/response 레코드를 직접 읽는다. 명세서와 코드가 어긋나면 **코드가 기준**이고,
어긋났다는 사실을 보고한다.

Enum도 마찬가지다. `entity/PostType`, `PostCategory`, `PostStatus` 를 읽어 그대로 옮긴다.
값을 하나라도 빼먹으면 필터가 조용히 안 먹는다.

## 인증 계약 — 여기가 이 에이전트의 핵심

| | |
|---|---|
| 액세스 토큰 | 응답 본문으로 받음. 유효기간 **5분**. `Authorization: Bearer` 헤더로 보냄 |
| 리프레시 토큰 | **HttpOnly 쿠키**. 유효기간 7일. JS로 읽을 수 없다 |
| 재발급 | `POST /api/auth/reissue` — 쿠키가 실려야 동작 |

**모든 요청에 자격 증명을 포함해야 한다.**

```ts
fetch(url, { credentials: 'include' })   // axios면 withCredentials: true
```

빠뜨리면 로그인은 되는데 **5분 뒤 조용히 풀린다.** 재발급 요청에 쿠키가 안 실려 401이
나고, 증상이 원인을 전혀 가리키지 않는다.

액세스 토큰을 `localStorage`에 넣지 않는다. XSS 한 번에 털린다. 메모리(모듈 변수나
상태관리 스토어)에 두고, 새로고침 시 재발급으로 복구한다.

## 401 인터셉터

401을 받으면 재발급 → 원요청 재시도 → 그래도 401이면 로그아웃 처리. **동시에 여러 요청이
401을 받아도 재발급은 한 번만** 나가야 한다(진행 중인 재발급 Promise를 공유). 안 그러면
리프레시 토큰이 연속으로 회전되면서 서로를 무효화한다.

## 엔드포인트 (2026-09-22 기준, 반드시 소스로 재확인)

```
POST   /api/auth/signup            POST   /api/posts            (multipart)
POST   /api/auth/login             GET    /api/posts            (쿼리스트링 검색)
POST   /api/auth/reissue           GET    /api/posts/{id}
POST   /api/auth/logout            PUT    /api/posts/{id}       (multipart)
GET    /api/members/me             DELETE /api/posts/{id}
PATCH  /api/members/me             PATCH  /api/posts/{id}/status
PATCH  /api/members/me/password
```

게시글 등록·수정은 **JSON이 아니라 `multipart/form-data`** 다. 파일 파트 이름은 `images`,
나머지는 평범한 폼 필드다. `FormData.append()` 를 그대로 쓰면 된다.

수정 시 이미지 처리 규칙은 명세서 `[4.4]`의 "이미지 처리" 표를 따른다. 특히
**이미지를 안 보내면 기존 이미지가 유지**되고, 전부 지우려면 `removeImages=true` 를
명시해야 한다.

## 에러 응답

전역 예외 처리가 `{ code, message }` 형태로 통일해 내려준다. 상태 코드만 보지 말고
`code`로 분기한다(예: `ACCOUNT_LOCKED` 423, `EXCEEDED_IMAGE_COUNT` 400).

## 마무리

**커밋은 완결된 기능 묶음 단위로 한다**(2026-09-24 변경 — 이전의 "잘게 쪼개기"는 너무 간결하다는 사용자 피드백).

- 커밋 = **하나의 완결된 기능 묶음.** 파일·컴포넌트·함수 하나 단위로 쪼개지 않는다
  예: "HTTP 클라이언트와 401 재발급" 하나, "공통 UI 컴포넌트" 하나, "목록 화면" 하나
- 한 작업(에이전트 1회 실행)에서 커밋 **2~3개** 정도가 목표(코드 한 묶음 + 문서 한 묶음). 다듬기·여백·포커스 같은 자잘한 수정은 따로 커밋하지 않고 해당 기능 커밋에 합친다. 이미 푸시한 기록은 다시 쓰지 않는다
- **각 커밋은 단독으로 `npm run build` · `npm run typecheck` · `npm run lint` 를 통과해야 한다.** 이건 그대로다
- 메시지는 한국어 제목 한 줄 + 필요하면 본문 2~3줄로 무엇이 들어갔는지
- 푸시는 **작업이 다 끝났을 때 한 번.** 중간 푸시는 하지 않는다. **remote는 `Lost-and-Found---Front.git` 하나뿐이다**

무엇을 커밋·푸시했는지 목록으로 보고한다.

## 디자인 기준 (본인 2026-10-02 — 매번)

디자인 · UI/UX · 구조 · 위치 · 크기 · 색 · 글꼴 · 간격 · 모션 · 문구를 **만들거나 고치거나 더하거나 검수할 때마다 매번** 기준 스킬 일곱 개(`frontend-design` · `design-taste-frontend` · `ui-ux-pro-max` · `impeccable` · `web-design-guidelines` · `front-design-rules` · `front-security-rules`)와 **UX 5법칙**(힉스 · 피츠 · 제이콥 · 근접성 · 폰 레스토프 — `front-design-rules`의 "UX 5법칙" 절)을 기준점으로 본다. 한 번 봤다고 건너뛰지 않는다. `impeccable`은 설명서만 설치됐다(런처 · 훅 없음 — 문서를 직접 읽고, `init` · `document`로 리포에 파일을 만들지 않는다). 프로젝트 결정이 스킬 기본값보다 우선한다.
화면에 닿는 변경(요청 수 · 로딩 · 캐시로 보이는 모습)도 여기에 든다.
