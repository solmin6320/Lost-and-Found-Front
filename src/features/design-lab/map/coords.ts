import type { PostListResponse } from '@/features/posts'

/**
 * 시안용 위도 · 경도(목 데이터). 실제로는 글을 쓸 때 지도에서 찍은 점이 `POST.latitude` · `longitude` 로 온다.
 * 목 서버 글의 장소 글자에서 이름난 곳을 찾아 그 근처에 놓고, 글 번호로 조금씩 흩뜨린다(같은 곳 글이 한 점에 겹치지 않게).
 */
const PLACES: [string, number, number, string][] = [
  ['강남역', 37.4979, 127.0276, '서울 강남구 역삼동'],
  ['서울숲', 37.5444, 127.0374, '서울 성동구 성수동1가'],
  ['신도림', 37.5088, 126.8912, '서울 구로구 신도림동'],
  ['472번', 37.5172, 127.0473, '서울 강남구 삼성동'],
  ['신촌', 37.5551, 126.9368, '서울 서대문구 창천동'],
  ['판교', 37.3948, 127.1112, '경기 성남시 분당구 삼평동'],
  ['홍대', 37.5572, 126.9245, '서울 마포구 동교동'],
  ['잠실', 37.5133, 127.1001, '서울 송파구 잠실동'],
  ['어린이대공원', 37.548, 127.0747, '서울 광진구 능동'],
  ['합정', 37.5495, 126.9139, '서울 마포구 합정동'],
  ['광화문', 37.5714, 126.9768, '서울 종로구 세종로'],
  ['건대', 37.5404, 127.0692, '서울 광진구 화양동'],
  ['연남', 37.566, 126.925, '서울 마포구 연남동'],
  ['서면', 35.1578, 129.06, '부산 부산진구 부전동'],
  ['여의도', 37.5284, 126.9327, '서울 영등포구 여의도동'],
  ['종각', 37.5702, 126.9831, '서울 종로구 종로1가'],
  ['수원', 37.2659, 127.0001, '경기 수원시 팔달구 매산로'],
  ['압구정', 37.5271, 127.0284, '서울 강남구 압구정동'],
  ['인천공항', 37.4492, 126.4508, '인천 중구 운서동'],
  ['성수', 37.5445, 127.056, '서울 성동구 성수동2가'],
  ['역삼', 37.5006, 127.0364, '서울 강남구 역삼동'],
  ['대학로', 37.5813, 127.0022, '서울 종로구 동숭동'],
  ['일산', 37.658, 126.7698, '경기 고양시 일산동구 장항동'],
]

export const SEOUL_CENTER: [number, number] = [37.535, 126.99]

export interface MapPoint {
  id: number
  lat: number
  lng: number
  post: PostListResponse
}

function jitter(id: number, salt: number) {
  const x = Math.sin(id * 12.9898 + salt * 78.233) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 0.006
}

/** 장소 글자 → 점. 이름난 곳을 못 찾으면 null(지도에 올리지 않는다 — 실제로도 위치를 안 찍은 글이 있다) */
export function pointOf(post: PostListResponse): MapPoint | null {
  const hit = PLACES.find(([key]) => post.location.includes(key) || post.title.includes(key))
  if (!hit) return null
  return { id: post.id, lat: hit[1] + jitter(post.id, 1), lng: hit[2] + jitter(post.id, 2), post }
}

/** 지도 가운데에서 가장 가까운 이름난 곳(위치 찍기 시안의 "근처" 주소 — 실제로는 역지오코딩 API) */
export function nearestArea(lat: number, lng: number): string {
  let best = PLACES[0]!
  let bestD = Infinity
  for (const place of PLACES) {
    const d = (place[1] - lat) ** 2 + (place[2] - lng) ** 2
    if (d < bestD) {
      bestD = d
      best = place
    }
  }
  return bestD < 0.0004 ? `${best[3]} 근처` : '이 근처'
}

/** 두 점 사이 거리(km, 대원 거리) */
export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
