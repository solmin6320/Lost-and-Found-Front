import { describe, expect, it } from 'vitest'

import { memberKeys } from '@/features/members'

import { PUBLIC_DATA_IMAGE_ORIGINS } from '../../../../build/csp.ts'

import type { PublicMatchResponse } from '../api/publicMatchTypes'
import { withoutPublicItem } from './publicMatchMutations'
import { publicMatchKeys } from './publicMatchQueries'
import {
  PUBLIC_DISMISS,
  PUBLIC_MATCHES_COPY,
  PUBLIC_PHOTO_ORIGIN,
  PUBLIC_PORTAL,
  nextFocusPublicItem,
  publicItemDetail,
  publicItemPhoto,
  publicMatchReasons,
  publicSourceLabel,
  showsPublicMatches,
} from './publicMatchView'

const base: PublicMatchResponse = {
  itemId: 1,
  source: 'POLICE',
  itemName: '검정색 가죽 반지갑',
  categoryName: '지갑 > 남성용 지갑',
  colorName: '검정',
  foundDate: '2026-10-22',
  storagePlace: '강남경찰서 생활질서계',
  imageUrl: null,
  daysApart: 0,
  similarName: false,
}

describe('공공 후보 묶음 권한(SCR-11 확장)', () => {
  it('글쓴이 · 게시중 · 분실 글에만', () => {
    expect(showsPublicMatches({ status: 'OPEN', type: 'LOST' }, true)).toBe(true)
    expect(showsPublicMatches({ status: 'OPEN', type: 'FOUND' }, true)).toBe(false)
    expect(showsPublicMatches({ status: 'OPEN', type: 'LOST' }, false)).toBe(false)
    expect(showsPublicMatches({ status: 'IN_PROGRESS', type: 'LOST' }, true)).toBe(false)
    expect(showsPublicMatches({ status: 'DONE', type: 'LOST' }, true)).toBe(false)
  })

  it('캐시 키는 회원 키 아래(로그아웃 때 함께 지워짐) · 우리 사이트 추천 키와 갈린다', () => {
    expect(publicMatchKeys.post(7)).toEqual([...memberKeys.all, 'public-matches', 7])
    expect(publicMatchKeys.post(7)).not.toContain('matches')
  })
})

describe('이름표 — 어디에 맡겨졌나', () => {
  it('경찰서 · 기관, 모르는 출처는 기관', () => {
    expect(publicSourceLabel('POLICE')).toBe('경찰서 보관')
    expect(publicSourceLabel('PORTAL')).toBe('기관 보관')
    expect(publicSourceLabel('SOMETHING_NEW')).toBe('기관 보관')
  })
})

describe('맞은 이유 — 말로, 체크는 같을 때만', () => {
  it('같은 날 주운 물건', () => {
    expect(publicMatchReasons(base)).toEqual([
      { key: 'category', text: '같은 종류', same: true },
      { key: 'date', text: '같은 날 주움', same: true },
    ])
  })

  it('날짜가 다르면 체크 없이 며칠 뒤', () => {
    expect(publicMatchReasons({ ...base, daysApart: 3 })[1]).toEqual({ key: 'date', text: '3일 뒤 주움', same: false })
    expect(publicMatchReasons({ ...base, daysApart: 14 })[1]?.text).toBe('14일 뒤 주움')
  })

  it('이름은 비슷할 때만 넣는다 — 장소 이유는 없다(보관 장소는 주운 곳이 아니다)', () => {
    expect(publicMatchReasons({ ...base, similarName: true }).map((r) => r.text)).toEqual(['같은 종류', '같은 날 주움', '이름 비슷'])
    expect(publicMatchReasons({ ...base, similarName: true, daysApart: 2 }).map((r) => r.key)).toEqual(['category', 'date', 'name'])
  })

  it('화면 문장에 % · 점수가 없다', () => {
    const texts = [
      ...Object.values(PUBLIC_MATCHES_COPY),
      ...Object.values(PUBLIC_DISMISS),
      ...publicMatchReasons({ ...base, similarName: true, daysApart: 5 }).map((r) => r.text),
    ]
    for (const text of texts) expect(text).not.toMatch(/%|점수|일치율/)
  })

  it('다음 행동 — 보관 장소에 직접, 우리 사이트의 `내 물건이에요`로는 이어지지 않는다', () => {
    expect(PUBLIC_MATCHES_COPY.lead).toContain('보관 장소')
    expect(PUBLIC_MATCHES_COPY.lead).toContain('내 물건이에요')
    expect(PUBLIC_MATCHES_COPY.credit).toBe('출처: 경찰청')
  })
})

