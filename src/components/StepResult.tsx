"use client";

import { useId, useState, type ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import {
  COMPARISON_CRITERIA,
  type ComparisonCriterionId,
  type ComparisonResult,
  type PlanDay,
  type PlanItem,
  type PlanStructure,
} from "@/types/plan";

type Props = {
  result: ComparisonResult;
  planAText: string;
  planBText: string;
  onBack: () => void;
  onNext: () => void;
  onReopenOriginal: (plan: "a" | "b") => void;
};

function sumItems(counts: number[]) {
  return counts.reduce((sum, n) => sum + n, 0);
}

export default function StepResult({
  result,
  planAText,
  planBText,
  onBack,
  onNext,
  onReopenOriginal,
}: Props) {
  const [openOriginal, setOpenOriginal] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [topTab, setTopTab] = useState<"summary" | "detail">("summary");
  const [planTab, setPlanTab] = useState<"a" | "b">("a");
  const [criterionTab, setCriterionTab] = useState<ComparisonCriterionId>("schedule_scale");

  function toggleOriginal(plan: "a" | "b") {
    setOpenOriginal((prev) => {
      const next = { ...prev, [plan]: !prev[plan] };
      if (next[plan]) onReopenOriginal(plan);
      return next;
    });
  }

  return (
    <div className="w-full">
      <AppHeader variant="back" onBack={onBack} />
      <div className="flex flex-col px-5 pt-20">
        <h1 className="heading-page">일정을 비교해본 결과예요.</h1>

        {/* 페이지 설명(결과 설명 → 비교 범위 안내)을 먼저 읽고 나서
            핵심 요약/상세 비교 중 무엇을 볼지 고르도록, 1차 탭보다
            위에 둔다. 탭 전환과 무관하게 항상 같은 안내이므로 topTab
            분기 밖에서 한 번만 렌더링한다. */}
        <div className="mt-7">
          <ResultDescription />
        </div>
        <div className="mt-3">
          <ComparisonScopeNotice />
        </div>
      </div>

      {/* 1차 탭(핵심 요약/상세 비교)과, 상세 비교 화면일 때만 2차 탭
          (플랜 A/B)까지 같은 sticky 박스 하나에 이어 붙인다. 두 탭을
          각각 별도 sticky 엘리먼트로 나누면 2차 탭의 top 값을 "header
          높이 + 1차 탭 높이"로 새로 계산해야 하는데, 1차 탭의 padding/
          폰트가 바뀔 때마다 그 값이 조용히 어긋나는 매직 넘버가 된다.
          하나의 sticky 박스 안에서 1차 탭 다음에 2차 탭을 그냥 일반
          흐름으로 이어 붙이면 별도 오프셋 계산 자체가 필요 없다 — 박스의
          top은 여전히 AppHeader 높이(56px, top-14) 하나만 기준으로
          삼는다. 비교 기준 상세 4개 탭은 이번에도 이 박스에 넣지 않고
          콘텐츠 영역에 그대로 둔다. AppHeader와 같은 "바깥은 전체 폭
          흰 배경, 안쪽만 앱쉘 폭"(mx-auto/max-w-[430px]) 패턴을 써서
          데스크톱에서도 앱쉘 밖으로 번지지 않는다. gap은 margin이 아니라
          padding으로 줘 sticky 전환 시 여백이 margin-collapse로
          흔들리지 않게 한다 — position: sticky라 레이아웃 자체가 튀는
          일도 없다. */}
      <div className="sticky top-14 z-10 bg-surface">
        <div className="mx-auto w-full max-w-[430px] px-5 pt-6">
          <div className="tab-underline-group">
            <button
              type="button"
              data-active={topTab === "summary"}
              className="tab-underline focus-ring"
              onClick={() => setTopTab("summary")}
            >
              핵심 요약
            </button>
            <button
              type="button"
              data-active={topTab === "detail"}
              className="tab-underline focus-ring"
              onClick={() => setTopTab("detail")}
            >
              상세 비교
            </button>
          </div>
        </div>

        {topTab === "detail" && (
          <div className="mx-auto w-full max-w-[430px] px-5 pb-4 pt-4">
            <div className="tab-pill-group w-full">
              <button
                type="button"
                data-active={planTab === "a"}
                className="tab-pill focus-ring flex-1"
                onClick={() => setPlanTab("a")}
              >
                플랜 A
              </button>
              <button
                type="button"
                data-active={planTab === "b"}
                className="tab-pill focus-ring flex-1"
                onClick={() => setPlanTab("b")}
              >
                플랜 B
              </button>
            </div>
          </div>
        )}
      </div>

      {/* pb-36(144px): CTA(.bottom-cta-bar, ~84px)보다 넉넉히 여유를 둬
          핵심 요약/비교 기준 상세/상세 비교 어느 탭이든 스크롤 맨 아래
          콘텐츠가 CTA에 가리거나 바짝 붙지 않게 한다. */}
      <div className="flex flex-col px-5 pb-36">
        {topTab === "summary" && (
          <section className="mt-6">
            <KeyDifferenceSummary result={result} />
            <div className="mt-7 flex flex-col gap-3">
              <h2 className="heading-card">비교 기준 상세</h2>
              {/* 4개 탭을 segmented control처럼 정확히 4등분한다 —
                  flex-1이라 텍스트 길이와 무관하게 폭이 항상 같다. 한
                  줄 유지를 위해 패딩/글자 크기를 이 탭 전용으로 줄였다
                  (다른 화면의 .tab-pill 사용처는 그대로 둠). */}
              <div className="tab-pill-group w-full">
                {COMPARISON_CRITERIA.map((criterion) => (
                  <button
                    key={criterion.id}
                    type="button"
                    data-active={criterionTab === criterion.id}
                    className="tab-pill focus-ring flex-1 whitespace-nowrap px-1 text-[13px]"
                    onClick={() => setCriterionTab(criterion.id)}
                  >
                    {criterion.label}
                  </button>
                ))}
              </div>
              <ComparisonTable result={result} criterion={criterionTab} />
            </div>
          </section>
        )}

        {topTab === "detail" && (
          <section className="flex flex-col gap-4">
            <PlanSections plan={planTab === "a" ? result.plans.a : result.plans.b} />
            <OriginalToggle
              label={planTab === "a" ? "플랜 A" : "플랜 B"}
              text={planTab === "a" ? planAText : planBText}
              open={planTab === "a" ? openOriginal.a : openOriginal.b}
              onToggle={() => toggleOriginal(planTab)}
            />
          </section>
        )}
      </div>

      {/* Fixed strip spans the viewport; the inner div clamps back to the app
          shell's max width so the CTA never grows wider than the app itself. */}
      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
          <button type="button" onClick={onNext} className="btn-primary focus-ring w-full">
            결정하러 가기
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultDescription() {
  return (
    <p className="text-body-secondary leading-[1.65]">
      입력된 두 일정에서 확인된 차이를 같은 기준으로 정리한 결과입니다. 어느 일정이 더
      적합한지는 개인의 취향·체력·예산에 따라 달라질 수 있습니다. 지금 정보만으로 선택이
      어렵다면 &apos;결정 어려움&apos;을 선택할 수 있습니다.
    </p>
  );
}

/** 지도·거리/교통시간 관련 오해를 막기 위한 별도 info 영역. 일반 보조
 *  텍스트로 묻어두지 않고 아이콘 + 중립(Neutral) 톤으로 시각적으로
 *  분리한다 — AI 관련 강조는 Purple/Blue, 일반 보조 정보는 Gray라는
 *  색상 원칙에 따라 여기서는 의도적으로 Purple을 쓰지 않는다(이 박스
 *  자체가 "AI가 하지 않는 일"을 알리는 정보라서 AI 카드 톤과 섞이면
 *  오히려 오해를 키운다). Red/warning 컬러도 쓰지 않는다 — 오류가
 *  아니라 범위 안내이기 때문이다. */
function ComparisonScopeNotice() {
  return (
    <div className="scope-notice">
      <InfoIcon />
      <div>
        <p className="scope-notice-title">비교 범위 안내</p>
        <p className="scope-notice-text">
          입력된 일정만을 기준으로 비교하며, 지도 기반 거리·교통시간은 계산하지 않습니다.
        </p>
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-primary"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11" y="10.5" width="2" height="6.5" rx="1" fill="currentColor" />
      <circle cx="12" cy="7.4" r="1.15" fill="currentColor" />
    </svg>
  );
}

function explicitCount(totalItems: number, missingCount: number) {
  return totalItems - missingCount;
}

// "핵심 요약" 카드에 쓰는 4개 고정 기준 문장. dummyComparison이 이미
// 계산해 둔 값만 그대로 읽어 자연어 문장으로 바꿀 뿐, 값을 새로 만들거나
// 추론하지 않는다. 같음/다름 여부에 따라 문장이 달라지지만 어느 쪽도
// "더 좋다/효율적이다/추천한다" 같은 주관적 판단은 포함하지 않는다.

function arraysEqual(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

// "일정 규모"는 여행 일수 + 일차별 항목 수가 같은지("개수" 사실)만
// 말한다. 그 개수 안의 실제 장소/활동이 같은지는 별도 기준(날짜별
// 구성, dailyCompositionSentences)에서 다루므로 여기서 "구성이
// 같다"고 단정하지 않는다 — 개수 동일과 구성 동일을 섞지 않기 위함.
// 이 사실은 A/B의 실제 차이가 아니라 공통점인 경우가 많아, 핵심 요약
// 목록의 마지막(보조 정보)에 둔다 — 강조할 첫 문장으로 쓰지 않는다.
function scheduleSentence({ plans, comparison }: ComparisonResult): string {
  const a = plans.a.duration_days;
  const b = plans.b.duration_days;
  if (a === null || b === null) return "여행 기간 정보가 부족합니다.";

  const countsEqual = arraysEqual(comparison.daily_item_counts.a, comparison.daily_item_counts.b);

  if (a === b) {
    return countsEqual ? "기간·일차별 항목 수는 동일합니다." : `두 일정 모두 ${a}일이지만 일차별 항목 수는 다릅니다.`;
  }
  const countsClause = countsEqual ? "일차별 항목 수는 동일합니다" : "일차별 항목 수는 다릅니다";
  return `여행 기간은 A ${a}일, B ${b}일이며 ${countsClause}.`;
}

// "전체 일정에 등장하는 장소가 같다"와 "일차별 구성이 같다"는 서로
// 다른 사실이다. 전체 장소 집합은 같은데 일차별 배치만 다른 경우
// (흔한 케이스) "장소가 같다"고만 말하면 바로 이어지는 날짜별 차이
// 문장과 모순처럼 읽히므로, 그 경우엔 "배치된 날짜가 다르다"는 점까지
// 한 문장에 명시한다.
function overallPlaceSentence({ comparison }: ComparisonResult): string {
  const { unique_to_a, unique_to_b, daily_place_comparison } = comparison;
  const hasDayDifference = daily_place_comparison.some(
    (d) => d.unique_to_a.length > 0 || d.unique_to_b.length > 0
  );

  if (unique_to_a.length === 0 && unique_to_b.length === 0) {
    return hasDayDifference
      ? "전체 여행에서 등장하는 장소는 같지만, 일부 장소가 배치된 날짜가 다릅니다."
      : "전체 일정에서 등장하는 장소가 동일합니다.";
  }
  if (unique_to_b.length === 0) return `전체 일정 기준으로 A에만 있는 장소가 ${unique_to_a.length}곳 있습니다.`;
  if (unique_to_a.length === 0) return `전체 일정 기준으로 B에만 있는 장소가 ${unique_to_b.length}곳 있습니다.`;
  return `전체 일정 기준으로 A에만 있는 장소 ${unique_to_a.length}곳, B에만 있는 장소 ${unique_to_b.length}곳이 있습니다.`;
}

function formatLabelList(labels: string[], max = 3): string {
  if (labels.length <= max) return labels.join("·");
  return `${labels.slice(0, max).join("·")} 외 ${labels.length - max}곳`;
}

// 일정 "개수"가 아니라 일차마다 실제로 있는 장소/활동 집합을 비교한다.
// daily_place_comparison은 같은 개수라도 구성이 다를 수 있다는 사실을
// 이미 반영해 계산되어 있으므로, 여기서는 그 결과를 문장으로 옮기기만
// 한다. 차이가 없는 날은 언급하지 않고, 차이가 있는 날만(최대 3일)
// 실제 장소/활동명을 그대로 보여준다.
function dailyCompositionSentences({ comparison }: ComparisonResult): string[] {
  const diffDays = comparison.daily_place_comparison.filter(
    (d) => d.unique_to_a.length > 0 || d.unique_to_b.length > 0
  );

  if (diffDays.length === 0) return ["모든 일차의 장소·활동 구성이 동일합니다."];

  return diffDays.slice(0, 3).map((d) => {
    const parts = [
      d.unique_to_a.length > 0 ? `A에 ${formatLabelList(d.unique_to_a)}` : null,
      d.unique_to_b.length > 0 ? `B에 ${formatLabelList(d.unique_to_b)}` : null,
    ].filter((part): part is string => part !== null);
    return `${d.day}일차에는 ${parts.join(", ")}이 포함되어 있습니다.`;
  });
}

// 정보 완성도는 시간/장소/비용 3가지 모두 실제 item 기준(missing_information)
// 으로 계산된다. 문장에는 가장 먼저 차이가 있는 하나를 우선 보여주고
// (시간 → 비용 → 장소 순 — PRD 예시가 시간을 첫 예로 들었고, 비용은
// "명시 비용" 규칙과 바로 연결되는 항목이라 다음 우선순위), 셋 다
// 같으면 이를 그대로 밝힌다. 표(ComparisonTable)에는 3개 모두 항상
// 노출되므로 문장에서 하나만 골라도 정보가 누락되지는 않는다.
function infoSentence({ comparison }: ComparisonResult): string {
  const totalA = sumItems(comparison.daily_item_counts.a);
  const totalB = sumItems(comparison.daily_item_counts.b);
  const timeA = explicitCount(totalA, comparison.missing_information.a.time);
  const timeB = explicitCount(totalB, comparison.missing_information.b.time);
  const costA = explicitCount(totalA, comparison.missing_information.a.cost);
  const costB = explicitCount(totalB, comparison.missing_information.b.cost);
  const placeA = explicitCount(totalA, comparison.missing_information.a.place);
  const placeB = explicitCount(totalB, comparison.missing_information.b.place);

  if (timeA !== timeB) return `시간 정보가 명시된 항목은 A ${timeA}개, B ${timeB}개입니다.`;
  if (costA !== costB) return `비용 정보가 명시된 항목은 A ${costA}개, B ${costB}개입니다.`;
  if (placeA !== placeB) return `장소 정보가 명시된 항목은 A ${placeA}개, B ${placeB}개입니다.`;
  if (timeA === 0 && costA === 0) return "두 일정 모두 시간·비용 정보가 명시되어 있지 않습니다.";
  return `두 일정 모두 시간 정보 ${timeA}개, 비용 정보 ${costA}개가 명시되어 있습니다.`;
}

function KeyDifferenceSummary({ result }: { result: ComparisonResult }) {
  // 실제 차이가 있는 사실(장소 배치, 날짜별 구성, 명시 정보)을 먼저
  // 보여주고, 두 일정의 공통점에 가까운 "기간·항목 수" 사실은 보조
  // 정보로 마지막에 둔다.
  const lines = [
    overallPlaceSentence(result),
    ...dailyCompositionSentences(result),
    infoSentence(result),
    scheduleSentence(result),
  ];

  return (
    <div className="ai-card-border">
      <div className="ai-card-inner">
        <div className="flex items-center gap-1.5">
          <SparkleIcon />
          <h2 className="ai-card-title">TripFit AI가 정리한 핵심 요약</h2>
        </div>
        <p className="text-caption mt-1 text-[13px] leading-[1.5]">
          입력된 두 일정에서 확인된 차이를 같은 기준으로 정리했어요.
        </p>

        <ul className="mt-5 flex flex-col gap-3">
          {lines.map((text, index) => (
            <li key={index} className="flex gap-2.5">
              <CheckIcon />
              <span className="text-[16px] leading-[1.55] text-text-primary">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** AI 카드 헤더 전용 반짝이 아이콘. 회전/점멸 없이 정적인 gradient
 *  채우기만 사용 — "과한 AI 느낌 금지" 요구를 따른다. */
function SparkleIcon() {
  const gradientId = useId();
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7a2eff" />
          <stop offset="55%" stopColor="#5b5bd6" />
          <stop offset="100%" stopColor="#6ea8fe" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5c.32 3.32 1.06 5.6 2.22 6.78 1.18 1.16 3.46 1.9 6.78 2.22-3.32.32-5.6 1.06-6.78 2.22-1.16 1.18-1.9 3.46-2.22 6.78-.32-3.32-1.06-5.6-2.22-6.78-1.18-1.16-3.46-1.9-6.78-2.22 3.32-.32 5.6-1.06 6.78-2.22C10.94 8.1 11.68 5.82 12 2.5z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}

/** 핵심 요약 목록의 체크 아이콘. 이전엔 유니코드 "✓" 글자였는데 폰트
 *  글자 굵기로는 선 두께를 정밀하게 제어할 수 없어(font-weight 몇 단계
 *  뿐), Lucide Check와 같은 모양의 stroke 기반 SVG로 바꿨다 —
 *  strokeWidth 하나로 "본문 대비 존재감"을 정확히 한 단계만 조정할 수
 *  있다(기본 2 → 2.5, +0.5). 이전 텍스트 글자와 같은 17px 박스/여백을
 *  그대로 유지해 크기·위치·간격은 바뀌지 않는다. */
function CheckIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-primary"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

type ComparisonRow =
  | { kind: "split"; label: string; a: string; b: string }
  | { kind: "single"; label: string; value: string };
type ComparisonSection = {
  id: ComparisonCriterionId;
  title: string;
  description?: string;
  note?: string;
  rows: ComparisonRow[];
};

// 한 일차, 한 플랜에서 실제로 명시된 시간/시간대 값만 모은다(중복
// 제거, 등장 순서 유지). "정보 없음"을 만들지 않고 없으면 빈 배열.
function dayTimeLabels(day: PlanDay | undefined): string[] {
  if (!day) return [];
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const item of day.items) {
    if (item.time && !seen.has(item.time)) {
      seen.add(item.time);
      labels.push(item.time);
    }
  }
  return labels;
}

function average(counts: number[]): number {
  if (counts.length === 0) return 0;
  return sumItems(counts) / counts.length;
}

function formatAverage(value: number): string {
  return Number.isInteger(value) ? `${value}개` : `${value.toFixed(1)}개`;
}

/** "핵심 요약" 탭, AI 카드 아래의 compact A/B 비교 표. dummyComparison이
 *  이미 계산해 둔 값만 그대로 읽어 표시하며, 값을 새로 만들거나 추론하지
 *  않는다.
 *
 *  TripFit v0.7 고정 비교 기준 4개만 그대로 쓴다 — 일정 규모 / 장소
 *  구성 / 날짜별 구성 / 정보 완성도. "명시 비용"은 별도 기준이 아니라
 *  정보 완성도의 비용 명시/누락 수로 포함된다.
 *
 *  "날짜별 구성"은 정형화된 숫자 비교표가 아니라 day-based 콘텐츠라
 *  전용 컴포넌트(DailyStructureView)로 별도 렌더링한다 — 이 함수는
 *  나머지 3개 기준(일정 규모/장소 구성/정보 완성도)만 다룬다. */
function buildComparisonSections(result: ComparisonResult): ComparisonSection[] {
  const { comparison, plans } = result;
  const countsA = comparison.daily_item_counts.a;
  const countsB = comparison.daily_item_counts.b;
  const dayCount = Math.max(countsA.length, countsB.length);
  const totalA = sumItems(countsA);
  const totalB = sumItems(countsB);

  const dailyCountRows: ComparisonRow[] =
    dayCount === 0
      ? [{ kind: "split", label: "일차별 항목 수", a: "정보 없음", b: "정보 없음" }]
      : Array.from({ length: dayCount }, (_, i) => ({
          kind: "split" as const,
          label: `${i + 1}일차 항목 수`,
          a: i < countsA.length ? `${countsA[i]}개` : "–",
          b: i < countsB.length ? `${countsB[i]}개` : "–",
        }));

  return [
    {
      id: "schedule_scale",
      title: "일정 규모",
      rows: [
        {
          kind: "split",
          label: "여행 일수",
          a: plans.a.duration_days !== null ? `${plans.a.duration_days}일` : "정보 없음",
          b: plans.b.duration_days !== null ? `${plans.b.duration_days}일` : "정보 없음",
        },
        { kind: "split", label: "전체 항목 수", a: `${totalA}개`, b: `${totalB}개` },
        ...dailyCountRows,
        { kind: "split", label: "하루 평균 항목 수", a: formatAverage(average(countsA)), b: formatAverage(average(countsB)) },
      ],
    },
    {
      id: "place_composition",
      title: "장소 구성",
      // 공통 장소는 A/B 어느 한쪽의 값이 아니라 둘을 비교해서 나온
      // 결과이므로 Plan A/B 컬럼에 넣지 않고 단독 값으로 보여준다.
      // "각 플랜에만 있는 장소"만 A/B로 나뉜다.
      rows: [
        { kind: "single", label: "공통 장소", value: `${comparison.common_places.length}곳` },
        {
          kind: "split",
          label: "각 플랜에만 있는 장소",
          a: `${comparison.unique_to_a.length}곳`,
          b: `${comparison.unique_to_b.length}곳`,
        },
      ],
    },
    {
      id: "information_completeness",
      title: "정보 완성도",
      description: "각 일정 항목에 해당 정보가 입력되어 있는지를 기준으로 계산합니다.",
      note: "비용은 원문에 명시된 값만 표시하며 합산·환산하지 않습니다.",
      rows: [
        {
          kind: "split",
          label: "시간 정보",
          a: `${explicitCount(totalA, comparison.missing_information.a.time)}개`,
          b: `${explicitCount(totalB, comparison.missing_information.b.time)}개`,
        },
        {
          kind: "split",
          label: "장소 정보",
          a: `${explicitCount(totalA, comparison.missing_information.a.place)}개`,
          b: `${explicitCount(totalB, comparison.missing_information.b.place)}개`,
        },
        {
          kind: "split",
          label: "비용 정보",
          a: `${explicitCount(totalA, comparison.missing_information.a.cost)}개`,
          b: `${explicitCount(totalB, comparison.missing_information.b.cost)}개`,
        },
      ],
    },
  ];
}

/** "비교 기준 상세" 2차 탭에서 선택된 기준 하나의 표만 보여준다. 4개
 *  기준을 한 화면에 전부 세로로 늘어놓지 않고, 탭으로 전환해 한 번에
 *  하나씩 — AI 요약을 먼저 읽고 궁금한 기준만 골라 보는 흐름에 맞춘다.
 *  raw 계산값(buildComparisonSections)은 이전과 동일하게 재사용할 뿐,
 *  어떤 section을 렌더링할지만 criterion prop으로 고른다. */
/** "비교 기준 상세" 2차 탭에서 선택된 기준 하나만 보여준다. "날짜별
 *  구성"은 정형화된 숫자표가 아니라 day-based 콘텐츠라 전용 레이아웃
 *  (DailyStructureView)으로 그리고, 나머지 3개 기준(일정 규모/장소
 *  구성/정보 완성도)은 표로 그린다. 표 헤더는 "비교 항목" 같은 공통
 *  라벨 대신 지금 선택된 기준명 자체를 왼쪽 헤더로 보여줘 별도의 제목
 *  줄을 반복하지 않는다. 보조 설명(description/note)은 표를 다 읽은
 *  뒤 참고하도록 표 아래에 둔다. */
function ComparisonTable({ result, criterion }: { result: ComparisonResult; criterion: ComparisonCriterionId }) {
  if (criterion === "daily_structure") {
    return <DailyStructureView result={result} />;
  }

  const sections = buildComparisonSections(result);
  const section = sections.find((s) => s.id === criterion);
  if (!section) return null;

  return (
    <div className="rounded-container bg-subtle-surface p-4">
      <div className="grid grid-cols-[1fr_64px_64px] items-center gap-x-2">
        <span className="text-[14px] font-bold text-text-primary">{section.title}</span>
        <span className="text-right text-[13px] font-semibold text-text-secondary">플랜 A</span>
        <span className="text-right text-[13px] font-semibold text-text-secondary">플랜 B</span>
      </div>

      <div className="mt-3">
        <div className="flex flex-col">
          {section.rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_64px_64px] items-start gap-x-2 py-1">
              <span className="text-[14px] leading-[1.3] text-text-secondary">{row.label}</span>
              {row.kind === "split" ? (
                <>
                  <span className="text-right text-[14px] font-semibold leading-[1.3] text-text-primary">
                    {row.a}
                  </span>
                  <span className="text-right text-[14px] font-semibold leading-[1.3] text-text-primary">
                    {row.b}
                  </span>
                </>
              ) : (
                <span className="col-span-2 text-right text-[14px] font-semibold leading-[1.3] text-text-primary">
                  {row.value}
                </span>
              )}
            </div>
          ))}
        </div>
        {(section.description || section.note) && (
          <div className="mt-3 flex flex-col gap-1">
            {section.description && (
              <p className="text-caption text-[13px] leading-[1.5]">{section.description}</p>
            )}
            {section.note && <p className="text-caption text-[13px] leading-[1.5]">{section.note}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** "날짜별 구성" 전용 레이아웃. 일차마다 하나의 정보 group으로
 *  묶는다 — Day title → 장소·활동(라벨+값) → 시간 정보(라벨 + Plan A/B
 *  행). column header("비교 항목 | Plan A | Plan B")는 day-based
 *  콘텐츠에 맞지 않아 쓰지 않고, Plan A/B는 시간 정보 안의 row label로만
 *  쓴다. 값 자체는 daily_place_comparison/plans의 raw 계산 결과를 그대로
 *  옮길 뿐 새로 추정하지 않는다. */
function DailyStructureView({ result }: { result: ComparisonResult }) {
  const { comparison, plans } = result;

  return (
    <div className="rounded-container bg-subtle-surface p-4">
      <h3 className="text-[14px] font-bold text-text-primary">날짜별 구성</h3>
      <div className="mt-3 flex flex-col gap-7">
        {comparison.daily_place_comparison.map((d) => {
          const timesA = dayTimeLabels(plans.a.days[d.day - 1]);
          const timesB = dayTimeLabels(plans.b.days[d.day - 1]);
          // 같은 일차라도 A/B 원문에 적힌 날짜가 다를 수 있어 병합하지
          // 않는다 — A에 날짜가 있으면 그대로 쓰고, 없으면 B의 날짜를
          // 쓴다(둘 다 없으면 표시하지 않음).
          const date = plans.a.days[d.day - 1]?.date ?? plans.b.days[d.day - 1]?.date ?? null;
          return (
            <div key={d.day}>
              <h4 className="flex items-baseline gap-2 text-[18px] font-bold leading-[1.3] text-text-primary">
                <span>{d.day}일차</span>
                {date !== null && <span className="text-[14px] font-medium text-text-secondary">{date}</span>}
              </h4>

              <div className="mt-4">
                <p className="text-[14px] font-semibold text-text-primary">장소·활동</p>
                <p className="mt-1.5 text-[14px] leading-[1.4] text-text-primary">
                  공통 {d.common.length}개 · A만 {d.unique_to_a.length}개 · B만 {d.unique_to_b.length}개
                </p>
              </div>

              <div className="mt-4">
                <p className="text-[14px] font-semibold text-text-primary">시간 정보</p>
                <div className="mt-2 flex flex-col gap-2">
                  <DailyTimeRow label="플랜 A" times={timesA} />
                  <DailyTimeRow label="플랜 B" times={timesB} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DailyTimeRow({ label, times }: { label: string; times: string[] }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-16 shrink-0 text-[15px] font-medium leading-[1.4] text-text-secondary">{label}</span>
      {times.length === 0 ? (
        <span className="text-[14px] leading-[1.4] text-text-secondary">없음</span>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {times.map((t, j) => (
            <span key={j} className="time-chip">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** 한 플랜의 상세 정보. Plan A/B 모두 이 컴포넌트 하나만 쓰며, 입력
 *  형식(대시 목록/서술형)과 무관하게 항상 같은 Day → Schedule Item
 *  구조로 렌더링한다. 비용/숙소는 각 일정 item 안에서 이미 보여주므로
 *  하단에 따로 요약 섹션을 두지 않는다 — 완전히 같은 정보의 중복
 *  노출을 피하기 위함(raw parsing 데이터 자체는 그대로 유지되고, 화면
 *  표시만 정리한 것). */
function PlanSections({ plan }: { plan: PlanStructure }) {
  return (
    <div className="flex flex-col gap-6">
      <SectionBlock title="일정">
        <ItineraryDays plan={plan} />
      </SectionBlock>
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="heading-card">{title}</h3>
      {children}
    </div>
  );
}

/** Plan A/B 공통 일차 그룹. 하루를 하나의 subtle-surface 섹션으로 묶고,
 *  그 안의 항목들을 세로 타임라인(뱃지 + 연결선)으로 잇는다. "n일차"와
 *  날짜는 한 줄에 붙이지 않고 위/아래로 분리해서 보여준다 — 날짜는
 *  원문에 실제로 있을 때만(dummyComparison의 extractDayDate) 입력된
 *  표현 그대로 노출하고, 없으면 만들지 않는다. 비교 기준 상세 표
 *  카드(ComparisonTable/DailyStructureView)와 같은 bg-subtle-surface를
 *  써서 카드 surface를 하나의 시스템으로 통일한다 — 역할 구분은 이
 *  배경색이 아니라 typography/time·cost chip/장소 아이콘으로 한다. */
function ItineraryDays({ plan }: { plan: PlanStructure }) {
  return (
    <div className="flex flex-col gap-4">
      {plan.days.map((day) => (
        <div key={day.day} className="rounded-container bg-subtle-surface p-4">
          <div className="mb-5">
            <h4 className="text-[16px] font-bold leading-[1.3] text-text-primary">{day.day}일차</h4>
            {day.date !== null && (
              <p className="mt-0.5 text-[13px] font-medium text-text-secondary">{day.date}</p>
            )}
          </div>
          <div className="flex flex-col">
            {day.items.map((item, i) => (
              <TimelineItem key={i} item={item} isLast={i === day.items.length - 1} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 타임라인 한 행 — 왼쪽 rail(보라색 뱃지 아이콘 + 다음 항목까지 이어지는
 *  세로선)과 오른쪽 ScheduleItem 콘텐츠로 구성한다. 회색 박스 마커가
 *  아니라 장소를 나타내는 핀 아이콘을 채운 Primary Purple 원형 뱃지를
 *  쓴다. rail의 선은 이 행 자신의 높이만큼 늘어나(flex-1) 바로 아래
 *  항목의 뱃지까지 시각적으로 끊김 없이 이어진다 — 그래서 행 사이에는
 *  별도 gap을 두지 않고, item 간 간격은 콘텐츠 쪽 padding-bottom(28px)
 *  으로만 만든다. 마지막 항목은 선을 그리지 않는다. 세로선은 이 앱에서
 *  기본적으로 쓰지 않는 border를 타임라인이라는 새 UI 패턴에 한해
 *  예외로 쓰는 것이다(핵심 요약 카드의 그라디언트 테두리와 같은 성격의
 *  예외). */
function TimelineItem({ item, isLast }: { item: PlanItem; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex w-5 shrink-0 flex-col items-center">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary"
          aria-hidden="true"
        >
          <PlaceBadgeIcon />
        </span>
        {!isLast && <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-7"}`}>
        <ScheduleItem item={item} />
      </div>
    </div>
  );
}

/** 타임라인 뱃지 안에 들어가는 흰색 핀 아이콘. 장소/활동이라는 의미만
 *  전달하는 장식용 아이콘이라 aria-hidden으로 스크린리더에서 제외한다. */
function PlaceBadgeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="#ffffff"
      />
      <circle cx="12" cy="9" r="2.6" fill="var(--color-primary)" />
    </svg>
  );
}

/** Plan A/B가 공유하는 유일한 일정 항목 UI. 입력 형식과 무관하게 같은
 *  위계로 보여준다 — 1차(primary)는 구체적인 place가 있으면 place만
 *  보여준다("저녁"/"점심"/"산책" 등 TRAILING_ACTIVITY_WORDS는 장소명이
 *  아니므로 title에 붙이지 않는다 — 대시 형식은 "장소 활동" 한 chunk를
 *  place/activity로 나눠 파싱하는데, 서술형은 애초에 place와 activity를
 *  같은 item에 함께 담지 않으므로 이 분리가 두 형식의 title 표시를
 *  일관되게 만든다). place가 없으면 activity를 그대로 1차로 보여준다
 *  (점심/숙소 이동처럼 장소 없이 활동만 있는 항목). place와 activity가
 *  함께 있을 때 activity는 보조 설명 영역에 표시하되, 원문에 실제
 *  보조 설명(description)이 이미 있으면 그 문장이 activity 의미를
 *  포함하므로(예: "저녁" + "돼지국밥으로 저녁 식사") 중복 표시하지
 *  않는다. 시간·비용은 각각 "시간"/"비용" 라벨을 먼저 보여주고 그 아래
 *  줄에 chip을 두는 세로 구조로 분리해 정보 위계를 명확히 한다. 명시되지
 *  않은 값은 그 라벨+chip 블록 자체를 만들지 않는다("—"를 반복해 밀도를
 *  높이지 않음) — raw parsing 결과는 그대로 두고 화면 표시만 정리한 것. */
function ScheduleItem({ item }: { item: PlanItem }) {
  const primary = item.place ?? item.activity ?? "정보 없음";
  const activityNote =
    item.place !== null && item.activity !== null && item.description === null
      ? item.activity
      : null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[16px] font-semibold leading-[1.3] text-text-primary">{primary}</span>
      {item.description !== null && (
        <p className="text-[14px] leading-[1.4] text-text-secondary">{item.description}</p>
      )}
      {activityNote !== null && (
        <p className="text-[14px] leading-[1.4] text-text-secondary">{activityNote}</p>
      )}
      {item.time !== null && (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[13px] font-medium text-text-secondary">시간</span>
          <span className="time-chip">{item.time}</span>
        </div>
      )}
      {item.stated_cost !== null && (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[13px] font-medium text-text-secondary">비용</span>
          <span className="cost-chip">{item.stated_cost}</span>
        </div>
      )}
    </div>
  );
}

/** 현재 선택된 플랜(planTab)의 원문만 보여주는 단일 accordion. 화면에는
 *  항상 "원문 다시보기"만 노출하고, 어떤 플랜인지는 aria-label로만
 *  전달한다 — 펼치기/접기 텍스트는 노출하지 않는다. */
function OriginalToggle({
  label,
  text,
  open,
  onToggle,
}: {
  label: string;
  text: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  return (
    <div className="accordion">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label} 원문 다시보기`}
        className="accordion-trigger focus-ring"
      >
        <span>원문 다시보기</span>
        <ChevronDownIcon open={open} />
      </button>
      {open && (
        <div id={panelId} className="accordion-panel">
          <pre className="whitespace-pre-wrap font-sans text-sm text-text-secondary">{text}</pre>
        </div>
      )}
    </div>
  );
}

/** accordion 전용 line chevron. 상단 back chevron과 동일한 stroke 스타일을
 *  쓰되, 채워진 삼각형(▼/▲)은 쓰지 않는다. 열림 상태는 180deg 회전으로만
 *  표현한다. */
function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-text-secondary transition-transform duration-150 ease-out"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
