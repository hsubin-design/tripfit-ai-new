import mixpanel from "mixpanel-browser";
import type { ComparisonCriterionId, Decision, InputMode } from "@/types/plan";

let initialized = false;

const APP_VERSION = "v0.7";

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
    app_version: APP_VERSION,
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
