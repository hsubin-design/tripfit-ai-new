"use client";

import { useState } from "react";
import StepInput from "@/components/StepInput";
import StepProcessing from "@/components/StepProcessing";
import StepResult from "@/components/StepResult";
import StepDecision from "@/components/StepDecision";
import StepReason from "@/components/StepReason";
import StepRating from "@/components/StepRating";
import StepComplete from "@/components/StepComplete";
import { buildDummyComparisonResult } from "@/lib/dummyComparison";
import { SAMPLE_PLAN_A_TEXT, SAMPLE_PLAN_B_TEXT } from "@/lib/sampleData";
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

  function handleChangeA(v: string) {
    setPlanAText(v);
    setInputMode("own_plan");
  }
  function handleChangeB(v: string) {
    setPlanBText(v);
    setInputMode("own_plan");
  }

  function handleLoadSample() {
    setPlanAText(SAMPLE_PLAN_A_TEXT);
    setPlanBText(SAMPLE_PLAN_B_TEXT);
    setInputMode("sample");
  }

  function handleSubmitInput() {
    setStep("processing");
  }

  function handleProcessingComplete() {
    setComparisonResult(buildDummyComparisonResult(planAText, planBText));
    setStep("result");
  }

  function handleReopenOriginal() {
    // v0.7 핵심 흐름 단계: 원문 재확인 행동은 UI로만 노출. 계측 연동은 이후 단계에서 진행.
  }

  function handleDecisionSelect(d: Decision) {
    setDecision(d);
    setStep("reason");
  }

  function handleRatingSubmit() {
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
  }

  return (
    <div className="min-h-screen bg-white">
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
          onChangeCriteria={setSelectedCriteria}
          onChangeReasonText={setReasonText}
          onBack={() => setStep("decision")}
          onNext={() => setStep("rating")}
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
  );
}
