"use client";

import { useEffect, useRef, useState } from "react";
import StepInput, { MAX_LEN, MIN_LEN } from "@/components/StepInput";
import StepProcessing from "@/components/StepProcessing";
import StepResult from "@/components/StepResult";
import StepDecision from "@/components/StepDecision";
import StepReason from "@/components/StepReason";
import StepRating from "@/components/StepRating";
import StepComplete from "@/components/StepComplete";
import { buildDummyComparisonResult } from "@/lib/dummyComparison";
import { SAMPLE_PLAN_A_TEXT, SAMPLE_PLAN_B_TEXT } from "@/lib/sampleData";
import {
  initAnalytics,
  trackComparisonCompleted,
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
import type { ComparisonCriterionId, ComparisonResult, Decision, InputMode } from "@/types/plan";

type Step = "input" | "processing" | "result" | "decision" | "reason" | "rating" | "complete";

export default function Home() {
  const [step, setStep] = useState<Step>("input");

  const [planAText, setPlanAText] = useState("");
  const [planBText, setPlanBText] = useState("");
  const [inputMode, setInputMode] = useState<InputMode | null>(null);

  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [selectedCriteria, setSelectedCriteria] = useState<ComparisonCriterionId[]>([]);
  const [reasonText, setReasonText] = useState("");
  const [helpfulness, setHelpfulness] = useState<number | null>(null);

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

  function handleChangeA(v: string) {
    setPlanAText(v);
    setInputMode("own_plan");
    if (!planAReadyFiredRef.current && isPlanReady(v)) {
      planAReadyFiredRef.current = true;
      trackPlanReady("a", "own_plan");
    }
  }
  function handleChangeB(v: string) {
    setPlanBText(v);
    setInputMode("own_plan");
    if (!planBReadyFiredRef.current && isPlanReady(v)) {
      planBReadyFiredRef.current = true;
      trackPlanReady("b", "own_plan");
    }
  }

  function handleLoadSample() {
    setPlanAText(SAMPLE_PLAN_A_TEXT);
    setPlanBText(SAMPLE_PLAN_B_TEXT);
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
    trackComparisonRequested(inputMode ?? "own_plan");
    processingStartedAtRef.current = Date.now();
    setStep("processing");
  }

  function handleProcessingComplete() {
    setComparisonResult(buildDummyComparisonResult(planAText, planBText));
    trackComparisonViewed(Date.now() - processingStartedAtRef.current);
    setStep("result");
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

  function handleRatingSubmit() {
    if (helpfulness !== null) trackHelpfulnessSubmitted(helpfulness);
    trackComparisonCompleted(Date.now() - comparisonStartedAtRef.current);
    setStep("complete");
  }

  function handleRestart() {
    setStep("input");
    setPlanAText("");
    setPlanBText("");
    setInputMode(null);
    setComparisonResult(null);
    setDecision(null);
    setSelectedCriteria([]);
    setReasonText("");
    setHelpfulness(null);
    startComparisonSession();
  }

  return (
    <div className="min-h-dvh w-full bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-surface">
        {step === "input" && (
          <StepInput
            planAText={planAText}
            planBText={planBText}
            onChangeA={handleChangeA}
            onChangeB={handleChangeB}
            onLoadSample={handleLoadSample}
            onSubmit={handleSubmitInput}
          />
        )}

        {step === "processing" && <StepProcessing onComplete={handleProcessingComplete} />}

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
    </div>
  );
}
