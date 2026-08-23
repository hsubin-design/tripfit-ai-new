"use client";

import { useEffect } from "react";

// 더미 처리 단계를 흉내 내는 고정 지연 — 실제 진행률이 없으므로 단계
// 텍스트나 % 숫자로 가짜 진행 상황을 만들지 않는다(PRD "가짜 % 진행률
// 금지"). 화면에는 처리 중이라는 사실과 입력값이 보존된다는 안내만
// 보여준다. 실제 LLM 호출은 이 지연과 별개로 onComplete 시점에
// page.tsx에서 시작된다.
const PROCESSING_DELAY_MS = 1400;

type Props = {
  onComplete: () => void;
  // 구조화 실패 시(LLM 응답 실패/스키마 불일치 등) null이 아닌 사용자용
  // 안내 문구가 전달된다 — 이 경우 스피너 대신 오류 상태를 보여주고,
  // 더미 파서로 조용히 대체하지 않는다. 입력한 A/B 원문은 page.tsx의
  // state에 그대로 남아 있으므로 재시도해도 다시 입력할 필요가 없다.
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
};

export default function StepProcessing({ onComplete, error, onRetry, onBack }: Props) {
  useEffect(() => {
    if (error) return;
    const timer = setTimeout(onComplete, PROCESSING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [onComplete, error]);

  if (error) {
    return (
      <div className="flex w-full flex-col gap-6 px-5 py-24 text-left">
        <div>
          <p className="text-[28px] font-bold leading-[1.3] text-text-primary">비교를 완료하지 못했어요.</p>
          <p className="text-body-secondary mt-2 whitespace-pre-line">{error}</p>
        </div>
        <p className="text-caption text-text-muted">입력한 플랜 A/B 내용은 그대로 남아 있어요.</p>
        <div className="flex flex-col gap-3">
          <button type="button" onClick={onRetry} className="btn-primary focus-ring w-full">
            다시 시도하기
          </button>
          <button
            type="button"
            onClick={onBack}
            className="focus-ring w-full rounded text-sm font-medium text-text-secondary underline underline-offset-4"
          >
            입력으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

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
