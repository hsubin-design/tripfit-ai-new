export type PlanItem = {
  time: string | null;
  place: string | null;
  activity: string | null;
  stated_cost: string | null;
  // 메뉴/운영시간/분위기/특징 등 장소·활동에 딸린 보조 설명. 원문에
  // 실제로 있는 텍스트만 담는다. 대시(-) 형식은 "시간 장소 - 보조 설명
  // - 비용"처럼 마지막 chunk가 비용일 때 그 사이 chunk를 그대로
  // 옮긴다. 서술형(문장) 형식은 아직 이 값을 추출하지 않아 항상
  // null이다 — 문장에서 어디까지가 "설명"인지 델리미터 없이 구분하는
  // 것은 오추출 위험이 있어 보수적으로 남겨둔 것. UI는 값이 있을
  // 때만 렌더링한다.
  description: string | null;
};

export type PlanDay = {
  day: number;
  items: PlanItem[];
  // 원문에 날짜 표현("8월 26일"/"8/26"/"2026.08.26"/"2026-08-26")이
  // 실제로 있을 때만, 입력된 형태 그대로 채운다 — "M월 D일"로 강제
  // 변환하지 않고, 연도가 있으면 지우지 않으며, 요일을 계산해서
  // 붙이지 않는다. 이 값은 순수 표시용 label일 뿐이고, day 간 비교는
  // 이 값이 아니라 등장 순서(day: number)로만 이뤄진다. "N일차"
  // 마커만 있고 날짜가 없으면 null.
  date: string | null;
};

export type PlanStructure = {
  duration_days: number | null;
  days: PlanDay[];
};

export type MissingInfoCount = {
  time: number;
  place: number;
  cost: number;
};

// TripFit v0.7 고정 비교 기준 — 반드시 이 4개만 유지한다. "명시 비용"은
// 별도의 5번째 기준이 아니라 정보 완성도(비용 명시/누락 수)와 상세
// 화면의 원문 값 표시 규칙에 포함된다. "도움이 된 기준" 선택 칩(이유
// 화면)도 이 목록 하나를 그대로 재사용하므로, 여기서 빼면 화면에서도
// 자동으로 5번째 칩이 사라진다.
export const COMPARISON_CRITERIA = [
  { id: "schedule_scale", label: "일정 규모" },
  { id: "place_composition", label: "장소 구성" },
  { id: "daily_structure", label: "날짜별 구성" },
  { id: "information_completeness", label: "정보 완성도" },
] as const;

export type ComparisonCriterionId = (typeof COMPARISON_CRITERIA)[number]["id"];

// 핵심 차이 요약 문장 하나하나가 위 4개 고정 기준 중 어디서 나온
// 사실인지 표시하기 위한 태그.
export type KeyDifferenceCriterion = ComparisonCriterionId;

export type KeyDifference = {
  criterion: KeyDifferenceCriterion | null;
  text: string;
};

// "장소가 등장하는지"(전체)와 "그 장소가 같은 날짜에 있는지"(일차별)는
// 서로 다른 질문이다. daily_item_counts(개수)만으로는 두 일차의 실제
// 구성이 같은지 알 수 없으므로, 일차별 장소/활동 라벨(place가 없으면
// activity)을 직접 비교한 결과를 별도로 둔다.
export type DailyPlaceComparison = {
  day: number;
  common: string[];
  unique_to_a: string[];
  unique_to_b: string[];
};

export type ComparisonResult = {
  plans: {
    a: PlanStructure;
    b: PlanStructure;
  };
  comparison: {
    common_places: string[];
    unique_to_a: string[];
    unique_to_b: string[];
    daily_item_counts: { a: number[]; b: number[] };
    daily_place_comparison: DailyPlaceComparison[];
    missing_information: { a: MissingInfoCount; b: MissingInfoCount };
    key_differences: KeyDifference[];
  };
};

export type InputMode = "sample" | "own_plan";

export type Decision = "plan_a" | "plan_b" | "undecided";
