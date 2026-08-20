"use client";

import AppHeader from "@/components/AppHeader";
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
  const title = isUndecided ? "결정하기 어려운 이유를 알려주세요." : "선택한 이유를 알려주세요.";
  const criteriaHeading = isUndecided ? "비교에 도움이 된 기준 (선택)" : "선택에 도움이 된 기준 (선택)";
  const reasonLabel = isUndecided ? "결정하기 어려운 이유" : "선택 이유";
  const placeholder = isUndecided
    ? "어떤 정보가 더 있으면 결정할 수 있을지 알려주세요."
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
    <div className="w-full">
      <AppHeader variant="back" onBack={onBack} />
      <div className="flex w-full flex-col px-5 pb-28 pt-20">
        <h1 className="heading-page">{title}</h1>

        <div className="mt-7">
          <h2 className="heading-card">{criteriaHeading}</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {COMPARISON_CRITERIA.map((criterion) => {
              const isSelected = selectedCriteria.includes(criterion.id);
              return (
                <button
                  key={criterion.id}
                  type="button"
                  onClick={() => toggleCriterion(criterion.id)}
                  data-selected={isSelected}
                  className="chip focus-ring px-4 py-1.5"
                >
                  {criterion.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-7">
          <h2 className="heading-card">{reasonLabel}</h2>
          <textarea
            value={reasonText}
            onChange={(e) => onChangeReasonText(e.target.value)}
            rows={5}
            placeholder={placeholder}
            className="field text-body mt-3 resize-none p-3"
          />
        </div>
      </div>

      {/* Fixed strip spans the viewport; the inner div clamps back to the app
          shell's max width so the CTA never grows wider than the app itself. */}
      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
          <button
            type="button"
            onClick={onNext}
            disabled={!isValid}
            className="btn-primary focus-ring w-full"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
