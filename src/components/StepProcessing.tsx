"use client";

import { useEffect } from "react";

// 더미 처리 단계를 흉내 내는 고정 지연 — 실제 진행률이 없으므로 단계
// 텍스트나 % 숫자로 가짜 진행 상황을 만들지 않는다(PRD "가짜 % 진행률
// 금지"). 화면에는 처리 중이라는 사실과 입력값이 보존된다는 안내만
// 보여준다.
const PROCESSING_DELAY_MS = 1400;

type Props = {
  onComplete: () => void;
};

export default function StepProcessing({ onComplete }: Props) {
  useEffect(() => {
    const timer = setTimeout(onComplete, PROCESSING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex w-full flex-col gap-6 px-5 py-24 text-left">
      <div>
        <p className="text-[28px] font-bold leading-[1.3] text-text-primary">두 일정을 비교하고 있어요.</p>
        <p className="text-body-secondary mt-2">입력한 일정만을 기준으로 차이를 정리하고 있어요.</p>
      </div>
      <div className="processing-progress-track" role="progressbar" aria-label="비교 처리 중">
        <div className="processing-progress-fill" />
      </div>
      <p className="text-caption text-text-muted">입력한 내용은 그대로 유지됩니다.</p>
    </div>
  );
}
