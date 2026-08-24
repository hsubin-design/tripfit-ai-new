"use client";

import AppHeader from "@/components/AppHeader";

type Props = {
  score: number | null;
  onChangeScore: (score: number) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
};

export default function StepRating({
  score,
  onChangeScore,
  onBack,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}: Props) {
  return (
    <div className="w-full">
      <AppHeader variant="back" onBack={onBack} />
      <div className="flex w-full flex-col px-5 pb-28 pt-20">
        <h1 className="heading-page">두 일정의 차이를 파악하는 데 얼마나 도움이 되었나요?</h1>

        <div className="mt-6 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChangeScore(n)}
              data-selected={score === n}
              className="rating-button focus-ring"
            >
              {n}
            </button>
          ))}
        </div>
        <div className="text-caption mt-3 flex justify-between">
          <span>전혀 도움 안 됨</span>
          <span>매우 도움 됨</span>
        </div>
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
            onClick={onSubmit}
            disabled={score === null || isSubmitting}
            className="btn-primary focus-ring w-full"
          >
            {isSubmitting ? "제출 중..." : "제출하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
