import type { PostStatus, PostType } from '@/features/posts'

import type { PersonalInfoKind } from '@/shared/lib/personalInfo'

import { CLAIM_ANSWER_MAX_LENGTH, type ClaimResponse, type ClaimStatus, type MyClaimSummary } from '../api/types'
import { isReceiver } from './labels'

/** 상세 주소 조각 — 경로 상수와 함께 `app/paths` 한곳에 둔다(로그인 뒤 돌아갈 곳 검사가 첫 화면 코드라 이 기능 입구를 싣지 않게) */
export { POST_CLAIMS_HASH } from '@/app/paths'

/** 상세의 확인 요청 칸 id — 알림 링크 · 로그인 뒤 돌아오는 주소가 `#claims` 로 이 칸을 가리킨다 */
export const CLAIMS_ANCHOR_ID = 'claims'

/** 보는 사람 — 로그인 확인 전 · 비로그인 · 글쓴이가 아닌 회원 · 글쓴이 */
export type ClaimViewer = 'unknown' | 'guest' | 'member' | 'owner'

/**
 * 글쓴이가 아닌 사람의 확인 요청 칸이 무엇을 그리나.
 *   none      그리지 않는다(글쓴이 · 끝난 글에 내 요청 없음)
 *   closed    연락중 글 — 지금은 요청을 받지 않는다는 한 줄
 *   checking  게시중 글인데 로그인 확인 전 — 단추 자리만 잡는다
 *   sign-in   게시중 · 비로그인 — 로그인 링크
 *   ask       게시중 · 회원 · 보낸 적 없음 — [내 물건이에요] → 답 칸
 *   mine      내가 보낸 요청이 있다 — 상태 한 줄(글 상태와 상관없이)
 */
export type ClaimPanelMode = 'none' | 'closed' | 'checking' | 'sign-in' | 'ask' | 'mine'

export function claimPanelMode(
  post: { status: PostStatus; myClaim: MyClaimSummary | null },
  viewer: ClaimViewer,
): ClaimPanelMode {
  if (viewer === 'owner') return 'none'
  if (post.myClaim) return 'mine'
  if (post.status === 'DONE') return 'none'
  if (post.status === 'IN_PROGRESS') return 'closed'
  if (viewer === 'unknown') return 'checking'
  return viewer === 'guest' ? 'sign-in' : 'ask'
}

/** 칸 제목 — 습득 글엔 주인에게, 분실 글엔 주운 사람에게 묻는다 */
export function claimAskHeading(type: PostType): string {
  return type === 'FOUND' ? '이 물건의 주인인가요?' : '이 물건을 주웠나요?'
}

/** 답 칸 이름 — 질문이 있으면 그 답, 없으면 확인할 내용(보내기 전 검사 문장이 이 이름으로 시작한다) */
export function claimAnswerLabel(hasQuestion: boolean): string {
  return hasQuestion ? '답' : '확인할 내용'
}

/** 보내기 전 검사(해요체, 칸 이름으로 시작). 서버가 앞뒤 공백을 자르므로 자른 길이로 잰다 */
export function validateClaimAnswer(answer: string, label: string): string | null {
  const trimmed = answer.trim()
  if (!trimmed) return `${label}을 적어 주세요`
  if (trimmed.length > CLAIM_ANSWER_MAX_LENGTH) {
    return `${label}은 ${CLAIM_ANSWER_MAX_LENGTH.toLocaleString('ko-KR')}자까지 쓸 수 있어요`
  }
  return null
}

/** 내가 보낸 요청의 상태 한 줄 — 첫 문장은 지금 상태, 둘째는 다음에 할 일(없으면 `null`) */
export interface MyClaimLine {
  text: string
  next: string | null
  /** [받았어요]를 그린다 — 승인됐고 내가 받는 쪽 */
  canReceive: boolean
}

