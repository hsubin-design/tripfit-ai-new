"use client";

import { useEffect, useRef, useState } from "react";
import StepInput, { MAX_LEN, MIN_LEN } from "@/components/StepInput";
import StepProcessing from "@/components/StepProcessing";
import StepResult from "@/components/StepResult";
import StepDecision from "@/components/StepDecision";
import StepReason from "@/components/StepReason";
import StepRating from "@/components/StepRating";
import StepComplete from "@/components/StepComplete";
import StepFeedback from "@/components/StepFeedback";
import ResetConfirmDialog from "@/components/ResetConfirmDialog";
import { buildComparison } from "@/lib/dummyComparison";
import { requestPlanStructuring, StructuringError } from "@/lib/structurePlans";
import { SAMPLE_PLAN_A_DAY_TEXTS, SAMPLE_PLAN_B_DAY_TEXTS } from "@/lib/sampleData";
import { joinDayTexts, resizeDayTexts } from "@/lib/planDayText";
import {
  initAnalytics,
  trackComparisonCompleted,
  trackComparisonFailed,
  trackComparisonRequested,
  trackComparisonStarted,
  trackComparisonViewed,
  trackDecisionCriterionSelected,
  trackDecisionReasonSubmitted,
  trackDecisionSubmitted,
  trackHelpfulnessSubmitted,
  trackOriginalReopened,
  trackPlanReady,
  trackSampleLoaded,
} from "@/lib/analytics";
import { insertUtResponse } from "@/lib/supabase";
import type { ComparisonCriterionId, ComparisonResult, Decision, InputMode } from "@/types/plan";

type Step = "input" | "processing" | "result" | "decision" | "reason" | "rating" | "complete" | "feedback";

