import { createClient } from "@supabase/supabase-js";
import type { ComparisonCriterionId, Decision, InputMode } from "@/types/plan";

// 브라우저에 노출돼도 안전한 anon/publishable key만 쓴다 — service_role/
// secret key/DB 비밀번호는 여기 들어오면 안 된다. 두 테이블 모두 RLS로
// anonymous는 INSERT만 가능하도록 이미 설정돼 있어(Supabase 쪽 policy),
// 클라이언트에서 이 키로 할 수 있는 일은 그 범위로 제한된다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const APP_VERSION = "0.7";

export type UtResponseInput = {
  testerMode: InputMode;
  decision: Decision;
  selectedCriteria: ComparisonCriterionId[];
  decisionReason: string;
  helpfulnessScore: number | null;
};

/** UT 응답 하나를 tripfit_ut_responses에 저장한다. 일정 원문(Plan A/B)이나
 *  비교 결과(장소/시간/비용)는 절대 포함하지 않는다 — 이 함수의 인자
 *  타입 자체에 그 값을 받는 필드가 없다. Supabase client가 아예 없으면
 *  (환경변수 미설정) 즉시 실패로 처리해 호출부가 완료 화면으로 넘어가지
 *  않고 재시도 안내를 보여줄 수 있게 한다. */
export async function insertUtResponse(input: UtResponseInput): Promise<{ success: boolean }> {
  if (!supabase) return { success: false };

  const { error } = await supabase.from("tripfit_ut_responses").insert({
    app_version: APP_VERSION,
    tester_mode: input.testerMode,
    decision: input.decision,
    selected_criteria: input.selectedCriteria,
    decision_reason: input.decisionReason,
    helpfulness_score: input.helpfulnessScore,
  });

  return { success: !error };
}

export type ServiceFeedbackInput = {
  feedbackText: string;
  sourceScreen: string;
};

/** 일반 의견 하나를 tripfit_service_feedback에 저장한다. created_at은
 *  DB default를 쓰므로 여기서 만들지 않는다. insertUtResponse와 동일한
 *  이유로 일정 원문/비교 결과를 받는 필드 자체가 없다. */
export async function insertServiceFeedback(input: ServiceFeedbackInput): Promise<{ success: boolean }> {
  if (!supabase) return { success: false };

  const { error } = await supabase.from("tripfit_service_feedback").insert({
    app_version: APP_VERSION,
    feedback_text: input.feedbackText,
    source_screen: input.sourceScreen,
  });

  return { success: !error };
}
