"use client";

import { useId, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import type { ComparisonResult, PlanDay, PlanItem, PlanStructure } from "@/types/plan";
import { classifyPlaceCategory } from "@/lib/placeCategory";
import { sumDayCost, sumPlanCost } from "@/lib/costSummary";
import { explicitTimeToMinutes, formatExplicitTime, sortItemsByExplicitTime } from "@/lib/timeSort";
import { getMockRouteSegment, isDevRouteMockEnabled, sumMockRoute, type RouteMode } from "@/lib/devRouteMock";

// v1.0 결과 화면 재설계 — Figma "Result / Option B" 골격을 그대로 옮긴다.
// 기존 "핵심 요약 / 상세 비교" 1차 탭 + Plan A/B 2차 탭(플랜 하나씩만
// 보여주고 왕복) 구조를 걷어내고, 같은 일차 안에서 Plan A → Plan B를
// 이어서 보여주는 구조로 바꾼다. ComparisonHelpfulness(피드백 위젯)는
// 이미 여러 라운드에 걸쳐 확정된 디자인이라 내용을 그대로 옮겨왔다.

type Props = {
  result: ComparisonResult;
  planAText: string;
  planBText: string;
  onBack: () => void;
  onNext: () => void;
  onReopenOriginal: (plan: "a" | "b") => void;
  comparisonHelpfulness: "helpful" | "not_helpful" | null;
  onSelectComparisonHelpfulness: (value: "helpful" | "not_helpful") => void;
  comparisonHelpfulnessReason: string;
  onChangeComparisonHelpfulnessReason: (text: string) => void;
  comparisonFeedbackSubmitted: boolean;
  isSubmittingComparisonFeedback: boolean;
  comparisonFeedbackSubmitError: string | null;
  onSubmitComparisonFeedback: () => void;
  /** v1.0 dev — "지도에서 N일차 동선 보기" CTA. 실제 지도 화면이 아니라
   *  UX 흐름 검증용 placeholder 화면으로 이동한다(RouteCompareDev). */
  onOpenRouteCompare: (day: number) => void;
  /** v1.0 dev — Plan A/B swipe carousel 실험안(ResultSwipeVariantDev)
   *  진입점. 기본 구조(vertical A→B)와 비교해보기 위한 실험용 화면일
   *  뿐이라 dev 환경에서만 링크를 보여준다. */
  onOpenSwipeExperiment: () => void;
};

const WON_FORMATTER = new Intl.NumberFormat("ko-KR");
function formatWon(amount: number): string {
  return `${WON_FORMATTER.format(amount)}원`;
}

export default function StepResult({
  result,
  planAText,
  planBText,
  onBack,
  onNext,
  onReopenOriginal,
  comparisonHelpfulness,
  onSelectComparisonHelpfulness,
  comparisonHelpfulnessReason,
  onChangeComparisonHelpfulnessReason,
  comparisonFeedbackSubmitted,
  isSubmittingComparisonFeedback,
  comparisonFeedbackSubmitError,
  onSubmitComparisonFeedback,
  onOpenRouteCompare,
  onOpenSwipeExperiment,
}: Props) {
  const [openOriginal, setOpenOriginal] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const dayCount = Math.max(result.plans.a.days.length, result.plans.b.days.length);
  const [selectedDay, setSelectedDay] = useState(1);

  function toggleOriginal(plan: "a" | "b") {
    setOpenOriginal((prev) => {
      const next = { ...prev, [plan]: !prev[plan] };
      if (next[plan]) onReopenOriginal(plan);
      return next;
    });
  }

  const conditionalHint = useMemo(() => buildConditionalHint(result), [result]);

  return (
    <div className="w-full">
      <AppHeader variant="back" onBack={onBack} />
      <div className="flex flex-col px-5 pt-20">
        <h1 className="heading-page">일정을 비교해본 결과예요.</h1>
        <div className="mt-7">
          <ResultDescription />
        </div>
        <div className="mt-3">
          <ComparisonScopeNotice />
        </div>
      </div>

      <div className="flex flex-col px-5 pb-36">
        {/* 1. AI가 요약한 핵심 차이 */}
        <section className="mt-8">
          <h2 className="heading-card">AI가 요약한 핵심 차이</h2>
          <div className="mt-3">
            <KeyDifferenceCard lines={result.comparison.key_differences.map((k) => k.text)} hint={conditionalHint} />
          </div>
        </section>

        {/* 2. 일차별 A/B 상세 비교 */}
        <section className="mt-8 flex flex-col gap-4">
          <h2 className="heading-card">일차별 A/B 상세 비교</h2>

          <div className="tab-pill-group w-full">
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                type="button"
                data-active={selectedDay === day}
                className="tab-pill focus-ring flex-1"
                onClick={() => setSelectedDay(day)}
              >
                {day}일차
              </button>
            ))}
          </div>

          {/* 상세 비교를 보조하는 기능들 — 지도 CTA와 원문 다시보기를 같은
              hierarchy로 묶어, 탭 바로 아래 본문 비교보다 먼저 보여준다
              (발견성 개선). 원문 다시보기는 여전히 collapsed 상태로
              시작하고 눌렀을 때만 펼쳐진다. */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onOpenRouteCompare(selectedDay)}
              className="scope-notice w-full text-left transition-opacity hover:opacity-80"
            >
              <span aria-hidden="true">🗺</span>
              <span className="text-[13px] font-medium text-primary">지도에서 {selectedDay}일차 동선 보기</span>
            </button>
            <OriginalToggle
              label="플랜 A"
              text={planAText}
              open={openOriginal.a}
              onToggle={() => toggleOriginal("a")}
            />
            <OriginalToggle
              label="플랜 B"
              text={planBText}
              open={openOriginal.b}
              onToggle={() => toggleOriginal("b")}
            />
          </div>

          <DayComparison
            dayNumber={selectedDay}
            planA={result.plans.a}
            planB={result.plans.b}
          />

          <TotalCostSummary planA={result.plans.a} planB={result.plans.b} />

          {/* v1.0 dev — swipe carousel 실험안 진입점. 기본 구조를 바꾸는
              버튼이 아니라 별도 실험 화면으로의 링크일 뿐이라, 실제
              서비스에는 없는 것처럼 보이도록 dev 환경에서만 보여준다. */}
          {isDevRouteMockEnabled() && (
            <button
              type="button"
              onClick={onOpenSwipeExperiment}
              className="focus-ring self-start text-[12px] font-medium text-text-muted underline underline-offset-4"
            >
              🧪 A/B 스와이프 비교 실험안 보기 (dev)
            </button>
          )}
        </section>

        {/* 3. 어떤 일정이 더 잘 맞나요? — 근거가 있을 때만 노출 */}
        {conditionalHint !== null && (
          <section className="mt-8">
            <h2 className="heading-card">어떤 일정이 더 잘 맞나요?</h2>
            <div className="scope-notice mt-3">
              <div>
                <p className="scope-notice-text text-[14px] leading-[1.5] text-text-primary">{conditionalHint}</p>
              </div>
            </div>
          </section>
        )}

        <ComparisonHelpfulness
          value={comparisonHelpfulness}
          onSelect={onSelectComparisonHelpfulness}
          reasonText={comparisonHelpfulnessReason}
          onChangeReasonText={onChangeComparisonHelpfulnessReason}
          submitted={comparisonFeedbackSubmitted}
          isSubmitting={isSubmittingComparisonFeedback}
          submitError={comparisonFeedbackSubmitError}
          onSubmit={onSubmitComparisonFeedback}
        />
      </div>

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

