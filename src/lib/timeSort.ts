import type { PlanItem } from "@/types/plan";

// v1.0 explicit time sorting. "명시적 시각"만 정렬 기준으로 쓴다 — 숫자로
// 구체적인 시각을 알 수 있는 표현("10:00", "오전 10시", "저녁 6시",
// "12시 30분")만 인정하고, "오전"/"오후"/"저녁"/"밤"처럼 숫자 없이 단어만
// 있는 막연한 시간대 표현은 정렬 근거로 쓰지 않는다(추론 금지 가드레일 —
// 없는 정밀도를 만들어내지 않는다).
//
// 버그 수정(2026-09-04) — AM/PM 표지 단어를 "오전"/"오후" 두 개로만
// 인정했던 게 버그였다. "저녁 6시"/"아침 7시"/"밤 9시"/"새벽 4시"처럼
// 원문에 실제 숫자 시각이 있는데도 표지 단어가 오전/오후가 아니라는
// 이유만으로 "명시적이지 않음"으로 취급돼, 상세 타임라인 정렬·요약
// 카드의 "일정 시간" earliest~latest 계산·AI 핵심 차이의 "시간 정보
// 구체성" 개수가 전부 그 항목을 누락한 채 계산되고 있었다(세 곳 모두
// 이 함수 하나를 공유하므로 버그도 하나, 수정도 하나로 충분하다).
// 아침/새벽은 오전과, 저녁/밤은 오후와 같은 AM/PM 의미로 취급한다 —
// 새 시각을 추론하는 게 아니라 원문에 이미 있는 단어의 자연스러운
// 뜻(저녁 6시 = 18:00)을 그대로 읽는 것뿐이다. "정오"는 뒤에 숫자가
// 붙는 관용구가 아니라서(정오 자체가 12시라는 뜻) 이 패턴 대상에
// 포함하지 않는다 — 별도 규칙 없이 새 해석을 만들지 않기 위함.
//
// 버그 수정(2026-09-04, 2차) — "점심"이 이 표지 단어 목록에서 빠져
// 있었다. "점심 1시"처럼 원문에 실제 숫자 시각이 있어도 "점심"이
// TIME_OF_DAY_MARKER에 없어 정규식 자체가 매칭되지 않았고, 그 결과
// (1) 상세 타임라인 정렬에서 명시 시각 없는 항목으로 취급돼 맨 뒤로
// 밀리고, (2) 이 함수 하나를 공유하는 시간 정보 구체성 카운트
// (dummyComparison.ts의 explicitTimeCount)에서도 함께 누락됐다. 점심은
// 관례상 정오~오후 시간대이므로 오후와 같은 PM 의미로 취급한다(점심
// 1시 = 13:00) — "숫자 없는 점심"(예: "점심 식사한다")은 여전히 이
// 정규식 자체가 요구하는 "표지+숫자+시" 모양이 아니므로 매칭되지
// 않아, 임의 시각을 만들어내는 것과는 무관하다.
// 버그 수정(2026-09-04, 3차) — "9:00 am"/"1:00 PM"처럼 영문 12시간제
// am/pm 표기는 이 정규식 어느 분기에도 없어 전혀 매칭되지 않았다(기존
// 분기는 전부 "HH:MM"(24시간제) 또는 한글 표지+숫자 조합만 인식). 새
// 분기(group 11-13)를 마지막에 추가하고 대소문자 무관 매칭을 위해 "i"
// 플래그를 추가했다 — 기존 분기는 전부 한글/숫자만 다뤄 "i" 플래그
// 추가로 인한 동작 변화가 없다(대소문자 구분이 의미 있는 문자가 그
// 분기들엔 없음). 24시간제 "HH:MM"(09:00, 13:00, 16:00 등)은 이미
// bare H:MM 분기(group 4-5)가 인식해 정상 동작하고 있었다(조사로
// 확인됨) — 이 부분은 변경하지 않았다.
const PM_WORDS = new Set(["오후", "저녁", "밤", "점심"]);
const TIME_OF_DAY_MARKER = "오전|오후|아침|저녁|밤|새벽|점심";
const EXPLICIT_TIME_SHAPE = new RegExp(
  `^(?:(${TIME_OF_DAY_MARKER})\\s?(\\d{1,2}):(\\d{2})|(\\d{1,2}):(\\d{2})|(${TIME_OF_DAY_MARKER})\\s?(\\d{1,2})시(?:\\s?(\\d{1,2})분)?|(\\d{1,2})시(?:\\s?(\\d{1,2})분)?|(\\d{1,2}):(\\d{2})\\s?([ap]m))$`,
  "i"
);

