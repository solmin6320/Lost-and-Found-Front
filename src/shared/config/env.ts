/**
 * 환경변수를 읽는 유일한 통로.
 *
 * 컴포넌트나 API 코드가 `import.meta.env` 를 직접 읽지 않게 한다.
 * 변수가 하나 늘거나 이름이 바뀔 때 고칠 자리가 여기 한 곳이면 된다.
 */
export const env = {
  /**
   * API 주소의 앞부분. 기본값은 빈 문자열이다.
   *
   * 빈 문자열이면 요청이 `/api/posts` 상대경로로 나가고
   *   - 개발 : vite.config.ts 의 프록시가 localhost:8080 으로 넘긴다
   *   - 배포 : CloudFront 가 /api/* 를 EC2(8080) 로 넘긴다 (기능명세서 11장)
   *
   * 두 경우 모두 브라우저가 보는 오리진이 하나이므로
   * CORS preflight 가 없고, SameSite=Strict 리프레시 쿠키가 그대로 실린다.
   */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
} as const