export function myClaimLine(status: ClaimStatus, type: PostType): MyClaimLine {
  const receiver = isReceiver(type, 'claimant')
  switch (status) {
    case 'PENDING':
      return { text: '확인 요청을 보냈어요. 글쓴이가 답을 확인하고 있어요.', next: null, canReceive: false }
    case 'APPROVED':
      return {
        text: '승인됐어요. 댓글로 만날 곳을 정해 주세요.',
        next: receiver ? '물건을 건네받으면 [받았어요]를 눌러 주세요.' : '글쓴이가 물건을 받으면 주인 확인이 끝나요.',
        canReceive: receiver,
      }
    case 'REJECTED':
      return { text: '요청이 거절됐어요.', next: '이 글에는 다시 요청할 수 없어요.', canReceive: false }
    case 'RECEIVED':
      return {
        text: receiver ? '물건을 받았어요.' : '물건을 건넸어요.',
        next: receiver ? null : '글쓴이가 받았다고 확인했어요.',
        canReceive: false,
      }
  }
}

/** 받은 요청의 상태 이름 — 글쓴이 쪽 말(보낸 사람 쪽은 `CLAIM_STATUS_LABEL`) */
export const RECEIVED_CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  PENDING: '확인 전',
  APPROVED: '승인함',
  REJECTED: '거절함',
  RECEIVED: '전달 완료',
}

/**
 * 받은 요청 하나에 글쓴이가 지금 할 수 있는 것. 서버 규칙(`Claim` · `ClaimService`)을 화면에 옮긴 것이다 —
 * 승인은 대기 중 · 게시중 글 · 승인한 요청이 없을 때만(한 글 한 승인), 거절은 대기 중, 승인 취소는 승인한 요청,
 * 받았어요는 승인한 요청 · 분실 글(글쓴이가 받는 쪽)
 */
export interface ReceivedClaimActions {
  approve: boolean
  reject: boolean
  cancel: boolean
  receive: boolean
}

export function receivedClaimActions(
  claim: Pick<ClaimResponse, 'status'>,
  post: { status: PostStatus; type: PostType },
  approvedExists: boolean,
): ReceivedClaimActions {
  const pending = claim.status === 'PENDING'
  const approved = claim.status === 'APPROVED'
  return {
    approve: pending && post.status === 'OPEN' && !approvedExists,
    reject: pending,
    cancel: approved,
    receive: approved && isReceiver(post.type, 'author'),
  }
}

/** 받은 요청을 늘어놓는 차례 — 지금 진행 중인 것(승인함)이 맨 위, 다음은 결정을 기다리는 것. 같은 묶음 안은 서버 차례(최근 순) 그대로 */
const RECEIVED_ORDER: Record<ClaimStatus, number> = { APPROVED: 0, PENDING: 1, RECEIVED: 2, REJECTED: 3 }

export function sortReceivedClaims<T extends Pick<ClaimResponse, 'status'>>(claims: readonly T[]): T[] {
  return claims
    .map((claim, index) => ({ claim, index }))
    .sort((a, b) => RECEIVED_ORDER[a.claim.status] - RECEIVED_ORDER[b.claim.status] || a.index - b.index)
    .map(({ claim }) => claim)
}

/**
 * 대기 중 요청의 [승인]을 그리지 않을 때 그 까닭 한 줄. 대기 중 요청이 없거나 승인할 수 있으면 `null`
 */
export function approveBlockedReason(
  claims: readonly Pick<ClaimResponse, 'status'>[],
  postStatus: PostStatus,
): string | null {
  if (!claims.some((claim) => claim.status === 'PENDING')) return null
  if (claims.some((claim) => claim.status === 'APPROVED')) {
    return '승인한 요청이 있어서 다른 요청은 승인할 수 없어요. 승인을 취소하면 다시 고를 수 있어요.'
  }
  if (postStatus !== 'OPEN') return '글이 게시중일 때만 승인할 수 있어요.'
  return null
}

/**
 * 답 칸의 개인정보 줄 — 답은 공개가 아니라 **글쓴이만** 본다. 공용 문장("올리면 누구나 봐요")은 이 칸에서 사실이 아니라 따로 둔다.
 * 그래도 확인에 필요 없는 번호를 낯선 사람에게 먼저 주지 않게 한 번 멈춰 세운다(막지 않는다)
 */
export const CLAIM_PERSONAL_INFO_NOTICE: Record<PersonalInfoKind, string> = {
  phone: '전화번호가 들어 있어요. 연락은 승인된 뒤 댓글로 해도 돼요.',
  residentId: '주민등록번호가 들어 있어요. 확인에는 필요 없어요.',
  card: '카드 번호가 들어 있어요. 확인에는 필요 없어요.',
}
