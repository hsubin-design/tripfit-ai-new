import type { ComparisonResult, PlanDay, PlanItem, PlanStructure } from "@/types/plan";

// v0.7 핵심 흐름 단계용 더미 구조화 로직. 실제 LLM 연동(추후 단계) 전까지
// 화면 흐름을 확인하기 위한 것으로, 입력 텍스트에 실제로 있는 부분 문자열만
// 추출하고 값이 불확실하면 null로 둔다 (사실 창작 금지 가드레일 준수).

const DAY_MARKER =
  /^(?:(\d+)\s*일\s*차|Day\s*(\d+)|첫째\s*날|둘째\s*날|셋째\s*날|넷째\s*날|다섯째\s*날|여섯째\s*날|마지막\s*날)(?:에는|에서는|은|는|에)?/;

const TIME_PATTERN = /(\d{1,2}:\d{2})|((?:오전|오후)\s?\d{1,2}시(?:\s?\d{1,2}분)?)/;
const COST_PATTERN = /(\d[\d,]*\s?원|₩\s?[\d,]+)/;
const TRAILING_ACTIVITY_WORDS = [
  "도착",
  "출발",
  "저녁",
  "점심",
  "아침",
  "산책",
  "관람",
  "방문",
  "이동",
  "숙소",
  "체크인",
  "체크아웃",
];

function splitIntoDayBlocks(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks: string[] = [];
  let pendingHeaderOnly: string | null = null;

  for (const paragraph of paragraphs) {
    const isHeaderOnly = DAY_MARKER.test(paragraph) && paragraph.length <= 6;
    if (isHeaderOnly) {
      if (pendingHeaderOnly) blocks.push(pendingHeaderOnly);
      pendingHeaderOnly = paragraph;
      continue;
    }
    if (pendingHeaderOnly) {
      blocks.push(`${pendingHeaderOnly}\n${paragraph}`);
      pendingHeaderOnly = null;
    } else if (DAY_MARKER.test(paragraph)) {
      blocks.push(paragraph);
    } else if (blocks.length > 0) {
      // 헤더 없이 이어지는 본문은 직전 일차에 포함
      blocks[blocks.length - 1] += `\n${paragraph}`;
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

function parseMemoChunk(rawChunk: string): PlanItem {
  let remaining = rawChunk.trim();

  const time = extractLeading(TIME_PATTERN, remaining);
  remaining = time.rest;
  const cost = extractLeading(COST_PATTERN, remaining);
  remaining = cost.rest;

  let place: string | null = remaining || null;
  let activity: string | null = null;

  for (const word of TRAILING_ACTIVITY_WORDS) {
    if (remaining.endsWith(word) && remaining !== word) {
      place = remaining.slice(0, remaining.length - word.length).trim() || null;
      activity = word;
      break;
    } else if (remaining === word) {
      place = null;
      activity = word;
      break;
    }
  }

  return {
    time: time.matched,
    place,
    activity,
    stated_cost: cost.matched,
  };
}

function parseDayBody(body: string): PlanItem[] {
  const withoutHeaderLine = body.replace(DAY_MARKER, "").trim();
  const content = withoutHeaderLine || body.trim();

  const hasDashList = /\s-\s|\s–\s|\s—\s/.test(content);

  if (hasDashList) {
    return content
      .split(/\n/)
      .flatMap((line) => line.split(/\s[-–—]\s/))
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map(parseMemoChunk);
  }

  // 서술형 문장: 구조 추출이 불확실하므로 원문 그대로 activity에 담고
  // 나머지 필드는 null로 유지 (정보 없음으로 표시됨).
  return [
    {
      time: null,
      place: null,
      activity: content || null,
      stated_cost: null,
    },
  ];
}

export function parsePlanText(text: string): PlanStructure {
  const blocks = splitIntoDayBlocks(text);
  const days: PlanDay[] = blocks.map((block, index) => ({
    day: index + 1,
    items: parseDayBody(block),
  }));

  return {
    duration_days: days.length > 0 ? days.length : null,
    days,
  };
}

function collectPlaces(plan: PlanStructure): string[] {
  const places = new Set<string>();
  for (const day of plan.days) {
    for (const item of day.items) {
      if (item.place) places.add(item.place.trim());
    }
  }
  return Array.from(places);
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

function truncateList(list: string[], max = 3): string {
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} 외 ${list.length - max}곳`;
}

export function buildComparison(planA: PlanStructure, planB: PlanStructure): ComparisonResult {
  const placesA = collectPlaces(planA);
  const placesB = collectPlaces(planB);
  const setA = new Set(placesA);
  const setB = new Set(placesB);

  const commonPlaces = placesA.filter((p) => setB.has(p));
  const uniqueToA = placesA.filter((p) => !setB.has(p));
  const uniqueToB = placesB.filter((p) => !setA.has(p));

  const dailyCountsA = planA.days.map((d) => d.items.length);
  const dailyCountsB = planB.days.map((d) => d.items.length);

  const missingA = countMissing(planA);
  const missingB = countMissing(planB);

  const keyDifferences: string[] = [];

  if (dailyCountsA.length !== dailyCountsB.length) {
    keyDifferences.push(
      `A는 총 ${dailyCountsA.length}일 일정, B는 총 ${dailyCountsB.length}일 일정으로 구성되어 있음`
    );
  }

  const maxDays = Math.min(dailyCountsA.length, dailyCountsB.length);
  for (let i = 0; i < maxDays && keyDifferences.length < 5; i++) {
    if (dailyCountsA[i] !== dailyCountsB[i]) {
      keyDifferences.push(
        `A는 ${i + 1}일차에 항목이 ${dailyCountsA[i]}개, B는 ${dailyCountsB[i]}개 있음`
      );
    }
  }

  if (uniqueToA.length > 0 && keyDifferences.length < 5) {
    keyDifferences.push(`A에만 있는 장소: ${truncateList(uniqueToA)}`);
  }
  if (uniqueToB.length > 0 && keyDifferences.length < 5) {
    keyDifferences.push(`B에만 있는 장소: ${truncateList(uniqueToB)}`);
  }
  if (missingA.cost !== missingB.cost && keyDifferences.length < 5) {
    keyDifferences.push(
      `비용 정보가 없는 항목이 A는 ${missingA.cost}건, B는 ${missingB.cost}건 있음`
    );
  }

  if (keyDifferences.length === 0) {
    keyDifferences.push("비교할 정보가 부족합니다");
  }

  return {
    plans: { a: planA, b: planB },
    comparison: {
      common_places: commonPlaces,
      unique_to_a: uniqueToA,
      unique_to_b: uniqueToB,
      daily_item_counts: { a: dailyCountsA, b: dailyCountsB },
      missing_information: { a: missingA, b: missingB },
      key_differences: keyDifferences.slice(0, 5),
    },
  };
}

export function buildDummyComparisonResult(planAText: string, planBText: string): ComparisonResult {
  return buildComparison(parsePlanText(planAText), parsePlanText(planBText));
}
