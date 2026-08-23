import type { PlanStructure } from "@/types/plan";

// /api/structure-plan(서버 Route Handler)만 호출한다 — LLM API를
// 브라우저에서 직접 호출하지 않는다. 실패 시 더미 파서로 조용히
// fallback하지 않고, 호출부(page.tsx)가 실패 상태를 그대로 보여줄 수
// 있도록 타입이 있는 에러를 던진다.
export type StructuringErrorType =
  | "bad_request"
  | "config_error"
  | "invalid_response"
  | "api_error"
  | "network"
  | "not_travel_content"
  | "timeout";

export class StructuringError extends Error {
  type: StructuringErrorType;
  constructor(type: StructuringErrorType, message: string) {
    super(message);
    this.type = type;
  }
}

export async function requestPlanStructuring(
  planAText: string,
  planBText: string
): Promise<{ planA: PlanStructure; planB: PlanStructure }> {
  let response: Response;
  try {
    response = await fetch("/api/structure-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planAText, planBText }),
    });
  } catch {
    throw new StructuringError("network", "네트워크 연결을 확인해주세요.");
  }

  if (!response.ok) {
    let type: StructuringErrorType = "api_error";
    let message = "일정을 구조화하지 못했어요. 잠시 후 다시 시도해주세요.";
    try {
      const body = await response.json();
      if (body?.error?.type) type = body.error.type;
      if (body?.error?.message) message = body.error.message;
    } catch {
      // 응답 본문을 못 읽어도 기본 메시지로 진행한다.
    }
    throw new StructuringError(type, message);
  }

  const data = await response.json();
  return data as { planA: PlanStructure; planB: PlanStructure };
}
