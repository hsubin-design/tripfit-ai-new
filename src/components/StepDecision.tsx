"use client";

import type { Decision } from "@/types/plan";

type Props = {
  onSelect: (decision: Decision) => void;
  onBack: () => void;
};

export default function StepDecision({ onSelect, onBack }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">어떤 일정을 선택하시겠어요?</h1>
        <p className="mt-2 text-sm text-slate-500">
          비교 결과를 참고해 A, B 중 하나를 고르거나 &quot;아직 결정하기 어려움&quot;을 선택할
          수 있습니다.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onSelect("plan_a")}
          className="rounded-lg border border-slate-300 px-6 py-4 text-base font-semibold text-slate-900 hover:border-slate-900"
        >
          플랜 A
        </button>
        <button
          type="button"
          onClick={() => onSelect("plan_b")}
          className="rounded-lg border border-slate-300 px-6 py-4 text-base font-semibold text-slate-900 hover:border-slate-900"
        >
          플랜 B
        </button>
        <button
          type="button"
          onClick={() => onSelect("undecided")}
          className="rounded-lg border border-dashed border-slate-300 px-6 py-4 text-base font-medium text-slate-600 hover:border-slate-500"
        >
          아직 결정하기 어려움
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="self-start rounded-lg border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:border-slate-500"
      >
        이전
      </button>
    </div>
  );
}
