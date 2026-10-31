/**
 * 공공 습득물 후보 응답 타입(7.6 ②-1 — 경찰서 · 기관에 맡겨진 습득물).
 * 원본 : Lost-and-Found `dto/response/PublicMatchResponse` · `entity/PublicFoundSource` · `service/PublicMatchService.getPublicMatches`(PR #45)
 *
 * 우리 사이트의 글이 아니다 — 글 id · 글쓴이 · 상세 화면이 없고, 확인 요청(`[내 물건이에요]`)으로 이어지지 않는다.
 * 점수(`PublicMatch.score`)는 서버 정렬에만 쓰고 응답에 없다. 후보는 이미 걸러져 온다 :
 * 내 분실 글과 같은 종류 · 분실일 ≤ 습득일 ≤ 분실일 + 14일 · 내가 숨기지 않은 것, 점수 높은 순. **습득 글이면 빈 배열**
 */

/** 보관한 곳 — `POLICE` 경찰서 · 지구대, `PORTAL` 지하철 · 공항 등 기관 */
export type PublicFoundSource = 'POLICE' | 'PORTAL'

export interface PublicMatchResponse {
  /** 공공 습득물 id — 숨길 때 `itemId` */
  itemId: number
  /** 서버에 새 출처가 생겨도 화면이 깨지지 않게 문자열도 받는다(모르는 출처는 `기관 보관`) */
  source: PublicFoundSource | (string & {})
  /** 물품명(공공 데이터 원문 — 글자로만 그린다) */
  itemName: string
  /** 원문 분류명(예 `지갑 > 남성용 지갑`). 없으면 `null` */
  categoryName: string | null
  /** 색상. 없으면 `null` */
  colorName: string | null
  /** 습득일 `yyyy-MM-dd` */
  foundDate: string
  /** 보관 장소(습득 장소가 아니다). 없으면 `null` */
  storagePlace: string | null
  /**
   * 사진 주소(공공 데이터 원문). 없으면 `null`, 사진 없는 습득물은 `…/img02_no_img.gif`.
   * 경찰민원24 출처(`PUBLIC_PHOTO_ORIGIN`)만 그린다 — 거르는 곳은 `publicItemPhoto`(보안명세서 4장)
   */
  imageUrl: string | null
  /** 분실일과 습득일의 차(0 이상, 일) */
  daysApart: number
  /** 물품명 · 게시 제목이 내 글 제목 · 본문과 비슷하다(서버 2-gram 기준) */
  similarName: boolean
}
