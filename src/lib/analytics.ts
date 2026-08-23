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

export function trackComparisonRequested(inputMode: InputMode) {
  track("comparison_requested", { input_mode: inputMode });
}

export function trackComparisonViewed(processingTimeMs: number) {
  track("comparison_viewed", { processing_time_ms: processingTimeMs });
}

export function trackOriginalReopened(plan: "a" | "b") {
  track("original_reopened", { plan });
}

// PRD 9번(Mixpanel 이벤트 표)에 이미 정의돼 있던 `comparison_failed`
// (error_type) — M2 이전에는 구조화가 실패할 수 없어(더미 파서) 쓰이지
// 않았고, 이제 실제 LLM 호출이 실패할 수 있으므로 연결한다.
export function trackComparisonFailed(errorType: string) {
  track("comparison_failed", { error_type: errorType });
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
