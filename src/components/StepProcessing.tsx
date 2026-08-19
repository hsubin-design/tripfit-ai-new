"use client";

import { useEffect, useState } from "react";

const PHASES = ["일정 확인", "구조화", "차이 비교"];
const PHASE_DURATION_MS = 550;

type Props = {
  onComplete: () => void;
};

export default function StepProcessing({ onComplete }: Props) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (phaseIndex >= PHASES.length - 1) {
      const timer = setTimeout(onComplete, PHASE_DURATION_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setPhaseIndex((i) => i + 1), PHASE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [phaseIndex, onComplete]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-4 py-24 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
        {PHASES.map((phase, i) => (
          <span key={phase} className="flex items-center gap-2">
            <span className={i <= phaseIndex ? "text-slate-900" : "text-slate-300"}>{phase}</span>
            {i < PHASES.length - 1 && <span className="text-slate-300">→</span>}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-400">입력한 내용은 그대로 유지됩니다.</p>
    </div>
  );
}
