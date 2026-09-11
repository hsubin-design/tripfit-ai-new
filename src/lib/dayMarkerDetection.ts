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
//
// 버그 수정(2026-09-11, 2차) — production 실측 QA에서 "관광1일차"/
// "투어1일차"/"여행 2일차"처럼 "N일차" 앞에 짧은 접두어가 붙은 표기가
// (여행사 브로슈어·패키지 상품 안내문에서 흔함) 기존 "(\d+)\s*일\s*차"
// (줄 맨 앞이 곧바로 숫자여야 함)에 걸리지 않아, 실제로는 여러 날짜가
// 있는 이미지가 통째로 통과되는 케이스가 확인됐다. "숫자+일차" 바로
// 앞에 한글/영문 접두어(최대 4자, 숫자는 포함 안 함)를 허용해 같은
// 하나의 대안으로 흡수한다 — 접두어가 없으면(기존 "1일차") 그대로
// 매칭되므로 기존 감지는 전혀 바뀌지 않는다. 4자로 제한한 이유는
// "관광"/"투어"/"여행" 같은 실제 라벨(대부분 2자)은 넉넉히 덮으면서,
// 문장 중간에 우연히 "숫자+일차" 모양이 나타나는 긴 서술문 전체를
// 앞부분까지 통째로 흡수하는 오탐 폭을 좁히기 위함이다.
export const DAY_MARKER =
  /^(?:[가-힣A-Za-z]{0,4}\s*(\d+)\s*일\s*차|Day\s*(\d+)|제\s*(\d+)\s*일|첫째\s*날|첫날|둘째\s*날|셋째\s*날|넷째\s*날|다섯째\s*날|여섯째\s*날|마지막\s*날)(?:에는|에서는|은|는|에)?/i;

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

// 버그 수정(2026-09-11, 2차) — production 실측 QA에서 "1일차\n10/14(수)"
// (표 셀 안에서 일차 라벨과 그 날짜가 줄바꿈으로 나뉜, 실제 캡처
// 이미지에 매우 흔한 배치)가 "1일차"(DAY_MARKER)와 "10/14(수)"
// (DATE_HEADER_START_PATTERN) 두 개의 독립된 신호로 각각 잡혀
// countDayHeaderLines가 2를 반환하는 오탐이 확인됐다 — 렌터카 반납일
// 같은 본문 날짜 없이 이 두 줄만으로도 이미 임계값(2)에 도달해, 실제
// 단일 일차 이미지가 "여러 날짜가 확인됐어요" 안내로 차단됐다.
// "N일차 뒤에 바로 오는, day marker 단어가 없는 순수 날짜 한 줄"은
// 새 날짜 경계가 아니라 "그 일차의 날짜"로 본다 — 그 직전 신호가
// DAY_MARKER(일차/Day/제N일/서술형 같은 "단어" 기반 마커)였을 때만
// 다음의 순수 날짜 신호 하나를 세지 않고 흡수한다. day marker 없이
// 날짜만으로 하루씩 구분하는 표(예: "8/2" 다음 내용, 다음 "8/3")는
// 이 흡수 대상이 아니므로(직전 신호가 날짜 자신이지 단어 마커가
// 아님) 기존처럼 각각 정상 카운트된다 — "기존 감지 유지" 요구사항.
// 반대로 일차 마커와 무관하게 본문 중간에 떨어져 나오는 날짜(예:
// 렌터카 반납일)는 그 사이에 다른 셀들이 있어 인접하지 않으므로
// 이 흡수 로직의 영향을 받지 않고 원래 판정 그대로 남는다.
export function countDayHeaderLines(text: string): number {
  let count = 0;
  let precededByNamedMarker = false;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells = line
      .split(TABLE_CELL_DELIMITER_PATTERN)
      .map((cell) => cell.trim())
      .filter(Boolean);
    for (const cell of cells) {
      const isNamedMarker = DAY_MARKER.test(cell);
      const isBareDate = !isNamedMarker && DATE_HEADER_START_PATTERN.test(cell);
      if (isNamedMarker) {
        count += 1;
        precededByNamedMarker = true;
      } else if (isBareDate) {
        if (!precededByNamedMarker) count += 1;
        precededByNamedMarker = false;
      } else {
        precededByNamedMarker = false;
      }
    }
  }
  return count;
}