export default function Home() {
  const [step, setStep] = useState<Step>("input");

  // 일차별 입력 구조 실험(2026-08-24) — Plan A/B는 이제 하나의 큰
  // textarea가 아니라 "여행 기간 선택 + 일차별 자유 텍스트"로 입력받는다.
  // planAText/planBText(구조화 API에 보내는 하나의 문자열, 결과 화면의
  // "원문 다시보기")는 이 상태에서 매 렌더 계산해 낸다 — 기존 비교
  // 로직/결과 화면은 이 계산된 문자열만 보고 동작하므로 변경이 없다.
  const [planADuration, setPlanADuration] = useState<number | null>(null);
  const [planADayTexts, setPlanADayTexts] = useState<string[]>([]);
  const [planBDuration, setPlanBDuration] = useState<number | null>(null);
  const [planBDayTexts, setPlanBDayTexts] = useState<string[]>([]);
  const planAText = joinDayTexts(planADayTexts);
  const planBText = joinDayTexts(planBDayTexts);
  const [inputMode, setInputMode] = useState<InputMode | null>(null);

  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  // type/message/invalidPlans는 StructuringError를 그대로 옮겨 담은
  // 것 — invalidPlans는 not_travel_content일 때만 채워지고, StepProcessing이
  // 이 값을 보고 "플랜 A/B 수정하기" 같은 구체적 안내를 만든다.
  const [structuringFailure, setStructuringFailure] = useState<{
    type: string;
    message: string;
    invalidPlans?: ("a" | "b")[];
  } | null>(null);
  // not_travel_content 오류에서 "플랜 A/B 수정하기"를 누르면 입력
  // 화면으로 돌아가면서 문제였던 입력칸에 포커스를 옮긴다 — 한 번
  // 쓰이면 StepInput이 소비 즉시 null로 되돌린다(onAutoFocusConsumed).
  const [focusPlan, setFocusPlan] = useState<"a" | "b" | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [selectedCriteria, setSelectedCriteria] = useState<ComparisonCriterionId[]>([]);
  const [reasonText, setReasonText] = useState("");
  const [helpfulness, setHelpfulness] = useState<number | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSubmitError, setRatingSubmitError] = useState<string | null>(null);
  // 상단 GNB "TripFit" 로고 → 처음부터 다시 시작. 아무 것도 입력/진행
  // 하지 않은 순수 초기 상태면 바로 초기화하고, 뭔가 입력했거나 결과·
  // 결정 단계까지 진행했다면(둘 다 planA/B 상태가 채워져 있어야만
  // 도달 가능하므로 이 조건 하나로 전부 커버된다) 확인 dialog를 먼저
  // 보여준다.
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 비교 세션(계측 퍼널) 타이밍/중복 방지 상태 — 화면 렌더링과 무관해
  // state가 아니라 ref로 둔다.
  const comparisonStartedAtRef = useRef(0);
  const processingStartedAtRef = useRef(0);
  const planAReadyFiredRef = useRef(false);
  const planBReadyFiredRef = useRef(false);

  useEffect(() => {
    initAnalytics();
    startComparisonSession();
  }, []);

  function startComparisonSession() {
    comparisonStartedAtRef.current = Date.now();
    planAReadyFiredRef.current = false;
    planBReadyFiredRef.current = false;
    trackComparisonStarted();
  }

  function isPlanReady(text: string) {
    return text.length >= MIN_LEN && text.length <= MAX_LEN;
  }

  function handleChangePlanADuration(days: number) {
    setPlanADuration(days);
    setPlanADayTexts((prev) => resizeDayTexts(prev, days));
    setInputMode("own_plan");
  }
  function handleChangePlanBDuration(days: number) {
    setPlanBDuration(days);
    setPlanBDayTexts((prev) => resizeDayTexts(prev, days));
    setInputMode("own_plan");
  }

  function handleChangePlanADayText(index: number, value: string) {
    const next = [...planADayTexts];
    next[index] = value;
    setPlanADayTexts(next);
    setInputMode("own_plan");
    if (!planAReadyFiredRef.current && isPlanReady(joinDayTexts(next))) {
      planAReadyFiredRef.current = true;
      trackPlanReady("a", "own_plan");
    }
  }
  function handleChangePlanBDayText(index: number, value: string) {
    const next = [...planBDayTexts];
    next[index] = value;
    setPlanBDayTexts(next);
    setInputMode("own_plan");
    if (!planBReadyFiredRef.current && isPlanReady(joinDayTexts(next))) {
      planBReadyFiredRef.current = true;
      trackPlanReady("b", "own_plan");
    }
  }

  function handleLoadSample() {
    setPlanADuration(SAMPLE_PLAN_A_DAY_TEXTS.length);
    setPlanADayTexts([...SAMPLE_PLAN_A_DAY_TEXTS]);
    setPlanBDuration(SAMPLE_PLAN_B_DAY_TEXTS.length);
    setPlanBDayTexts([...SAMPLE_PLAN_B_DAY_TEXTS]);
    setInputMode("sample");
    trackSampleLoaded(1);
    if (!planAReadyFiredRef.current) {
      planAReadyFiredRef.current = true;
      trackPlanReady("a", "sample");
    }
    if (!planBReadyFiredRef.current) {
      planBReadyFiredRef.current = true;
      trackPlanReady("b", "sample");
    }
  }

  function handleSubmitInput() {
    trackComparisonRequested(inputMode ?? "own_plan", planADuration, planBDuration);
    processingStartedAtRef.current = Date.now();
    setStructuringFailure(null);
    setStep("processing");
  }

  // 실제 구조화(LLM 호출)는 여기서 수행한다. 성공하면 기존
  // buildComparison(변경 없음)에 그대로 넘긴다 — 비교 로직/결과 UI는
  // 파서가 규칙 기반이든 LLM이든 PlanStructure 모양만 같으면 그대로
  // 동작한다. 실패하면 더미 파서로 조용히 대체하지 않고, 오류를
  // StepProcessing에 보여준 채로 입력값(planAText/planBText)은 그대로
  // 유지해 재시도할 수 있게 한다.
  async function handleProcessingComplete() {
    try {
      const { planA, planB } = await requestPlanStructuring(planAText, planBText);
      setComparisonResult(buildComparison(planA, planB));
      trackComparisonViewed(Date.now() - processingStartedAtRef.current);
      setStructuringFailure(null);
      setStep("result");
    } catch (error) {
      const errorType = error instanceof StructuringError ? error.type : "unknown";
      const message =
        error instanceof StructuringError
          ? error.message
          : "일정을 구조화하지 못했어요. 잠시 후 다시 시도해주세요.";
      const invalidPlans = error instanceof StructuringError ? error.invalidPlans : undefined;
      trackComparisonFailed(errorType);
      setStructuringFailure({ type: errorType, message, invalidPlans });
    }
  }

  function handleRetryProcessing() {
    processingStartedAtRef.current = Date.now();
    setStructuringFailure(null);
  }

  // not_travel_content 전용 "플랜 A/B 수정하기" CTA. 재시도(같은 텍스트로
  // 다시 LLM 호출)가 아니라 입력 화면으로 돌아가는 동작이다 — 텍스트
  // 자체가 문제이므로 재시도해도 같은 결과가 나올 뿐이다.
  function handleEditPlan(invalidPlans: ("a" | "b")[] | undefined) {
    setStructuringFailure(null);
    setFocusPlan(invalidPlans && invalidPlans.length === 1 ? invalidPlans[0] : null);
    setStep("input");
  }

  function handleReopenOriginal(plan: "a" | "b") {
    trackOriginalReopened(plan);
  }

  function handleDecisionSelect(d: Decision) {
    setDecision(d);
    trackDecisionSubmitted(d);
    setStep("reason");
  }

  function handleChangeCriteria(next: ComparisonCriterionId[]) {
    const added = next.find((id) => !selectedCriteria.includes(id));
    if (added) trackDecisionCriterionSelected(added);
    setSelectedCriteria(next);
  }

  function handleReasonNext() {
    if (decision) trackDecisionReasonSubmitted(decision, reasonText.trim().length);
    setStep("rating");
  }

  // 제출은 Supabase INSERT가 성공한 뒤에만 완료 화면으로 넘어간다 —
  // 실패하면 화면 전환도, Mixpanel 제출 이벤트도 하지 않고 사용자가
  // 입력/선택한 값은 그대로 유지해 재시도할 수 있게 한다. 여기서
  // Supabase로 보내는 값에는 일정 원문(Plan A/B)이나 비교 결과가
  // 전혀 포함되지 않는다 — insertUtResponse의 인자 타입 자체가 그
  // 값을 받지 않는다.
  async function handleRatingSubmit() {
    if (helpfulness === null || decision === null) return;

    setIsSubmittingRating(true);
    setRatingSubmitError(null);

    const { success } = await insertUtResponse({
      testerMode: inputMode ?? "own_plan",
      decision,
      selectedCriteria,
      decisionReason: reasonText,
      helpfulnessScore: helpfulness,
    });

    setIsSubmittingRating(false);

    if (!success) {
      setRatingSubmitError("제출에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    trackHelpfulnessSubmitted(helpfulness);
    trackComparisonCompleted(Date.now() - comparisonStartedAtRef.current);
    setStep("complete");
  }

  function handleRestart() {
    setStep("input");
    setPlanADuration(null);
    setPlanADayTexts([]);
    setPlanBDuration(null);
    setPlanBDayTexts([]);
    setInputMode(null);
    setComparisonResult(null);
    setStructuringFailure(null);
    setFocusPlan(null);
    setDecision(null);
    setSelectedCriteria([]);
    setReasonText("");
    setHelpfulness(null);
    setIsSubmittingRating(false);
    setRatingSubmitError(null);
    startComparisonSession();
  }

  function hasInProgressData() {
    return (
      planADuration !== null ||
      planBDuration !== null ||
      planADayTexts.some((t) => t.trim().length > 0) ||
      planBDayTexts.some((t) => t.trim().length > 0)
    );
  }

  function handleLogoClick() {
    if (hasInProgressData()) {
      setShowResetConfirm(true);
    } else {
      handleRestart();
    }
  }

  function handleConfirmReset() {
    setShowResetConfirm(false);
    handleRestart();
  }

  return (
    <div className="min-h-dvh w-full bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-surface">
        {step === "input" && (
          <StepInput
            planADuration={planADuration}
            planADayTexts={planADayTexts}
            onChangePlanADuration={handleChangePlanADuration}
            onChangePlanADayText={handleChangePlanADayText}
            planBDuration={planBDuration}
            planBDayTexts={planBDayTexts}
            onChangePlanBDuration={handleChangePlanBDuration}
            onChangePlanBDayText={handleChangePlanBDayText}
            onLoadSample={handleLoadSample}
            onSubmit={handleSubmitInput}
            onFeedbackClick={() => setStep("feedback")}
            onLogoClick={handleLogoClick}
            autoFocusPlan={focusPlan}
            onAutoFocusConsumed={() => setFocusPlan(null)}
          />
        )}

        {step === "feedback" && <StepFeedback onBack={() => setStep("input")} />}

        {step === "processing" && (
          <StepProcessing
            onComplete={handleProcessingComplete}
            error={structuringFailure}
            onRetry={handleRetryProcessing}
            onEditPlan={handleEditPlan}
            onBack={() => {
              setStructuringFailure(null);
              setStep("input");
            }}
          />
        )}

        {step === "result" && comparisonResult && (
          <StepResult
            result={comparisonResult}
            planAText={planAText}
            planBText={planBText}
            onBack={() => setStep("input")}
            onNext={() => setStep("decision")}
            onReopenOriginal={handleReopenOriginal}
          />
        )}

        {step === "decision" && (
          <StepDecision onSelect={handleDecisionSelect} onBack={() => setStep("result")} />
        )}

        {step === "reason" && decision && (
          <StepReason
            decision={decision}
            selectedCriteria={selectedCriteria}
            reasonText={reasonText}
            onChangeCriteria={handleChangeCriteria}
            onChangeReasonText={setReasonText}
            onBack={() => setStep("decision")}
            onNext={handleReasonNext}
          />
        )}

        {step === "rating" && (
          <StepRating
            score={helpfulness}
            onChangeScore={setHelpfulness}
            onBack={() => setStep("reason")}
            onSubmit={handleRatingSubmit}
            isSubmitting={isSubmittingRating}
            submitError={ratingSubmitError}
          />
        )}

        {step === "complete" && (
          <StepComplete
            inputMode={inputMode}
            decision={decision}
            selectedCriteria={selectedCriteria}
            reasonText={reasonText}
            helpfulness={helpfulness}
            onRestart={handleRestart}
          />
        )}
      </div>

      {showResetConfirm && (
        <ResetConfirmDialog onCancel={() => setShowResetConfirm(false)} onConfirm={handleConfirmReset} />
      )}
    </div>
  );
}