/** "AI가 요약한 핵심 차이" 카드. lines는 dummyComparison.ts buildComparison()
 *  한 곳에서만 생성된 문장(시간/비용/장소 축, 최대 4개)이다 — 여기서
 *  새로 문장을 만들지 않는다. hint가 있으면(조건부 insight 근거가 있을
 *  때만) 구분선 아래에 한 줄 더 보여준다. */
function KeyDifferenceCard({ lines, hint }: { lines: string[]; hint: string | null }) {
  return (
    <div className="ai-card-border">
      <div className="ai-card-inner">
        <div className="flex items-center gap-1.5">
          <SparkleIcon />
          <span className="text-caption text-[13px] font-medium">입력된 두 일정에서 확인된 차이예요.</span>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {lines.map((text, index) => (
            <li key={index} className="flex gap-2.5">
              <CheckIcon />
              <span className="text-[16px] leading-[1.55] text-text-primary">{text}</span>
            </li>
          ))}
        </ul>
        {hint !== null && (
          <>
            <div className="mt-4 h-px w-full bg-border" />
            <p className="mt-4 text-[13px] font-medium leading-[1.5] text-primary">💡 {hint}</p>
          </>
        )}
      </div>
    </div>
  );
}

/** 시간/비용 축 중 실제로 차이가 있는 축 하나를 골라 조건부 insight
 *  문장을 만든다. 근거(둘 중 하나라도 개수 차이)가 없으면 null — 억지로
 *  만들지 않는다. 동선(이동거리) 축은 API 연동 전까지 추가하지 않는다. */
