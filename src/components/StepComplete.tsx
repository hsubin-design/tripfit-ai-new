"use client";

import { COMPARISON_CRITERIA, type ComparisonCriterionId, type Decision, type InputMode } from "@/types/plan";

const DECISION_LABEL: Record<Decision, string> = {
  plan_a: "플랜 A",
  plan_b: "플랜 B",
  undecided: "아직 결정하기 어려움",
};

const INPUT_MODE_LABEL: Record<InputMode, string> = {
  sample: "예시 일정 불러오기",
  own_plan: "직접 입력",
};

type Props = {
  inputMode: InputMode | null;
  decision: Decision | null;
  selectedCriteria: ComparisonCriterionId[];
  reasonText: string;
  helpfulness: number | null;
  onRestart: () => void;
};

export default function StepComplete({
  inputMode,
  decision,
  selectedCriteria,
  reasonText,
  helpfulness,
  onRestart,
}: Props) {
  const criteriaLabels = COMPARISON_CRITERIA.filter((c) => selectedCriteria.includes(c.id)).map(
    (c) => c.label
  );

  return (
    <div className="w-full">
      <div className="flex w-full flex-col px-5 pb-28 pt-20 text-left">
        <h1 className="heading-page">제출이 완료되었습니다.</h1>
        <p className="text-body-secondary mt-2">비교와 응답을 보내주셔서 감사합니다.</p>

        <dl className="card mt-7 flex w-full flex-col gap-6 bg-subtle-surface px-4 py-7 text-left">
          <SummaryRow label="입력 방식" value={inputMode ? INPUT_MODE_LABEL[inputMode] : "정보 없음"} />
          <SummaryRow label="결정" value={decision ? DECISION_LABEL[decision] : "정보 없음"} />
          <SummaryRow
            label="선택에 도움이 된 기준"
            value={criteriaLabels.length > 0 ? criteriaLabels.join(", ") : "선택 없음"}
          />
          <SummaryRow label="선택한 이유" value={reasonText || "정보 없음"} />
          <SummaryRow label="비교 도움 정도" value={helpfulness ? `${helpfulness} / 5` : "정보 없음"} />
        </dl>
      </div>

      {/* Fixed strip spans the viewport; the inner div clamps back to the app
          shell's max width so the CTA never grows wider than the app itself. */}
      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
          <button type="button" onClick={onRestart} className="btn-primary focus-ring w-full">
            새로 비교하기
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption font-semibold text-text-secondary">{label}</dt>
      <dd className="text-sm text-text-primary">{value}</dd>
    </div>
  );
}
