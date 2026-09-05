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
// 경과에 따라 "N / 3" 단계만 순수 표시용으로 넘어가고, 실제 LLM
// 응답이 오면(=이 컴포넌트가 언마운트되거나 error prop이 채워지면)
// 그 즉시 화면이 바뀐다 — 이 단계 애니메이션이 완료를 막거나 늦추지
// 않는다.
//
// v1.0 — 문구를 너무 자주 바꾸지 않기 위해 4단계 → 3단계(초기/중간/
// 후반)로 줄였다. 각 단계는 STEP_INTERVAL_MS(4초)씩 지속되고, 3단계에
// 도달한 뒤에도 응답이 안 오면 그 3단계 문구를 유지한 채 멈춘다(가짜
// "완료" 단계를 만들지 않기 위함) — FALLBACK_AFTER_MS(15초)가 지나면
// "내용을 조금 더 확인하고 있어요" 안내가 그 아래에 추가로만 나타난다.
//
// 버그 수정(2026-09-06) — 이 안내 문구가 "입력 내용이 길면"이라고만
// 말해 텍스트 입력만 염두에 둔 것처럼 읽혔다. 이미지 입력도 지원하는
// 지금은 텍스트/이미지 어느 쪽이든 자연스러운 "입력한 일정에 따라"로
// 바꿨다 — 지연 자체의 원인(긴 텍스트든 이미지 분석이든)은 여전히
// 언급하지 않고, 그냥 일정 입력을 가리키는 공통 표현으로만 둔다.
const PROCESSING_STEPS = [
  {
    headline: "두 일정을 정리하고 있어요",
    sub: "입력된 일정의 정보를 확인하고 있어요.",
  },
  {
    headline: "비교할 정보를 확인하고 있어요",
    sub: "시간, 장소, 비용 등의 차이를 정리하고 있어요.",
  },
  {
    headline: "차이를 정리하고 있어요",
    sub: "두 일정에서 확인된 내용을 비교하고 있어요.",
  },
] as const;