/** 원문 시간 문자열이 "명시적 시각"이면 하루 중 분(0~1439)을, 아니면
 *  null을 반환한다. AM/PM 표지 없이 "시"만 있는 표기(예: "9시")는
 *  원문에 오전/오후 등 표지가 없으면 그 정보를 만들어내지 않고 단순히
 *  24시간제 그대로 읽는다(9시=09:00). "12시"는 자정이 아니라 낮
 *  12시(정오)로 해석한다 — 여행 일정 맥락에서 자정에 활동이 시작되는
 *  경우는 거의 없고, 원문에 "밤 12시"처럼 명시가 있으면 그 표현 자체가
 *  다른 분기(표지 없는 "12시")로 들어와 이 함수만으로는 자정/정오를
 *  구분할 근거가 없다 — 그래서 모호한 단독 "12시"는 정렬 근거로 쓰기에
 *  안전하지 않다고 보고 명시적 시각에서 제외한다(null 반환). */
export function explicitTimeToMinutes(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const m = trimmed.match(EXPLICIT_TIME_SHAPE);
  if (!m) return null;

  // group 1-3: (표지) H:MM
  if (m[2] !== undefined) {
    const marker = m[1];
    let h = Number(m[2]);
    const min = Number(m[3]);
    if (h === 12) h = PM_WORDS.has(marker) ? 12 : 0;
    else if (PM_WORDS.has(marker)) h += 12;
    return h * 60 + min;
  }
  // group 4-5: bare H:MM (24h, no time-of-day marker in source)
  if (m[4] !== undefined) {
    const h = Number(m[4]);
    const min = Number(m[5]);
    if (h > 23) return null;
    return h * 60 + min;
  }
  // group 6-8: (표지) H시(M분)
  if (m[7] !== undefined) {
    const marker = m[6];
    let h = Number(m[7]);
    const min = m[8] ? Number(m[8]) : 0;
    if (h === 12) h = PM_WORDS.has(marker) ? 12 : 0;
    else if (PM_WORDS.has(marker)) h += 12;
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
  // group 11-13: H:MM am/pm (영문 12시간제, 대소문자 무관). 12시는
  // am/pm 관례대로 처리한다(12am=자정=0시, 12pm=정오=12시) — 위
  // 한글 표지 분기(group 1-3, 6-8)의 PM_WORDS 처리와 같은 규칙.
  if (m[11] !== undefined) {
    let h = Number(m[11]);
    const min = Number(m[12]);
    const isPm = m[13].toLowerCase() === "pm";
    if (h === 12) h = isPm ? 12 : 0;
    else if (isPm) h += 12;
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

/** 버그 수정(2026-09-05) — 기존엔 명시 시각이 있는 item을 항상 앞으로,
 *  없는 item은 전부 뒤로 보냈다. 그런데 이 함수는 day 하나(day.items)
 *  단위로 호출되는데, 시간이 아예 없는 항목이 하나라도 섞여 있으면
 *  "시간 있는 것만 시간순으로 앞에 오고 나머지는 뒤로 밀림" 자체가
 *  원문 입력 순서를 깨버렸다(예: "부산역 → 오전 10시 국제시장 → 남포동
 *  구경 → 오후 2시 보수동책방골목 → 광안리"가 "국제시장 → 보수동책방골목
 *  → 부산역 → 남포동 → 광안리"로 재배열됨 — 사용자가 실제로 의도한
 *  순서 정보가 사라지는 문제). 이제는 그 day의 모든 item에 명시 시각이
 *  있을 때만(=완전히 시간순으로 재구성해도 정보 손실이 없을 때만) 시간
 *  오름차순으로 정렬하고, 하나라도 없으면 정렬을 아예 하지 않고 원문
 *  입력 순서를 그대로 반환한다 — "일부만 시간순, 나머지는 뒤로"라는
 *  절충이 결과적으로 더 나쁜 순서를 만든다는 것이 이번 버그의 핵심이라,
 *  절충 자체를 없앴다. explicitTimeToMinutes/isExplicitTime의 시각
 *  해석 규칙 자체는 전혀 건드리지 않았다. */
export function sortItemsByExplicitTime<T extends Pick<PlanItem, "time">>(items: T[]): T[] {
  if (!items.every((item) => isExplicitTime(item.time))) return items;

  const withIndex: SortableItem<T>[] = items.map((item, originalIndex) => ({ item, originalIndex }));
  withIndex.sort((a, b) => {
    const diff = explicitTimeToMinutes(a.item.time)! - explicitTimeToMinutes(b.item.time)!;
    return diff !== 0 ? diff : a.originalIndex - b.originalIndex;
  });

  return withIndex.map((x) => x.item);
}
