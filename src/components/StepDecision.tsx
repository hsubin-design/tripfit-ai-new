"use client";

import AppHeader from "@/components/AppHeader";
import type { Decision } from "@/types/plan";

type Props = {
  onSelect: (decision: Decision) => void;
  onBack: () => void;
};

export default function StepDecision({ onSelect, onBack }: Props) {
  return (
    <div className="w-full">
      <AppHeader variant="back" onBack={onBack} />
      <div className="flex w-full flex-col px-5 pb-6 pt-20">
        <div className="w-full text-left">
          <h1 className="heading-page">원하시는 일정을 선택하세요.</h1>
          <p className="text-body-secondary mt-2">
            비교 결과를 참고해 A, B 중 하나를 고르거나 &quot;아직 결정하기 어려움&quot;을 선택할
            수 있습니다.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button type="button" onClick={() => onSelect("plan_a")} className="btn-secondary focus-ring">
            플랜 A
          </button>
          <button type="button" onClick={() => onSelect("plan_b")} className="btn-secondary focus-ring">
            플랜 B
          </button>
          <button type="button" onClick={() => onSelect("undecided")} className="btn-secondary focus-ring">
            아직 결정하기 어려움
          </button>
        </div>
      </div>
    </div>
  );
}
