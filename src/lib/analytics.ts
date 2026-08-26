import mixpanel from "mixpanel-browser";
import type { ComparisonCriterionId, Decision, InputMode } from "@/types/plan";
import { APP_VERSION } from "@/lib/appVersion";

let initialized = false;

/**
 * autocapture/session replay/기본 pageview 자동 이벤트는 모두 끈다 —
 * 화면 텍스트(일정 원문 등)를 그대로 수집할 수 있어 PRD 9의 "원문·
 * 자유서술 텍스트 미전송" 가드레일과 충돌한다. 이벤트는 아래 정의된
 * PRD 고정 이벤트만 명시적으로 track한다.
 */
export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) return;

  mixpanel.init(token, {
    autocapture: false,
    record_sessions_percent: 0,
    track_pageview: false,
    persistence: "localStorage",
  });
  initialized = true;
}

function getDeviceType(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

function track(event: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  mixpanel.track(event, props);
}

// tripfit_comparison_feedback의 session_id로 재사용하는, Mixpanel이
// 이미 관리하는 기기 단위 식별자 — comparison_started의 participant_id와
// 같은 값이다(개인정보·일정 원문 아님, 새 식별자를 따로 만들지 않는다).
// 초기화 전(토큰 미설정 등)이면 null.
export function getAnalyticsDistinctId(): string | null {
  if (!initialized) return null;
  return mixpanel.get_distinct_id();
}

export function trackComparisonStarted() {
  if (!initialized) return;
  track("comparison_started", {
    app_version: `v${APP_VERSION}`,
    participant_id: mixpanel.get_distinct_id(),
    device_type: getDeviceType(),
  });
}

export function trackSampleLoaded(sampleOrder: number) {
  track("sample_loaded", { sample_order: sampleOrder });
}

export function trackPlanReady(plan: "a" | "b", inputMode: InputMode) {
  track(plan === "a" ? "plan_a_ready" : "plan_b_ready", { input_mode: inputMode });
}

// 일차별 입력 구조 실험(2026-08-24) — 여행 기간은 사용자가 이미 선택한
// 값(숫자, PII/원문 아님)이라 comparison_requested에 속성만 추가한다.
// 새 이벤트를 만들지 않고 기존 funnel 이벤트 이름/순서는 그대로 둔다.
export function trackComparisonRequested(
  inputMode: InputMode,
  planADurationDays?: number | null,
  planBDurationDays?: number | null
) {
  track("comparison_requested", {
    input_mode: inputMode,
    ...(planADurationDays != null ? { plan_a_duration_days: planADurationDays } : {}),
    ...(planBDurationDays != null ? { plan_b_duration_days: planBDurationDays } : {}),
  });
}

export function trackComparisonViewed(processingTimeMs: number) {
  track("comparison_viewed", { processing_time_ms: processingTimeMs });
}

export function trackOriginalReopened(plan: "a" | "b") {
  track("original_reopened", { plan });
}

// 비교 결과 화면 자체의 유용성(후행지표) — 최종 의사결정 완료율/유보율과는
// 별개 지표라 helpfulness_submitted(1~5, 최종 단계)와 이름을 겹치지 않게
// comparison_ 접두사를 붙였다. helpful/not_helpful 사이를 변경하면 그때마다
// 다시 보내 최종 선택 상태를 알 수 있게 하고(호출부에서 동일 값 재클릭만
// 걸러낸다), 여행 일정 원문/자유서술 텍스트는 싣지 않는다.
export function trackComparisonHelpfulnessSelected(
  helpfulness: "helpful" | "not_helpful",
  testerMode: InputMode,
  planADurationDays: number | null,
  planBDurationDays: number | null
) {
  track("comparison_helpfulness_selected", {
    helpfulness,
    tester_mode: testerMode,
    ...(planADurationDays != null ? { plan_a_duration_days: planADurationDays } : {}),
    ...(planBDurationDays != null ? { plan_b_duration_days: planBDurationDays } : {}),
    app_version: APP_VERSION,
    source_screen: "comparison_result",
  });
}

// comparison_helpfulness_selected(버튼 선택)와 구분되는, 전송 아이콘을
// 눌러 Supabase(tripfit_comparison_feedback) 저장까지 성공했을 때만
// 보내는 이벤트 — 호출부(page.tsx)가 insert 성공 콜백 안에서만 부른다.
// comparison_helpfulness_reason 원문은 인자로도 받지 않는다.
export function trackComparisonHelpfulnessSubmitted(
  helpfulness: "helpful" | "not_helpful",
  testerMode: InputMode,
  planADurationDays: number | null,
  planBDurationDays: number | null
) {
  track("comparison_helpfulness_submitted", {
    helpfulness,
    tester_mode: testerMode,
    ...(planADurationDays != null ? { plan_a_duration_days: planADurationDays } : {}),
    ...(planBDurationDays != null ? { plan_b_duration_days: planBDurationDays } : {}),
    app_version: APP_VERSION,
    source_screen: "comparison_result",
  });
}

// PRD 9번(Mixpanel 이벤트 표)에 이미 정의돼 있던 `comparison_failed`
// (error_type) — M2 이전에는 구조화가 실패할 수 없어(더미 파서) 쓰이지
// 않았고, 이제 실제 LLM 호출이 실패할 수 있으므로 연결한다.
export function trackComparisonFailed(errorType: string) {
  track("comparison_failed", { error_type: errorType });
}

// comparison_viewed → decision_viewed 시간 차이로 "비교 결과 화면
// 체류시간"을 볼 수 있게 하려고 추가한 이벤트(2026-08-24) — decision
// 화면에 결정을 내리기까지 걸리는 시간(decision_submitted와의 차이)과
// 섞이지 않도록 결과 화면 이탈 시점을 별도로 남긴다. 결정 화면에
// 진입할 때(mount) 1회만 보내고, 뒤로가기로 다시 들어오면 새 진입으로
// 다시 보낸다(원문 이름/규모 등 여행 일정 관련 값은 담지 않는다).
export function trackDecisionViewed() {
  track("decision_viewed");
}

export function trackDecisionSubmitted(decision: Decision) {
  track("decision_submitted", { decision });
}

export function trackDecisionCriterionSelected(criterion: ComparisonCriterionId) {
  track("decision_criterion_selected", { criterion });
}

export function trackDecisionReasonSubmitted(decision: Decision, reasonLength: number) {
  track("decision_reason_submitted", { decision, reason_length: reasonLength });
}

export function trackHelpfulnessSubmitted(score: number) {
  track("helpfulness_submitted", { score });
}

export function trackComparisonCompleted(timeToCompleteMs: number) {
  track("comparison_completed", { time_to_complete_ms: timeToCompleteMs });
}

// 의견 보내기 이벤트는 요구사항에 "0.7"(접두 v 없이)로 명시돼 있어,
// comparison_started가 쓰는 형식("v0.7")과 다르다 — 값의 출처(APP_VERSION)는
// 하나로 공유하되, 접두사 유무만 이벤트별로 다르게 붙인다. feedback_text
// 원문은 어떤 이벤트에도 실어 보내지 않는다(가드레일) — 아래 두 함수의
// 인자 자체에 원문을 받는 자리가 없다.
export function trackFeedbackOpened(sourceScreen: string) {
  track("feedback_opened", { source_screen: sourceScreen, app_version: APP_VERSION });
}

export function trackFeedbackSubmitted(sourceScreen: string, feedbackLength: number) {
  track("feedback_submitted", {
    source_screen: sourceScreen,
    app_version: APP_VERSION,
    feedback_length: feedbackLength,
  });
}
