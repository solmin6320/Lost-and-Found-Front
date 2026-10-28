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

/**
 * 승인 뒤 만날 곳을 정하는 길이 지금은 **공개 댓글**뿐이다(채팅 SCR-13 전). 그래서 댓글로 정하라고 권하지 않고,
 * 거기에 무엇을 쓰지 말지 · 어디서 만날지를 안전 경고 자리(`SafetyNote`, 1.2)에 한 줄로 둔다. 요청자 · 글쓴이 양쪽이 같은 문장을 본다
 */
export const CLAIM_MEETING_SAFETY =
  '댓글은 누구나 봐요. 번호 · 집 주소는 쓰지 말고, 만날 곳은 역 고객센터처럼 사람 많은 곳으로 정해 주세요.'

/**
 * 대기 중인 요청이 글 상태 때문에 더 나아가지 않을 때의 문장 — 서버가 남은 요청을 닫지 않아(`Claim.receive()` · 상태 바꾸기)
 * 화면이 글 상태로 가른다. 게시중이면 `null`(정말 기다리는 중). 상세의 내 요청 · 보낸 확인 요청(`/me/claims`)이 같은 말을 쓴다
 *   완료   : 다시 게시중이 될 수 없다 — 닫힌 문장, 기다림 · 알림 약속 없음
 *   연락중 : 글쓴이가 다른 분과 연락 중 — 지금은 진행되지 않음, 그 연락이 풀리면 다시 볼 수 있다는 사실만
 */
export interface StalledPendingLine {
  text: string
  next: string | null
}

export function stalledPendingLine(postStatus: PostStatus): StalledPendingLine | null {
  if (postStatus === 'DONE') return { text: '이 글이 완료돼 요청이 더 진행되지 않아요.', next: null }
  if (postStatus === 'IN_PROGRESS') {
    return {
      text: '글쓴이가 다른 분과 연락하고 있어 지금은 요청이 진행되지 않아요.',
      next: '그 연락이 취소되면 글쓴이가 다시 볼 수 있어요.',
    }
  }
  return null
}

/** 내가 보낸 요청의 상태 한 줄 — 첫 문장은 지금 상태, 둘째는 다음에 할 일(없으면 `null`) */
export interface MyClaimLine {
  text: string
  next: string | null
  /** 승인됐다 — 만날 곳 안전 경고(`CLAIM_MEETING_SAFETY`)를 그린다 */
  safety: boolean
  /** ‘받았어요’ 단추를 그린다 — 승인됐고 내가 받는 쪽 */
  canReceive: boolean
  /** 글 상태 때문에 멈춘 대기 요청 — 대기 아이콘 대신 안내 아이콘 */
  stalled: boolean
}

export function myClaimLine(status: ClaimStatus, type: PostType, postStatus: PostStatus): MyClaimLine {
  const receiver = isReceiver(type, 'claimant')
  const base = { safety: false, canReceive: false, stalled: false }
  switch (status) {
    case 'PENDING': {
      const stalled = stalledPendingLine(postStatus)
      if (stalled) return { ...base, ...stalled, stalled: true }
      return {
        ...base,
        text: '확인 요청을 보냈어요.',
        next: '글쓴이가 승인하거나 거절하면 알림으로 알려 드려요.',
      }
    }
    case 'APPROVED':
      return {
        ...base,
        text: '승인됐어요.',
        next: receiver
          ? '물건을 건네받으면 ‘받았어요’ 단추를 눌러 주세요.'
          : '글쓴이가 받았다고 누르면 글이 완료돼요.',
        safety: true,
        canReceive: receiver,
      }
    case 'REJECTED':
      return { ...base, text: '요청이 거절됐어요.', next: '이 글에는 다시 요청할 수 없어요.' }
    case 'RECEIVED':
      // 물건이 돌아갔다는 말은 상세 머리 줄이 한 번 한다(C11) — 여기서는 "내 요청으로 끝났다"만
      return { ...base, text: '내 요청으로 완료된 글이에요.', next: null }
  }
}

