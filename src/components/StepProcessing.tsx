"use client";

import { useEffect, useState } from "react";

// 더미 처리 단계를 흉내 내는 고정 지연 — 실제 LLM 호출은 이 지연과
// 별개로 onComplete 시점에 page.tsx에서 시작된다. 이 값과 그 호출
// 로직 자체는 v1.0 로딩 UX 개선에서도 그대로 둔다(요구사항: "기존
// LLM 요청/응답 로직은 변경하지 않기").
const PROCESSING_DELAY_MS = 1400;

// v1.0 로딩 UX — "단계별로 무엇을 하는지 보여주는" 화면. 서버가 실제
// 진행률(%)을 주지 않으므로, 5.1%/43% 같은 정확한 숫자처럼 보이는
// 값은 절대 만들지 않는다(가짜 progress 금지 가드레일). 대신 시간
// 경과에 따라 "N / 4" 단계만 순수 표시용으로 넘어가고, 실제 LLM
// 응답이 오면(=이 컴포넌트가 언마운트되거나 error prop이 채워지면)
// 그 즉시 화면이 바뀐다 — 이 단계 애니메이션이 완료를 막거나 늦추지
// 않는다.
const PROCESSING_STEPS = [
  {
    headline: "입력한 일정을 읽고 있어요",
    sub: "두 일정에서 필요한 정보를 확인하고 있어요.",
  },
  {
    headline: "시간·장소·비용을 정리하고 있어요",
    sub: "입력된 정보만 기준으로 정리하고 있어요.",
  },
  {
    headline: "두 일정의 차이를 비교하고 있어요",
    sub: "시간·장소·비용 차이를 같은 기준으로 확인하고 있어요.",
  },
  {
    headline: "결과를 준비하고 있어요",
    sub: "일차별로 비교할 수 있도록 정리하고 있어요.",
  },
] as const;

// 실제 응답 시간(평균 7~13초, 최대 25초 타임아웃)과 무관하게, 이 화면
// 자체가 살아있는 동안 순수 경과 시간 기준으로만 단계를 넘긴다 — 마지막
// 단계(4/4)에서 멈추고 더 진행하지 않는다(가짜로 "완료"를 만들지
// 않기 위함).
const STEP_INTERVAL_MS = 2600;
// 이 시간을 넘겨도 여전히 처리 중이면(드문 긴 응답), 같은 4단계를
// 무한 반복하는 대신 안심시키는 안내 문구를 추가로 보여준다.
const FALLBACK_AFTER_MS = 11000;

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
  const [stepIndex, setStepIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (error) return;
    const timer = setTimeout(onComplete, PROCESSING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [onComplete, error]);

  // 순수 표시용 단계 연출 — 실제 fetch 진행 상황과는 완전히 분리돼
  // 있다. 실제 응답이 오면 이 컴포넌트 자체가 언마운트되거나(성공)
  // error prop이 채워져(실패) 다른 분기로 전환되므로, 여기서는
  // 마지막 단계(4/4)에서 그냥 멈춘 채로 기다리기만 하면 된다 —
  // 4단계를 다시 처음부터 반복하지 않는다.
  useEffect(() => {
    if (error) return;
    const interval = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, PROCESSING_STEPS.length - 1));
    }, STEP_INTERVAL_MS);
    const fallbackTimer = setTimeout(() => setShowFallback(true), FALLBACK_AFTER_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(fallbackTimer);
    };
  }, [error]);

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

  const current = PROCESSING_STEPS[stepIndex];

  return (
    <div className="flex w-full flex-col items-center gap-6 px-5 py-20 text-center">
      {/* 사용자가 로딩 화면에서 가장 먼저 불안해할 만한 지점("입력한
          내용이 사라지지 않을까?")을 처리 과정 설명보다 먼저 안심시킨다
          — stage visual 바로 위, 메인 headline보다 작고 연한 톤으로. */}
      <p className="text-caption text-text-muted">입력한 내용은 그대로 유지돼요</p>

      <div className="processing-visual-frame" aria-hidden="true">
        {/* key=stepIndex로 매 단계마다 통째로 리마운트시켜 진입
            애니메이션(1회성)이 다시 재생되게 한다 — 반복 루프가 아니라
            "단계가 바뀌었다"는 전환 신호로만 쓰인다. */}
        <div key={stepIndex} className="processing-stage-enter">
          <StageVisual stepIndex={stepIndex} />
        </div>
      </div>

      {/* aria-live로 단계가 바뀔 때마다 스크린리더가 새 headline을
          읽어준다 — 진행 상태를 애니메이션(visual)에만 의존하지 않고
          텍스트로도 완전히 전달하기 위함. */}
      <div aria-live="polite">
        <p className="heading-page break-keep">{current.headline}</p>
        <p className="text-body-secondary mt-2 break-keep">{current.sub}</p>
      </div>

      {/* 정밀 % 대신, 그리고 이제는 "N / 4" 숫자도 없이 점 4개만으로
          단계를 보여준다 — 실제 진행률을 아는 것처럼 보이는 표현을
          더 철저히 피한다. */}
      <div
        className="processing-step-dots"
        role="progressbar"
        aria-label="비교 처리 단계"
        aria-valuemin={1}
        aria-valuemax={PROCESSING_STEPS.length}
        aria-valuenow={stepIndex + 1}
      >
        {PROCESSING_STEPS.map((step, i) => (
          <div
            key={step.headline}
            className="processing-step-dot"
            data-state={i < stepIndex ? "done" : i === stepIndex ? "current" : "pending"}
          />
        ))}
      </div>

      {/* 평소엔 아무것도 없다가, 오래 걸릴 때만 상태 메시지 한 줄이
          추가된다 — 안심 문구(상단)와 겹쳐 쌓이지 않는다. */}
      {showFallback && (
        <p className="text-caption text-text-muted">
          조금 더 확인하고 있어요. 입력 내용이 길면 시간이 더 걸릴 수 있어요.
        </p>
      )}
    </div>
  );
}

// 단계별 visual — 장식일 뿐이라 aria-hidden 부모 아래에서만 쓰인다.
// 상태 이해는 전적으로 headline/sub 텍스트가 담당한다.
function StageVisual({ stepIndex }: { stepIndex: number }) {
  switch (stepIndex) {
    case 0:
      return <ReadingDocsVisual />;
    case 1:
      return <ChipSortVisual />;
    case 2:
      return <PlanCompareVisual />;
    default:
      return <ResultReadyVisual />;
  }
}

function ReadingDocsVisual() {
  return (
    <div className="doc-pair">
      <div className="doc-card">
        <div className="doc-line" />
        <div className="doc-line" />
        <div className="doc-line" />
      </div>
      <div className="doc-card">
        <div className="doc-line" />
        <div className="doc-line" />
        <div className="doc-line" />
      </div>
      <div className="doc-scan-line" />
    </div>
  );
}

function ChipSortVisual() {
  return (
    <div className="chip-stack">
      <span className="chip-pop">시간</span>
      <span className="chip-pop">장소</span>
      <span className="chip-pop">비용</span>
    </div>
  );
}

function PlanCompareVisual() {
  return (
    <div className="ab-compare">
      <div className="ab-card">A</div>
      <div className="ab-card">B</div>
      <div className="ab-scan-dot" />
    </div>
  );
}

function ResultReadyVisual() {
  return (
    <div className="result-check">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 13l4 4L19 7"
          stroke="var(--color-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