function buildConditionalHint(result: ComparisonResult): string | null {
  const { key_differences } = result.comparison;
  const timeLine = key_differences.find((k) => k.text.includes("정확한 시간"));
  if (timeLine) {
    const more = timeLine.text.includes("플랜 A는") ? "A" : "B";
    return `시간이 구체적인 일정을 중요하게 본다면 플랜 ${more}의 일정을 확인해보세요.`;
  }
  const costLine = key_differences.find((k) => k.text.includes("비용이 명시된"));
  if (costLine) {
    const more = costLine.text.includes("플랜 A는") ? "A" : "B";
    return `비용 정보를 중요하게 본다면 플랜 ${more}의 일정을 확인해보세요.`;
  }
  return null;
}

// key={dayNumber}로 일차 탭이 바뀔 때마다 아래 두 PlanDayBlock을
// 통째로 리마운트시켜, "상세 일정 보기" 펼침 상태가 일차마다 항상
// collapsed로 새로 시작하게 한다(이전 일차에서 펼쳤던 상태가 다음
// 일차에도 그대로 남아있는 걸 방지).
function DayComparison({
  dayNumber,
  planA,
  planB,
}: {
  dayNumber: number;
  planA: PlanStructure;
  planB: PlanStructure;
}) {
  return (
    <div key={dayNumber} className="flex flex-col gap-6">
      <PlanDayBlock label="플랜 A" day={planA.days[dayNumber - 1]} />
      <PlanDayBlock label="플랜 B" day={planB.days[dayNumber - 1]} />
    </div>
  );
}

/** v1.0 — Plan A/B는 계속 같은 일차 안에서 세로로 이어 보여주는 구조를
 *  유지한다(좌우 swipe carousel로 바꾸지 않음 — 동시 비교 어려움/왕복
 *  부담 방지). 다만 390px에서 두 플랜의 전체 타임라인을 항상 펼쳐두면
 *  화면이 지나치게 길어져, 기본은 컴팩트 요약(시간 범위/장소/비용/
 *  이동정보)만 보여주고 "상세 일정 보기"를 눌렀을 때만 기존 타임라인이
 *  펼쳐지는 구조로 바꿨다. 요약에 쓰는 값은 전부 이미 계산돼 있던
 *  실제 데이터(day.items, sumDayCost, sumMockRoute)를 그대로 재사용할
 *  뿐, 새로 만들어내는 값은 없다. */
