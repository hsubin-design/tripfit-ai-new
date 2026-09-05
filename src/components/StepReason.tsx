"use client";

import AppHeader from "@/components/AppHeader";
import { COMPARISON_CRITERIA, DECISION_REASON_OPTIONS, type Decision, type SelectedReasonId } from "@/types/plan";

type Props = {
  decision: Decision;
  selectedCriteria: SelectedReasonId[];
  reasonText: string;
  onChangeCriteria: (criteria: SelectedReasonId[]) => void;
  onChangeReasonText: (text: string) => void;
  onBack: () => void;
  onNext: () => void;
  // 라운드(2026-09-04) — "다음"이 이제 Supabase 제출(insertUtResponse)을
  // 직접 트리거한다(완료 화면 개편: helpfulness를 별도 화면으로 미루지
  // 않고, decision/reason이 저장된 뒤 바로 완료 화면에 도착해야 하므로).
  // 기존 StepRating의 isSubmitting/submitError와 동일한 패턴이다.
  isSubmitting?: boolean;
  submitError?: string | null;
};

export default function StepReason({
  decision,
  selectedCriteria,
  reasonText,
  onChangeCriteria,
  onChangeReasonText,
  onBack,
  onNext,
  isSubmitting = false,
  submitError = null,
}: Props) {
  const isUndecided = decision === "undecided";
  const title = isUndecided ? "결정하기 어려운 이유를 알려주세요." : "왜 이 플랜을 선택하셨나요?";
  const criteriaHeading = isUndecided ? "비교에 도움이 된 기준 (선택)" : "선택에 도움이 된 점을 모두 골라주세요.";
  const criteriaHelper = isUndecided ? null : "여러 개 선택할 수 있어요.";
  // 라운드(2026-09-04) — 두 플로우 모두 같은 label("다른 이유가 있다면
  // 알려주세요.")을 쓰도록 통일했다(요청). placeholder만 플로우별
  // 문맥에 맞게 다르게 둔다.
  const reasonLabel = "다른 이유가 있다면 알려주세요.";
  const placeholder = isUndecided
    ? "결정하기 어려운 이유를 자유롭게 적어주세요."
    : "이 플랜을 선택한 이유를 자유롭게 적어주세요.";
  // v1.0 — "결정함" 플로우는 새 DECISION_REASON_OPTIONS(선택 이유
  // 체크리스트)를, "결정 어려움" 플로우는 기존 COMPARISON_CRITERIA(AI
  // 비교 축)를 그대로 쓴다 — 두 목록은 별개이며 이 화면 안에서만
  // 하나의 SelectedReasonId 유니온으로 함께 다룬다.
  const options: readonly { id: SelectedReasonId; label: string }[] = isUndecided
    ? COMPARISON_CRITERIA
    : DECISION_REASON_OPTIONS;

  // 라운드(2026-09-04) — 자유 서술 textarea는 이제 항상 보이지 않고,
  // 각 목록의 마지막 항목("기타 이유가 있어요"/"다른 이유가 있어요")을
  // 선택했을 때만 나타난다. 두 목록 모두 이 특수 항목을 마지막에 두는
  // 규칙(types/plan.ts 주석)을 그대로 이용해, 문자열을 하드코딩하지
  // 않고 "지금 활성 목록의 마지막 id"로 판별한다 — 목록이 어느 쪽이든
  // 같은 로직 하나로 동작한다.
  const otherOptionId = options[options.length - 1].id;
  const showFreeText = selectedCriteria.includes(otherOptionId);

  function toggleCriterion(id: SelectedReasonId) {
    onChangeCriteria(
      selectedCriteria.includes(id)
        ? selectedCriteria.filter((c) => c !== id)
        : [...selectedCriteria, id]
    );
  }

  // "다른 이유"를 선택했을 때만 자유 서술이 필수다 — 선택하지 않았으면
  // textarea 자체가 안 보이므로 그 값으로 다음 단계를 막지 않는다(안
  // 보이는 필드가 CTA를 막으면 전혀 진행할 수 없게 된다). 기존처럼
  // "다른 이유"를 선택한 채로는 내용을 적어야 다음으로 넘어간다.
  const isValid = !showFreeText || reasonText.trim().length > 0;

  return (
    <div className="w-full">
      <AppHeader variant="back" onBack={onBack} />
      <div className="flex w-full flex-col px-5 pb-28 pt-20">
        <h1 className="heading-page">{title}</h1>

        <div className="mt-7">
          <h2 className="heading-card">{criteriaHeading}</h2>
          {criteriaHelper !== null && <p className="text-caption mt-1">{criteriaHelper}</p>}
          <div className="mt-3 flex flex-col gap-2.5">
            {options.map((option) => {
              const isSelected = selectedCriteria.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleCriterion(option.id)}
                  data-selected={isSelected}
                  className="reason-select-card focus-ring"
                >
                  <span className="reason-select-card-indicator" aria-hidden="true">
                    {isSelected && <ReasonCheckIcon />}
                  </span>
                  <span className="reason-select-card-label">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 라운드(2026-09-04) — "다른 이유"를 선택했을 때만 노출한다.
            선택 해제해도 onChangeReasonText는 부르지 않는다 — 입력값
            자체는 부모(page.tsx) state에 그대로 남아있고, 다시 선택하면
            지웠던 값이 그대로 돌아온다(요청: "선택 해제 시... 기존
            입력값 처리 로직은 유지"). */}
        {showFreeText && (
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
        )}
      </div>

      {/* Fixed strip spans the viewport; the inner div clamps back to the app
          shell's max width so the CTA never grows wider than the app itself. */}
      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
          {submitError !== null && (
            <p className="text-error mb-2 text-[13px] leading-[1.4]">{submitError}</p>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={!isValid || isSubmitting}
            className="btn-primary focus-ring w-full"
          >
            {isSubmitting ? "제출 중..." : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** v1.0 — 선택 카드 오른쪽 원형 indicator 안의 체크 표시. indicator
 *  배경이 선택 시 primary purple로 채워지므로 흰색 stroke만 있으면
 *  된다. */
function ReasonCheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.3 4.3L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
