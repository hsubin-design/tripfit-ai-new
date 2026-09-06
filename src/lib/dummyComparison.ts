import type { ComparisonResult, DailyPlaceComparison, KeyDifference, PlanDay, PlanItem, PlanStructure } from "@/types/plan";
import { isExplicitTime } from "@/lib/timeSort";
import { sumPlanCost } from "@/lib/costSummary";
import { DAY_MARKER, DATE_HEADER_PATTERN, isDayHeaderStart } from "@/lib/dayMarkerDetection";

const WON_FORMATTER = new Intl.NumberFormat("ko-KR");
function formatWon(amount: number): string {
  return `${WON_FORMATTER.format(amount)}원`;
}

// v0.7 핵심 흐름 단계용 더미 구조화 로직. 실제 LLM 연동(추후 단계) 전까지
// 화면 흐름을 확인하기 위한 것으로, 입력 텍스트에 실제로 있는 부분 문자열만
// 추출하고 값이 불확실하면 null로 둔다 (사실 창작 금지 가드레일 준수).

// DAY_MARKER/DATE_HEADER_PATTERN/isDayHeaderStart는 이제 dayMarkerDetection.ts
// 공용 유틸에 있다(2026-09-06, 이미지 multi-day validation과 공유하기
// 위해 추출) — 정규식/판정 로직은 전혀 바뀌지 않았다.

/** 일차 헤더 줄에서 날짜 표현을 찾아 원문 그대로("8월 26일"/"8/26"/
 *  "2026.08.26"/"2026-08-26") 반환한다 — "M월 D일"로 강제 변환하지
 *  않고, 연도가 있으면 지우지 않고, 요일은 계산해서 붙이지 않는다.
 *  day 비교는 이 값이 아니라 등장 순서(day index)로만 이뤄지므로
 *  date는 순수 표시용 label이다. 못 찾거나 월/일 범위가 비정상이면
 *  null. */
