"use client";

import { useEffect, useRef, useState } from "react";
import StepInput, { MAX_LEN, MIN_LEN } from "@/components/StepInput";
import StepProcessing from "@/components/StepProcessing";
import StepResult from "@/components/StepResult";
import StepDecision from "@/components/StepDecision";
import StepReason from "@/components/StepReason";
import StepComplete from "@/components/StepComplete";
import StepFeedback from "@/components/StepFeedback";
import RouteCompareDev from "@/components/RouteCompareDev";
import ResultSwipeVariantDev from "@/components/ResultSwipeVariantDev";
import StepInputExplorationDev from "@/components/StepInputExplorationDev";
import ResetConfirmDialog from "@/components/ResetConfirmDialog";
import { buildComparison } from "@/lib/dummyComparison";
import { requestPlanStructuring, StructuringError } from "@/lib/structurePlans";
import { SAMPLE_PLAN_A_DAY_TEXTS, SAMPLE_PLAN_B_DAY_TEXTS } from "@/lib/sampleData";
import { joinDayTexts, resizeDayTexts, typedLength } from "@/lib/planDayText";
import {
  getAnalyticsDistinctId,
  getCurrentComparisonId,
  initAnalytics,
  setComparisonId,
  trackComparisonCompleted,
  trackComparisonFailed,
  trackComparisonHelpfulnessSelected,
  trackComparisonHelpfulnessSubmitted,
  trackComparisonRequested,
  trackComparisonStarted,
  trackComparisonViewed,
  trackDecisionCriterionSelected,
  trackDecisionReasonSubmitted,
  trackDecisionSubmitted,
  trackFlowSelected,
  trackHelpfulnessSubmitted,
  trackOriginalReopened,
  trackPlanReady,
  trackPlanStarted,
  trackSampleLoaded,
  type PlanInputMethod,
} from "@/lib/analytics";
import { insertComparisonFeedback, insertUtResponse } from "@/lib/supabase";
import type { ComparisonResult, Decision, InputMode, SelectedReasonId } from "@/types/plan";

// resizeDayTexts(planDayText.ts)와 같은 원칙 — 뒤쪽만 자르거나 새
// day는 null(텍스트 day)로 채운다. planAImages 전용이라 별도 파일로
// export하지 않고 이 파일 안에서만 쓴다.
function resizeImages(current: (string | null)[], newLength: number): (string | null)[] {
  const next = current.slice(0, newLength);
  while (next.length < newLength) next.push(null);
  return next;
}

type Step =
  | "input"
  | "processing"
  | "result"
  | "routeCompare"
  | "resultSwipeExperiment"
  | "inputExploration"
  | "decision"
  | "reason"
  | "complete"
  | "feedback";

