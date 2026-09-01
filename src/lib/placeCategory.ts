// v1.0 장소 category badge — 여행 사실을 새로 만드는 것이 아니라, 이미
// 입력된 장소명 문자열에서 화면 탐색을 돕는 UI 메타데이터만 뽑아내는
// 보조 분류다. 원칙: 키워드로 "명확하게 판단 가능한 경우"만 분류하고,
// 애매하면 배지를 아예 보여주지 않는다(추측성 "기타"도 만들지 않음).
// 향후 장소 API에서 신뢰 가능한 category를 받으면 이 함수 대신 그 값을
// 우선 쓰도록 교체할 수 있게, 반환 타입과 함수 하나로 분리해뒀다.
export type PlaceCategory = "교통" | "관광지" | "식당" | "숙소" | "액티비티";

const CATEGORY_KEYWORDS: { category: PlaceCategory; keywords: string[] }[] = [
  { category: "교통", keywords: ["역", "공항", "터미널", "정류장", "항구", "여객터미널"] },
  {
    category: "숙소",
    keywords: ["호텔", "펜션", "게스트하우스", "모텔", "리조트", "숙소", "한옥스테이", "민박"],
  },
  {
    category: "식당",
    keywords: ["식당", "맛집", "국밥", "횟집", "고깃집", "분식", "레스토랑", "맛집거리", "포장마차"],
  },
  {
    category: "액티비티",
    keywords: ["체험", "액티비티", "서핑", "다이빙", "클래스", "강습", "테마파크", "워터파크", "짚라인"],
  },
  {
    category: "관광지",
    keywords: [
      "해수욕장",
      "해변",
      "공원",
      "시장",
      "전망대",
      "문화마을",
      "타워",
      "사찰",
      "궁",
      "폭포",
      "박물관",
      "미술관",
      "동물원",
      "수목원",
      "섬",
    ],
  },
];

/** place 문자열이 위 키워드 중 하나를 명확히 포함할 때만 분류한다.
 *  둘 이상의 카테고리 키워드가 동시에 걸리면(예: "공항 리무진 정류장"처럼
 *  드물게 중복 매칭되는 경우) 어느 쪽도 확신할 수 없다고 보고 배지를
 *  만들지 않는다 — 확신 없는 분류보다 미표시가 안전하다. */
export function classifyPlaceCategory(place: string | null): PlaceCategory | null {
  if (!place) return null;
  const matches = CATEGORY_KEYWORDS.filter(({ keywords }) => keywords.some((kw) => place.includes(kw)));
  if (matches.length !== 1) return null;
  return matches[0].category;
}