// 실제 응답 시간(평균 7~13초, 최대 25초 타임아웃)과 무관하게, 이 화면
// 자체가 살아있는 동안 순수 경과 시간 기준으로만 단계를 넘긴다 — 마지막
// 단계(3/3)에서 멈추고 더 진행하지 않는다(가짜로 "완료"를 만들지
// 않기 위함). 0~4초 stage 0, 4~8초 stage 1, 8초~ stage 2로 자연스럽게
// 이어진다.
const STEP_INTERVAL_MS = 4000;
// 1차 우선순위 라운드 — 평균 응답 7~13초 구간 안(특히 12~13초대)에서는
// 이 메시지가 화면 전환 직전 잠깐 반짝였다가 사라져 "너무 이르거나
// 어색한 시점에 나온다"는 피드백이 있었다. 평균 상한(13초)을 넘긴
// 뒤에만 나오도록 15초로 늦춰, 실제로 오래 걸리는 이례적인 경우에만
// 보이게 한다 — 순수 경과 시간 기준이라는 방식 자체(가짜 progress
// 아님, API가 그 전에 끝나면 아예 렌더되지 않음)는 그대로 유지한다.
const FALLBACK_AFTER_MS = 15000;

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
      <div className="w-full">
        {/* 버그 수정(2026-09-04) — 2026-09-04 라운드에서 세로 stack을
            같은 행 2버튼으로 바꾸면서, 다른 모든 화면(StepInput/
            StepReason/StepComplete/StepResult 등)이 쓰는 fixed bottom
            CTA 래퍼를 함께 옮기지 않아 이 두 버튼만 일반 컨텐츠 흐름
            안에 남아 있었다(화면 중간에 붕 뜬 것처럼 보이는 회귀).
            다른 화면과 동일한 fixed inset-x-0 bottom-0 + .bottom-cta-bar
            패턴으로 되돌린다 — onClick(onBack/onRetry)과 재시도/리셋
            로직은 전혀 건드리지 않는다. */}
        <div className="flex w-full flex-col gap-6 px-5 pt-24 pb-28 text-left">
          <div>
            <p className="text-[28px] font-bold leading-[1.3] text-text-primary">비교를 완료하지 못했어요.</p>
            <p className="text-body-secondary mt-2 whitespace-pre-line">{error.message}</p>
          </div>
          <p className="text-caption text-text-muted">입력한 플랜 A/B 내용은 그대로 남아 있어요.</p>
        </div>

        {/* Fixed strip spans the viewport; the inner div clamps back to the app
            shell's max width so the CTA never grows wider than the app itself. */}
        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="bottom-cta-bar mx-auto flex w-full max-w-[430px] gap-3">
            <button type="button" onClick={onBack} className="btn-secondary-tint focus-ring flex-1">
              입력으로 돌아가기
            </button>
            <button type="button" onClick={onRetry} className="btn-primary focus-ring flex-1">
              다시 비교하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = PROCESSING_STEPS[stepIndex];

  return (
    <div className="flex w-full flex-col items-start px-5 pt-8 pb-20 text-left">
      {/* 1. Step indicator — 화면 맨 위. 정밀 %가 아니라 지금 몇 단계인지
          (완료/현재/대기 3 상태)만 보여준다 — 실제 진행률을 아는 것처럼
          보이는 표현은 쓰지 않는다. */}
      <div
        className="processing-progress-bar"
        role="progressbar"
        aria-label="비교 처리 단계"
        aria-valuemin={1}
        aria-valuemax={PROCESSING_STEPS.length}
        aria-valuenow={stepIndex + 1}
      >
        {PROCESSING_STEPS.map((step, i) => (
          <div
            key={step.headline}
            className="processing-progress-segment"
            data-state={i < stepIndex ? "done" : i === stepIndex ? "current" : "pending"}
          />
        ))}
      </div>

      {/* 2-3. Title + supporting text — 사용자가 지금 무엇이 처리되고
          있는지 가장 먼저 읽도록 illustration보다 앞에 둔다. 제목과
          설명은 mt-2로 좁게 붙여 하나의 text group처럼 보이게 한다.
          key=stepIndex로 문구가 바뀔 때마다 짧은 opacity fade만
          재생한다(위치 이동 없음 — layout jump 방지). aria-live로
          스크린리더에도 전달한다.
          Figma 기준(2026-09-04) — 부모의 균일한 gap-6를 없애고 구간별로
          다른 margin-top을 직접 줘서 "progress→제목(24px) / 설명→notice
          bar(16px) / notice bar→illustration(20px)"처럼 Figma에 더
          가까운 비균일 간격을 만들었다. */}
      <div key={stepIndex} aria-live="polite" className="processing-text-enter mt-6">
        <p className="heading-page break-keep">{current.headline}</p>
        <p className="text-body-secondary mt-2 break-keep">{current.sub}</p>
      </div>

      {/* Figma 기준 — 무채색 caption 한 줄이었던 안심 문구를 yellow
          notice bar로 바꿨다("입력한 내용이 사라지지 않을까?"를
          안심시키는 목적은 그대로, 시각적으로만 더 눈에 띄게). 실제
          입력 보존 로직과는 무관한 순수 안내 UI다. */}
      <div className="processing-notice-bar mt-4">
        <NoticeInfoIcon />
        <p>입력한 내용은 그대로 유지 돼요.</p>
      </div>

      {/* 4. Illustration — 본문 콘텐츠 너비를 그대로 쓴다(좌우 여백은
          바깥 px-5뿐). 비율은 고정(aspect-ratio)이라 커져도 잘리거나
          늘어나지 않는다. */}
      <div className="processing-visual-frame mt-5" aria-hidden="true">
        {/* key=stepIndex로 매 단계마다 통째로 리마운트시켜 진입
            애니메이션(1회성)이 다시 재생되게 한다 — 반복 루프가 아니라
            "단계가 바뀌었다"는 전환 신호로만 쓰인다. */}
        <div key={stepIndex} className="processing-stage-enter">
          <StageVisual stepIndex={stepIndex} />
        </div>
      </div>

      {/* 평소엔 아무것도 없다가, 12초를 넘겨도 여전히 처리 중일 때만
          상태 메시지 한 줄이 짧은 fade와 함께 추가된다 — API가 그 전에
          끝나면 이 문구는 아예 렌더되지 않는다. */}
      {showFallback && (
        <p className="processing-text-enter whitespace-pre-line text-caption text-text-muted mt-4">
          {"내용을 조금 더 확인하고 있어요.\n입력한 일정에 따라 시간이 조금 더 걸릴 수 있어요."}
        </p>
      )}
    </div>
  );
}