function PlanDayBlock({ label, day }: { label: string; day: PlanDay | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!day) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="heading-card">{label}</h3>
        <p className="text-caption">이 플랜에는 해당 일차 일정이 없습니다.</p>
      </div>
    );
  }

  const sortedItems = sortItemsByExplicitTime(day.items);
  const daySum = sumDayCost(day);
  const devRoute = isDevRouteMockEnabled();
  const segmentCount = Math.max(sortedItems.length - 1, 0);
  const routeSummary = devRoute ? sumMockRoute(segmentCount) : null;
  const timeRange = dayTimeRangeSummary(day.items);
  const placeList = dayPlaceSummary(day.items);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="heading-card">{label}</h3>

      <div className="rounded-container bg-subtle-surface flex flex-col gap-2.5 p-4">
        <SummaryRow label="시간" value={timeRange} />
        <SummaryRow label="장소" value={placeList} />
        <SummaryRow label="비용" value={daySum.total !== null ? formatWon(daySum.total) : "정보 없음"} />
        {routeSummary !== null && (
          <SummaryRow label="이동정보" value={`차량·도보 합산 예상 ${routeSummary.minutes}분 · ${routeSummary.km}km (dev mock)`} />
        )}
      </div>

      <div className="accordion">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="accordion-trigger focus-ring"
        >
          <span>상세 일정 보기</span>
          <ChevronDownIcon open={expanded} />
        </button>
        {expanded && (
          <div className="accordion-panel">
            <div className="flex flex-col">
              {sortedItems.map((item, i) => (
                <TimelineItem
                  key={i}
                  item={item}
                  isLast={i === sortedItems.length - 1}
                  routeToNext={devRoute && i < sortedItems.length - 1 ? getMockRouteSegment(i) : null}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-14 shrink-0 text-[13px] font-medium text-text-secondary">{label}</span>
      <span className="text-[14px] leading-[1.4] text-text-primary">{value}</span>
    </div>
  );
}

/** 명시적 시간이 있는 항목만으로 가장 이르고 늦은 시각을 잡아 보여준다
 *  — 추론이 아니라 입력에 실제로 있던 값 중 min/max일 뿐이다. 명시적
 *  시간이 하나도 없으면 "시간 미기재"(사실 없음을 그대로 표시). */
function dayTimeRangeSummary(items: PlanItem[]): string {
  const explicit = items
    .map((item) => ({ raw: item.time, minutes: explicitTimeToMinutes(item.time) }))
    .filter((t): t is { raw: string; minutes: number } => t.minutes !== null);
  if (explicit.length === 0) return "시간 미기재";
  const earliest = explicit.reduce((a, b) => (a.minutes <= b.minutes ? a : b));
  const latest = explicit.reduce((a, b) => (a.minutes >= b.minutes ? a : b));
  if (earliest.raw === latest.raw) return formatExplicitTime(earliest.raw);
  return `${formatExplicitTime(earliest.raw)} ~ ${formatExplicitTime(latest.raw)}`;
}

/** 항목의 place 값을 순서대로 나열할 뿐, 새로 만들어내거나 지도로
 *  검색해 채우지 않는다. */
function dayPlaceSummary(items: PlanItem[]): string {
  const places = items.map((i) => i.place).filter((p): p is string => p !== null);
  if (places.length === 0) return "장소 정보 없음";
  return places.join(" · ");
}

/** "9. 비용 합계 — 일차별 + 전체 둘 다"의 전체(全 일차 합) 쪽. 일차별
 *  합계는 PlanDayBlock 안에 이미 있으므로 여기서는 플랜 전체 합만
 *  Plan A/B 나란히 보여준다. "총 여행 비용"이라는 표현은 쓰지 않는다
 *  (숙박비/교통비 등 사용자가 안 적은 비용이 있을 수 있으므로). */
function TotalCostSummary({ planA, planB }: { planA: PlanStructure; planB: PlanStructure }) {
  const sumA = sumPlanCost(planA);
  const sumB = sumPlanCost(planB);
  return (
    <div className="rounded-container bg-subtle-surface p-4">
      <p className="text-[14px] font-bold text-text-primary">합산 가능한 입력 비용</p>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-text-secondary">플랜 A</span>
          <span className="text-[14px] font-semibold text-text-primary">
            {sumA.total !== null ? formatWon(sumA.total) : "정보 없음"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-text-secondary">플랜 B</span>
          <span className="text-[14px] font-semibold text-text-primary">
            {sumB.total !== null ? formatWon(sumB.total) : "정보 없음"}
          </span>
        </div>
      </div>
      <p className="text-caption mt-3 text-[12px] leading-[1.4]">
        비용 정보가 없거나 합산 기준이 명확하지 않은 항목은 제외했어요.
      </p>
    </div>
  );
}

function TimelineItem({
  item,
  isLast,
  routeToNext,
}: {
  item: PlanItem;
  isLast: boolean;
  routeToNext: { mode: RouteMode; minutes: number; km: number } | null;
}) {
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
        {routeToNext !== null && <RouteConnector segment={routeToNext} />}
      </div>
    </div>
  );
}

/** v1.0 dev — 이동정보 커넥터. 시간/비용/category보다 한 단계 낮은
 *  hierarchy(neutral gray, 작은 글씨)를 쓰고, 차량/도보를 이모지+텍스트로
 *  명확히 구분한다. isDevRouteMockEnabled()가 false인 프로덕션 빌드에서는
 *  이 컴포넌트 자체가 호출되지 않는다(PlanDayBlock에서 게이트). */
function RouteConnector({ segment }: { segment: { mode: RouteMode; minutes: number; km: number } }) {
  const icon = segment.mode === "vehicle" ? "🚗" : "🚶";
  const label = segment.mode === "vehicle" ? "차량" : "도보";
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span aria-hidden="true" className="text-[12px]">
        ↓
      </span>
      <span aria-hidden="true" className="text-[12px]">
        {icon}
      </span>
      <span className="text-[12px] text-text-muted">
        {label} {segment.minutes}분 · {segment.km}km (dev mock)
      </span>
    </div>
  );
}

/** 시각적 우선순위: 1) 장소명 2) 비용 3) 시간 4) 활동/설명 5) category
 *  6) 이동 보조정보(dev mock에서만 RouteConnector로 표시). */
function ScheduleItem({ item }: { item: PlanItem }) {
  const primary = item.place ?? item.activity ?? "정보 없음";
  const activityNote =
    item.place !== null && item.activity !== null && item.description === null ? item.activity : null;
  const category = classifyPlaceCategory(item.place);
  const isExplicit = explicitTimeToMinutes(item.time) !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[16px] font-semibold leading-[1.3] text-text-primary">{primary}</span>
        {category !== null && <span className="category-badge">{category}</span>}
      </div>

      {item.stated_cost !== null ? (
        item.stated_cost.length <= 16 ? (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[13px] font-medium text-text-secondary">비용</span>
            <span className="cost-chip-v1">{item.stated_cost}</span>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <span className="text-[13px] font-medium text-text-secondary">비용</span>
            <p className="text-[14px] leading-[1.5] text-text-primary">{item.stated_cost}</p>
          </div>
        )
      ) : (
        <div className="flex flex-col items-start gap-1">
          <span className="text-[13px] font-medium text-text-secondary">비용</span>
          <span className="cost-missing-label">비용 정보 없음</span>
        </div>
      )}

      <div className="flex flex-col items-start gap-1">
        <span className="text-[13px] font-medium text-text-secondary">시간</span>
        {isExplicit && item.time !== null ? (
          <span className="time-chip">{formatExplicitTime(item.time)}</span>
        ) : (
          <span className="time-missing-chip">{item.time ?? "시간 미기재"}</span>
        )}
      </div>

      {item.description !== null && (
        <p className="text-[14px] leading-[1.4] text-text-secondary">{item.description}</p>
      )}
      {activityNote !== null && <p className="text-[14px] leading-[1.4] text-text-secondary">{activityNote}</p>}
    </div>
  );
}

function PlaceBadgeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ffffff" />
      <circle cx="12" cy="9" r="2.6" fill="var(--color-primary)" />
    </svg>
  );
}

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
        <span>{label} 원문 다시보기</span>
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