function extractDayDate(headerLine: string): string | null {
  const match = headerLine.match(DATE_HEADER_PATTERN);
  if (!match) return null;

  const month = Number(match[2] ?? match[4] ?? match[6]);
  const day = Number(match[3] ?? match[5] ?? match[7]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return match[0].trim();
}

// "오전/오후 HH:MM", HH:MM, "오전/오후 N시(M분)", 그리고 오전/오후
// 없이 쓴 "N시(M분)"까지 명시적 시각 표현으로 인정한다. "오전 10:30"
// 처럼 AM/PM 접두와 콜론 표기가 함께 쓰이는 불릿 목록 형식이 있어
// 가장 구체적인 알테너티브를 맨 앞에 둔다(그래야 "오전"이 따로 떨어져
// 나머지 장소 텍스트에 붙는 문제가 없다). 숫자가 없는 "오전/오후/저녁"
// 등 막연한 시간대 표현은 별도로 TIME_OF_DAY_WORDS에서 문법적 근거
// (조사)가 있을 때만 인정한다 — 이 패턴에는 포함하지 않는다.
const TIME_PATTERN =
  /((?:오전|오후)\s?\d{1,2}:\d{2})|(\d{1,2}:\d{2})|((?:오전|오후)\s?\d{1,2}시(?:\s?\d{1,2}분)?)|(\d{1,2}시(?:\s?\d{1,2}분)?)/;

// 숫자 기반 비용 값 — 순수 숫자(2,000원), 만원 단위(3만원), 범위
// (4만~7만원), "약" 접두(약 15,000원), ₩ 표기까지 인정한다. 문자열 어디서든
// extractLeading으로 찾아 쓰는 용도라, 한글 단어("무료")처럼 place 안에
// 우연히 포함될 위험이 있는 항목은 넣지 않는다(무료는 COST_VALUE_PATTERN
// 에서만, 전체 일치 검사로 다룬다).
const COST_PATTERN =
  /(?:약\s*)?(?:\d[\d,]*\s*만?\s*~\s*\d[\d,]*\s*만?\s*원|\d[\d,]*\s*만\s*원|\d[\d,]*\s*원|₩\s*[\d,]+)/;
// chunk/문장 전체가 정확히 비용 값인지(=/^...$/ 전체 일치) 검사할 때만
// 쓰는 확장 패턴. "무료"는 여기서만 인정해 오탐(장소명 부분 문자열
// 오추출)을 막는다.
const COST_VALUE_PATTERN = new RegExp(`(?:${COST_PATTERN.source}|무료)`);
// 비용 금액 바로 앞/뒤에 원문 그대로 붙어 있는 조건 수식어 — "1박"/
// "2인 기준"처럼 금액 앞에, "정도"/"예상"처럼 금액 뒤에 온다. 이 조건은
// stated_cost에서 지워지면 안 되는 정보라(요구사항: "1박 약 90,000원"의
// "1박"이 사라지면 안 됨), COST_PATTERN이 찾는 숫자 부분과 이 수식어를
// 하나의 표현으로 묶어서 추출한다. 금액과 공백만 두고 곧바로 붙어 있을
// 때만 인정해, 문장 앞쪽의 무관한 숫자·단어까지 끌어오지 않는다 —
// "1박 2일 여행에서 약 90,000원"이면 "여행에서" 뒤엔 수식어 모양이
// 아니므로 "약 90,000원"만 남는다.
const COST_PREFIX_QUALIFIER = /(?:\d+\s*(?:박|일|인)(?:\s*기준)?\s*)*/;
const COST_SUFFIX_QUALIFIER = /(?:\s*(?:정도|예상|가량|쯤))*/;
// 실제 텍스트에서 비용 "표현 전체"(수식어 포함)를 찾을 때 쓴다 —
// COST_PATTERN 자체는 그대로 두고(다른 용도로도 쓰이므로), 값 보존이
// 필요한 자리에서만 이 확장 패턴을 쓴다.
const COST_EXPRESSION_PATTERN = new RegExp(
  `${COST_PREFIX_QUALIFIER.source}${COST_PATTERN.source}${COST_SUFFIX_QUALIFIER.source}`
);
const COST_EXPRESSION_VALUE_PATTERN = new RegExp(
  `${COST_PREFIX_QUALIFIER.source}(?:${COST_VALUE_PATTERN.source})${COST_SUFFIX_QUALIFIER.source}`
);
// "교통비 20,000원"처럼 비용 값 앞에 붙는 라벨. 값과 분리해 라벨은
// stated_cost에서 제거하되(요구사항 7), 원문에 실제로 있던 값 자체는
// 그대로 보존한다.
const COST_LABEL_PATTERN =
  /^(교통비|입장\s?료|입장\s?비용|식사\s?비용|식사비|카페\s?비용|숙소\s?비용|별도\s?비용|가격|비용)\s*(은|는)?\s*/;
// "정보 없음/없다" 계열 — 비용이 명시되지 않았다는 문장. UI에서만
// "정보 없음"으로 보여주고 raw data는 null로 유지한다(요구사항 5).
const COST_NO_INFO_PATTERN = /^(정보)?\s*(는|은)?\s*(없다|없음)$/;

/** 대시(-)로 분리된 한 chunk가 "장소/활동이 아니라 비용 표현 그 자체"인지
 *  판정한다. 비용 chunk면 새 item을 만들지 않고 직전 item의 stated_cost로
 *  붙여야 하므로, 호출자가 이 결과를 보고 병합 여부를 결정한다.
 *  반환값이 null이면 비용 chunk가 아니라는 뜻(평소처럼 parseMemoChunk로
 *  처리). "무료"/숫자 값은 라벨 없이도 단독으로 인정하지만, "정보 없음"
 *  계열은 비용 라벨이 붙어 있을 때만 비용 문맥으로 인정한다(라벨 없는
 *  bare "정보 없음"까지 삼키면 과잉 인식이 되므로). */
function parseCostOnlyExpression(rawChunk: string): { value: string | null } | null {
  const original = rawChunk.trim();
  if (!original) return null;

  const labelMatch = original.match(COST_LABEL_PATTERN);
  const hadLabel = labelMatch !== null;
  const text = hadLabel ? original.slice(labelMatch![0].length).trim() : original;
  if (!text) return hadLabel ? { value: null } : null;

  if (COST_NO_INFO_PATTERN.test(text)) {
    return hadLabel ? { value: null } : null;
  }

  const valueMatch = text.match(new RegExp(`^(?:${COST_EXPRESSION_VALUE_PATTERN.source})$`));
  if (valueMatch) {
    return { value: valueMatch[0] };
  }

  return hadLabel ? { value: null } : null;
}

/** 서술형 문장 하나가 "장소/활동 문장이 아니라 비용 문장"인지 판정한다.
 *  대시 chunk와 달리 문장은 맥락이 넓어 라벨("비용은"/"교통비는" 등)이
 *  없으면 비용 문장으로 확정하지 않는다 — 과잉 인식을 막기 위한
 *  보수적 기준. 값 매칭은 라벨 바로 뒤에서 시작하기만 하면 되고(앞쪽은
 *  라벨로 이미 확정됨), 뒤에 "정도"/"예상"처럼 원문에 흔히 붙는 수식어가
 *  남아 있어도 인정한다 — 전체 일치를 요구하면 "비용은 16,000원 정도"
 *  같은 표현이 통째로 버려지기 때문이다. */
function parseCostSentence(rawSentence: string): { value: string | null } | null {
  const original = rawSentence.trim().replace(/[.!?]+$/, "").trim();
  if (!original) return null;

  const labelMatch = original.match(COST_LABEL_PATTERN);
  if (!labelMatch) return null;

  let text = original.slice(labelMatch[0].length).trim();
  text = text.replace(/(이다|다)$/, "").trim();

  if (COST_NO_INFO_PATTERN.test(text)) {
    return { value: null };
  }

  const valueMatch = text.match(new RegExp(`^(?:${COST_EXPRESSION_VALUE_PATTERN.source})`));
  if (valueMatch) {
    return { value: valueMatch[0] };
  }

  return { value: null };
}

// "스카이캡슐 비용은 2인 기준 약 40,000원 정도"처럼 장소/항목명 뒤에
// 비용 라벨이 곧바로 이어지는 문장에서 쓰는, 앞쪽에 자유 텍스트(장소명)
// 를 허용하는 버전 — COST_LABEL_PATTERN과 같은 라벨 목록이지만 문장
// 맨 앞이 아니어도 인정한다. 라벨 앞에 아무 것도 없으면(=COST_LABEL_
// PATTERN이 이미 처리하는 "비용 전용 문장") group 1이 빈 문자열이
// 될 수 없어(최소 1글자) 여기서 매칭되지 않으므로 두 함수는 서로
// 겹치지 않는다.
const PLACE_COST_LABEL_PATTERN =
  /^(.{1,20}?)\s*(교통비|입장\s?료|입장\s?비용|식사\s?비용|식사비|카페\s?비용|숙소\s?비용|별도\s?비용|가격|비용)\s*(은|는)?\s*(.+)$/;

/** 장소명 + 비용 라벨 + 비용이 한 문장에 같이 있는 경우, 그 장소명을
 *  새 item으로 만들고 비용을 바로 붙이기 위해 둘을 함께 추출한다.
 *  라벨이 없거나(=일반 서술) 라벨 뒤에 실제 비용 값이 없으면(=단순
 *  설명 문장) null — 없는 비용을 추정해 만들지 않는다. */
function parsePlaceCostSentence(sentence: string): { place: string; cost: string } | null {
  const cleaned = sentence.trim().replace(/[.!?]+$/, "").trim();
  const match = cleaned.match(PLACE_COST_LABEL_PATTERN);
  if (!match) return null;

  // 장소명에 조사가 붙어 있으면(예: "카페에서 식사비...") 떼어낸다 —
  // 다른 narrative 추출 경로들과 동일한 조사 스트립 규칙을 그대로
  // 적용해 "카페에서"가 아니라 "카페"가 place로 남게 한다.
  const { stripped: place } = stripLongestSuffix(match[1].trim(), PLACE_PARTICLE_SUFFIXES);
  if (!place) return null;

  const costMatch = match[4].match(COST_EXPRESSION_PATTERN);
  if (!costMatch) return null;

  return { place, cost: costMatch[0].trim() };
}

// "저녁: 광안리 횟집 / 약 35,000원"처럼 "라벨: 설명 / 비용"으로 쓰인
// 줄. 콜론 앞이 시간대 단어(저녁/아침/점심/오전/오후)면 time으로 쓰고,
// 아니면(숙소 등) 라벨 자체는 버리고 콜론 뒤 내용을 place로 쓴다 —
// place가 이미 있으니 라벨을 활동명으로 따로 만들지 않는다. 마지막
// "/" 조각이 실제 비용 표현일 때만 이 형식으로 인정해, "/"가 다른
// 용도로 쓰인 줄을 오인하지 않게 한다. 라벨에는 숫자를 허용하지 않는다
// — 그렇지 않으면 "오전 10:00 해운대..."처럼 시각 표기 안의 콜론을
// "라벨:"로 착각해 "10"이 라벨, "00 해운대..."가 내용으로 잘못
// 잘리는 사고가 난다(실제 라벨은 항상 "저녁"/"숙소" 같은 한글 단어).
function parseLabeledSlashLine(line: string): PlanItem | null {
  const headerMatch = line.match(/^([^:\n0-9]{1,12}):\s*(.+)$/);
  if (!headerMatch) return null;

  const label = headerMatch[1].trim();
  const rest = headerMatch[2].trim();
  const slashParts = rest
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (slashParts.length < 2) return null;

  const lastPart = slashParts[slashParts.length - 1];
  const costMatch = lastPart.match(COST_EXPRESSION_PATTERN);
  if (!costMatch) return null;

  // "남포동에서 돼지국밥"처럼 콜론 뒤 내용에 조사가 어절 중간에 있고
  // 그 뒤에 다른 말이 더 있으면 place/description으로 나눈다. "광안리
  // 횟집"처럼 조사가 아예 없으면 전체가 그대로 place가 된다.
  const joinedPlace = slashParts.slice(0, -1).join(" / ").trim();
  const { place, description } = extractPlaceAndDescription(joinedPlace);
  if (!place) return null;

  // 라벨이 시간대 단어(저녁 등)면 time으로 쓰고, 아니면 "점심"/"숙소"
  // 처럼 TRAILING_ACTIVITY_WORDS에 있는 활동 라벨일 때만 activity로
  // 살린다 — "점심: 남포동에서 돼지국밥 / 약 10,000원"에서 "점심"이라는
  // 정보 자체가 통째로 사라지지 않게 한다(place/description만으로는
  // 이 항목이 점심 식사였다는 사실이 드러나지 않는다).
  const isTimeLabel = TIME_OF_DAY_WORDS.has(label);
  const isActivityLabel = !isTimeLabel && TRAILING_ACTIVITY_WORDS.includes(label);

  return {
    time: isTimeLabel ? label : null,
    place,
    category: null,
    activity: isActivityLabel ? label : null,
    stated_cost: costMatch[0],
    description,
  };
}

// 숫자 없이 쓰인 시간대 표현. "아침/점심/저녁"은 식사 활동으로도 쓰이는
// 애매한 단어라 문맥(서술형의 조사 부착 여부) 없이는 시간으로 확정하지
// 않는다 — 대시 형식에서는 늘 TRAILING_ACTIVITY_WORDS의 식사 활동으로
// 남긴다(기존 sample 데이터의 "남포동 저녁" = 저녁 식사 해석과 동일).
// "오전/오후/밤/새벽/정오"는 식사 의미가 없어 애매하지 않으므로, 두
// 형식(대시/서술형) 모두에서 동일하게 시간으로 인정한다 — 이게 Plan
// A/B의 시간대 파싱 기준을 통일하는 지점이다.
const TIME_OF_DAY_WORDS = new Set(["오전", "오후", "저녁", "아침", "밤", "새벽", "정오"]);
const UNAMBIGUOUS_TIME_OF_DAY_WORDS = ["오전", "오후", "밤", "새벽", "정오"];
const TRAILING_ACTIVITY_WORDS = [
  "도착",
  "출발",
  "저녁",
  "점심",
  "아침",
  "식사",
  "산책",
  "관람",
  "방문",
  "이동",
  "숙소",
  "체크인",
  "체크아웃",
  "복귀",
  "구경",
  "이용",
];

// 서술형(문장) 일차 본문에서 어절 단위로 장소/활동 후보를 골라낼 때 쓰는
// 보조 사전. 조사·동사 어미를 떼어 이미 원문에 있는 명사를 그대로
// 드러낼 뿐, 새 단어를 만들어 붙이지 않는다.
const PLACE_PARTICLE_SUFFIXES = [
  "에서는",
  "에는",
  "으로는",
  "이라는",
  "라는",
  "에서",
  "으로",
  "로는",
  "과는",
  "와는",
  "이",
  "가",
  "을",
  "를",
  "은",
  "는",
  "로",
  "과",
  "와",
  "에",
  "도",
  "의",
].sort((a, b) => b.length - a.length);

// 주격/보조사(이/가/은/는)는 "저녁은"/"오늘은"처럼 시간대·날짜 단어를
// 잡을 때는 필요하지만(그래서 위 목록엔 그대로 둔다), 동사 활용형
// (예: "보내는"→"보내", "쉬었다가"의 "가")에도 흔히 붙어서 이 네 개를
// 새 장소를 만드는 근거로 쓰면 자연스러운 문장에서 동사 어간·연결어까지
// 장소로 오추출된다. 그래서 "새 place item을 만들지 여부"를 판단할
// 때만 이 네 조사로 떨어진 경우는 제외한다 — 시간대/스킵/활동 단어
// 판정에는 영향 없다(그 판정들은 이미 이 네 조사가 필요하므로).
const WEAK_PLACE_PARTICLES = new Set(["이", "가", "은", "는"]);

// 일차 헤더에 흔히 붙는 시간대·순서·연결어. 장소/활동 후보에서 제외한다.
const NARRATIVE_SKIP_WORDS = new Set([
  "오전",
  "오후",
  "저녁",
  "아침",
  "밤",
  "새벽",
  "정오",
  "그",
  "이",
  "다음",
  "당일",
  "날",
  "첫째",
  "둘째",
  "셋째",
  "넷째",
  "다섯째",
  "여섯째",
  "마지막",
  "뒤",
  "후",
  "그리고",
]);

// 서술형 문장에서 "장소를 방문해 ~을 구경하고 ~을 찍는다"처럼, 이미
// 찾은 장소에 대한 활동 묘사(둘러보다/구경하다/보다/찍다 등)의 목적어로
// 등장하는 일반 명사. 조사가 붙어 있어 다른 규칙상 place 후보가
// 되어버리지만 실제로는 새 장소가 아니라 같은 문장 속 장소를 꾸미는
// 설명일 뿐이므로 후보에서 제외한다 — TRAILING_ACTIVITY_WORDS/
// TIME_OF_DAY_WORDS와 같은 성격의, 새 단어를 만들지 않고 이미 아는
// 어휘만 제외하는 보수적 목록이다.
const NARRATIVE_DESCRIPTIVE_OBJECT_WORDS = new Set(["골목", "사진", "풍경", "돼지국밥"]);

// "식사한다"/"이동해"처럼 TRAILING_ACTIVITY_WORDS의 활동 명사에 조사가
// 아니라 "하다" 활용 어미가 곧바로 붙어 등장하는 경우. 새 동사 어휘를
// 추측하는 게 아니라, 이미 아는 활동 명사 + 정해진 활용 어미 몇 가지
// (하고/하며/해서/하는/한다/했다/해) 조합만 좁게 인정한다 — 조사 스트립
// (PLACE_PARTICLE_SUFFIXES)과 정확히 같은 성격의 보수적 규칙이다.
const HADA_VERB_SUFFIXES = ["하고", "하며", "해서", "하는", "한다", "했다", "해"];

function extractHadaActivity(token: string): string | null {
  for (const word of TRAILING_ACTIVITY_WORDS) {
    for (const suffix of HADA_VERB_SUFFIXES) {
      if (token === `${word}${suffix}`) return word;
    }
  }
  return null;
}

function splitIntoDayBlocks(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // 문서 전체에 실제 일차 마커가 하나라도 있으면, 그 첫 마커 이전에
  // 나오는 문단("부산 2박 3일 여행" 같은 제목/소개 줄)은 하루로 세지
  // 않는다 — 그렇지 않으면 이 제목 문단이 가짜 "1일차"가 되고 실제
  // 일차들이 전부 하나씩 밀린다. 문서 전체에 일차 마커가 아예 없으면
  // (기존 fallback) 첫 문단도 그대로 살려서 단일 암묵적 일차로 쓴다.
  const hasAnyDayHeader = paragraphs.some((p) => isDayHeaderStart(p));

  const blocks: string[] = [];
  let pendingHeaderOnly: string | null = null;
  let sawDayHeader = false;

  for (const paragraph of paragraphs) {
    // 날짜 형식("2026-08-26" 등)은 "N일차"보다 길어질 수 있어 길이
    // 상한을 12자로 넉넉히 둔다 — 헤더 한 줄만 있는 문단인지 판정하는
    // 용도일 뿐, 다른 파싱에는 영향 없다.
    const isHeaderOnly = isDayHeaderStart(paragraph) && paragraph.length <= 12;
    if (isHeaderOnly) {
      if (pendingHeaderOnly) blocks.push(pendingHeaderOnly);
      pendingHeaderOnly = paragraph;
      sawDayHeader = true;
      continue;
    }
    if (pendingHeaderOnly) {
      blocks.push(`${pendingHeaderOnly}\n${paragraph}`);
      pendingHeaderOnly = null;
    } else if (isDayHeaderStart(paragraph)) {
      blocks.push(paragraph);
      sawDayHeader = true;
    } else if (blocks.length > 0) {
      // 헤더 없이 이어지는 본문은 직전 일차에 포함
      blocks[blocks.length - 1] += `\n${paragraph}`;
    } else if (hasAnyDayHeader && !sawDayHeader) {
      // 진짜 일차 마커가 뒤에 있다는 걸 이미 아는 상태(hasAnyDayHeader)
      // 라, 그 앞에 나온 이 제목/소개 문단은 일정 정보가 아니므로 조용히
      // 건너뛴다.
      continue;
    } else {
      blocks.push(paragraph);
    }
  }
  if (pendingHeaderOnly) blocks.push(pendingHeaderOnly);

  return blocks.length > 0 ? blocks : [text.trim()];
}

function extractLeading(pattern: RegExp, source: string): { matched: string | null; rest: string } {
  const match = source.match(pattern);
  if (!match) return { matched: null, rest: source };
  return { matched: match[0].trim(), rest: (source.slice(0, match.index) + source.slice((match.index ?? 0) + match[0].length)).trim() };
}

// 대시(-) 목록 안에서 조사 없이 독립된 단어로 등장한 "오전/오후/밤/새벽/
// 정오"를 찾는다. 앞뒤가 공백 또는 문자열 경계인 경우만 매칭해 다른
// 단어의 일부를 잘못 잘라내지 않는다. "아침/점심/저녁"은 식사 활동과
// 애매해 여기서 다루지 않는다(TRAILING_ACTIVITY_WORDS로 남김).
function extractTimeOfDayWord(source: string): { matched: string | null; rest: string } {
  for (const word of UNAMBIGUOUS_TIME_OF_DAY_WORDS) {
    const pattern = new RegExp(`(?:^|\\s)${word}(?:\\s|$)`);
    const match = source.match(pattern);
    if (match) {
      const index = match.index ?? 0;
      const rest = `${source.slice(0, index)} ${source.slice(index + match[0].length)}`.trim().replace(/\s+/g, " ");
      return { matched: word, rest };
    }
  }
  return { matched: null, rest: source };
}

function parseMemoChunk(rawChunk: string): PlanItem {
  let remaining = rawChunk.trim();

  const time = extractLeading(TIME_PATTERN, remaining);
  remaining = time.rest;
  let timeValue = time.matched;

  if (timeValue === null) {
    const timeOfDay = extractTimeOfDayWord(remaining);
    if (timeOfDay.matched) {
      timeValue = timeOfDay.matched;
      remaining = timeOfDay.rest;
    }
  }

  const cost = extractLeading(COST_EXPRESSION_PATTERN, remaining);
  // "이용 / 약 16,000원"처럼 "/"로 비용을 나눠 적은 줄은 비용만 잘라내면
  // 구분자 "/"가 장소 쪽에 그대로 남는다 — 원문에 있던 내용이 아니라
  // 형식상 구분자일 뿐이므로 지운다.
  remaining = cost.rest.replace(/\/+$/, "").trim();

  let place: string | null = remaining || null;
  let activity: string | null = null;
  let description: string | null = null;

  let matchedTrailingActivity = false;
  for (const word of TRAILING_ACTIVITY_WORDS) {
    if (remaining.endsWith(word) && remaining !== word) {
      place = remaining.slice(0, remaining.length - word.length).trim() || null;
      activity = word;
      matchedTrailingActivity = true;
      break;
    } else if (remaining === word) {
      place = null;
      activity = word;
      matchedTrailingActivity = true;
      break;
    }
  }

  // "남포동에서 돼지국밥"처럼 장소 뒤에 조사가 있고 그 뒤에 다른 말이
  // 더 있으면(활동 접미어로 끝나는 경우가 아닐 때만), 조사 붙은 어절을
  // place로, 나머지를 description으로 나눈다 — 그렇지 않으면 "에서"
  // 같은 조사가 안 떨어진 채로 통째로 place가 되어버린다. 조사가 아예
  // 없는 "광안리 횟집" 같은 문구는 그대로 place 전체로 남는다(잘라낼
  // 근거가 없으므로).
  if (!matchedTrailingActivity && remaining) {
    const extracted = extractPlaceAndDescription(remaining);
    place = extracted.place || null;
    description = extracted.description;
  }

  return {
    time: timeValue,
    place,
    category: null,
    activity,
    stated_cost: cost.matched,
    description,
  };
}

function stripLongestSuffix(
  token: string,
  suffixes: string[]
): { stripped: string; matched: boolean; suffix: string | null } {
  for (const suffix of suffixes) {
    if (token.length > suffix.length && token.endsWith(suffix)) {
      return { stripped: token.slice(0, token.length - suffix.length), matched: true, suffix };
    }
  }
  return { stripped: token, matched: false, suffix: null };
}

/** "남포동에서 돼지국밥"처럼 장소 뒤에 조사가 붙고 그 뒤에 다른 말이
 *  더 이어지는 문구에서, 조사가 붙은 첫 어절을 place로, 그 뒤에 남는
 *  말을 description으로 나눈다. parseMemoChunk/parseLabeledSlashLine/
 *  parsePlaceCostSentence 모두 공백으로 이어붙인 원문 조각을 다루는데,
 *  조사가 어절 중간에 있으면 그 뒤 텍스트가 장소명에 그대로 붙어버리는
 *  문제(예: "남포동에서 돼지국밥"이 place 전체가 되는 것)를 막기 위한
 *  것 — 새 단어를 만들지 않고 원문 조각을 place/description으로
 *  나눠 담을 뿐이다. 조사가 붙은 어절이 하나도 없으면(예: "광안리
 *  횟집"처럼 명사가 조사 없이 그대로 이어지는 경우) 잘라낼 근거가
 *  없으므로 원문 전체를 place로 그대로 둔다. */
// extractPlaceAndDescription 전용으로 좁힌 조사 목록 — 1글자 조사(을/를/
// 로/과/와/에/도/의)는 여기서 빼뒀다. "흰여울문화마을"처럼 장소명 자체가
// 조사와 같은 음절로 끝나는 경우(마을의 "을"), 이 함수가 그 음절을
// 진짜 조사로 착각해 "흰여울문화마"처럼 이름을 잘라버리는 사고가
// 있었다 — 조사가 2글자 이상이면 단어 끝과 우연히 겹칠 위험이 훨씬
// 낮아 안전하다. PLACE_PARTICLE_SUFFIXES(서술형 토크나이저 전용)는
// 이미 검증된 기존 동작이라 그대로 둔다.
const UNAMBIGUOUS_PLACE_PARTICLE_SUFFIXES = ["에서는", "에는", "으로는", "이라는", "라는", "에서", "으로", "로는", "과는", "와는"];

function extractPlaceAndDescription(text: string): { place: string; description: string | null } {
  const tokens = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const { stripped, matched } = stripLongestSuffix(tokens[i], UNAMBIGUOUS_PLACE_PARTICLE_SUFFIXES);
    if (matched && stripped.length >= 2) {
      const rest = tokens.slice(i + 1).join(" ").trim();
      return { place: stripped, description: rest || null };
    }
  }
  return { place: text.trim(), description: null };
}