/** yellow notice bar 안의 filled info icon. StepResult.tsx의
 *  FilledInfoIcon과 같은 모양(채워진 원 + 흰 i)이지만, 이 파일은 그
 *  컴포넌트를 공유하지 않아(구조 변경 최소화 원칙상 새로 import 배선을
 *  만들지 않음) 로컬로 하나 더 둔다 — 색만 amber 계열로 다르다. */
function NoticeInfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
      style={{ color: "var(--color-notice-icon)" }}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <rect x="11" y="10.4" width="2" height="7.1" rx="1" fill="#ffffff" />
      <circle cx="12" cy="7.1" r="1.3" fill="#ffffff" />
    </svg>
  );
}

// 단계별 visual — 장식일 뿐이라 aria-hidden 부모 아래에서만 쓰인다.
// 상태 이해는 전적으로 headline/sub 텍스트가 담당한다. 3단계로 줄어서
// (읽기/정리/비교) "완료" 전용 visual은 더 이상 없다 — 3단계(비교)가
// 응답이 늦어져도 그대로 유지된다.
function StageVisual({ stepIndex }: { stepIndex: number }) {
  switch (stepIndex) {
    case 0:
      return <ReadingDocsVisual />;
    case 1:
      return <ChipSortVisual />;
    default:
      return <PlanCompareVisual />;
  }
}

// 2026-09-04 재재보정 — Stage 1/Stage 3가 "따로 만든 그림"처럼 보이지
// 않도록, 두 stage가 완전히 같은 마크업(같은 크기/radius/border/shadow/
// padding/라벨 위치/내용 줄)의 카드를 이 컴포넌트 하나로 공유한다 —
// stage마다 다른 건 이 카드를 감싸는 motion(scan line/moving dot)뿐이다.
// CSS의 .doc-line:nth-child(2/3/4) 선택자가 이 자식 순서(라벨 1개 + 줄
// 3개)에 맞춰져 있으므로 구조를 바꾸면 그 선택자도 함께 맞춰야 한다.
function StageCard({ label }: { label: string }) {
  return (
    <div className="stage-card doc-card">
      <span className="doc-card-label">{label}</span>
      <div className="doc-line" />
      <div className="doc-line" />
      <div className="doc-line" />
    </div>
  );
}

function ReadingDocsVisual() {
  return (
    <div className="stage-card-pair">
      <StageCard label="A" />
      <StageCard label="B" />
      <div className="doc-scan-line" />
    </div>
  );
}

// 2026-09-04 재보정 — wave(.wave-chip-wrapper, transform: translateY
// 무한반복)가 바깥 wrapper를 움직이고, 그 안의 실제 pill(.chip-pop —
// border/배경/padding/텍스트를 모두 가진 요소 자체)이 진입 pop-in(1회성,
// transform: scale+translateY)을 맡는다 — "텍스트만 움직이고 border는
// 고정돼 보인다"는 문제를 피하려면 wave가 텍스트가 아니라 pill 전체를
// 감싸는 요소에 있어야 한다. 서로 다른 요소라 두 애니메이션의 transform도
// 여전히 충돌하지 않는다.
function ChipSortVisual() {
  return (
    <div className="chip-stack">
      <span className="wave-chip-wrapper">
        <span className="chip-pop">시간</span>
      </span>
      <span className="wave-chip-wrapper">
        <span className="chip-pop">장소</span>
      </span>
      <span className="wave-chip-wrapper">
        <span className="chip-pop">비용</span>
      </span>
    </div>
  );
}

function PlanCompareVisual() {
  return (
    <div className="stage-card-pair">
      <StageCard label="A" />
      <StageCard label="B" />
      <div className="ab-scan-dot" />
    </div>
  );
}

