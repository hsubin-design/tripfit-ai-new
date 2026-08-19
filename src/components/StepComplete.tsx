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
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">제출이 완료되었습니다</h1>
      <p className="text-sm text-slate-500">비교와 응답을 보내주셔서 감사합니다.</p>

      <dl className="mt-4 w-full rounded-lg border border-slate-200 p-4 text-left text-sm text-slate-600">
        <SummaryRow label="입력 방식" value={inputMode ? INPUT_MODE_LABEL[inputMode] : "정보 없음"} />
        <SummaryRow label="결정" value={decision ? DECISION_LABEL[decision] : "정보 없음"} />
        <SummaryRow label="도움이 된 기준" value={criteriaLabels.length > 0 ? criteriaLabels.join(", ") : "선택 없음"} />
        <SummaryRow label="이유" value={reasonText || "정보 없음"} />
        <SummaryRow label="도움 정도" value={helpfulness ? `${helpfulness} / 5` : "정보 없음"} />
      </dl>

      <button
        type="button"
        onClick={onRestart}
        className="mt-4 rounded-lg border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:border-slate-500"
      >
        새로 비교하기
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}
