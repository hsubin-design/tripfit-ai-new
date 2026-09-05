import mixpanel from "mixpanel-browser";
import type { Decision, InputMode, SelectedReasonId } from "@/types/plan";
import { APP_VERSION } from "@/lib/appVersion";

let initialized = false;

// v1.0 — 한 번의 비교 시도(입력 시작~완료/재시작 전까지)를 묶어서 볼 수
// 있는 id. distinct_id(기기 단위)만으로는 같은 사람이 여러 번 재시작한
// 시도를 구분할 수 없어 추가한다. startComparisonSession()에서만
// 새로 생성/교체하고, 그 사이 발생하는 모든 이벤트에 track()이 자동으로
// 실어 보낸다 — 이벤트 하나하나에 인자로 넘길 필요가 없다.
let currentComparisonId: string | null = null;
export function setComparisonId(id: string | null) {
  currentComparisonId = id;
}

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
  mixpanel.track(event, {
    ...(currentComparisonId ? { comparison_id: currentComparisonId } : {}),
    ...props,
  });
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

// v1.0 — sample/own_plan 쪽은 flow_mode로, text/image 입력 방식 쪽은
// input_mode로 부른다(서로 다른 축이라 이름이 겹치면 분석 시 헷갈린다).
// 버그 수정(2026-09-05) — 링크/파일(PDF·TXT) 탭을 걷어내고 텍스트/이미지
// 두 방식만 남기면서, 이 타입의 실제 의미도 "paste vs manual"(예전
// 직접 일정 추가 모드, 이미 제거됨)에서 "text vs image"로 바뀌었다.
// 필드 이름(plan_a_input_mode 등)과 이벤트 스키마는 그대로 두고 값만
// 바꿨다 — 기존 분석 파이프라인이 이 필드를 참조하는 방식은 안 깨진다.
export type PlanInputMethod = "text" | "image";

export function trackPlanReady(plan: "a" | "b", flowMode: InputMode, method: PlanInputMethod) {
  track(plan === "a" ? "plan_a_ready" : "plan_b_ready", { flow_mode: flowMode, input_mode: method });
}

// plan_a_ready/plan_b_ready보다 먼저, 그 플랜에 뭔가 처음 입력되는
// 순간(빈 값 → 비어있지 않은 값)을 본다 — "입력 방식 선택 → 입력 시작
// → 완료 → 비교 요청" 퍼널의 두 번째 단계.
export function trackPlanStarted(plan: "a" | "b", flowMode: InputMode, method: PlanInputMethod) {
  track(plan === "a" ? "plan_a_started" : "plan_b_started", { flow_mode: flowMode, input_mode: method });
}

// 기본값이 paste라 이 이벤트 자체가 "실제로 어떤 방식을 썼는지"의
// 근거는 아니다(그건 plan_a_ready 등의 input_mode로 본다) — 오직
// "모드를 실제로 바꾼 행동"만 본다. 값이 실제로 바뀔 때만 호출부에서
// 불러야 한다(같은 값 재클릭은 여기로 오지 않음). 이름을
// input_method_selected → input_method_changed로 바꿨다 — 이 이벤트가
// 아직 커밋/배포된 적이 없어(uncommitted, preview 브랜치) 실제 Mixpanel
// 데이터가 없으므로 이름을 바꿔도 기존 분석에 영향이 없다는 걸 git
// history로 확인한 뒤 진행했다. flow_mode/app_version을 추가해 다른
// funnel 이벤트와 같은 필드 구성을 갖추고, comparison_id는 track()이
// 자동으로 실어 보낸다.
export function trackInputMethodChanged(
  plan: "a" | "b",
  fromMethod: PlanInputMethod,
  toMethod: PlanInputMethod,
  flowMode: InputMode
) {
  track("input_method_changed", {
    plan,
    from_method: fromMethod,
    to_method: toMethod,
    flow_mode: flowMode,
    app_version: APP_VERSION,
  });
}

// 버그 수정(2026-09-05) — 이미지 입력을 실제 비교 플로우에 연결하면서
// 추가한 3개 이벤트. 이미지 안 내용(추출된 일정 텍스트)은 어떤 인자로도
// 받지 않는다 — 원문/자유서술 텍스트를 Mixpanel에 싣지 않는다는 기존
// 가드레일과 동일하게 적용한다. comparison_requested보다 반드시 먼저
// (그리고 별도로) 발화된다 — 이미지 선택 즉시 추출을 시도하는 시점에
// 붙어 있어, 이미지를 고르기만 하고 실제 비교까지 가지 않은 시도도
// 놓치지 않고 잡을 수 있다. image_parse_failed가 나면 그 day의 텍스트
// 슬롯이 채워지지 않아 CTA가 활성화되지 않으므로, comparison_requested는
// 구조적으로 그 실패 건에서는 절대 나중에 발화되지 않는다(별도 방지
// 로직이 필요 없다).
export function trackImageParseStarted(plan: "a" | "b") {
  track("image_parse_started", { plan });
}

export function trackImageParseSucceeded(plan: "a" | "b") {
  track("image_parse_succeeded", { plan });
}

// reason은 에러 타입 문자열(예: "unreadable"/"api_error"/"timeout")만
// 담고, 이미지 내용이나 실패 원인 문장 원문은 담지 않는다.
export function trackImageParseFailed(plan: "a" | "b", reason: string) {
  track("image_parse_failed", { plan, reason });
}

// 일차별 입력 구조 실험(2026-08-24) — 여행 기간은 사용자가 이미 선택한
// 값(숫자, PII/원문 아님)이라 comparison_requested에 속성만 추가한다.
// 새 이벤트를 만들지 않고 기존 funnel 이벤트 이름/순서는 그대로 둔다.
// v1.0에서 flow_mode(sample/own_plan)와 플랜별 input_mode(text/image)를
// 함께 실어, 제출 시점 기준으로 "무엇으로 입력을 완성했는지"를 한 이벤트
// 에서 바로 볼 수 있게 한다. 이 이벤트는 사용자가 실제로 CTA를 눌러
// 비교 요청까지 도달했을 때만 발화된다(handleSubmitInput) — 이미지를
// 선택/첨부만 한 시점에는 절대 발화되지 않는다.
export function trackComparisonRequested(
  flowMode: InputMode,
  planAInputMethod: PlanInputMethod,
  planBInputMethod: PlanInputMethod,
  planADurationDays?: number | null,
  planBDurationDays?: number | null
) {
  track("comparison_requested", {
    flow_mode: flowMode,
    plan_a_input_mode: planAInputMethod,
    plan_b_input_mode: planBInputMethod,
    app_version: APP_VERSION,
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

export function trackDecisionCriterionSelected(criterion: SelectedReasonId) {
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