/** 받은 요청의 상태 이름 — 글쓴이 쪽 말(보낸 사람 쪽은 `CLAIM_STATUS_LABEL`) */
export const RECEIVED_CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  PENDING: '확인 전',
  APPROVED: '승인함',
  REJECTED: '거절함',
  RECEIVED: '전달 완료',
}

/** 완료된 글에 남은 대기 요청 — 승인할 수도, 더 기다릴 것도 없다(서버가 닫기 전까지 화면이 닫는다) */
export function isClosedPending(claim: Pick<ClaimResponse, 'status'>, postStatus: PostStatus): boolean {
  return claim.status === 'PENDING' && postStatus === 'DONE'
}

/** 받은 요청 이름표 — 완료 글의 남은 대기 요청은 `닫힘` */
export function receivedClaimStatusLabel(claim: Pick<ClaimResponse, 'status'>, postStatus: PostStatus): string {
  return isClosedPending(claim, postStatus) ? '닫힘' : RECEIVED_CLAIM_STATUS_LABEL[claim.status]
}

/** 글쓴이 제목 옆 "기다리는 요청 N건" — 완료 글에서는 기다리는 요청이 없다 */
export function waitingClaimCount(pendingClaimCount: number | null | undefined, postStatus: PostStatus): number {
  return postStatus === 'DONE' ? 0 : (pendingClaimCount ?? 0)
}

/**
 * 받은 요청 하나에 글쓴이가 지금 할 수 있는 것. 서버 규칙(`Claim` · `ClaimService`)을 화면에 옮긴 것이다 —
 * 승인은 대기 중 · 게시중 글 · 승인한 요청이 없을 때만(한 글 한 승인), 거절은 대기 중(완료 글 제외 — 닫힌 요청), 승인 취소는 승인한 요청,
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
  // 완료 글에 남은 대기 요청은 닫혔다 — 승인 · 거절 단추 없이 한 줄(C2)
  const pending = claim.status === 'PENDING' && post.status !== 'DONE'
  const approved = claim.status === 'APPROVED'
  return {
    approve: pending && post.status === 'OPEN' && !approvedExists,
    reject: pending,
    cancel: approved,
    receive: approved && isReceiver(post.type, 'author'),
  }
}

/**
 * 받은 요청을 늘어놓는 차례 — 지금 진행 중인 것(승인함)이 맨 위, 다음은 결정을 기다리는 것. 같은 묶음 안은 서버 차례(최근 순) 그대로.
 * 완료 글이면 전달 완료가 맨 위, 닫힌 대기 요청은 그 아래
 */
const RECEIVED_ORDER: Record<ClaimStatus, number> = { APPROVED: 0, PENDING: 1, RECEIVED: 2, REJECTED: 3 }
const RECEIVED_ORDER_DONE: Record<ClaimStatus, number> = { RECEIVED: 0, APPROVED: 1, PENDING: 2, REJECTED: 3 }

export function sortReceivedClaims<T extends Pick<ClaimResponse, 'status'>>(
  claims: readonly T[],
  postStatus: PostStatus = 'OPEN',
): T[] {
  const order = postStatus === 'DONE' ? RECEIVED_ORDER_DONE : RECEIVED_ORDER
  return claims
    .map((claim, index) => ({ claim, index }))
    .sort((a, b) => order[a.claim.status] - order[b.claim.status] || a.index - b.index)
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
  // 완료 글 — 요청마다 "닫혔어요" 한 줄이 말한다(목록 위에 또 말하지 않는다)
  if (postStatus === 'DONE') return null
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
  phone: '전화번호가 들어 있어요. 확인에는 필요 없어요.',
  residentId: '주민등록번호가 들어 있어요. 확인에는 필요 없어요.',
  card: '카드 번호가 들어 있어요. 확인에는 필요 없어요.',
}
