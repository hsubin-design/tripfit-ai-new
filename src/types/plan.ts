export type PlanItem = {
  time: string | null;
  place: string | null;
  activity: string | null;
  stated_cost: string | null;
};

export type PlanDay = {
  day: number;
  items: PlanItem[];
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
    missing_information: { a: MissingInfoCount; b: MissingInfoCount };
    key_differences: string[];
  };
};

export type InputMode = "sample" | "own_plan";

export type Decision = "plan_a" | "plan_b" | "undecided";

export const COMPARISON_CRITERIA = [
  { id: "schedule_scale", label: "일정 규모" },
  { id: "place_composition", label: "장소 구성" },
  { id: "daily_structure", label: "날짜별 구성" },
  { id: "information_completeness", label: "정보 완성도" },
  { id: "stated_cost", label: "명시 비용" },
] as const;

export type ComparisonCriterionId = (typeof COMPARISON_CRITERIA)[number]["id"];