// 조사를 뗀 어절이 통째로 "숫자시(분)" / "HH:MM" / "오전·오후+숫자시" 꼴일
// 때만 명시적 시각으로 인정한다 (TIME_PATTERN과 동일한 어휘 기준).
const EXPLICIT_TIME_SHAPE = /^(?:\d{1,2}:\d{2}|(?:오전|오후)\d{1,2}시(?:\d{1,2}분)?|\d{1,2}시(?:\d{1,2}분)?)$/;

/** 서술형(문장) 일차 본문에서 어절 단위로 실제 등장한 장소/활동을
 *  추출한다. 조사가 붙은 어절은 조사를 뗀 명사를, 조사 없이 쉼표로만
 *  나열된 어절은 그 명사 자체를 후보로 삼는다. 대시(-) 목록과 동일하게
 *  TRAILING_ACTIVITY_WORDS에 속한 명사는 place가 아닌 activity로
 *  분류한다. 동사 활용형(-하고/-한다 등)은 추측해 늘리지 않는다 —
 *  근거가 조사·쉼표로 명확한 명사만 후보로 남겨 없는 관계를 만들지
 *  않는다.
 *
 *  시간 표현은 두 가지를 모두 인정한다 — ① "10시에"/"14:30에"처럼
 *  숫자로 명시된 시각, ② "오전에는"/"저녁에"처럼 조사가 직접 붙은
 *  시간대 표현. 두 경우 모두 등장 순서대로 바로 다음 항목들의 time으로
 *  이어 붙인다 — 문장에서 그 시각/시간대 다음에 나오는 장소가 거기
 *  해당한다고 읽는 것은 원문 순서를 그대로 따르는 것이지 임의 보정이
 *  아니다. 새 시각/시간대가 나오면 갱신되고, 하루가 끝나면(함수가 일차
 *  단위로 호출되므로) 초기화된다. "점심"/"저녁"처럼 조사 없이 단독으로
 *  쓰인 경우는 시간대가 아니라 TRAILING_ACTIVITY_WORDS의 식사 활동으로만
 *  처리한다 — 의미가 애매한 경우를 추측하지 않기 위한 명확한 구분
 *  기준이다. */
