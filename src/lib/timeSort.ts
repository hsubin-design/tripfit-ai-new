import type { PlanItem } from "@/types/plan";

// v1.0 explicit time sorting. "명시적 시각"만 정렬 기준으로 쓴다 — 숫자로
// 구체적인 시각을 알 수 있는 표현("10:00", "오전 10시", "12시 30분")만
// 인정하고, "오전"/"오후"/"저녁"/"밤"처럼 숫자 없는 막연한 시간대 표현은
// 정렬 근거로 쓰지 않는다(추론 금지 가드레일 — 없는 정밀도를 만들어내지
// 않는다). dummyComparison.ts의 파싱 규칙과 같은 "숫자 시각만 명시적"
// 기준을 그대로 따른다.
const EXPLICIT_TIME_SHAPE =
  /^(?:(오전|오후)\s?(\d{1,2}):(\d{2})|(\d{1,2}):(\d{2})|(오전|오후)\s?(\d{1,2})시(?:\s?(\d{1,2})분)?|(\d{1,2})시(?:\s?(\d{1,2})분)?)$/;

/** 원문 시간 문자열이 "명시적 시각"이면 하루 중 분(0~1439)을, 아니면
 *  null을 반환한다. AM/PM 없이 "시"만 있는 표기(예: "9시")는 새벽~오전
 *  9시로 본다 — 원문에 오전/오후가 없으면 그 정보를 만들어내지 않고
 *  단순히 24시간제 그대로 읽는다(9시=09:00). "12시"는 자정이 아니라
 *  낮 12시(정오)로 해석한다 — 여행 일정 맥락에서 자정에 활동이 시작되는
 *  경우는 거의 없고, 원문에 "밤 12시"처럼 명시가 있으면 그 표현 자체가
 *  다른 분기(오전/오후 없는 "12시")로 들어와 이 함수만으로는 자정/정오를
 *  구분할 근거가 없다 — 그래서 모호한 단독 "12시"는 정렬 근거로 쓰기에
 *  안전하지 않다고 보고 명시적 시각에서 제외한다(null 반환). */
export function explicitTimeToMinutes(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const m = trimmed.match(EXPLICIT_TIME_SHAPE);
  if (!m) return null;

  // group 1-3: (오전|오후) H:MM
  if (m[2] !== undefined) {
    const ampm = m[1];
    let h = Number(m[2]);
    const min = Number(m[3]);
    if (h === 12) h = ampm === "오전" ? 0 : 12;
    else if (ampm === "오후") h += 12;
    return h * 60 + min;
  }
  // group 4-5: bare H:MM (24h, no am/pm marker in source)
  if (m[4] !== undefined) {
    const h = Number(m[4]);
    const min = Number(m[5]);
    if (h > 23) return null;
    return h * 60 + min;
  }
  // group 6-8: (오전|오후) H시(M분)
  if (m[7] !== undefined) {
    const ampm = m[6];
    let h = Number(m[7]);
    const min = m[8] ? Number(m[8]) : 0;
    if (h === 12) h = ampm === "오전" ? 0 : 12;
    else if (ampm === "오후") h += 12;
    return h * 60 + min;
  }
  // group 9-10: bare "N시(M분)" — ambiguous 12시 alone is excluded (see doc comment).
  if (m[9] !== undefined) {
    const h = Number(m[9]);
    const min = m[10] ? Number(m[10]) : 0;
    if (h === 12) return null;
    if (h > 23) return null;
    return h * 60 + min;
  }
  return null;
}

export function isExplicitTime(raw: string | null): boolean {
  return explicitTimeToMinutes(raw) !== null;
}

/** 명시적 시각 표시 형식을 "오전 10시" / "오후 6시" / "오후 3시 30분"으로
 *  통일한다. 명시적 시각이 아니면(예: "오후", "저녁") 원문을 그대로
 *  돌려준다 — 형식을 억지로 맞추지 않는다. */
export function formatExplicitTime(raw: string): string {
  const minutes = explicitTimeToMinutes(raw);
  if (minutes === null) return raw;
  const h24 = Math.floor(minutes / 60);
  const min = minutes % 60;
  const ampm = h24 < 12 ? "오전" : "오후";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return min === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}시 ${min}분`;
}

export type SortableItem<T> = { item: T; originalIndex: number };

/** 명시적 시각이 있는 item은 시각 오름차순으로, 없는 item은 서로의
 *  원래 순서를 유지한 채 뒤로 보낸다 — "시간 없는 항목끼리는 입력
 *  순서 유지"를 가장 단순하고 예측 가능한 방식으로 만족시키는 안정
 *  정렬이다. (해석 메모: 명시적 시각 항목과 미기재 항목이 뒤섞여 있을
 *  때 "그 사이 어디에 끼워 넣을지"는 요구사항에 명시되어 있지 않아,
 *  가장 예측하기 쉬운 "시각 있는 것 전부 먼저(시간순) → 미기재 전부
 *  뒤(입력순)"로 해석했다.) */
export function sortItemsByExplicitTime<T extends Pick<PlanItem, "time">>(items: T[]): T[] {
  const withIndex: SortableItem<T>[] = items.map((item, originalIndex) => ({ item, originalIndex }));
  const explicit = withIndex.filter((x) => isExplicitTime(x.item.time));
  const missing = withIndex.filter((x) => !isExplicitTime(x.item.time));

  explicit.sort((a, b) => {
    const diff = explicitTimeToMinutes(a.item.time)! - explicitTimeToMinutes(b.item.time)!;
    return diff !== 0 ? diff : a.originalIndex - b.originalIndex;
  });
  missing.sort((a, b) => a.originalIndex - b.originalIndex);

  return [...explicit, ...missing].map((x) => x.item);
}
