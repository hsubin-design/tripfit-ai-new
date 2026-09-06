// 일차별 입력 구조 실험(2026-08-24, "이사님 피드백") 전용 헬퍼.
// Plan A/B를 "여행 기간 선택 + 일차별 자유 텍스트"로 입력받되, 실제
// 구조화 API(/api/structure-plan)는 여전히 하나의 문자열을 받는다 —
// 백엔드 프롬프트/스키마를 다시 설계하지 않기 위해, 프런트에서 이미
// "N일차" 헤더를 명시적으로 붙여 기존 API가 인식하는 형태로 조합해
// 보낸다(route.ts 프롬프트 규칙 7이 "1일차"/"2일차" 마커를 그대로
// day 구분자로 인식). 사용자가 이미 기간을 선택했으므로 LLM이 일차
// 수를 다시 추론할 필요가 없다.

// 버그 수정(2026-09-04) — 사용자가 일차별 텍스트 박스 안에 이미 자기
// 손으로 "N일차"/"DAY N" 같은 명시적 헤더를 적어 넣었을 때, 위 자동
// 헤더가 그 위에 한 번 더 붙어 같은 텍스트 안에 마커가 두 번(때로는
// 서로 다른 숫자로) 나타났다. route.ts 프롬프트 규칙 7은 이런 마커가
// "나올 때마다" 새 day로 넘어가므로, 실제로는 박스 2개(=2일)만
// 입력했는데도 구조화 결과가 3일차까지 만들어지는 문제로 이어졌다.
// 박스 텍스트의 첫 줄이 이미 이 마커 모양이면 자동 헤더를 생략해
// 마커가 중복되지 않게 한다 — 그냥 날짜만 있는 줄("9월 12일", 요일
// 유무 무관, ISO 날짜 포함)은 규칙 7이 day 경계 트리거로 보지 않는
// 표현이라 이 패턴에 포함하지 않는다(날짜만 있는 입력에서 자동 헤더를
// 생략하면 오히려 day 경계 신호 자체가 사라져 새로운 문제가 생긴다).
// \b(단어 경계)는 뒤에 오는 "일차"가 ASCII \w가 아니라서 한글 뒤에서는
// 의도대로 동작하지 않는다(JS 정규식의 \b는 유니코드 문자를 \w로 보지
// 않음) — "차" 바로 뒤에서 매칭이 실패해 마커 자체를 못 찾는 문제가
// 있었다. "일차"/"DAY N"은 이미 그 자체로 충분히 구체적인 패턴이라
// \b 없이도 오탐 위험이 없다.
//
// 버그 수정(2026-09-06) — UT 직전 QA에서 발견된 phantom day 버그.
// 이 패턴이 숫자+일차/DAY N만 인식하는 반면, structure-plan
// route.ts(SYSTEM_PROMPT 규칙 7·DAY_BOUNDARY_LINE_PATTERN)는 "첫째
// 날"/"다음 날"/"마지막 날" 같은 서술형 표현도 day 경계로 인정한다.
// 그 결과 사용자가 일차 박스 첫 줄에 "첫째 날"처럼 서술형 마커를
// 적으면, 이 함수가 "자기 마커가 없다"고 오판해 앞에 "1일차\n"를
// 또 붙였고, 서버는 그 자동 헤더와 사용자의 서술형 마커를 각각
// 별개의 day 경계로 인식해 빈 phantom day가 하나씩 끼어들었다(예:
// 1박2일인데 결과가 4일차까지 생성). route.ts의 프롬프트/정규식
// 목록을 그대로 옮겨와 두 쪽이 인정하는 day 경계 표현을 다시
// 일치시킨다 — 서버 규칙 자체는 건드리지 않는다.
const DAY_MARKER_START_PATTERN =
  /^(?:\d+\s*일\s*차|DAY\s*\d+|첫째\s*날|첫날|둘째\s*날|셋째\s*날|넷째\s*날|다섯째\s*날|여섯째\s*날|다음\s*날|다음날|마지막\s*날)/i;

// 버그 수정(2026-09-05) — StepResult.tsx의 "원문 다시보기" modal이
// day별로 렌더링하면서(이미지 입력 지원), joinDayTexts가 "이 day에
// 자동 헤더를 붙일지" 판단할 때 쓰는 것과 완전히 같은 규칙으로 "이
// day 텍스트에 이미 사용자 자신의 헤더가 있는지"를 판단해야 두 곳의
// 판정이 어긋나지 않는다 — 그래서 export해서 재사용한다.
//
// 버그 수정(2026-09-06, 2차) — 이미지 OCR처럼 "부산여행\nDAY 1\n..."
// 처럼 제목 줄이 마커보다 앞에 오는 입력에서, 첫 줄("부산여행")만
// 검사하다 보니 "마커 없음"으로 오판해 자동 헤더가 또 붙고, 서버가
// 그 자동 헤더와 원문 안의 "DAY 1"을 각각 별개 day 경계로 인식해
// phantom day가 생겼다. 첫 줄만 보지 않고 텍스트 전체 줄을 훑어
// 마커로 시작하는 줄이 하나라도 있으면(어느 위치든) "이미 자기
// 마커가 있다"고 판단한다 — 마커가 어디 있든 서버가 그 줄에서
// day 경계로 넘어갈 것이므로, 앞에 자동 헤더를 얹으면 항상 중복이다.
// "부산여행" 같은 제목 줄 자체는 이 정규식이 애초에 매칭하지 않으므로
// (숫자+일차/DAY N/서술형 날짜 표현 외에는 매칭 안 함) 제목을 마커로
// 오인할 위험은 없다.
export function startsWithOwnDayMarker(text: string): boolean {
  return text
    .split("\n")
    .some((line) => DAY_MARKER_START_PATTERN.test(line.trim()));
}

export function joinDayTexts(dayTexts: string[]): string {
  return dayTexts
    .map((text, i) => {
      const trimmed = text.trim();
      return startsWithOwnDayMarker(trimmed) ? trimmed : `${i + 1}일차\n${trimmed}`;
    })
    .join("\n\n");
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

// joinDayTexts 결과("N일차\n" 헤더 포함)로 "입력이 시작됐는지"를 재면,
// 일차만 고르고 아직 한 글자도 안 쳤을 때도 헤더 글자 수 때문에 길이가
// 0보다 커져 버린다 — 실제로 사용자가 타이핑한 글자 수만 보려면 헤더를
// 붙이기 전 원본 배열을 그대로 합산해야 한다.
export function typedLength(dayTexts: string[]): number {
  return dayTexts.reduce((sum, t) => sum + t.trim().length, 0);
}

// v1.0 — "직접 일정 추가" 모드 전용. 일차마다 한 줄짜리 자유 텍스트
// item을 여러 개 가질 수 있다. 기간이 바뀔 때 resizeDayTexts와 같은
// 원칙(뒤쪽만 자르거나 새 일차는 item 1개짜리 빈 배열로 채움)을 쓴다.
export function resizeManualItems(current: string[][], newLength: number): string[][] {
  const next = current.slice(0, newLength);
  while (next.length < newLength) next.push([""]);
  return next;
}

// 빈 item은 제외하고 줄바꿈으로 합쳐, joinDayTexts가 기대하는 것과
// 동일한 "일차별 자유 텍스트 배열" 모양을 만든다 — API/구조화 로직은
// item이라는 개념 자체를 모른다.
export function manualItemsToDayTexts(items: string[][]): string[] {
  return items.map((dayItems) =>
    dayItems
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .join("\n")
  );
}