/** 문장 단위로 나눈다("~다." 등 종결부호 뒤 공백, 줄바꿈 기준). 비용
 *  문장("교통비는 20,000원이다.")을 장소/활동 문장과 분리해 각각 다른
 *  규칙으로 처리하기 위한 전처리 — 비용 문장은 여기서 문장 하나를
 *  통째로 차지하므로, 어절 단위로 쪼개기 전에 먼저 걸러내야 "비용"
 *  "20,000원이다" 같은 조각이 장소로 오추출되지 않는다. */
function splitIntoSentences(content: string): string[] {
  return content
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// "12시 30분"처럼 시-분이 공백으로 분리된 두 어절로 나뉜 경우를 위한
// 보조 패턴. 어절 단위 파싱이라 "12시"와 "30분에"가 서로 다른 토큰으로
// 떨어지는데, 다음 어절 처리 시점엔 이미 시각 문맥을 알 수 없어 "30분"만
// 남아 장소 후보로 잘못 넘어가는 버그가 있었다 — 그 결과 "30분"이 독립
// item으로 생성되어 항목 수가 부풀려졌다. 방금 확정한 시각이 분 단위가
// 없는 "N시"/"오전 N시" 형태일 때만, 바로 다음 어절이 "M분"(조사 붙어도
// 됨) 형태인지 확인해 있으면 하나의 시각 표현으로 합치고 그 어절은
// 소비해 건너뛴다 — 원문에 없는 시각을 만드는 게 아니라 공백으로만
// 나뉜 같은 시각 표현을 다시 합치는 것이다.
const BARE_HOUR_SHAPE = /^(?:(?:오전|오후)\d{1,2}시|\d{1,2}시)$/;
const MINUTE_CONTINUATION_SHAPE = /^\d{1,2}분$/;

function mergeMinuteContinuation(hourText: string, nextRawToken: string | undefined): string | null {
  if (!nextRawToken || !BARE_HOUR_SHAPE.test(hourText)) return null;
  const nextCleaned = nextRawToken.replace(/[,.·]+$/, "");
  const { stripped: nextStripped } = stripLongestSuffix(nextCleaned, PLACE_PARTICLE_SUFFIXES);
  return MINUTE_CONTINUATION_SHAPE.test(nextStripped) ? `${hourText} ${nextStripped}` : null;
}

function extractNarrativeItems(content: string): PlanItem[] {
  const normalized = content.replace(/(아침|점심|저녁)\s*식사/g, "$1").trim();
  const sentences = splitIntoSentences(normalized);
  const items: PlanItem[] = [];
  let currentTimeMarker: string | null = null;
  // 방금 push된(또는 마지막으로 손댄) item의 activity가 어떤 근거로
  // 채워졌는지 추적한다. "explicit"는 조사/단독 명사로 TRAILING_ACTIVITY_
  // WORDS와 정확히 일치해 확정한 값이라 hada 추측이 덮어쓰지 않는다
  // (예: "숙소로 이동한다"에서 "숙소"가 "이동"에 밀려 사라지면 안 됨).
  // "hada"는 이 추측 규칙으로 채운 값이라, 같은 문장에서 뒤이어 나오는
  // 다른 hada 활동이 있으면 더 뒤에 나온 쪽(문장상 최종 행동)으로 계속
  // 갱신한다(예: "이동해 식사한다" → 최종 activity는 "식사").
  let lastActivitySource: "explicit" | "hada" | null = null;

  for (const sentence of sentences) {
    // 비용 문장("비용은 약 15,000원이다.", "숙소 비용은 정보 없음.")은
    // 새 item을 만들지 않고 바로 앞 문장에서 만들어진 item에 붙인다 —
    // "비용은 기존 item의 stated_cost 속성"이라는 규칙을 서술형에도
    // 동일하게 강제한다. 다만 붙일 앞선 item이 아예 없으면(비용 문장이
    // 일차의 첫 문장인 경우) 값을 조용히 버리지 않고 비용만 담은
    // item으로라도 보존한다 — 대시 형식(parseDashLine)의 "직전 item이
    // 없는 비정상 입력" 처리와 같은 원칙이다.
    const costSentence = parseCostSentence(sentence);
    if (costSentence !== null) {
      const previous = items[items.length - 1];
      if (costSentence.value !== null) {
        if (previous) {
          previous.stated_cost = costSentence.value;
        } else {
          items.push({
            time: currentTimeMarker,
            place: null,
            category: null,
            activity: null,
            stated_cost: costSentence.value,
            description: null,
          });
          lastActivitySource = null;
        }
      }
      continue;
    }

    // "저녁: 광안리 횟집 / 약 35,000원"처럼 콜론+슬래시로 장소와 비용을
    // 함께 적은 줄은 어절 단위 토큰화 전에 통째로 하나의 item으로
    // 만든다 — 이런 줄은 조사도 쉼표도 없어 아래 토큰 루프가 장소명을
    // 인식하지 못하기 때문이다.
    const labeledSlash = parseLabeledSlashLine(sentence);
    if (labeledSlash !== null) {
      items.push(labeledSlash);
      continue;
    }

    // "스카이캡슐 비용은 2인 기준 약 40,000원 정도"처럼 장소명 뒤에 비용
    // 라벨이 곧바로 붙은 문장도 마찬가지로 통째로 한 item으로 만든다.
    const placeCost = parsePlaceCostSentence(sentence);
    if (placeCost !== null) {
      items.push({
        time: currentTimeMarker,
        place: placeCost.place,
        category: null,
        activity: null,
        stated_cost: placeCost.cost,
        description: null,
      });
      lastActivitySource = null;
      continue;
    }

    // 위 두 형식에 해당하지 않는 일반 서술 문장에 비용 표현이 섞여
    // 있으면(예: "~을 방문한다. 총 20,000원 정도 든다" 같은 경우), 어절
    // 토큰화 전에 값을 미리 찾아 두고, 이 문장에서 실제로 item이 하나라도
    // 생기면 그중 마지막 item에 붙인다 — 문장 전체가 비용 전용은 아니라
    // parseCostSentence가 못 잡는 경우의 보완이다.
    const inlineCostMatch = sentence.match(COST_EXPRESSION_PATTERN);
    const itemCountBeforeSentence = items.length;

    const withoutCost = sentence.replace(new RegExp(COST_EXPRESSION_PATTERN.source, "g"), " ");
    const rawTokens = withoutCost.split(/\s+/).filter(Boolean);

    for (let i = 0; i < rawTokens.length; i++) {
      const rawToken = rawTokens[i];
      const hadPunctuation = /[,.·]$/.test(rawToken);
      const cleaned = rawToken.replace(/[,.·]+$/, "");
      if (!cleaned) continue;

      const { stripped: particleStripped, matched: hasParticle, suffix: matchedSuffix } = stripLongestSuffix(
        cleaned,
        PLACE_PARTICLE_SUFFIXES
      );

      if (hasParticle) {
        if (EXPLICIT_TIME_SHAPE.test(particleStripped) || TIME_OF_DAY_WORDS.has(particleStripped)) {
          const merged = mergeMinuteContinuation(particleStripped, rawTokens[i + 1]);
          currentTimeMarker = merged ?? particleStripped;
          if (merged) i++;
          continue;
        }
        if (NARRATIVE_SKIP_WORDS.has(particleStripped)) continue;
        if (NARRATIVE_DESCRIPTIVE_OBJECT_WORDS.has(particleStripped)) continue;
        if (TRAILING_ACTIVITY_WORDS.includes(particleStripped)) {
          items.push({
            time: currentTimeMarker,
            place: null,
            category: null,
            activity: particleStripped,
            stated_cost: null,
            description: null,
          });
          lastActivitySource = "explicit";
        } else if (
          particleStripped.length >= 2 &&
          !(matchedSuffix !== null && WEAK_PLACE_PARTICLES.has(matchedSuffix))
        ) {
          // 이/가/은/는으로 떨어진 어절은 새 place로 만들지 않는다 —
          // "보내는"→"보내"처럼 동사 활용형이 장소로 오추출되는 걸
          // 막기 위함이다(WEAK_PLACE_PARTICLES 정의 참고).
          items.push({
            time: currentTimeMarker,
            place: particleStripped,
            category: null,
            activity: null,
            stated_cost: null,
            description: null,
          });
          lastActivitySource = null;
        }
        continue;
      }

      if (EXPLICIT_TIME_SHAPE.test(cleaned)) {
        const merged = mergeMinuteContinuation(cleaned, rawTokens[i + 1]);
        currentTimeMarker = merged ?? cleaned;
        if (merged) i++;
        continue;
      }

      if (NARRATIVE_SKIP_WORDS.has(cleaned)) continue;
      if (NARRATIVE_DESCRIPTIVE_OBJECT_WORDS.has(cleaned)) continue;

      if (TRAILING_ACTIVITY_WORDS.includes(cleaned)) {
        items.push({
          time: currentTimeMarker,
          place: null,
          category: null,
          activity: cleaned,
          stated_cost: null,
          description: null,
        });
        lastActivitySource = "explicit";
        continue;
      }

      // "식사한다"/"이동해"처럼 활동 명사 + 하다 활용 어미가 조사 없이
      // 곧바로 붙은 경우. 직전 item의 activity가 비어 있거나(place만
      // 있는 상태) 마찬가지로 hada 추측으로 채워진 값이면 이 값으로
      // 갱신한다 — 새 item을 만들지 않고 "장소 + 활동"을 대시 형식
      // (parseMemoChunk)과 동일한 모양으로 합친다. 다만 조사/단독 명사로
      // 이미 확정된 explicit 활동은 덮어쓰지 않는다(정보 손실 방지).
      const hadaActivity = extractHadaActivity(cleaned);
      if (hadaActivity !== null) {
        const previous = items[items.length - 1];
        if (previous && lastActivitySource !== "explicit") {
          previous.activity = hadaActivity;
          lastActivitySource = "hada";
        }
        continue;
      }

      // 조사 없이 쉼표로만 나열된 명사 (예: "해운대,")
      if (
        hadPunctuation &&
        !cleaned.endsWith("다") &&
        cleaned.length >= 2 &&
        !NARRATIVE_DESCRIPTIVE_OBJECT_WORDS.has(cleaned)
      ) {
        items.push({
          time: currentTimeMarker,
          place: cleaned,
          category: null,
          activity: null,
          stated_cost: null,
          description: null,
        });
        lastActivitySource = null;
      }
    }

    if (inlineCostMatch !== null && items.length > itemCountBeforeSentence) {
      items[items.length - 1].stated_cost = inlineCostMatch[0];
    }
  }

  return items;
}

/** 대시로 나뉜 한 줄을 item으로 변환한다. 각 chunk가 순수 비용 표현이면
 *  (parseCostOnlyExpression) 새 item을 만들지 않고 직전 item의
 *  stated_cost로 붙인다 — "비용은 별도 item이 아니라 기존 item의
 *  stated_cost 속성"이라는 규칙을 여기서 강제한다.
 *
 *  "시간 장소 - 보조 설명 - 비용"처럼 마지막 chunk가 명확한 비용
 *  표현이면, 첫 chunk와 마지막 chunk 사이의 나머지 chunk는 각각 새
 *  item이 아니라 첫 item의 description(보조 설명)으로 합친다 — 원문에
 *  실제로 있는 문구를 그대로 옮길 뿐 새로 만들지 않는다. 마지막
 *  chunk가 비용이 아니면(예: 기존 sample처럼 장소를 나열만 하는 줄)
 *  기존처럼 chunk마다 독립된 item으로 본다 — 리스트형 dash 줄과의
 *  하위 호환을 그대로 유지한다. */
function parseDashLine(line: string): PlanItem[] {
  const chunks = line
    .split(/\s[-–—]\s/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length >= 2) {
    const lastCostOnly = parseCostOnlyExpression(chunks[chunks.length - 1]);
    if (lastCostOnly !== null) {
      const firstItem = parseMemoChunk(chunks[0]);
      const middleChunks = chunks.slice(1, chunks.length - 1);
      if (middleChunks.length > 0) firstItem.description = middleChunks.join(" ");
      if (lastCostOnly.value !== null) firstItem.stated_cost = lastCostOnly.value;
      return [firstItem];
    }
  }

  const items: PlanItem[] = [];
  for (const chunk of chunks) {
    const costOnly = parseCostOnlyExpression(chunk);
    if (costOnly !== null) {
      const previous = items[items.length - 1];
      if (previous) {
        if (costOnly.value !== null) previous.stated_cost = costOnly.value;
        continue;
      }
      // 직전 item이 없는 비정상 입력(맨 앞이 비용 표현)이면 비용만 담은
      // item으로라도 값을 보존한다 — 정보를 조용히 버리지 않기 위함.
      items.push({ time: null, place: null, category: null, activity: null, stated_cost: costOnly.value, description: null });
      continue;
    }
    items.push(parseMemoChunk(chunk));
  }
  return items;
}

// "- 오전 10:30 부산역 도착"처럼 줄마다 "- "로 시작하는 불릿 목록.
// 기존 dash 형식("10:00 부산역 도착 - 교통비 20,000원")은 한 줄 *안에서*
// " - "로 항목을 나누는 것이고, 이 불릿 형식은 줄 *맨 앞*에 "- "가
// 붙는 것이라 서로 다른 형식이다. 줄바꿈이 정규식 \s에 포함되기 때문에
// 뒤 줄의 선행 "- "가 우연히 "\s-\s"에 걸려 기존 hasDashList 판정이
// 이 형식을 잘못 dash 형식으로 오인했었다 — 그래서 불릿 판정을 dash
// 판정보다 먼저 한다. 문단의 모든 줄이 불릿으로 시작할 때만 이 형식으로
// 인정해, 불릿이 하나도 없거나 일부만 있는 경우와 헷갈리지 않는다.
const BULLET_LINE_PATTERN = /^[-*•]\s+/;

function isBulletList(lines: string[]): boolean {
  return lines.length > 0 && lines.every((line) => BULLET_LINE_PATTERN.test(line));
}

/** 불릿 한 줄(선행 "- " 제거된 상태)을 item 하나로 만든다. "라벨: 설명
 *  / 비용"(콜론+슬래시) 형식이면 그 전용 파서를 그대로 재사용하고,
 *  아니면 "시간 + 장소[+ 활동]" 형태로 보고 parseMemoChunk에 맡긴다 —
 *  둘 다 이미 검증된 로직이라 새로 만들지 않는다. */
function parseBulletLine(line: string): PlanItem {
  const trimmed = line.trim();

  const labeledSlash = parseLabeledSlashLine(trimmed);
  if (labeledSlash !== null) return labeledSlash;

  return parseMemoChunk(trimmed);
}

function parseDayBody(body: string): PlanItem[] {
  const withoutHeaderLine = body.replace(DAY_MARKER, "").trim();
  const content = withoutHeaderLine || body.trim();

  const contentLines = content.split(/\n/).map((l) => l.trim()).filter(Boolean);

  if (isBulletList(contentLines)) {
    return contentLines.map((line) => parseBulletLine(line.replace(BULLET_LINE_PATTERN, "")));
  }

  const hasDashList = /\s-\s|\s–\s|\s—\s/.test(content);

  if (hasDashList) {
    return content.split(/\n/).flatMap((line) => parseDashLine(line));
  }

  // 서술형 문장: 어절 단위로 실제 등장한 장소/활동을 추출한다. 추출
  // 결과가 하나도 없을 때만(예: 구조 추출이 불확실한 매우 짧은 메모)
  // 원문 전체를 하나의 activity로 보존해 정보를 잃지 않는다.
  const narrativeItems = extractNarrativeItems(content);
  if (narrativeItems.length > 0) return narrativeItems;

  return [
    {
      time: null,
      place: null,
      category: null,
      activity: content || null,
      stated_cost: null,
      description: null,
    },
  ];
}

export function parsePlanText(text: string): PlanStructure {
  const blocks = splitIntoDayBlocks(text);
  const days: PlanDay[] = blocks.map((block, index) => {
    const lines = block.split("\n");
    const headerLine = lines[0];
    const date = extractDayDate(headerLine);
    // 날짜를 추출했다면 헤더 줄에서 그 날짜 문자열만 제거하고 나머지는
    // 그대로 둔다 — 그렇지 않으면 날짜 숫자가 item 파싱 단계에서 장소로
    // 오추출될 수 있다(예: "1일차 2026.08.26"의 "2026.08.26", 또는
    // 날짜만 있는 헤더 "8월 26일" 자체가 장소로 잡히는 문제).
    const body = date === null ? block : [headerLine.replace(DATE_HEADER_PATTERN, "").trim(), ...lines.slice(1)].join("\n");
    return {
      day: index + 1,
      items: parseDayBody(body),
      date,
    };
  });

  return {
    duration_days: days.length > 0 ? days.length : null,
    days,
  };
}

// 장소 비교(canonical) 전용 — QA7: 같은 장소가 한/영 병기나 표기 순서
// 차이("서울숲(Seoul Forest)" ↔ "Seoul Forest", "Starfield Library @
// COEX" ↔ "COEX Starfield Library")로 다르게 적혀 있으면 common_places/
// unique_to_a/unique_to_b가 실제보다 부풀려지는 문제가 있었다. 여기서
// 만드는 key는 오직 "같은 장소인지" 판정에만 쓰고, 화면에 보여주는
// item.place 원문이나 일정 항목 수는 절대 바꾸지 않는다.
//
// 허용 범위(요구사항에 명시된 것만, LLM 재판단이나 alias 사전 없이 —
// 입력 문자열 자체에 있는 정보만 사용):
// 1) 공백 정리, 영문 대소문자 무시
// 2) "(" ")" "-" "@" 는 토큰 구분자로 취급(제거)
// 3) 토큰을 정렬해서 비교 — 같은 단어 집합이 순서만 다르면
//    ("Starfield Library @ COEX" ↔ "COEX Starfield Library") 동일 취급.
//    단 "정렬 후 비교"는 집합이 완전히 같을 때만 같아지므로, 한쪽에
//    없는 단어가 있으면(부분 포함) 여전히 다른 장소로 남는다 — "COEX"와
//    "Starfield Library @ COEX"가 합쳐지지 않고, "성수동"과 "성수동
//    연무장길"도 합쳐지지 않는 이유가 이것이다(둘 다 substring 포함
//    여부가 아니라 "전체 토큰 집합이 같은가"로만 판정).
// 4) "X(Y)" 형태로 괄호 안에 다른 이름이 병기된 경우에만 X 전체, Y
//    전체 각각을 별도 후보로도 인정한다("서울역" ↔ "Seoul Station(서울역)"
//    처럼 한쪽엔 한 이름만 있는 경우를 잡기 위함). 괄호가 없으면 이
//    후보들은 생기지 않으므로, "-"/"@"는 괄호와 달리 독립 후보를
//    만들지 않는다 — 그래야 "동대문 - 신당"처럼 그냥 대시로 이어 쓴
//    다른 두 장소를 별칭 관계로 착각해 합치는 사고를 막을 수 있다.
function tokenizeForComparison(text: string): string {
  return text
    .replace(/[()\-@]/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

const PARENTHETICAL_ALIAS_PATTERN = /^(.*?)\(([^()]+)\)\s*$/;

// 버그 수정(2026-09-06, place count 중복) — 실측(실제 Excel 캡처 이미지)
// 에서 "야마와라와우 샤브샤브로 이동"과 "아침 (야마와라와우 샤브샤브)"가
// 같은 식당인데도 앞쪽 item의 place에 이동 조사("로")가 붙은 채로
// 추출되어("아마와라우 사바사브로" vs "아마와라우 사바사브") 서로 다른
// canonical key로 갈라지는 문제가 확인됐다. place 문자열 끝의 조사를
// 무조건 떼면 "테헤란로"처럼 실제로 "로"/"길"로 끝나는 고유명사를
// 깨뜨릴 위험이 있어(요청사항: 고유명사 훼손 검토), activity가 정확히
// "이동"인 item에서만 — 즉 "이 항목 자체가 어딘가로 향한다"는 의미가
// 이미 구조적으로 확정된 경우에만 — 조사를 뗀 대체 key를 "추가"한다
// (원래 key는 그대로 남겨 원문 표기도 계속 매칭에 참여함). "그레이서리
// 호텔 긴자"/"호텔 그레이서리"처럼 조사가 아니라 단어 순서 자체가
// 다른 경우는 이 정규화로 잡히지 않는다 — 의도적으로 그대로 둔다
// (요청사항: 실제 표현이 다른 장소는 임의 병합 금지).
const TRAILING_MOVEMENT_PARTICLE_PATTERN = /(으로|에서|로|에)$/;

function movementNormalizedKey(place: string, activity: string | null): string | null {
  if (activity !== "이동") return null;
  const match = place.match(TRAILING_MOVEMENT_PARTICLE_PATTERN);
  if (!match) return null;
  const stripped = place.slice(0, place.length - match[0].length).trim();
  if (!stripped) return null;
  return tokenizeForComparison(stripped) || null;
}

function canonicalPlaceKeys(rawLabel: string, activity: string | null = null): string[] {
  const trimmed = rawLabel.trim();
  const keys = new Set<string>();

  const wholeKey = tokenizeForComparison(trimmed);
  if (wholeKey) keys.add(wholeKey);

  const aliasMatch = trimmed.match(PARENTHETICAL_ALIAS_PATTERN);
  if (aliasMatch) {
    const outerKey = tokenizeForComparison(aliasMatch[1]);
    const innerKey = tokenizeForComparison(aliasMatch[2]);
    if (outerKey) keys.add(outerKey);
    if (innerKey) keys.add(innerKey);
  }

  const movementKey = movementNormalizedKey(trimmed, activity);
  if (movementKey) keys.add(movementKey);

  return Array.from(keys);
}

type CanonicalLabel = { label: string; keys: string[] };

function hasSharedKey(keys: string[], index: Set<string>): boolean {
  return keys.some((k) => index.has(k));
}

// 버그 수정(2026-09-06) — "세이브존 -> 김포공항정류소"처럼 place
// 문자열 전체가 이동 구간(A -> B)인 경우, 실제로는 "방문한 장소"가
// 아니라 두 장소 사이의 이동 자체를 가리킨다. 이 값이 방문 장소
// 집계(공통/고유 장소, 장소 수 insight)에 그대로 섞이면 실제 방문지
// 수가 부풀어 보인다. place 문자열 자체에 "->"/"→"가 있는지만 보고
// 판정한다(activity가 "이동"인지에는 의존하지 않는다 — 실측 데이터에서
// 같은 route item도 activity가 null로 나오는 경우가 있었다). "디즈니씨
// 이동"처럼 화살표 없이 실제 장소명 하나만 있는 경우는 이 판정에
// 걸리지 않아 그대로 방문 장소로 유지된다. timeline item 자체(원본
// place/activity/category, 원문 다시보기)는 이 판정과 무관하게 그대로
// 보존된다 — 오직 장소 "집계" 단계에서만 걸러낸다.
export function isRouteString(place: string): boolean {
  return place.includes("->") || place.includes("→");
}

// 같은 플랜 안에서도 같은 장소가 "서울역"/"Seoul Station(서울역)"처럼
// 서로 다른 표기로 여러 번 등장할 수 있다 — 그 경우 일정 item은 각각
// 그대로 두고(항목 수도 그대로), 장소 "집합"을 만들 때만 canonical
// key가 같으면 하나로 묶는다. 대표 라벨은 먼저 등장한 원문 표기를
// 그대로 쓸 뿐 새로 만들지 않는다.
function collectCanonicalPlaces(plan: PlanStructure): CanonicalLabel[] {
  const seenKeys = new Set<string>();
  const result: CanonicalLabel[] = [];
  for (const day of plan.days) {
    for (const item of day.items) {
      if (!item.place || isRouteString(item.place)) continue;
      const label = item.place.trim();
      const keys = canonicalPlaceKeys(label, item.activity);
      if (hasSharedKey(keys, seenKeys)) continue;
      keys.forEach((k) => seenKeys.add(k));
      result.push({ label, keys });
    }
  }
  return result;
}

function countMissing(plan: PlanStructure) {
  const missing = { time: 0, place: 0, cost: 0 };
  for (const day of plan.days) {
    for (const item of day.items) {
      if (!item.time) missing.time += 1;
      if (!item.place) missing.place += 1;
      if (!item.stated_cost) missing.cost += 1;
    }
  }
  return missing;
}

export function truncateList(list: string[], max = 3): string {
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} 외 ${list.length - max}곳`;
}

// 버그 수정(2026-09-04) — 한 일차의 "장소" 라벨. 이전엔 place가 없으면
// activity로 대체했는데("일정 몇 개"가 아니라 "무엇이 있는지"로
// 비교하려는 의도였음), activity는 "씨앗호떡을 사 먹는다"/"점심
// 식사"처럼 행동 서술·일반 명사인 경우가 많아 그대로 place 비교에
// 섞이면 "AI가 요약한 핵심 차이"의 일차별 장소 구성 insight에 장소가
// 아닌 값이 장소인 것처럼 노출되는 문제가 있었다(상세 일정 UI에서
// 이미 고친 것과 같은 종류의 버그 — item.place 존재 여부만으로
// 판단해야 하는데 activity로 대체하고 있었다). 이제 place가 실제로
// 있는 item만 이 비교에 포함한다 — place가 없는 item은 "이 일차에
// 장소가 없다"는 사실 그대로 daily place insight 계산에서 제외될 뿐,
// activity 텍스트로 대신 채우지 않는다.
function dayLabelEntries(day: PlanDay | undefined): CanonicalLabel[] {
  if (!day) return [];
  const seenKeys = new Set<string>();
  const result: CanonicalLabel[] = [];
  for (const item of day.items) {
    if (!item.place || isRouteString(item.place)) continue;
    const label = item.place.trim();
    const keys = canonicalPlaceKeys(label, item.activity);
    if (hasSharedKey(keys, seenKeys)) continue;
    keys.forEach((k) => seenKeys.add(k));
    result.push({ label, keys });
  }
  return result;
}

/** "전체 장소가 같다"와 "일차별 구성이 같다"는 다른 질문이다. 같은
 *  장소 집합이라도 어느 날짜에 배치됐는지는 다를 수 있으므로, 일차마다
 *  독립적으로 공통/A만/B만을 계산한다. 두 플랜의 일수가 다르면 짧은
 *  쪽에 없는 날은 있는 쪽 항목 전부가 "그 플랜만" 있는 것으로 취급한다
 *  (없는 일차를 생성하지 않고, 실제로 없다는 사실 그대로 반영).*/
function buildDailyComparison(planA: PlanStructure, planB: PlanStructure): DailyPlaceComparison[] {
  const dayCount = Math.max(planA.days.length, planB.days.length);
  const result: DailyPlaceComparison[] = [];

  for (let i = 0; i < dayCount; i++) {
    const entriesA = dayLabelEntries(planA.days[i]);
    const entriesB = dayLabelEntries(planB.days[i]);
    const keysA = new Set(entriesA.flatMap((e) => e.keys));
    const keysB = new Set(entriesB.flatMap((e) => e.keys));

    result.push({
      day: i + 1,
      common: entriesA.filter((e) => hasSharedKey(e.keys, keysB)).map((e) => e.label),
      unique_to_a: entriesA.filter((e) => !hasSharedKey(e.keys, keysB)).map((e) => e.label),
      unique_to_b: entriesB.filter((e) => !hasSharedKey(e.keys, keysA)).map((e) => e.label),
    });
  }

  return result;
}

export function buildComparison(planA: PlanStructure, planB: PlanStructure): ComparisonResult {
  const placesA = collectCanonicalPlaces(planA);
  const placesB = collectCanonicalPlaces(planB);
  const keysA = new Set(placesA.flatMap((p) => p.keys));
  const keysB = new Set(placesB.flatMap((p) => p.keys));

  const commonPlaces = placesA.filter((p) => hasSharedKey(p.keys, keysB)).map((p) => p.label);
  const uniqueToA = placesA.filter((p) => !hasSharedKey(p.keys, keysB)).map((p) => p.label);
  const uniqueToB = placesB.filter((p) => !hasSharedKey(p.keys, keysA)).map((p) => p.label);

  const dailyCountsA = planA.days.map((d) => d.items.length);
  const dailyCountsB = planB.days.map((d) => d.items.length);
  const dailyPlaceComparison = buildDailyComparison(planA, planB);

  const missingA = countMissing(planA);
  const missingB = countMissing(planB);

  // v1.0 (1차 우선순위 라운드, 2026-09-04) — "핵심 차이"를 단순 사실
  // 나열에서 "비교 인사이트"로 확장한다(UT 피드백: 장소 구성/시간 개수
  // 나열만으로는 와닿지 않음). 이 한 곳에서만 만든다. 우선순위:
  //   1) 방문 장소 수 + "실제 계산 가능한" 이동 시간/거리 trade-off —
  //      예시 문장("플랜 A는 방문 장소가 더 많지만 이동 거리는 더
  //      짧아요")부터 이동 데이터가 근거다. 그런데 PlanItem에는 애초에
  //      duration/distance 필드가 없다(v0.7 JSON 계약에 없음) —
  //      devRouteMock.ts는 화면 검증용 가짜 데이터일 뿐이라 AI 인사이트
  //      근거로 "절대" 쓰지 않는다(가드레일). 그래서 이 축의 자리는
  //      실제 이동 API가 붙어 PlanItem에 계산된 시간/거리가 생기기
  //      전까지는 항상 비어 있다 — 이전 라운드처럼 입력 비용으로
  //      대신 채우지 않는다(비용은 아래 2번의 독립 인사이트로만 쓴다).
  //   2) 입력 비용 합계 차이 — sumPlanCost(요약 카드와 완전히 같은
  //      계산)를 그대로 재사용한다. 비용이 없거나 합산 불가면(total이
  //      null) 인사이트를 만들지 않는다 — 억지로 채우지 않기.
  //   3) 방문 장소 수 차이 — 위에서 이미 계산한 고유 장소 수
  //      (placesA/placesB.length, collectCanonicalPlaces 기준)를 그대로
  //      쓴다.
  //   4) 시간 정보 구체성 — 기존 로직 그대로.
  //   5) 일차별 고유 장소 구성 차이 — 기존 로직 그대로, 남는 자리만
  //      채운다.
  // 전체 최대 4개(핵심만), 근거가 약하면(차이가 없거나 데이터가 없으면)
  // 절대 채우지 않는다 — "A가 더 좋다/추천한다"류 판단 문장도 만들지
  // 않는다(관찰 가능한 차이만 서술).
  const keyDifferences: KeyDifference[] = [];

  const costA = sumPlanCost(planA);
  const costB = sumPlanCost(planB);
  const placeCountA = placesA.length;
  const placeCountB = placesB.length;

  // 1) 방문 장소 수 + 실제 이동 시간/거리 trade-off — 위 주석대로 이
  // 데이터 모델에서는 항상 근거가 없어 생성하지 않는다. 실제 이동
  // API가 붙어 PlanItem에 계산된 duration/distance가 생기면 이 자리에
  // 그 값 기준의 관계형 인사이트를 추가한다.

  // 2) 입력 비용 합계 — 독립 인사이트.
  if (costA.total !== null && costB.total !== null) {
    if (costA.total !== costB.total) {
      const more = costA.total > costB.total ? "A" : "B";
      const diff = Math.abs(costA.total - costB.total);
      keyDifferences.push({
        criterion: "information_completeness",
        text: `플랜 ${more}의 입력 비용 합계가 ${formatWon(diff)} 더 높아요.`,
        title: `플랜 ${more}의 입력 비용 합계가 더 높아요.`,
        detail: `A ${formatWon(costA.total)} · B ${formatWon(costB.total)}`,
      });
    } else {
      keyDifferences.push({
        criterion: "information_completeness",
        text: "두 플랜의 입력 비용 합계는 같아요.",
        title: "두 플랜의 입력 비용 합계는 같아요.",
        detail: `A ${formatWon(costA.total)} · B ${formatWon(costB.total)}`,
      });
    }
  }

  // 3) 방문 장소 수 — 독립 인사이트.
  if (keyDifferences.length < 4 && placeCountA !== placeCountB) {
    const more = placeCountA > placeCountB ? "A" : "B";
    const diff = Math.abs(placeCountA - placeCountB);
    keyDifferences.push({
      criterion: "place_composition",
      text: `플랜 ${more}가 방문 장소가 ${diff}곳 더 많아요.`,
      title: `플랜 ${more}가 방문 장소가 ${diff}곳 더 많아요.`,
      detail: `방문 장소 A ${placeCountA}곳 · B ${placeCountB}곳`,
    });
  }

  const explicitTimeCount = (plan: PlanStructure) =>
    plan.days.reduce((sum, d) => sum + d.items.filter((i) => isExplicitTime(i.time)).length, 0);
  const explicitA = explicitTimeCount(planA);
  const explicitB = explicitTimeCount(planB);
  if (keyDifferences.length < 4 && explicitA !== explicitB) {
    const more = explicitA > explicitB ? "A" : "B";
    keyDifferences.push({
      criterion: "information_completeness",
      text: `플랜 ${more}는 정확한 시간이 입력된 일정이 더 많아요 (A ${explicitA}개, B ${explicitB}개).`,
      title: `시간 정보는 플랜 ${more}가 더 구체적이에요.`,
      detail: `시간 정보 A ${explicitA}개 · B ${explicitB}개`,
    });
  }

  // 버그 수정(2026-09-04) — 장소 구성은 실제로 차이가 있는 일차만, 남은
  // 자리까지만 짚어준다. 이전엔 같은 일차의 "A에만 있는 장소"와 "B에만
  // 있는 장소"를 서로 다른 두 insight로 나눠 push했는데, 이는 사실
  // 하나("이 일차는 장소 구성이 다르다")의 두 면일 뿐이라 4개로 제한된
  // slot을 같은 사실의 반복으로 낭비했다. 한 일차당 insight를 최대
  // 1개만 만들고, 그 안에서 A/B 양쪽 차이를 함께("플랜 A에만: ... /
  // 플랜 B에만: ...") 보여준다 — 한쪽에만 고유 장소가 있으면 그 쪽만
  // 표시한다.
  for (const dayComparison of dailyPlaceComparison) {
    if (keyDifferences.length >= 4) break;
    const hasUniqueToA = dayComparison.unique_to_a.length > 0;
    const hasUniqueToB = dayComparison.unique_to_b.length > 0;
    if (!hasUniqueToA && !hasUniqueToB) continue;

    const detailParts: string[] = [];
    const textParts: string[] = [];
    if (hasUniqueToA) {
      const list = truncateList(dayComparison.unique_to_a).replaceAll(", ", " · ");
      detailParts.push(`플랜 A에만: ${list}`);
      textParts.push(`플랜 A에만 ${list}이 포함되어 있어요.`);
    }
    if (hasUniqueToB) {
      const list = truncateList(dayComparison.unique_to_b).replaceAll(", ", " · ");
      detailParts.push(`플랜 B에만: ${list}`);
      textParts.push(`플랜 B에만 ${list}이 포함되어 있어요.`);
    }

    keyDifferences.push({
      criterion: "place_composition",
      text: `${dayComparison.day}일차 장소 구성이 달라요. ${textParts.join(" ")}`,
      title: `${dayComparison.day}일차 장소 구성이 달라요.`,
      detail: detailParts.join(" / "),
    });
  }

  if (keyDifferences.length === 0) {
    keyDifferences.push({ criterion: null, text: "비교할 정보가 부족합니다" });
  }

  return {
    plans: { a: planA, b: planB },
    comparison: {
      common_places: commonPlaces,
      unique_to_a: uniqueToA,
      unique_to_b: uniqueToB,
      daily_item_counts: { a: dailyCountsA, b: dailyCountsB },
      daily_place_comparison: dailyPlaceComparison,
      missing_information: { a: missingA, b: missingB },
      key_differences: keyDifferences.slice(0, 4),
    },
  };
}

export function buildDummyComparisonResult(planAText: string, planBText: string): ComparisonResult {
  return buildComparison(parsePlanText(planAText), parsePlanText(planBText));
}
