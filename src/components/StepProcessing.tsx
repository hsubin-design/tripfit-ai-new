"use client";

import { useEffect } from "react";

// 더미 처리 단계를 흉내 내는 고정 지연 — 실제 진행률이 없으므로 단계
// 텍스트나 % 숫자로 가짜 진행 상황을 만들지 않는다(PRD "가짜 % 진행률
// 금지"). 화면에는 처리 중이라는 사실과 입력값이 보존된다는 안내만
// 보여준다. 실제 LLM 호출은 이 지연과 별개로 onComplete 시점에
// page.tsx에서 시작된다.
const PROCESSING_DELAY_MS = 1400;

export type ProcessingError = {
  type: string;
  message: string;
  // not_travel_content일 때만 채워진다 — 어느 플랜(들)이 문제인지.
  invalidPlans?: ("a" | "b")[];
};

type Props = {
  onComplete: () => void;
  // 구조화 실패 시 null이 아닌 값이 전달된다 — 이 경우 스피너 대신 오류
  // 상태를 보여주고, 더미 파서로 조용히 대체하지 않는다. 입력한 A/B
  // 원문은 page.tsx의 state에 그대로 남아 있으므로 다시 입력할 필요가
  // 없다. type이 "not_travel_content"면 시스템 오류가 아니라 입력
  // validation 안내로 다르게 보여준다(아래 NotTravelContentScreen).
  error: ProcessingError | null;
  onRetry: () => void;
  // not_travel_content 전용 "플랜 A/B 수정하기" — 재시도가 아니라 입력
  // 화면으로 돌아가는 동작이다.
  onEditPlan: (invalidPlans: ("a" | "b")[] | undefined) => void;
  onBack: () => void;
};

// invalidPlans가 정확히 하나면 그 플랜을 콕 집어 안내하고, 없거나
// 둘 다면(빈 배열/undefined 포함, 방어적으로 "둘 다"와 동일하게 처리)
// 일반적인 문구로 안내한다 — 서버가 준 사실(어느 플랜인지)만 그대로
// 반영할 뿐 추측하지 않는다.
function notTravelContentCopy(invalidPlans: ("a" | "b")[] | undefined): { title: string; primaryLabel: string } {
  if (invalidPlans?.length === 1) {
    const label = invalidPlans[0] === "a" ? "플랜 A" : "플랜 B";
    return { title: `${label}는 여행 일정으로 보기 어려워요.`, primaryLabel: `${label} 수정하기` };
  }
  return { title: "입력한 내용을 여행 일정으로 보기 어려워요.", primaryLabel: "일정 수정하기" };
}

export default function StepProcessing({ onComplete, error, onRetry, onEditPlan, onBack }: Props) {
  useEffect(() => {
    if (error) return;
    const timer = setTimeout(onComplete, PROCESSING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [onComplete, error]);

  if (error?.type === "not_travel_content") {
    const { title, primaryLabel } = notTravelContentCopy(error.invalidPlans);
    return (
      <div className="w-full">
        {/* 다른 화면들의 fixed .bottom-cta-bar와 겹치지 않도록 pb-28로
            여유를 둔다(px-5 pb-28 pt-20 조합은 StepInput/StepRating/
            StepFeedback과 동일 — 여기는 AppHeader가 없는 화면이라 pt만
            기존 py-24의 상단 값을 그대로 유지한다). */}
        <div className="flex w-full flex-col px-5 pb-28 pt-24 text-left">
          <div>
            {/* 기존 주요 화면 타이틀(.heading-page, 24px)과 같은 스케일을
                쓴다 — 이전의 28px 커스텀 크기보다 한 단계 작아, "플랜
                B는 여행 일정으로 보기 어려워요." 같은 문장이 375px에서
                마지막 한두 글자만 다음 줄로 떨어지는 orphan 없이
                자연스럽게 줄바꿈된다. break-keep으로 한글 단어 중간이
                아니라 띄어쓰기 단위로만 줄이 바뀌게 한다. */}
            <p className="heading-page break-keep">{title}</p>
            <p className="text-body-secondary mt-2">방문 장소나 일정이 포함된 여행 계획을 입력해주세요.</p>
            {/* 보조 문구는 설명과 같은 정보 그룹으로 보이도록 바로 아래
                mt-4로 좁혀 붙인다(이전에는 부모의 gap-6로 24px 떨어진
                별개 문단처럼 보였다) — 강조 수준(text-caption/text-muted)
                자체는 그대로 유지한다. */}
            <p className="text-caption text-text-muted mt-4">입력한 플랜 A/B 내용은 그대로 남아 있어요.</p>
          </div>
        </div>

        {/* Fixed strip spans the viewport; the inner div clamps back to the app
            shell's max width so the CTA never grows wider than the app itself
            (다른 화면과 동일한 .bottom-cta-bar 패턴 그대로 재사용). */}
        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
            <button
              type="button"
              onClick={() => onEditPlan(error.invalidPlans)}
              className="btn-primary focus-ring w-full"
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full flex-col gap-6 px-5 py-24 text-left">
        <div>
          <p className="text-[28px] font-bold leading-[1.3] text-text-primary">비교를 완료하지 못했어요.</p>
          <p className="text-body-secondary mt-2 whitespace-pre-line">{error.message}</p>
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