describe('제목 아래 작은 글자 — 색상 · 원문 분류명', () => {
  it('있는 것만 잇는다', () => {
    expect(publicItemDetail(base)).toBe('검정 · 지갑 > 남성용 지갑')
    expect(publicItemDetail({ colorName: null, categoryName: '지갑' })).toBe('지갑')
    expect(publicItemDetail({ colorName: '  ', categoryName: null })).toBeNull()
  })
})

describe('사진 — 경찰민원24 출처만, 자리표시 · 없음은 포스터', () => {
  const real = 'https://minwon24.police.go.kr/lost112/find/getOpenapiAttachFileImage/V0007722L10290002/1/C2026102910002186/1.do'

  it('경찰민원24 사진 주소는 그대로 그린다', () => {
    expect(publicItemPhoto({ imageUrl: real })).toBe(real)
  })

  it('사진 없는 습득물의 "이미지 없음" 그림(no_img)은 사진 없음', () => {
    expect(publicItemPhoto({ imageUrl: 'https://minwon24.police.go.kr/images/sub/img02_no_img.gif' })).toBeNull()
  })

  it('다른 출처 · http · 비슷한 이름의 도메인 · 위험한 주소 · 상대 주소 · 없음은 그리지 않는다', () => {
    for (const imageUrl of [
      'https://www.lost112.go.kr/lostnfs/images/uploadImg/a.jpg',
      'http://minwon24.police.go.kr/x.jpg',
      'https://minwon24.police.go.kr.evil.example/x.jpg',
      'https://evil.example/https://minwon24.police.go.kr/x.jpg',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      '/images/a.jpg',
      '',
      null,
    ]) {
      expect(publicItemPhoto({ imageUrl }), String(imageUrl)).toBeNull()
    }
  })

  it('그리는 출처 = CSP img-src 의 공공 사진 출처(build/csp.ts) — 한쪽만 바꾸면 사진이 깨지거나 막힌다', () => {
    expect([PUBLIC_PHOTO_ORIGIN]).toEqual([...PUBLIC_DATA_IMAGE_ORIGINS])
    expect(PUBLIC_PORTAL.href).toBe(PUBLIC_PHOTO_ORIGIN)
  })
})

describe('숨긴 뒤', () => {
  const list = [{ itemId: 1 }, { itemId: 2 }, { itemId: 3 }]

  it('포커스는 다음 카드, 마지막이면 앞 카드, 하나뿐이면 없음', () => {
    expect(nextFocusPublicItem(list, 1)).toBe(2)
    expect(nextFocusPublicItem(list, 3)).toBe(2)
    expect(nextFocusPublicItem([{ itemId: 9 }], 9)).toBeNull()
    expect(nextFocusPublicItem(list, 42)).toBeNull()
  })

  it('받은 목록에서 그 후보만 뺀다', () => {
    const items = [base, { ...base, itemId: 2 }]
    expect(withoutPublicItem(items, 1)?.map((m) => m.itemId)).toEqual([2])
    expect(withoutPublicItem(undefined, 1)).toBeUndefined()
  })

  it('확인 창 본문은 물품명 뒤에 받침과 무관한 말로 잇는다', () => {
    expect(PUBLIC_DISMISS.body.startsWith('물건을')).toBe(true)
    expect(PUBLIC_DISMISS.label).toBe('내 물건 아니에요')
  })
})
