// dummyComparison.ts(문단 단위 day 분리)와 이미지 multi-day validation
// (StepInput.tsx, 이미지 1장에 day marker/date heading이 여러 개
// 감지되면 업로드를 막는 기능)이 공유하는 day marker/date heading
// 감지 유틸. 정규식을 두 곳에 따로 두면 한쪽만 고쳐 서로 어긋날
// 위험이 있어 한 곳으로 모았다 — 판정 로직/정규식 자체는
// dummyComparison.ts에 있던 것을 그대로 옮겼을 뿐 전혀 바꾸지 않았다.

// "첫날"(첫째 날의 축약형)도 인정한다 — 빠뜨리면 "둘째 날"/"마지막
// 날"만 일차 마커로 잡히고 "첫날"로 시작하는 문단은 안 잡혀서, 문서
// 전체에 일차 마커가 있다고 판단하는 순간(hasAnyDayHeader) 그 앞의
// "첫날" 문단이 "일차 마커 이전 제목"으로 오인되어 통째로 버려지는
// 사고가 난다.
// 버그 수정(2026-09-06) — 원래 "Day"만 매칭하고 "DAY"/"day"는 놓쳤다.
// structure-plan의 SYSTEM_PROMPT 규칙 7이 이미 "Day 1"/"DAY 1"을
// 대소문자 구분 없이 같은 마커로 인정하고 있고, 실제 이미지 캡처에서도
// "DAY 1" 표기가 흔해 이 유틸도 대소문자를 가리지 않게(i 플래그)
// 맞췄다 — 매칭 대상 어휘 자체를 늘린 게 아니라 같은 "Day" 어휘의
// 대소문자 변형만 추가로 인정한다. dummyComparison.ts의 실제 사용
// 경로(buildComparison)는 이 상수를 쓰지 않으므로(parsePlanText 계열은
// 현재 어디서도 호출되지 않는 v0.7 죽은 코드) 이 변경은 이미지
// multi-day 감지에만 영향을 준다.
//
// 버그 수정(2026-09-11) — "제1일"/"제 1일"(옛 단체여행 일정표에서 흔한
// 표기) 이미지 실측 QA에서, 이 표기가 기존 목록(N일차/Day N/서술형)
// 중 어느 것과도 매칭되지 않아 한 이미지 안에 여러 날짜가 있어도
// multi-day guard가 발동하지 않는 케이스가 확인됐다("제1일" ~ "제4일"
// 표가 한 장에 통째로 들어가 그대로 통과). "제"+숫자+"일" 형태만 새로
// 인정한다 — 숫자와 "일" 사이 공백 유무 둘 다 받아들인다("제1일"/
// "제 1일"). 이 유틸은 detection(개수 세기)에만 쓰이므로, structure-plan
// 쪽 day-splitting fallback(별도의 DAY_BOUNDARY_LINE_PATTERN, 이번
// 요청 범위 밖이라 변경하지 않음)에는 영향이 없다 — 두 정규식은
// 애초에 서로 다른 상수였다.
export const DAY_MARKER =
  /^(?:(\d+)\s*일\s*차|Day\s*(\d+)|제\s*(\d+)\s*일|첫째\s*날|첫날|둘째\s*날|셋째\s*날|넷째\s*날|다섯째\s*날|여섯째\s*날|마지막\s*날)(?:에는|에서는|은|는|에)?/i;

// "1일차"류 마커 없이 날짜 자체가 하루의 시작을 나타내는 경우도 day
// 구분자로 인정한다 — "8월 26일", "8/26", "2026.08.26", "2026-08-26"
// 모두 지원한다. 연도가 없어도(예: "8월 26일") 원문에 실제로 적힌
// 값이므로 그대로 인정한다 — "날짜를 만들지 않는다"는 원칙은 없는
// 연도를 추정해서 붙이지 않는다는 뜻이지, 연도 없는 날짜 자체를
// 거부한다는 뜻이 아니다. 헤더 줄 어디서든(예: "1일차 2026.08.26"처럼
// 마커 뒤에 붙는 경우 포함) 찾을 수 있도록 앵커 없는 패턴을 기본으로
// 두고, day 시작 여부 판정에는 앵커를 씌운 버전을 쓴다.
export const DATE_HEADER_PATTERN =
  /(\d{4})\s*[.\-]\s*(\d{1,2})\s*[.\-]\s*(\d{1,2})|(\d{1,2})\s*월\s*(\d{1,2})\s*일|(\d{1,2})\s*\/\s*(\d{1,2})/;
const DATE_HEADER_START_PATTERN = new RegExp(`^(?:${DATE_HEADER_PATTERN.source})`);

export function isDayHeaderStart(paragraph: string): boolean {
  return DAY_MARKER.test(paragraph) || DATE_HEADER_START_PATTERN.test(paragraph);
}

// 버그 수정(2026-09-06, 2차) — 실제 가로형 Excel 캡처 이미지로 QA한
// 결과, vision 모델이 표를 "시간 | 1일차 | 2일차 | 3일차 | 4일차"처럼
// 표 헤더 행 하나에 여러 day marker를 몰아서 추출하는 경우가 확인됐다
// (같은 이미지를 5번 추출하면 대략 절반은 이렇게, 절반은 marker가
// 각자 줄로 나뉘어 나온다 — vision 출력 자체의 비결정성). 줄 시작만
// 보는 기존 방식은 이런 줄을 "0개"로 세어 validation을 놓친다.
// 새 정규식을 만들지 않고, 줄을 표 컬럼 구분자(파이프 "|", 탭, 연속
// 공백 2칸 이상)로 "셀" 단위로 다시 쪼갠 뒤 각 셀에 기존
// isDayHeaderStart(줄 시작 판정과 동일한 함수, 앵커 있는 패턴 재사용)를
// 그대로 적용한다. 구분자가 없는 일반 줄(쉼표·한 칸 공백으로 된
// 문장, 예: "1일차")은 셀이 원래 줄 하나로 그대로 남아 기존 동작과
// 완전히 동일하다 — "기존 줄 시작 감지는 그대로 유지" 요구사항을
// 셀 단위로 일반화한 것뿐이다. 일반 문장 속 셀(예: "8:00 진천역 ->
// 대구공항")은 day marker로 시작하지 않으므로 오탐이 생기지 않는다.
const TABLE_CELL_DELIMITER_PATTERN = /\s*\|\s*|\t+|[ ]{2,}/;

export function countDayHeaderLines(text: string): number {
  let count = 0;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells = line
      .split(TABLE_CELL_DELIMITER_PATTERN)
      .map((cell) => cell.trim())
      .filter(Boolean);
    for (const cell of cells) {
      if (isDayHeaderStart(cell)) count += 1;
    }
  }
  return count;
}
