// 일차별 입력 구조 실험(2026-08-24, "이사님 피드백") 전용 헬퍼.
// Plan A/B를 "여행 기간 선택 + 일차별 자유 텍스트"로 입력받되, 실제
// 구조화 API(/api/structure-plan)는 여전히 하나의 문자열을 받는다 —
// 백엔드 프롬프트/스키마를 다시 설계하지 않기 위해, 프런트에서 이미
// "N일차" 헤더를 명시적으로 붙여 기존 API가 인식하는 형태로 조합해
// 보낸다(route.ts 프롬프트 규칙 7이 "1일차"/"2일차" 마커를 그대로
// day 구분자로 인식). 사용자가 이미 기간을 선택했으므로 LLM이 일차
// 수를 다시 추론할 필요가 없다.

export function joinDayTexts(dayTexts: string[]): string {
  return dayTexts.map((text, i) => `${i + 1}일차\n${text.trim()}`).join("\n\n");
}

// 여행 기간(일수)이 바뀔 때 이미 입력된 일차별 텍스트가 다른 날로
// 밀리거나 복사되지 않도록, 각 인덱스의 값은 그대로 두고 뒤쪽만
// 자르거나 빈 문자열로 채운다.
export function resizeDayTexts(current: string[], newLength: number): string[] {
  const next = current.slice(0, newLength);
  while (next.length < newLength) next.push("");
  return next;
}

export function allDaysFilled(dayTexts: string[]): boolean {
  return dayTexts.length > 0 && dayTexts.every((t) => t.trim().length > 0);
}
