"use client";

import { COMPARISON_CRITERIA, type ComparisonCriterionId, type Decision } from "@/types/plan";

type Props = {
  decision: Decision;
  selectedCriteria: ComparisonCriterionId[];
  reasonText: string;
  onChangeCriteria: (criteria: ComparisonCriterionId[]) => void;
  onChangeReasonText: (text: string) => void;
  onBack: () => void;
  onNext: () => void;
};

export default function StepReason({
  decision,
  selectedCriteria,
  reasonText,
  onChangeCriteria,
  onChangeReasonText,
  onBack,
  onNext,
}: Props) {
  const isUndecided = decision === "undecided";
  const title = isUndecided ? "결정하기 어려운 이유를 알려주세요" : "선택한 이유를 알려주세요";
  const placeholder = isUndecided
    ? "지금 정보로 결정하기 어려운 이유를 자유롭게 적어주세요."
    : "이 플랜을 선택한 이유를 자유롭게 적어주세요.";

  function toggleCriterion(id: ComparisonCriterionId) {
    onChangeCriteria(
      selectedCriteria.includes(id)
        ? selectedCriteria.filter((c) => c !== id)
        : [...selectedCriteria, id]
    );
  }

  const isValid = reasonText.trim().length > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>

      <div>
        <h2 className="text-sm font-semibold text-slate-800">도움이 된 기준 (선택)</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {COMPARISON_CRITERIA.map((criterion) => {
            const isSelected = selectedCriteria.includes(criterion.id);
            return (
              <button
                key={criterion.id}
                type="button"
                onClick={() => toggleCriterion(criterion.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-600 hover:border-slate-500"
                }`}
              >
                {criterion.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-800">
          {isUndecided ? "유보 이유" : "선택 이유"}
        </h2>
        <textarea
          value={reasonText}
          onChange={(e) => onChangeReasonText(e.target.value)}
          rows={5}
          placeholder={placeholder}
          className="mt-2 w-full resize-none rounded-lg border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
        />
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:border-slate-500"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!isValid}
          className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          다음
        </button>
      </div>
    </div>
  );
}
