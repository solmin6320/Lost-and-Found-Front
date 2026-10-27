/** 글을 지우면 함께 사라지는 것 — 화면정의서 SCR-03 ① "무엇이 함께 사라지는지 숫자로" */
export interface DeleteLoss {
  photos: number
  comments: number
  /** 받은 확인 요청 수. 서버가 글과 함께 지운다(`claimRepository.deleteAllByPostId`) — 보낸 사람의 요청 목록에서도 사라진다 */
  claims: number
}

/** 단위와 받침 — 뒤에 붙는 조사(과/와 · 이/가)를 가른다 */
const UNITS = [
  { key: 'photos', label: (n: string) => `사진 ${n}장`, batchim: true },
  { key: 'comments', label: (n: string) => `댓글 ${n}개`, batchim: false },
  { key: 'claims', label: (n: string) => `확인 요청 ${n}건`, batchim: true },
] as const

/**
 * 삭제 확인 창의 결과 문장. 0인 것은 문장에서 뺀다.
 *   하나 "사진 2장이 함께 사라져요." · 둘 "사진 2장과 댓글 3개가 …" · 셋 "사진 2장과 댓글 3개, 확인 요청 1건이 …"
 * 앞 조사(과/와)는 첫 낱말의 받침, 끝 조사(이/가)는 마지막 낱말의 받침을 따른다.
 * 삭제는 댓글 · 확인 요청 · S3 사진까지 지운다 — 사용자가 예상하지 못하는 결과다
 */
export function deleteConsequence(loss: DeleteLoss): string {
  const items = UNITS.filter(({ key }) => loss[key] > 0).map((unit) => ({
    text: unit.label(loss[unit.key].toLocaleString('ko-KR')),
    batchim: unit.batchim,
  }))
  if (items.length === 0) return '이 게시글을 삭제하면 되돌릴 수 없어요.'

  const [first, ...rest] = items
  const last = items[items.length - 1]
  const lost =
    rest.length === 0 ? first.text : `${first.text}${first.batchim ? '과' : '와'} ${rest.map((item) => item.text).join(', ')}`
  return `이 게시글을 삭제하면 ${lost}${last.batchim ? '이' : '가'} 함께 사라져요. 되돌릴 수 없어요.`
}
