import type { PlaceCategory } from "@/lib/placeCategory";

export type PlanItem = {
  time: string | null;
  place: string | null;
  // 버그 수정(2026-09-05) — 이전엔 category가 아예 없어 UI가 place
  // 문자열을 키워드로 다시 추측했는데("역"/"시장"/"해수욕장" 등),
  // 키워드가 없는 실제 장소(예: "광안리", "청사포", "블루라인파크")는
  // 전부 배지가 안 뜨는 문제가 있었다. 이제 structure-plan API가
  // place의 실제 종류를 판단해 이 5개 값 중 하나로 채우거나(확신
  // 없으면 null), place가 없으면(활동만 있는 item) 항상 null이다 —
  // UI는 더 이상 문자열을 다시 추측하지 않고 이 값을 그대로 쓴다.
  category: PlaceCategory | null;
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

// TripFit v0.7 고정 비교 기준(4개, id는 절대 바꾸지 않는다 — 아래
// dummyComparison.ts key_differences criterion 태깅이 이 id 문자열을
// 그대로 쓴다). "명시 비용"은 별도의 5번째 기준이 아니라 정보
// 완성도(비용 명시/누락 수)와 상세 화면의 원문 값 표시 규칙에
// 포함된다. "결정하기 어려움"(undecided) 플로우의 "비교에 도움이 된
// 기준" 선택 카드가 이 목록을 그대로 재사용한다("선택함" 플로우는
// 별도의 DECISION_REASON_OPTIONS를 쓴다 — 아래 참고).
//
// 라운드(2026-09-04) — 라벨을 추상적 명사형("일정 규모" 등)에서
// "왜 이 플랜을 선택하셨나요?" 화면(DECISION_REASON_OPTIONS)과 대응되는
// 쉬운 대화체로 바꿨다(요청). id 자체는 그대로라 기존 Mixpanel/Supabase에
// 쌓인 값과의 연속성에는 영향 없다. 마지막 "이동 편의 차이를
// 모르겠어요"(movement_convenience)는 이 4개 고정 기준에는 없던
// 새 항목이다 — DECISION_REASON_OPTIONS의 "이동이 더 편해 보여요"와
// 짝을 맞추기 위한 사용자 자기보고용 선택지일 뿐, 실제 AI
// key_differences는 이동 데이터가 없어(PlanItem에 거리/시간 필드
// 자체가 없고 dev mock route는 근거로 쓰지 않음) 이 criterion을 절대
// 태깅하지 않는다 — schedule_scale/daily_structure와 마찬가지로
// "선택 가능하지만 AI가 실제로 채우지는 않는" 자기보고 전용 항목이다.
export const COMPARISON_CRITERIA = [
  { id: "schedule_scale", label: "일정 수 차이가 잘 안 느껴져요" },
  { id: "place_composition", label: "가고 싶은 장소가 비슷해요" },
  { id: "daily_structure", label: "하루 일정 차이가 잘 안 보여요" },
  { id: "information_completeness", label: "정보가 부족해서 고르기 어려워요" },
  { id: "movement_convenience", label: "이동 편의 차이를 모르겠어요" },
  // "다른 이유가 있어요" — 선택 시에만 자유 서술 textarea를 노출하는
  // 특수 항목(StepReason.tsx). 항상 이 목록의 마지막 항목이어야 한다 —
  // StepReason이 "마지막 옵션 = 자유입력 트리거"로 판단한다.
  { id: "other_undecided_reason", label: "다른 이유가 있어요" },
] as const;

export type ComparisonCriterionId = (typeof COMPARISON_CRITERIA)[number]["id"];

// 핵심 차이 요약 문장 하나하나가 위 4개 고정 기준 중 어디서 나온
// 사실인지 표시하기 위한 태그.
export type KeyDifferenceCriterion = ComparisonCriterionId;

// v1.0 — "왜 이 플랜을 선택하셨나요?"(StepReason, 결정함 플로우) 화면
// 전용 선택지. 위 COMPARISON_CRITERIA(AI가 실제로 비교에 쓰는 v0.7
// 고정 축, key_differences 태깅용)와는 목적이 다르다 — 이건 사용자가
// "이 플랜을 왜 골랐는지" 스스로 고르는 체크리스트라 AI의 비교 축과
// 항상 같을 필요가 없다. 이름이 비슷해 보여도 서로 독립적인 목록이라
// 한쪽을 바꿔도 다른 쪽에는 영향이 없다.
export const DECISION_REASON_OPTIONS = [
  { id: "schedule_amount_fits", label: "일정 수가 적당해요" },
  { id: "more_places_wanted", label: "가고 싶은 장소가 더 많아요" },
  { id: "daily_flow_natural", label: "하루 일정이 더 자연스러워요" },
  { id: "info_more_detailed", label: "정보가 더 자세해요" },
  { id: "movement_more_convenient", label: "이동이 더 편해 보여요" },
  // "기타 이유가 있어요" — 선택 시에만 자유 서술 textarea를 노출하는
  // 특수 항목(StepReason.tsx). 항상 이 목록의 마지막 항목이어야 한다 —
  // StepReason이 "마지막 옵션 = 자유입력 트리거"로 판단한다.
  { id: "other_reason", label: "기타 이유가 있어요" },
] as const;

export type DecisionReasonOptionId = (typeof DECISION_REASON_OPTIONS)[number]["id"];

// StepReason의 selectedCriteria state는 어느 플로우냐에 따라 위 두
// 목록 중 하나의 id를 담는다 — Supabase selected_criteria 컬럼과
// Mixpanel decision_criterion_selected 이벤트는 그대로 두고(구조/
// 이벤트명 변경 없음), 담기는 값의 타입만 이 유니온으로 넓힌다.
export type SelectedReasonId = ComparisonCriterionId | DecisionReasonOptionId;

export type KeyDifference = {
  criterion: KeyDifferenceCriterion | null;
  text: string;
  /** v1.0 — "짧은 제목 + 보조 설명" 카드 레이아웃 전용. text를 만들 때
   *  쓴 것과 완전히 같은 계산값(같은 변수)만으로 만든, text의 대체
   *  표현일 뿐이다 — 새로운 사실이나 숫자를 추가로 계산하지 않는다.
   *  없으면(예: "정보 부족" fallback 문구) title/detail 없이 text를
   *  그대로 한 줄로 보여준다. */
  title?: string;
  detail?: string;
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