/** 결과 콘텐츠 맨 아래, [결정하러 가기] CTA 바로 위에 오는 후행지표
 *  피드백 — 여러 라운드에 걸쳐 확정된 디자인이라 v1.0에서도 내용을
 *  그대로 옮긴다(see memory: feedback-comparison-helpfulness-ui). */
function ComparisonHelpfulness({
  value,
  onSelect,
  reasonText,
  onChangeReasonText,
  submitted,
  isSubmitting,
  submitError,
  onSubmit,
}: {
  value: "helpful" | "not_helpful" | null;
  onSelect: (value: "helpful" | "not_helpful") => void;
  reasonText: string;
  onChangeReasonText: (text: string) => void;
  submitted: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
}) {
  const placeholder =
    value === "not_helpful"
      ? "어떤 점이 아쉬웠는지 알려주세요. (선택)"
      : "어떤 점이 도움이 되었는지 알려주세요. (선택)";
  const canSubmit = value !== null && reasonText.trim().length > 0;
  const sendDisabled = !canSubmit || isSubmitting || submitted;

  return (
    <section className="mt-8">
      <p className="text-[15px] font-semibold text-text-primary">비교 결과가 도움이 되었나요?</p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => onSelect("not_helpful")}
          data-selected={value === "not_helpful"}
          data-variant="negative"
          className="outline-toggle focus-ring flex-1"
        >
          <span className="feedback-icon-box">
            <ThumbsDownIcon />
          </span>
          아쉬워요
        </button>
        <button
          type="button"
          onClick={() => onSelect("helpful")}
          data-selected={value === "helpful"}
          data-variant="positive"
          className="outline-toggle focus-ring flex-1"
        >
          <span className="feedback-icon-box">
            <ThumbsUpIcon />
          </span>
          도움이 됐어요
        </button>
      </div>
      {value !== null && (
        <div className="feedback-reason-enter relative mt-3">
          <textarea
            value={reasonText}
            onChange={(e) => onChangeReasonText(e.target.value)}
            rows={3}
            placeholder={placeholder}
            className="field text-body resize-none p-3 pr-12 pb-12"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={sendDisabled}
            data-ready={canSubmit}
            aria-label={submitted ? "피드백이 저장됐어요" : "피드백 전송"}
            className="feedback-send-btn focus-ring"
          >
            {isSubmitting ? <SpinnerIcon /> : submitted ? <SendSuccessIcon /> : <SendIcon />}
          </button>
        </div>
      )}
      {submitError !== null && <p className="text-error mt-2 text-[13px] leading-[1.4]">{submitError}</p>}
    </section>
  );
}

function ThumbsDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
    </svg>
  );
}

function ThumbsUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function SendSuccessIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
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

function SparkleIcon() {
  const gradientId = useId();
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6a43e8" />
          <stop offset="55%" stopColor="#7e72fa" />
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
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

