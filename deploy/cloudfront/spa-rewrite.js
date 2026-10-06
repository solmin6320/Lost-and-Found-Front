/*
 * CloudFront Function — SPA 주소를 index.html 로 돌린다(viewer-request, 런타임 cloudfront-js-2.0).
 *
 * 붙이는 곳 : **기본 동작(`/*` → 프론트 S3) 하나만.** `/api/*` 동작(→ EC2)에는 붙이지 않는다.
 * 커스텀 오류 응답(403/404 → /index.html)은 쓰지 않는다 — 배포 전체에 걸려 API 의 403 · 404 까지 200 HTML 이 된다.
 * 콘솔에 그대로 붙여 넣는 파일이라 export · import 가 없다. 고치면 `spa-rewrite.test.ts` 를 같이 돌린다.
 *
 * 규칙(uri 만 본다 — 쿼리스트링은 CloudFront 가 따로 들고 있어 그대로 S3 까지 간다)
 *   1. `/api` · `/api/...` → 손대지 않는다. 이 동작에 올 일은 없지만, 잘못 붙여도 API 가 HTML 이 되지 않게
 *   2. 점으로 시작하는 조각이 있다(`/.well-known/...` · `/.env`) → 손대지 않는다. 앱 주소에는 없고, 없는 파일이면 S3 의 403 이 그대로 간다
 *   3. 마지막 조각이 `.확장자`로 끝난다(`/assets/index-abc.js` · `/theme-init.js` · `/favicon.svg`) → 손대지 않는다.
 *      없는 파일을 index.html 로 덮지 않는다 — 옛 청크가 HTML(200)로 오면 오류가 흐려지고 캐시에도 남는다
 *   4. 나머지(`/` · `/posts/3` · `/posts/3/edit/` · `/%EA%B0%80`) → `/index.html`. 화면은 React Router 가 고른다(없는 주소면 SCR-09)
 *
 * 확장자는 **글자로 시작하는** 1~10자다. `/posts/1.5` 의 `.5` 는 확장자로 보지 않는다 — 앱으로 보내 "없는 글"을 보여 준다(S3 403 XML 대신).
 */
// oxlint-disable-next-line no-unused-vars -- CloudFront 가 이름으로 부른다
function handler(event) {
  var request = event.request
  var uri = request.uri

  if (uri === '/api' || uri.indexOf('/api/') === 0) return request
  if (uri.indexOf('/.') !== -1) return request

  var last = uri.slice(uri.lastIndexOf('/') + 1)
  if (/\.[A-Za-z][A-Za-z0-9]{0,9}$/.test(last)) return request

  request.uri = '/index.html'
  return request
}
