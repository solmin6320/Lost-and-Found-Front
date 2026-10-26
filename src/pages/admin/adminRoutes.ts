/**
 * 관리자 화면 묶음의 입구 — 틀(`AdminLayout`)과 섹션 화면을 **한 조각**으로 받는다(라우트 `lazy` 가 둘 다 이 파일을 부른다).
 * 따로 받으면 둘이 같이 쓰는 머리 · 스켈레톤이 또 한 조각으로 갈리고, 번들러가 앱 공용 코드까지 새 조각으로 떼어 내 첫 화면 요청이 하나 늘었다(2026-10-25 실측)
 */
export { AdminLayout } from './AdminLayout'
export { ManagersPage } from './ManagersPage'