export default function Home() {
  const [step, setStep] = useState<Step>("input");

  // 일차별 입력 구조 실험(2026-08-24) — Plan A/B는 하나의 큰 textarea가
  // 아니라 "여행 기간 선택 + 일차별 자유 텍스트"로 입력받는다.
  //
  // 버그 수정(2026-09-05, 2차) — 이미지 입력을 실제 비교 플로우에
  // 연결하면서 planAImages/planBImages(day별 업로드 이미지 data URL,
  // 텍스트 day는 null)를 추가했다. planAPasteDayTexts[i]는 이제
  // "타이핑한 텍스트"뿐 아니라 "이미지에서 추출된 텍스트"도 담을 수
  // 있다 — 어느 쪽이든 이후 파이프라인(joinDayTexts → structure-plan)은
  // 완전히 동일하게 취급한다. planAInputMethod/planBInputMethod(analytics
  // 전용, text/image)는 이제 그 플랜의 day 중 하나라도 이미지면
  // "image"로 계산되는 파생값이다 — 별도 state로 들고 다니지 않는다.
  //
  // planADayTexts/planADuration은 실제 제출·API·"원문 다시보기"가 보는
  // 최종 결과이고, page.tsx에 lifted돼 있는 이유는 "not_travel_content"
  // 오류 후 입력 화면으로 돌아왔을 때(StepInput이 리마운트됨)도 값이
  // (이미지 포함) 남아있어야 하기 때문 — 컴포넌트 로컬 state였다면
  // 리마운트 시 사라진다.
  //
  // 버그 수정(2026-09-06, 2차) — planAPasteDayTexts는 이제 "비교에 쓸
  // 선별된 텍스트(itineraryText)"만 담는다. 이미지에서 실제로 읽힌
  // 전체 원문(rawText — 블로그 UI/감상 문장 등 노이즈 포함 가능)은
  // 별도로 planARawTexts에 담아, "원문 다시보기"에서만 쓴다. 텍스트로
  // 직접 입력한 day는 rawText 개념이 없으므로 빈 문자열로 둔다 —
  // OriginalDayBlock이 imageDataUrl===null이면 이 값을 아예 쓰지 않는다.
  const [planADuration, setPlanADuration] = useState<number | null>(null);
  const [planAPasteDayTexts, setPlanAPasteDayTexts] = useState<string[]>([]);
  const [planARawTexts, setPlanARawTexts] = useState<string[]>([]);
  const [planAImages, setPlanAImages] = useState<(string | null)[]>([]);
  const [planBDuration, setPlanBDuration] = useState<number | null>(null);
  const [planBPasteDayTexts, setPlanBPasteDayTexts] = useState<string[]>([]);
  const [planBRawTexts, setPlanBRawTexts] = useState<string[]>([]);
  const [planBImages, setPlanBImages] = useState<(string | null)[]>([]);
  const planADayTexts = planAPasteDayTexts;
  const planBDayTexts = planBPasteDayTexts;
  const planAText = joinDayTexts(planADayTexts);
  const planBText = joinDayTexts(planBDayTexts);
  const planAInputMethod: PlanInputMethod = planAImages.some((img) => img !== null) ? "image" : "text";
  const planBInputMethod: PlanInputMethod = planBImages.some((img) => img !== null) ? "image" : "text";
  const [inputMode, setInputMode] = useState<InputMode | null>(null);

  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  // 비교 결과 화면 자체의 도움 여부(후행지표, 2026-08-24) — 최종
  // 의사결정(decision/helpfulness 1~5)과는 별개 값이라 결과 화면을
  // 벗어나도(결정→이유→평가) 유지해야 최종 Supabase row에 함께 저장할
  // 수 있다. 그래서 StepResult 로컬 state가 아니라 여기(page)에 둔다.
  const [comparisonHelpfulness, setComparisonHelpfulness] = useState<"helpful" | "not_helpful" | null>(
    null
  );
  // comparisonHelpfulness와 같은 이유로 page 레벨에 둔다 — 결과 화면을
  // 벗어나도 유지되어야 최종 제출에 함께 담을 수 있다. Mixpanel에는
  // 절대 실리지 않는다(가드레일) — trackComparisonHelpfulnessSelected는
  // 이 값을 인자로 받지 않는다.
  const [comparisonHelpfulnessReason, setComparisonHelpfulnessReason] = useState("");
  // 전송 아이콘으로 tripfit_comparison_feedback에 즉시 저장한 뒤에만
  // true가 된다 — CTA(결정하러 가기)는 이 값과 무관하게 항상 활성화되고,
  // 이 값은 오직 전송 아이콘 자체의 재전송 가능 여부(sendDisabled)에만
  // 쓰인다. helpfulness/reason 중 하나라도 다시 바뀌면 이미 제출된
  // 내용과 어긋나므로 즉시 false로 되돌린다 —
  // handleComparisonHelpfulnessSelect/handleChangeComparisonHelpfulnessReason에서
  // 처리.
  const [comparisonFeedbackSubmitted, setComparisonFeedbackSubmitted] = useState(false);
  const [isSubmittingComparisonFeedback, setIsSubmittingComparisonFeedback] = useState(false);
  const [comparisonFeedbackSubmitError, setComparisonFeedbackSubmitError] = useState<string | null>(
    null
  );
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
  // v1.0 dev — "지도에서 N일차 동선 보기"가 어느 일차에서 눌렸는지만
  // 기억한다. RouteCompareDev는 실제 지도 API가 붙기 전 UX 흐름 확인용
  // 화면이라 별도 analytics/Supabase 기록은 하지 않는다.
  const [routeCompareDay, setRouteCompareDay] = useState<number | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [selectedCriteria, setSelectedCriteria] = useState<SelectedReasonId[]>([]);
  const [reasonText, setReasonText] = useState("");
  const [helpfulness, setHelpfulness] = useState<number | null>(null);
  // 3차 우선순위(2026-09-04) — 완료 화면 개편. 예전엔 decision+reason+
  // helpfulness를 한 화면(StepRating)에서 한 번에 Supabase에 저장했는데,
  // 이제 helpfulness는 완료 화면에서 나중에(선택적으로) 고르므로 제출이
  // 두 시점으로 나뉜다: (1) "다음"을 누르면 decision/reason을 helpfulness
  // 없이 먼저 저장하고 곧바로 완료 화면으로 이동 — isSubmittingReason/
  // reasonSubmitError가 이 제출 상태를 담당한다(예전 isSubmittingRating/
  // ratingSubmitError와 같은 역할, 화면만 옮겨졌다). (2) 완료 화면에서
  // helpfulness를 고르면 그 즉시 별도로 한 번 더 저장한다 —
  // isSavingHelpfulness/helpfulnessSaveError가 그 상태를 담당한다. Supabase
  // anon key는 INSERT만 가능하도록 RLS가 걸려 있어(supabase.ts 주석) 먼저
  // 저장한 행을 나중에 UPDATE할 수 없다 — 그래서 helpfulness를 고르면
  // decision/reason/기준을 포함해 한 번 더 insert한다(같은 insertUtResponse
  // 함수, 같은 테이블/컬럼 구조를 그대로 재사용 — 새 스키마/RLS 변경 없음).
  const [isSubmittingReason, setIsSubmittingReason] = useState(false);
  const [reasonSubmitError, setReasonSubmitError] = useState<string | null>(null);
  const [isSavingHelpfulness, setIsSavingHelpfulness] = useState(false);
  const [helpfulnessSaveError, setHelpfulnessSaveError] = useState<string | null>(null);
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
  // v1.0 — plan_a_ready/b_ready보다 먼저 "뭔가 입력을 시작했다"를 보는
  // plan_a_started/b_started 전용 1회성 가드. ready와 마찬가지로
  // startComparisonSession()에서 매번 리셋된다.
  const planAStartedFiredRef = useRef(false);
  const planBStartedFiredRef = useRef(false);
  // v1.0 — flow_selected(own_plan/sample) 1회성 가드. setInputMode를
  // 부르는 곳이 여러 곳(기간 변경/텍스트 입력/이미지 추출/예시 불러오기)
  // 이라 이 가드 없이는 이벤트가 계속 다시 발화된다 — 위 *StartedFiredRef와
  // 동일한 패턴으로 startComparisonSession()에서 리셋된다.
  const flowSelectedFiredRef = useRef(false);
  // 직전에 실제로 이벤트를 보낸 helpfulness 값 — state(comparisonHelpfulness)로
  // 비교하면, 같은 값을 아주 빠르게 연속 클릭했을 때 React가 두 클릭을
  // 한 배치로 묶어 아직 리렌더되지 않은 stale 값을 보고 중복 전송할 수
  // 있다(state는 다음 렌더에서만 갱신되지만 ref는 그 자리에서 바로
  // 갱신됨). ref로 비교해야 클릭 시점에 항상 최신 값을 본다.
  const lastFiredHelpfulnessRef = useRef<"helpful" | "not_helpful" | null>(null);
  // handleSelectHelpfulness 전용 — 같은 점수를 연속 클릭했을 때 매번
  // 새로 insert하지 않도록 막는다. lastFiredHelpfulnessRef와 동일한
  // 이유로 ref를 쓴다(클릭 시점에 항상 최신 값을 봐야 함).
  const lastSavedHelpfulnessRef = useRef<number | null>(null);

  useEffect(() => {
    initAnalytics();
    startComparisonSession();
  }, []);

  // v1.0 — plan_a_started/ready, plan_b_started/ready는 이제 여러
  // 입력 경로(붙여넣기 textarea든, 직접 일정 추가의 item 편집/추가/
  // 삭제든)에서 만들어질 수 있다. 경로마다 따로 추적 로직을 심는 대신,
  // "최종 계산된 텍스트(planAText/planBText)가 실제로 바뀔 때"만 보는
  // effect 하나로 통일한다 — 어느 모드로 만들어졌든 결과가 같으면
  // 같은 방식으로 감지된다. sample 불러오기도 planAText가 이 effect의
  // 트리거이므로 별도 처리가 필요 없다.
  // "started"는 joinDayTexts가 붙이는 "N일차" 헤더가 아니라, 사용자가
  // 실제로 타이핑한 글자 수(typedLength)만 본다 — 기간만 고르고 아직
  // 아무것도 안 썼을 때 헤더 글자만으로 false positive가 나는 걸
  // 막는다. "ready"는 기존과 동일하게 joinDayTexts 결과(planAText)
  // 기준 MIN_LEN을 그대로 쓴다(이미 있던 동작, 이번에 바꾸지 않음).
  useEffect(() => {
    if (!planAStartedFiredRef.current && typedLength(planADayTexts) > 0) {
      planAStartedFiredRef.current = true;
      trackPlanStarted("a", inputMode ?? "own_plan", planAInputMethod);
    }
    if (!planAReadyFiredRef.current && isPlanReady(planAText)) {
      planAReadyFiredRef.current = true;
      trackPlanReady("a", inputMode ?? "own_plan", planAInputMethod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planAText]);
  useEffect(() => {
    if (!planBStartedFiredRef.current && typedLength(planBDayTexts) > 0) {
      planBStartedFiredRef.current = true;
      trackPlanStarted("b", inputMode ?? "own_plan", planBInputMethod);
    }
    if (!planBReadyFiredRef.current && isPlanReady(planBText)) {
      planBReadyFiredRef.current = true;
      trackPlanReady("b", inputMode ?? "own_plan", planBInputMethod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planBText]);

  function startComparisonSession() {
    comparisonStartedAtRef.current = Date.now();
    planAReadyFiredRef.current = false;
    planBReadyFiredRef.current = false;
    planAStartedFiredRef.current = false;
    planBStartedFiredRef.current = false;
    flowSelectedFiredRef.current = false;
    lastFiredHelpfulnessRef.current = null;
    lastSavedHelpfulnessRef.current = null;
    setComparisonId(typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`);
    trackComparisonStarted();
  }

  // v1.0 — own_plan/sample 선택 시점을 잡는 flow_selected 1회성 발화
  // 헬퍼. setInputMode(mode)를 부르던 자리를 전부 이걸로 바꿔, 그
  // 비교 세션에서 처음 이 함수가 불릴 때만(flowSelectedFiredRef)
  // trackFlowSelected를 보내고, state 갱신(setInputMode)은 매번 그대로
  // 수행한다 — 실제 입력값(어느 day를 고쳤는지 등)에는 영향 없다.
  function markFlowSelected(mode: InputMode) {
    if (!flowSelectedFiredRef.current) {
      flowSelectedFiredRef.current = true;
      trackFlowSelected(mode);
    }
    setInputMode(mode);
  }

  function isPlanReady(text: string) {
    return text.length >= MIN_LEN && text.length <= MAX_LEN;
  }

  function handleChangePlanADuration(days: number) {
    setPlanADuration(days);
    setPlanAPasteDayTexts((prev) => resizeDayTexts(prev, days));
    setPlanARawTexts((prev) => resizeDayTexts(prev, days));
    setPlanAImages((prev) => resizeImages(prev, days));
    markFlowSelected("own_plan");
  }
  function handleChangePlanBDuration(days: number) {
    setPlanBDuration(days);
    setPlanBPasteDayTexts((prev) => resizeDayTexts(prev, days));
    setPlanBRawTexts((prev) => resizeDayTexts(prev, days));
    setPlanBImages((prev) => resizeImages(prev, days));
    markFlowSelected("own_plan");
  }

  // 버그 수정(2026-09-05, 2차) — 그 day가 이미지로 채워져 있었는데
  // 사용자가 텍스트 탭에서 직접 값을 고치면, 더 이상 "이미지에서 그대로
  // 추출된 내용"이 아니게 되므로 이미지 슬롯을 함께 비운다 — 수정한
  // 텍스트를 이미지에서 나온 것처럼 위장하지 않기 위함이다.
  // 버그 수정(2026-09-06, 2차) — 같은 이유로 그 day의 rawText(원문
  // 다시보기용)도 함께 비운다. 이미지가 없어졌으니 "이미지에서 읽은
  // 원문"이라는 값 자체가 더 이상 의미가 없다.
  function handleChangePlanAPasteText(index: number, value: string) {
    const next = [...planAPasteDayTexts];
    next[index] = value;
    setPlanAPasteDayTexts(next);
    setPlanARawTexts((prev) => prev.map((t, i) => (i === index ? "" : t)));
    setPlanAImages((prev) => prev.map((img, i) => (i === index ? null : img)));
    markFlowSelected("own_plan");
  }
  function handleChangePlanBPasteText(index: number, value: string) {
    const next = [...planBPasteDayTexts];
    next[index] = value;
    setPlanBPasteDayTexts(next);
    setPlanBRawTexts((prev) => prev.map((t, i) => (i === index ? "" : t)));
    setPlanBImages((prev) => prev.map((img, i) => (i === index ? null : img)));
    markFlowSelected("own_plan");
  }

  // 이미지 추출 성공 시 그 day의 텍스트/이미지 슬롯을 한 번에 채운다.
  // 버그 수정(2026-09-06, 2차) — itineraryText(선별된 값)를 비교용
  // day 텍스트 슬롯에 담아 이후 joinDayTexts/structure-plan을 그대로
  // 거치게 하고, rawText(전체 원문)는 별도 슬롯에 담아 "원문 다시보기"
  // 전용으로만 쓴다 — 실제 일정과 무관한 블로그 UI·감상 문장이
  // 비교 데이터에 섞이던 문제(2026-09-06 조사)의 근본 수정이다.
  function handleImageExtractedPlanA(index: number, dataUrl: string, itineraryText: string, rawText: string) {
    setPlanAPasteDayTexts((prev) => prev.map((t, i) => (i === index ? itineraryText : t)));
    setPlanARawTexts((prev) => prev.map((t, i) => (i === index ? rawText : t)));
    setPlanAImages((prev) => prev.map((img, i) => (i === index ? dataUrl : img)));
    markFlowSelected("own_plan");
  }
  function handleImageExtractedPlanB(index: number, dataUrl: string, itineraryText: string, rawText: string) {
    setPlanBPasteDayTexts((prev) => prev.map((t, i) => (i === index ? itineraryText : t)));
    setPlanBRawTexts((prev) => prev.map((t, i) => (i === index ? rawText : t)));
    setPlanBImages((prev) => prev.map((img, i) => (i === index ? dataUrl : img)));
    markFlowSelected("own_plan");
  }

  function handleLoadSample() {
    setPlanADuration(SAMPLE_PLAN_A_DAY_TEXTS.length);
    setPlanAPasteDayTexts([...SAMPLE_PLAN_A_DAY_TEXTS]);
    setPlanARawTexts(new Array(SAMPLE_PLAN_A_DAY_TEXTS.length).fill(""));
    setPlanAImages(new Array(SAMPLE_PLAN_A_DAY_TEXTS.length).fill(null));
    setPlanBDuration(SAMPLE_PLAN_B_DAY_TEXTS.length);
    setPlanBPasteDayTexts([...SAMPLE_PLAN_B_DAY_TEXTS]);
    setPlanBRawTexts(new Array(SAMPLE_PLAN_B_DAY_TEXTS.length).fill(""));
    setPlanBImages(new Array(SAMPLE_PLAN_B_DAY_TEXTS.length).fill(null));
    markFlowSelected("sample");
    trackSampleLoaded(1);
  }

  // durationOverride는 Input Exploration variant 전용 — setState 직후
  // 같은 tick에서 곧바로 제출하면 planADuration/planBDuration이 아직
  // 갱신 전 값(stale closure)일 수 있어, 방금 넘겨준 값을 analytics
  // 호출에 바로 쓸 수 있게 하는 우회로다. 나머지 로직(구조화 API 호출
  // 등)은 전부 그대로다 — handleProcessingComplete는 나중에(지연 후)
  // 실행되므로 그때는 이미 최신 state를 정상적으로 읽는다.
  function handleSubmitInput(durationOverride?: { a: number; b: number }) {
    trackComparisonRequested(
      inputMode ?? "own_plan",
      planAInputMethod,
      planBInputMethod,
      durationOverride?.a ?? planADuration,
      durationOverride?.b ?? planBDuration
    );
    processingStartedAtRef.current = Date.now();
    setStructuringFailure(null);
    setStep("processing");
  }

  // v1.0 dev — Input Exploration variant(StepInputExplorationDev) 전용.
  // 그 화면은 자기 안에서 두 입력 방식(붙여넣기/직접 일정 추가)을 이미
  // 하나의 일차별 자유 텍스트 배열로 합쳐서 넘겨준다 — 이 함수는 그
  // 결과를 기존 planADayTexts/planBDayTexts state에 그대로 반영한 뒤
  // 기존 handleSubmitInput을 그대로 호출할 뿐, 구조화 API 호출 방식
  // 자체는 바꾸지 않는다.
  function handleSubmitFromExploration(
    aDuration: number,
    aDayTexts: string[],
    bDuration: number,
    bDayTexts: string[]
  ) {
    setPlanADuration(aDuration);
    setPlanAPasteDayTexts(aDayTexts);
    setPlanARawTexts(new Array(aDuration).fill(""));
    setPlanAImages(new Array(aDuration).fill(null));
    setPlanBDuration(bDuration);
    setPlanBPasteDayTexts(bDayTexts);
    setPlanBRawTexts(new Array(bDuration).fill(""));
    setPlanBImages(new Array(bDuration).fill(null));
    markFlowSelected("own_plan");
    handleSubmitInput({ a: aDuration, b: bDuration });
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
      trackComparisonViewed(Date.now() - processingStartedAtRef.current, inputMode ?? "own_plan");
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
    // v1.0 — not_travel_content로 돌아와 내용을 고친 뒤 다시 제출하는
    // 것은 처음부터 다시 시작하는 것(handleRestart)과는 다르지만,
    // 계측 관점에서는 "새 비교 시도"로 본다 — 새 comparison_id를 받고
    // ready/started 1회성 가드도 다시 열려야, 고친 뒤 재제출했을 때
    // comparison_requested/plan_a_ready 등이 새 id로 온전히 다시
    // 기록된다. startComparisonSession()은 planA/B 입력값(duration/
    // 텍스트/item/입력 방식)은 전혀 건드리지 않으므로 "값 유지"
    // 요구사항과 충돌하지 않는다.
    startComparisonSession();
  }

  function handleReopenOriginal(plan: "a" | "b") {
    trackOriginalReopened(plan);
  }

  // 같은 값을 다시 눌러도(연속 클릭) 이벤트를 다시 보내지 않고, helpful
  // ↔ not_helpful처럼 실제로 값이 바뀔 때만 다시 보낸다 — 최종 선택
  // 상태를 그대로 분석할 수 있으면서도 중복 이벤트는 만들지 않는다.
  function handleComparisonHelpfulnessSelect(value: "helpful" | "not_helpful") {
    setComparisonHelpfulness(value);
    if (comparisonFeedbackSubmitted) setComparisonFeedbackSubmitted(false);
    if (lastFiredHelpfulnessRef.current === value) return;
    lastFiredHelpfulnessRef.current = value;
    trackComparisonHelpfulnessSelected(value, inputMode ?? "own_plan", planADuration, planBDuration);
  }

  // reason 텍스트를 고치면 이미 전송한 피드백과 내용이 어긋나므로,
  // 제출 상태를 무효화해 전송 아이콘을 다시 활성화한다(CTA는 이 상태와
  // 무관하게 항상 활성화 상태다).
  function handleChangeComparisonHelpfulnessReason(text: string) {
    setComparisonHelpfulnessReason(text);
    if (comparisonFeedbackSubmitted) setComparisonFeedbackSubmitted(false);
  }

  // 전송 아이콘 클릭 — Supabase(tripfit_comparison_feedback) INSERT가
  // 성공한 뒤에만 comparisonFeedbackSubmitted를 true로 바꾸고
  // comparison_helpfulness_submitted를 보낸다. 실패하면 상태를 그대로
  // 두고 에러 메시지만 보여줘 재시도할 수 있게 한다 — 일정 원문과
  // 마찬가지로 reason 원문은 Mixpanel 인자로 넘기지 않는다. 이 피드백은
  // 전체가 optional이라 CTA(결정하러 가기)는 이 함수 호출 여부와 무관하게
  // 항상 활성화되어 있다.
  async function handleSubmitComparisonFeedback() {
    if (comparisonHelpfulness === null || comparisonHelpfulnessReason.trim().length === 0) return;
    if (isSubmittingComparisonFeedback) return;

    setIsSubmittingComparisonFeedback(true);
    setComparisonFeedbackSubmitError(null);

    const { success } = await insertComparisonFeedback({
      testerMode: inputMode ?? "own_plan",
      comparisonHelpfulness,
      comparisonHelpfulnessReason,
      planADurationDays: planADuration,
      planBDurationDays: planBDuration,
      sessionId: getAnalyticsDistinctId(),
    });

    setIsSubmittingComparisonFeedback(false);

    if (!success) {
      setComparisonFeedbackSubmitError("저장하지 못했어요. 다시 시도해주세요.");
      return;
    }

    setComparisonFeedbackSubmitted(true);
    trackComparisonHelpfulnessSubmitted(
      comparisonHelpfulness,
      inputMode ?? "own_plan",
      planADuration,
      planBDuration
    );
  }

  function handleDecisionSelect(d: Decision) {
    setDecision(d);
    trackDecisionSubmitted(d, inputMode ?? "own_plan");
    setStep("reason");
  }

  function handleChangeCriteria(next: SelectedReasonId[]) {
    const added = next.find((id) => !selectedCriteria.includes(id));
    if (added) trackDecisionCriterionSelected(added);
    setSelectedCriteria(next);
  }

  // 3차 우선순위 — decision_reason_submitted는 기존과 동일하게 "다음"을
  // 누르는 즉시(제출 성공 여부와 무관하게) 발생한다(회귀 없음). 그
  // 다음이 예전과 달라진 지점: 이전엔 여기서 helpfulness 화면(rating)
  // 으로만 넘어가고 실제 Supabase 저장은 그 화면의 "제출하기"에서
  // 이뤄졌는데, 이제 helpfulness가 완료 화면으로 옮겨가면서 그 전에
  // decision/reason을 먼저 저장해야 완료 화면에 "제출 완료" 상태로
  // 도착할 수 있다. helpfulnessScore는 아직 모르므로 null로 보낸다 —
  // 완료 화면에서 고르면 handleSelectHelpfulness가 별도로 다시 저장한다.
  async function handleReasonNext() {
    if (!decision) return;
    trackDecisionReasonSubmitted(decision, reasonText.trim().length);

    if (isSubmittingReason) return;
    setIsSubmittingReason(true);
    setReasonSubmitError(null);

    const { success } = await insertUtResponse({
      testerMode: inputMode ?? "own_plan",
      decision,
      selectedCriteria,
      decisionReason: reasonText,
      helpfulnessScore: null,
      comparisonHelpfulness,
      comparisonHelpfulnessReason,
      comparisonId: getCurrentComparisonId(),
    });

    setIsSubmittingReason(false);

    if (!success) {
      setReasonSubmitError("제출에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    trackComparisonCompleted(Date.now() - comparisonStartedAtRef.current);
    setStep("complete");
  }

  // 3차 우선순위 — 완료 화면의 1~5 helpfulness. 별도 "제출하기" 버튼
  // 없이 숫자를 누르는 즉시 저장을 시도한다. decision/reason은 이미
  // handleReasonNext에서 저장됐지만, RLS가 anon key에 UPDATE를 허용하지
  // 않아(supabase.ts 주석) 그 행을 수정할 수 없다 — 그래서 helpfulness가
  // 포함된 완전한 스냅샷을 같은 insertUtResponse로 한 번 더 insert한다
  // (테이블/컬럼 구조는 그대로, 새 스키마 없음). 실패해도 helpfulness는
  // optional이라 화면 전환을 막지 않고, 에러만 조용히 보여준다 —
  // "새로 비교하기"는 이 성공 여부와 무관하게 항상 눌러야 한다.
  async function handleSelectHelpfulness(score: number) {
    setHelpfulness(score);
    if (lastSavedHelpfulnessRef.current === score) return;
    lastSavedHelpfulnessRef.current = score;
    if (decision === null) return;

    setIsSavingHelpfulness(true);
    setHelpfulnessSaveError(null);

    const { success } = await insertUtResponse({
      testerMode: inputMode ?? "own_plan",
      decision,
      selectedCriteria,
      decisionReason: reasonText,
      helpfulnessScore: score,
      comparisonHelpfulness,
      comparisonHelpfulnessReason,
      comparisonId: getCurrentComparisonId(),
    });

    setIsSavingHelpfulness(false);

    if (!success) {
      setHelpfulnessSaveError("저장하지 못했어요. 다시 시도해주세요.");
      return;
    }

    trackHelpfulnessSubmitted(score);
  }

  function handleRestart() {
    setStep("input");
    setPlanADuration(null);
    setPlanAPasteDayTexts([]);
    setPlanARawTexts([]);
    setPlanAImages([]);
    setPlanBDuration(null);
    setPlanBPasteDayTexts([]);
    setPlanBRawTexts([]);
    setPlanBImages([]);
    setInputMode(null);
    setComparisonResult(null);
    setComparisonHelpfulness(null);
    setComparisonHelpfulnessReason("");
    setComparisonFeedbackSubmitted(false);
    setIsSubmittingComparisonFeedback(false);
    setComparisonFeedbackSubmitError(null);
    setStructuringFailure(null);
    setFocusPlan(null);
    setDecision(null);
    setSelectedCriteria([]);
    setReasonText("");
    setHelpfulness(null);
    setIsSubmittingReason(false);
    setReasonSubmitError(null);
    setIsSavingHelpfulness(false);
    setHelpfulnessSaveError(null);
    startComparisonSession();
  }

  function hasInProgressData() {
    return (
      planADuration !== null ||
      planBDuration !== null ||
      planAPasteDayTexts.some((t) => t.trim().length > 0) ||
      planBPasteDayTexts.some((t) => t.trim().length > 0)
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
            planAPasteDayTexts={planAPasteDayTexts}
            planAImages={planAImages}
            planADayTexts={planADayTexts}
            onChangePlanADuration={handleChangePlanADuration}
            onChangePlanAPasteText={handleChangePlanAPasteText}
            onImageExtractedPlanA={handleImageExtractedPlanA}
            planBDuration={planBDuration}
            planBPasteDayTexts={planBPasteDayTexts}
            planBImages={planBImages}
            planBDayTexts={planBDayTexts}
            onChangePlanBDuration={handleChangePlanBDuration}
            onChangePlanBPasteText={handleChangePlanBPasteText}
            onImageExtractedPlanB={handleImageExtractedPlanB}
            onLoadSample={handleLoadSample}
            onSubmit={handleSubmitInput}
            onFeedbackClick={() => setStep("feedback")}
            onLogoClick={handleLogoClick}
            autoFocusPlan={focusPlan}
            onAutoFocusConsumed={() => setFocusPlan(null)}
          />
        )}

        {/* v1.0 dev — StepInput의 진입 버튼은 제거했지만(사용자 화면
            노출 경로 없음), 코드 기록용으로 이 화면/경로 자체는 그대로
            남겨둔다. setStep("inputExploration")을 부르는 곳이 이제
            없어 도달 불가능하다. */}
        {step === "inputExploration" && (
          <StepInputExplorationDev onBack={() => setStep("input")} onSubmit={handleSubmitFromExploration} />
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
            planADayTexts={planADayTexts}
            planARawTexts={planARawTexts}
            planAImages={planAImages}
            planBDayTexts={planBDayTexts}
            planBRawTexts={planBRawTexts}
            planBImages={planBImages}
            onBack={() => setStep("input")}
            onNext={() => setStep("decision")}
            onReopenOriginal={handleReopenOriginal}
            comparisonHelpfulness={comparisonHelpfulness}
            onSelectComparisonHelpfulness={handleComparisonHelpfulnessSelect}
            comparisonHelpfulnessReason={comparisonHelpfulnessReason}
            onChangeComparisonHelpfulnessReason={handleChangeComparisonHelpfulnessReason}
            comparisonFeedbackSubmitted={comparisonFeedbackSubmitted}
            isSubmittingComparisonFeedback={isSubmittingComparisonFeedback}
            comparisonFeedbackSubmitError={comparisonFeedbackSubmitError}
            onSubmitComparisonFeedback={handleSubmitComparisonFeedback}
            onOpenRouteCompare={(day) => {
              setRouteCompareDay(day);
              setStep("routeCompare");
            }}
            onOpenSwipeExperiment={() => setStep("resultSwipeExperiment")}
          />
        )}

        {step === "routeCompare" && routeCompareDay !== null && (
          <RouteCompareDev day={routeCompareDay} onBack={() => setStep("result")} />
        )}

        {step === "resultSwipeExperiment" && comparisonResult && (
          <ResultSwipeVariantDev result={comparisonResult} onBack={() => setStep("result")} />
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
            isSubmitting={isSubmittingReason}
            submitError={reasonSubmitError}
          />
        )}

        {step === "complete" && (
          <StepComplete
            decision={decision}
            selectedCriteria={selectedCriteria}
            reasonText={reasonText}
            helpfulness={helpfulness}
            onSelectHelpfulness={handleSelectHelpfulness}
            isSavingHelpfulness={isSavingHelpfulness}
            helpfulnessSaveError={helpfulnessSaveError}
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
