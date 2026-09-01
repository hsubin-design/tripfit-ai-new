import type { PlanDay, PlanItem, PlanStructure } from "@/types/plan";

// v1.0 "합산 가능한 입력 비용". PRD/CLAUDE.md의 "비용은 원문 문자열을 그대로
// 유지하고, 임의로 환산하거나 합산하지 않는다" 가드레일을 지키기 위해,
// 합산 대상은 의미가 완전히 명확한 두 형태만 인정한다:
//   1) 순수 숫자 + "원" (쉼표 허용) — 예: "20,000원", "15000원"
//   2) "무료" 또는 "0원" — 0원으로 취급
// "약 15,000원"/"4만~7만원"/"90,000원 정도"/"1인 20,000원"/"1박 90,000원"처럼
// 수식어·범위·단위·조건이 붙은 값, 그리고 "만원" 단위 표기(숫자 변환이
// 필요함)는 의도적으로 합산에서 제외한다 — 서비스가 대신 계산/환산한
// 것으로 보이면 안 되기 때문이다. 제외된 값은 화면에서 원문 그대로
// 계속 보여주되(Cost Chip), 합계에는 포함하지 않는다.
const PURE_WON_PATTERN = /^\d[\d,]*원$/;
const FREE_PATTERN = /^(무료|0원)$/;

/** 이 stated_cost 문자열이 "합산 가능한 값"이면 숫자(원)를, 아니면
 *  null을 반환한다. null은 "이 항목은 합계에서 제외"를 뜻할 뿐, 원문
 *  표시(Cost Chip)에는 아무 영향이 없다. */
export function summableCostValue(statedCost: string | null): number | null {
  if (statedCost === null) return null;
  const trimmed = statedCost.trim();
  if (FREE_PATTERN.test(trimmed)) return 0;
  if (PURE_WON_PATTERN.test(trimmed)) {
    const digits = trimmed.replace(/[^\d]/g, "");
    return digits ? Number(digits) : null;
  }
  return null;
}

export type CostSum = {
  /** 합산 가능한 값만 더한 총액(원). 합산 가능한 항목이 하나도 없으면 null. */
  total: number | null;
  /** stated_cost가 있었지만(=null이 아니었지만) 합산 규칙을 만족하지 못해 제외된 항목 수. */
  excludedCount: number;
};

function sumItems(items: PlanItem[]): CostSum {
  let total: number | null = null;
  let excludedCount = 0;
  for (const item of items) {
    if (item.stated_cost === null) continue;
    const value = summableCostValue(item.stated_cost);
    if (value === null) {
      excludedCount += 1;
      continue;
    }
    total = (total ?? 0) + value;
  }
  return { total, excludedCount };
}

export function sumPlanCost(plan: PlanStructure): CostSum {
  return sumItems(plan.days.flatMap((d) => d.items));
}

export function sumDayCost(day: PlanDay): CostSum {
  return sumItems(day.items);
}
