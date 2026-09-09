"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import type { ComparisonResult, PlanDay, PlanItem, PlanStructure } from "@/types/plan";
import { isFreeStatedCost, sumPlanCost, type CostSum } from "@/lib/costSummary";
import { isRouteString, truncateList } from "@/lib/dummyComparison";
import { startsWithOwnDayMarker } from "@/lib/planDayText";
import { explicitTimeToMinutes, formatExplicitTime, sortItemsByExplicitTime } from "@/lib/timeSort";
import {
  getMockRouteSegments,
  isDevRouteMockEnabled,
  sumMockRoute,
  type MockRouteSegment,
} from "@/lib/devRouteMock";

// v1.0 결과 화면 재설계 — Figma "Result / Option B" 골격을 그대로 옮긴다.
// 기존 "핵심 요약 / 상세 비교" 1차 탭 + Plan A/B 2차 탭(플랜 하나씩만
// 보여주고 왕복) 구조를 걷어내고, 같은 일차 안에서 Plan A → Plan B를
// 이어서 보여주는 구조로 바꾼다. ComparisonHelpfulness(피드백 위젯)는
// 이미 여러 라운드에 걸쳐 확정된 디자인이라 내용을 그대로 옮겨왔다.

type Props = {
  result: ComparisonResult;
  /** day별 원문 텍스트(타이핑했든 이미지에서 추출됐든 동일하게 담김)와
   *  day별 업로드 이미지(data URL, 텍스트 day는 null) — "원문 다시보기"
   *  modal이 day 단위로 렌더링하는 데 쓴다. 세 배열은 항상 같은 길이/
   *  순서를 공유한다.
   *  버그 수정(2026-09-06, 2차) — planADayTexts/planBDayTexts는 이제
   *  "비교에 실제로 쓰인 선별된 텍스트(itineraryText)"다. 이미지
   *  day의 경우 사용자가 "원문 다시보기"에서 봐야 하는 건 이 선별된
   *  값이 아니라 이미지에서 실제로 읽힌 전체 원문이므로, 그 값을 담은
   *  planARawTexts/planBRawTexts를 별도로 받는다 — 텍스트 day는 raw
   *  개념이 없어 빈 문자열이고, OriginalDayBlock이 imageDataUrl===null
   *  이면 이 값 자체를 쓰지 않는다. */
  planADayTexts: string[];
  planARawTexts: string[];
  planAImages: (string | null)[];
  planBDayTexts: string[];
  planBRawTexts: string[];
  planBImages: (string | null)[];
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
  /** v1.0 — Plan A/B swipe carousel 실험안(ResultSwipeVariantDev) 진입점.
   *  실 서비스 화면에 dev 실험 흔적이 남지 않도록 이 화면에서는 더 이상
   *  진입 링크를 렌더링하지 않는다(요청: dev 실험 흔적 제거). 파일과
   *  이 prop 자체는 지우지 않았다 — 필요하면 이후에 다시 연결할 수
   *  있다. */
  onOpenSwipeExperiment: () => void;
};

const WON_FORMATTER = new Intl.NumberFormat("ko-KR");
function formatWon(amount: number): string {
  return `${WON_FORMATTER.format(amount)}원`;
}

export default function StepResult({
  result,
  planADayTexts,
  planARawTexts,
  planAImages,
  planBDayTexts,
  planBRawTexts,
  planBImages,
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
}: Props) {
  const dayCount = Math.max(result.plans.a.days.length, result.plans.b.days.length);
  const [selectedDay, setSelectedDay] = useState(1);
  // 버그 수정(2026-09-06, production dev mock 차단) — 이 CTA는 실제
  // 지도가 아니라 RouteCompareDev(dev mock 화면)로 이동하는 버튼인데,
  // 아래 다른 dev mock UI(이 날 이동 요약/상세 timeline route label,
  // 전부 isDevRouteMockEnabled()로 게이트됨)와 달리 이 버튼만 게이트가
  // 빠져 있었다 — production build에서도 버튼이 보이고 눌리면
  // RouteCompareDev까지 진입할 수 있었다. 같은 기존 함수를 그대로
  // 재사용해 이 버튼도 동일하게 막는다(새 env 변수 없음).
  const devRouteMockEnabled = isDevRouteMockEnabled();
  // v1.0 — "원문 다시보기"는 인라인 아코디언이 아니라 modal popup으로
  // 연다(요청). 어느 플랜의 원문을 보여줄지만 상태로 들고, 실제 day별
  // 텍스트/이미지는 planADayTexts/planAImages(또는 B)에서 바로 읽는다.
  const [originalModalPlan, setOriginalModalPlan] = useState<"a" | "b" | null>(null);

  function openOriginalModal(plan: "a" | "b") {
    onReopenOriginal(plan);
    setOriginalModalPlan(plan);
  }

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
            <KeyDifferenceCard
              items={result.comparison.key_differences}
              commonPlaces={result.comparison.common_places}
            />
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

          {/* 2차 우선순위 — 지도 CTA. 이전엔 "비교 범위 안내" 정보
              카드와 같은 .scope-notice를 재사용했는데(min-h만 override),
              두 컴포넌트가 완전히 똑같은 lavender 톤 flat 카드라 이
              버튼이 "누를 수 있는 행동"이 아니라 또 다른 안내 문구처럼
              읽힌다는 피드백이 있었다 — 전용 클래스(.map-cta-btn)로
              분리해 아이콘+텍스트를 가운데 정렬하고 은은한 그림자로
              살짝 들어 보이게 한다("border 없음" 정책은 유지 — 진한
              보라 배경/border로 primary CTA와 경쟁하게 만들지 않는다). */}
          {devRouteMockEnabled && (
            <button
              type="button"
              onClick={() => onOpenRouteCompare(selectedDay)}
              className="map-cta-btn focus-ring w-full"
            >
              <MapIcon />
              <span className="text-[15px] font-bold text-primary-hover">지도에서 {selectedDay}일차 동선 보기</span>
            </button>
          )}

          <DayComparison
            dayNumber={selectedDay}
            planA={result.plans.a}
            planB={result.plans.b}
            onOpenOriginal={openOriginalModal}
          />
        </section>

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

      {originalModalPlan !== null && (
        <OriginalTextModal
          label={originalModalPlan === "a" ? "플랜 A" : "플랜 B"}
          dayTexts={originalModalPlan === "a" ? planADayTexts : planBDayTexts}
          dayRawTexts={originalModalPlan === "a" ? planARawTexts : planBRawTexts}
          dayImages={originalModalPlan === "a" ? planAImages : planBImages}
          onClose={() => setOriginalModalPlan(null)}
        />
      )}

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
      <FilledInfoIcon size={16} className="mt-0.5 shrink-0 text-[var(--color-notice-icon)]" />
      <div>
        <p className="scope-notice-title">비교 범위 안내</p>
        <p className="scope-notice-text">
          입력된 일정만을 기준으로 비교하며, 지도 기반 거리·교통시간은 계산하지 않습니다.
        </p>
      </div>
    </div>
  );
}

/** "AI가 요약한 핵심 차이" 카드. items는 dummyComparison.ts
 *  buildComparison() 한 곳에서만 생성된 값(시간/비용/장소 축, 최대
 *  4개)이다 — 여기서 새로 문장을 만들거나 계산하지 않는다. title/detail이
 *  있으면(제목+보조 설명 구조) 그걸 쓰고, 없으면(예: "정보 부족" fallback)
 *  text를 한 줄로 그대로 보여준다. hint가 있으면(조건부 insight 근거가
 *  있을 때만) 구분선 아래에 한 줄 더 보여준다.
 *
 *  v1.0 — 한 차례 흰 배경 + 좌측 accent bar로 단순화했었는데, border-
 *  radius가 있는 카드에 border-left만 쓰면 위/아래 모서리에서 선이
 *  잘려 보이는 문제가 있었다("어색하게 잘린 상태" 피드백). 원래
 *  의도했던 Purple → Indigo → Soft Blue gradient 테두리로 되돌린다
 *  (globals.css .key-difference-card-frame — padding+inner surface
 *  기법이라 border-radius 코너에서도 gradient가 끊기지 않는다).
 *
 *  v1.0 — "어떤 일정이 더 잘 맞나요?" 조건부 추천 문구(hint)는 결과
 *  화면이 승자를 판단하는 것처럼 보인다는 이유로 완전히 제거했다 —
 *  이 카드는 이제 순수하게 "확인된 차이"만 나열한다.
 *
 *  v1.0 — 공통 장소(commonPlaces)는 "차이"가 아니지만, 별도 notice
 *  박스보다 이 카드 안의 마지막 항목으로 함께 보여달라는 요청(2026-09-06)에
 *  따라 items와 동일한 check/title/detail 구조로 이어서 렌더링한다.
 *  commonPlaces는 buildComparison()이 이미 canonical dedup·이동 경로
 *  문자열 제외까지 끝내 내려주는 값이라 여기서는 표시만 담당하고,
 *  items(최대 4개 슬롯)의 개수 정책과는 무관하게 항상 별도로 붙는다. */
function KeyDifferenceCard({
  items,
  commonPlaces,
}: {
  items: { text: string; title?: string; detail?: string }[];
  commonPlaces: string[];
}) {
  return (
    <div className="key-difference-card-frame">
      <div className="key-difference-card">
        {/* v1.0 (1차 우선순위 라운드) — 카드 안쪽 상단 문구를 한 단계 더
            키웠다(16→17px, semibold→bold) — "단순 차이 나열처럼 느껴져
            와닿지 않는다"는 UT 피드백으로, 이 줄이 카드 안의 진짜
            section title처럼 읽히도록 강조를 더 올린다. 카드 바깥의
            진짜 제목(.heading-card, 18px)보다는 여전히 작게 둔다. 위계:
            AI가 요약한 핵심 차이(18px) > 이 문구(17px/bold) > 인사이트
            title(15px/semibold, 아래 li) > detail(13px). */}
        <div className="flex items-center gap-1.5">
          <SparkleIcon />
          <span className="text-[17px] font-bold leading-[1.4] text-primary">
            입력된 두 일정에서 확인된 차이예요.
          </span>
        </div>
        <ul className="mt-4 flex flex-col gap-3.5">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2.5">
              <CheckIcon />
              {item.title !== undefined ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold leading-[1.4] text-text-primary">{item.title}</span>
                  {item.detail !== undefined && (
                    <span className="text-[13px] leading-[1.4] text-text-secondary">{item.detail}</span>
                  )}
                </div>
              ) : (
                <span className="text-[15px] leading-[1.5] text-text-primary">{item.text}</span>
              )}
            </li>
          ))}
          {commonPlaces.length > 0 && (
            <li className="flex gap-2.5">
              <CheckIcon />
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold leading-[1.4] text-text-primary">
                  두 일정에 공통으로 포함된 장소가 있어요.
                </span>
                <span className="text-[13px] leading-[1.4] text-text-secondary">
                  {truncateList(commonPlaces, 5).replaceAll(", ", " · ")}
                </span>
              </div>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

// key={dayNumber}로 일차 탭이 바뀔 때마다 아래 두 PlanDayBlock을
// 통째로 리마운트시켜, "상세 일정 보기" 펼침 상태가 일차마다 항상
// collapsed로 새로 시작하게 한다(이전 일차에서 펼쳤던 상태가 다음
// 일차에도 그대로 남아있는 걸 방지).
function DayComparison({
  dayNumber,
  planA,
  planB,
  onOpenOriginal,
}: {
  dayNumber: number;
  planA: PlanStructure;
  planB: PlanStructure;
  onOpenOriginal: (plan: "a" | "b") => void;
}) {
  // v1.0 — "입력 비용 합계"는 이제 일차별 카드가 아니라 플랜 전체(sumPlanCost)
  // 기준이다 — 이전에 별도 하단 카드(TotalCostSummary)로 나뉘어 있던
  // 정보를 각 플랜 요약 카드 안으로 흡수했을 뿐, 새로 계산한 값이
  // 아니다. 일차 탭을 바꿔도 이 값 자체는 바뀌지 않는다(플랜 전체
  // 기준이므로 당연함).
  //
  // 버그 수정(2026-09-04) — "일정 시간"/"방문 장소"도 같은 이유로 플랜
  // 전체 기준이어야 하는데, 지금까지는 PlanDayBlock 안에서 선택된
  // 일차(day.items)만 보고 계산해 "비용 합계는 플랜 전체인데 시간/장소는
  // 지금 보고 있는 일차만"이라는 스코프 불일치가 있었다(사용자가
  // 여러 일차에 걸친 시간을 입력했는데 요약에는 1일차 시간만 보이는
  // 것처럼 보이는 문제로 리포트됨). costSumA/B와 동일하게 여기서
  // planA.days.flatMap(...)/planB.days.flatMap(...)로 전체 일차의
  // item을 모아 한 번만 계산해 내려준다 — 일차 탭을 바꿔도 이 값들은
  // 더 이상 바뀌지 않는다(costSum과 동일한 스코프로 통일).
  const costSumA = sumPlanCost(planA);
  const costSumB = sumPlanCost(planB);
  const timeRangeA = timeRangeSummary(planA.days.flatMap((d) => d.items));
  const timeRangeB = timeRangeSummary(planB.days.flatMap((d) => d.items));
  const placeListA = placeSummary(planA.days.flatMap((d) => d.items));
  const placeListB = placeSummary(planB.days.flatMap((d) => d.items));
  // 버그 수정(2026-09-04) — Plan 제목 옆에 붙였던 날짜 표시가 "플랜
  // 전체가 특정 하루 일정처럼 보인다"는 피드백으로 제거되고, 대신 이미
  // 플랜 전체 기준으로 통일돼 있는 "일정 시간" 요약 행 안으로 옮겨졌다
  // (timeRangeA/B와 동일한 스코프 — costSum과도 일관). day.date가 없는
  // 일차가 섞여 있어도 있는 값만으로 계산하고, 원문 날짜 문자열을 그대로
  // 쓸 뿐 새 날짜를 만들거나 요일을 추정하지 않는다.
  const dateRangeA = planDateRangeSummary(planA.days);
  const dateRangeB = planDateRangeSummary(planB.days);
  return (
    <div key={dayNumber} className="flex flex-col gap-6">
      <PlanDayBlock
        label="플랜 A"
        day={planA.days[dayNumber - 1]}
        costSum={costSumA}
        timeRange={timeRangeA}
        dateRange={dateRangeA}
        placeList={placeListA}
        onOpenOriginal={() => onOpenOriginal("a")}
      />
      <PlanDayBlock
        label="플랜 B"
        day={planB.days[dayNumber - 1]}
        costSum={costSumB}
        timeRange={timeRangeB}
        dateRange={dateRangeB}
        placeList={placeListB}
        onOpenOriginal={() => onOpenOriginal("b")}
      />
    </div>
  );
}

/** v1.0 — Plan A/B는 계속 같은 일차 안에서 세로로 이어 보여주는 구조를
 *  유지한다(좌우 swipe carousel로 바꾸지 않음 — 동시 비교 어려움/왕복
 *  부담 방지). 다만 390px에서 두 플랜의 전체 타임라인을 항상 펼쳐두면
 *  화면이 지나치게 길어져, 기본은 컴팩트 요약(시간 범위/장소/비용/
 *  이동정보)만 보여주고 "상세 일정 보기"를 눌렀을 때만 기존 타임라인이
 *  펼쳐지는 구조로 바뀌었다. 요약에 쓰는 값은 전부 이미 계산돼 있던
 *  실제 데이터(day.items, sumPlanCost, sumMockRoute)를 그대로 재사용할
 *  뿐, 새로 만들어내는 값은 없다.
 *
 *  v1.0 — Figma 레퍼런스 기준으로 요약 카드를 아이콘 없는 label+value
 *  "정보 테이블" 형태로 다시 맞췄다(이전 라운드의 filled 아이콘 +
 *  차등 강조 타이포는 제거). 필드는 시간 → 장소 → 입력 비용 합계 →
 *  이동 시간/거리 순으로, 전부 같은 시각적 무게의 행으로 보여준다(Figma에 없는
 *  활동 요약 행은 이번 라운드에서 뺐다).
 *
 *  v1.0 — "원문 다시보기"는 더 이상 별도 인라인 아코디언이 아니라, 이
 *  플랜 헤더 옆의 언더라인 텍스트 버튼 → modal popup으로 바뀌었다
 *  (onOpenOriginal).
 *
 *  버그 수정(2026-09-04) — timeRange/placeList는 이제 부모(DayComparison)가
 *  플랜 전체 기준으로 계산해 내려주는 props다(costSum과 동일한 스코프로
 *  통일 — 아래 상세 QA 참고). 이 컴포넌트 안에서는 더 이상 day.items로
 *  다시 계산하지 않는다 — "상세 일정 보기"에서 펼쳐지는 sortedItems/
 *  routeSummary만 선택된 일차(day) 기준으로 남는다(원래도 일차별로 보는
 *  게 맞는 정보라 스코프 변경 없음). */
function PlanDayBlock({
  label,
  day,
  costSum,
  timeRange,
  dateRange,
  placeList,
  onOpenOriginal,
}: {
  label: string;
  day: PlanDay | undefined;
  costSum: CostSum;
  timeRange: string | null;
  dateRange: string | null;
  placeList: string;
  onOpenOriginal: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h3 className="heading-card">{label}</h3>
      <button type="button" onClick={onOpenOriginal} className="original-link-btn focus-ring">
        {label} 원문 다시보기
      </button>
    </div>
  );

  if (!day) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        <p className="text-caption">이 플랜에는 해당 일차 일정이 없습니다.</p>
      </div>
    );
  }

  const sortedItems = sortItemsByExplicitTime(day.items);
  const devRoute = isDevRouteMockEnabled();
  // 버그 수정(2026-09-05) — activity-only item(place: null, 예: "숙소
  // 이동"/"카페에서 휴식"/"저녁")은 실제 출발지·도착지가 아니므로, 그
  // item이 낀 구간에는 이동 정보(거리/시간)를 만들거나 보여주지 않는다.
  // "이 구간의 두 item 모두 place가 있을 때만" route가 유효하다 —
  // 상세 타임라인의 구간별 연결선(routesToNext)과 이 요약 합계가 항상
  // 같은 기준을 쓴다.
  const validRouteIndices = sortedItems
    .slice(0, -1)
    .map((_, i) => i)
    .filter((i) => sortedItems[i].place !== null && sortedItems[i + 1].place !== null);
  const routeSummary = devRoute && validRouteIndices.length > 0 ? sumMockRoute(validRouteIndices) : null;

  return (
    <div className="flex flex-col gap-3">
      {header}

      <div className="rounded-container bg-subtle-surface flex flex-col gap-2.5 p-4">
        {/* 일정 시간 — 버그 수정(2026-09-04): 플랜 전체(모든 일차) 기준
            earliest~latest다. 예전엔 지금 선택된 일차(day.items)만 보고
            계산해 "1일차 탭을 보고 있으면 1일차 시간만" 나오는 문제가
            있었다(비용 합계는 이미 플랜 전체 기준인데 시간만 일차
            스코프라 서로 다른 기준이 한 카드에 섞여 있었음). 명시적
            시간이 하나도 없으면 행 자체를 생략한다("시간 미기재" 같은
            문구를 새로 만들어 보여주지 않는다). 값은 "가장 이른 시각
            ~ 가장 늦은 시각" 범위다.
            버그 수정(2026-09-04, 2차) — Plan 제목 옆에 있던 날짜 표시를
            이 행 첫 줄로 옮겼다(둘째 줄은 기존 시간 범위). 날짜가 없으면
            첫 줄 없이 시간 줄만(기존과 동일한 단일 줄 모양), 시간이
            없으면(드묾) 날짜 줄만 보여준다 — 둘 다 없을 때만 행 자체를
            생략한다. 새 날짜/요일을 계산하지 않고 day.date 원문 값을
            그대로만 쓴다. */}
        {(timeRange !== null || dateRange !== null) && (
          <SummaryRow
            label="일정 시간"
            value={
              <>
                {dateRange !== null && <div>{dateRange}</div>}
                {timeRange !== null && <div>{timeRange}</div>}
              </>
            }
          />
        )}

        {/* 방문 장소 — 버그 수정(2026-09-04): 마찬가지로 플랜 전체 기준
            (모든 일차의 장소를 등장 순서 그대로 나열, 새로 만들거나
            지도로 검색해 채우지 않는다). */}
        <SummaryRow label="방문 장소" value={placeList} />

        {/* 비용 합계 — "총 비용"/"총 여행 비용" 같은, 전체 여행 비용을
            뜻하는 표현은 쓰지 않는다(이전 라운드에서 확정된 가드레일).
            뜻은 동일(합산 가능한 항목만 더한 값)하고 라벨만 더 짧고
            균형 있게 다듬었다. 합산 가능한 항목이 하나도 없으면 0원으로
            지어내지 않고 "없음"을 그대로 값 자리에 보여준다.
            버그 수정(2026-09-06) — "비용 정보 자체가 없음"과 "비용은
            입력됐지만(예: 단위 없는 숫자, 외화) 합산 기준을 만족하지
            못해 제외됨"을 같은 "입력 비용 합계 없음" 문구로 뭉뚱그려
            보여주던 걸 나눴다. sumPlanCost/costSummary.ts의 합산
            로직(PURE_WON_PATTERN 등)은 그대로 두고, 이미 계산돼 있던
            CostSum.excludedCount(값은 있었지만 합산 규칙에 안 맞아
            제외된 항목 수)만 새로 읽어 분기한다 — 통화 추론이나 새
            계산 없이 기존 값 소비처만 늘린 것이라 회귀 위험이 낮다. */}
        <SummaryRow
          label="비용 합계"
          value={
            costSum.total !== null
              ? formatWon(costSum.total)
              : costSum.excludedCount > 0
                ? "합산 가능한 비용 없음"
                : "입력 비용 합계 없음"
          }
        />

        {/* 이동 정보 — 실제 Kakao Mobility 등 연동 전까지는 dev mock만
            존재하므로 dev 환경에서만 행 자체가 나타난다(프로덕션에는
            보이지 않음).
            버그 수정(2026-09-05) — 라벨을 "이동 정보"에서 "이 날
            이동"으로 바꿨다. 같은 카드 안 다른 행(일정 시간/방문 장소/
            비용 합계)은 플랜 전체 기준인데 이 값만 선택된 day 기준이라
            (의도된 설계 — 이동은 day 안에서만 의미 있는 순차 개념),
            라벨이 그 스코프 차이를 드러내지 않으면 플랜 전체 값으로
            오해하기 쉬웠다. 집계 로직(routeSummary, day-scope)은 전혀
            바꾸지 않았다 — 라벨 문자열만 수정. */}
        {routeSummary !== null && (
          <SummaryRow
            label="이 날 이동"
            value={`차량·도보 합산 예상 ${routeSummary.minutes}분 · ${routeSummary.km}km (dev mock)`}
          />
        )}

        {/* 3차 우선순위 — 아이콘을 filled 스타일로 바꾸면서, 정렬도
            items-start(+수동 mt-0.5 보정)에서 items-center로 바꿨다 —
            한 줄일 때 아이콘이 텍스트 세로 중앙에 정확히 맞고, 두 줄로
            줄바꿈돼도 아이콘이 전체 텍스트 블록의 세로 중앙쯤에
            자연스럽게 오도록 한다(요청: "줄바꿈이 생겨도 optical
            alignment가 어색하지 않게"). 본문보다 강조되지 않게 icon도
            텍스트와 같은 muted 톤을 유지한다. */}
        <div className="flex items-center gap-1.5">
          <FilledInfoIcon size={14} className="shrink-0 text-text-muted" />
          <p className="text-[12px] leading-[1.4] text-text-muted">
            비용 정보가 없거나 합산 기준이 명확하지 않은 항목은 제외했어요.
          </p>
        </div>
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
          <div className="accordion-panel pb-6">
            {/* v1.0 — "상세 일정 보기" 헤더와 1번 item 사이 여백을 더
                벌려달라는 요청이 반복돼 20px → 24px(pt-6)로 다시
                키웠다. 이 화면(상세 일정)에만 로컬로 추가한다 —
                .accordion-panel 자체는 StepInput의 다른 아코디언과
                공유하는 클래스라 거기엔 영향 없음.
                버그 수정(2026-09-04) — 마지막 timeline item과 카드
                하단 사이 여백이 부족하다는 피드백으로, 같은 방식(로컬
                Tailwind 오버라이드)으로 bottom padding만 12px→24px로
                늘렸다(pb-6이 @layer utilities라 @layer components인
                .accordion-panel의 padding-bottom보다 우선 적용됨).
                item 사이 간격(아래 gap-6)이나 collapsed 상태(패널
                자체가 렌더링되지 않음)에는 영향 없다.
                버그 수정(2026-09-09) — item 사이 간격을 각 TimelineItem
                내부의 pb-6(콘텐츠 칸에 붙어 있어 콘텐츠 높이에 따라
                다음 배지까지의 거리가 들쭉날쭉해 보이던 원인)에서 이
                목록 자체의 gap-6로 옮겼다. gap은 항목의 실제 콘텐츠
                높이와 무관하게 항상 24px로 고정되므로, 내용이 짧은
                항목끼리는 배지 간격이 완전히 동일해진다(내용이 긴
                항목은 그만큼 늘어나되, 그 뒤에 오는 gap 자체는 여전히
                24px로 동일 — TimelineItem 안의 .timeline-rail-line이
                이 24px gap 안까지 내려가 다음 배지와 이어지도록 CSS를
                같이 바꿨다, globals.css 참고). */}
            <div className="flex flex-col gap-6 pt-6">
              {sortedItems.map((item, i) => (
                <TimelineItem
                  key={i}
                  number={i + 1}
                  item={item}
                  isLast={i === sortedItems.length - 1}
                  routesToNext={devRoute && validRouteIndices.includes(i) ? getMockRouteSegments(i) : null}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 명시적 시간이 있는 항목만으로 가장 이르고 늦은 시각을 잡아 보여준다
 *  — 추론이 아니라 입력에 실제로 있던 값 중 min/max일 뿐이다. 명시적
 *  시간이 하나도 없으면 null(호출부가 행 자체를 생략한다 — "시간
 *  미기재" 같은 문구를 새로 만들지 않는다).
 *
 *  버그 수정(2026-09-04) — 이름을 day~에서 범용 이름으로 바꿨다: 이제
 *  "선택된 일차의 items"뿐 아니라 "플랜 전체 모든 일차의 items"를
 *  넘겨도 그대로 동작한다(함수 자체는 PlanItem[]만 받을 뿐 원래도
 *  day 개념을 몰랐다 — 호출부만 day.items → days.flatMap(...)으로
 *  바뀌었다). "명시적 시각"의 정의(오전/오후/아침/저녁/밤/새벽 + 숫자
 *  '시')는 timeSort.ts의 explicitTimeToMinutes 하나로 통일돼 있어
 *  (버그 수정: 이전엔 오전/오후만 인정해 "저녁 6시"처럼 숫자가 있는데도
 *  막연한 시간대로 오인되는 경우가 있었다), 상세 타임라인 정렬
 *  (sortItemsByExplicitTime)·AI 핵심 차이의 "시간 정보 구체성" 개수
 *  (dummyComparison.ts)와 완전히 같은 기준으로 이 요약도 계산된다. */
function timeRangeSummary(items: PlanItem[]): string | null {
  const explicit = items
    .map((item) => ({ raw: item.time, minutes: explicitTimeToMinutes(item.time) }))
    .filter((t): t is { raw: string; minutes: number } => t.minutes !== null);
  if (explicit.length === 0) return null;
  const earliest = explicit.reduce((a, b) => (a.minutes <= b.minutes ? a : b));
  const latest = explicit.reduce((a, b) => (a.minutes >= b.minutes ? a : b));
  if (earliest.raw === latest.raw) return formatExplicitTime(earliest.raw);
  return `${formatExplicitTime(earliest.raw)} ~ ${formatExplicitTime(latest.raw)}`;
}

/** 항목의 place 값을 순서대로 나열할 뿐, 새로 만들어내거나 지도로
 *  검색해 채우지 않는다. 버그 수정(2026-09-04) — day~에서 범용 이름으로
 *  변경(위 timeRangeSummary와 같은 이유 — 이제 플랜 전체 items를
 *  받는다).
 *
 *  버그 수정(2026-09-04, 4차) — 플랜 전체 items를 모아 나열하면서 같은
 *  장소가 여러 일차에 걸쳐 반복될 때(예: 매일 아침 같은 숙소) 요약
 *  한 줄에 똑같은 이름이 여러 번 찍혔다. 이 함수(요약 카드 표시용)
 *  안에서만 최초 등장 순서를 유지한 채 중복 이름을 제거한다 — 원본
 *  structured data(day.items)나 상세 타임라인은 이 함수를 거치지 않고
 *  그대로 실제 방문 순서를 보여주므로 영향이 없고, AI 핵심 차이의
 *  장소 개수·day별 장소 비교도 이 함수가 아니라 원본 items를 직접
 *  세므로 영향이 없다. */
function placeSummary(items: PlanItem[]): string {
  const places = items
    .map((i) => i.place)
    .filter((p): p is string => p !== null && !isRouteString(p));
  if (places.length === 0) return "장소 정보 없음";
  return [...new Set(places)].join(" · ");
}

/** 플랜 전체(모든 일차) 기준으로 날짜 범위 문자열을 만든다. day.date가
 *  있는 일차만 모아, 하나도 없으면 null(호출부가 행 자체를 생략).
 *  전부 같은 날짜면 한 번만, 다르면 "처음 ~ 마지막"으로 보여준다 —
 *  달력 값으로 정렬하지 않고 배열 순서(day 순서) 그대로의 첫/마지막을
 *  쓴다. day.date는 원문 표현을 그대로 보존한 문자열이라(요일 포함
 *  여부도 원문에 달림) 여기서 새로 파싱·재포맷하거나 요일을 계산해
 *  붙이지 않는다 — ISO/한글 날짜 어떤 형태든 원문 그대로 보여준다. */
function planDateRangeSummary(days: PlanDay[]): string | null {
  const dated = days.filter((d): d is PlanDay & { date: string } => d.date !== null);
  if (dated.length === 0) return null;
  const first = dated[0].date;
  const last = dated[dated.length - 1].date;
  return first === last ? first : `${first} ~ ${last}`;
}

/** v1.0 — Figma 레퍼런스의 요약 카드 행 하나(label + value). 정보
 *  종류마다 다른 아이콘을 붙이지 않고, 라벨 텍스트 자체가 정보 종류를
 *  설명하는 "정보 테이블"에 가깝게 둔다.
 *
 *  3차 우선순위 — 라벨 4개(일정 시간/방문 장소/비용 합계/이동 정보)가
 *  전부 4글자로 맞춰지면서, 6글자였던 "입력 비용 합계" 기준으로 잡혀
 *  있던 고정폭(92px)이 지금은 과하게 넓다. 76px로 줄여 오른쪽 value
 *  영역에 여유를 더 주되, 여전히 라벨이 줄바꿈되지 않을 만큼은
 *  남겨둔다(4글자 기준 13px/medium 폰트로 실측). Plan A/B 모두 이
 *  컴포넌트 하나를 공유하므로 폭은 항상 같다. items-start는 유지한다
 *  — value가 여러 줄(장소 나열 등)일 때 라벨이 첫 줄과 맞아야 하므로
 *  세로 중앙 정렬로 바꾸지 않는다. */
function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-[76px] shrink-0 text-[13px] font-medium text-text-secondary">{label}</span>
      <div className="min-w-0 flex-1 text-[14px] leading-[1.5] text-text-primary">{value}</div>
    </div>
  );
}

/** v1.0 — 배지+세로 rail이 있는 rail 칸(고정폭)과 실제 일정 내용이
 *  있는 content 칸, 두 컬럼으로 된 단순한 구조를 유지한다(구조를 다시
 *  리팩터링하지 않고 CSS 위치만 polish). 배지와 "첫 줄"의 세로 정렬은
 *  rail 칸의 margin-top으로 맞춘다 — 시간이 있으면 첫 줄이 시간(2차
 *  우선순위에서 14px→15px로 키워, 배지보다 살짝 더 낮게 -mt-[3px]로
 *  당김 — DOM 측정 기반 재조정), 시간이 없으면 첫 줄이 장소명(18px/1.3
 *  라인이 배지 높이와 이미 거의 같아 추가 보정이 필요 없음)이라
 *  offset을 다르게 준다.
 *
 *  버그 수정(2026-09-09) — 번호 배지 사이 세로 리듬을 "콘텐츠 높이에
 *  기대는 방식"에서 "항상 고정된 gap + 그 gap까지 이어지는 연결선"
 *  구조로 바꿨다. 이전엔 rail 칸(배지+세로선)이 content 칸과 같은 flex
 *  row 안에서 stretch로 높이를 맞추고, 그 늘어난 공간을
 *  timeline-rail-line이 flex:1로 채우는 방식이었다 — content가 짧으면
 *  rail도 짧아져 배지끼리 바짝 붙어 보였고, min-height를 올려도 "짧은
 *  항목들끼리도 서로 미묘하게 다른 실제 높이"만큼은 여전히 들쭉날쭉
 *  했다(QA 스크린샷으로 재확인). 지금은 목록 자체가 flex-col gap-6(item
 *  사이 24px 고정 간격)을 갖고, 이 컴포넌트는 그 24px 안까지 자기
 *  rail-line을 연장해 다음 배지와 이어지도록 CSS로 처리한다
 *  (globals.css .timeline-rail-line — top/bottom 절대위치로 재정의,
 *  bottom:-24px가 이 gap-6 값과 반드시 같아야 한다). 즉 "배지 이후
 *  간격"은 콘텐츠 높이와 무관하게 항상 24px로 고정되고, 콘텐츠가
 *  길면 그만큼 항목 자체가 늘어날 뿐 뒤따르는 간격 값은 바뀌지
 *  않는다 — 짧은 항목끼리는 완전히 동일한 배지 간격을 갖게 된다.
 *  min-h-14는 여전히 content 칸에 남겨뒀다 — gap이 "항목 이후의
 *  간격"은 고정해주지만, 완전히 빈 한 줄짜리 항목과 두 줄짜리 항목처럼
 *  "항목 자체의 높이"가 다르면 배지-배지 거리는 여전히 다를 수 있어,
 *  아주 짧은 항목들을 공통 바닥값으로 맞추는 보조 역할로 유지한다
 *  (rail 칸이 이제 absolute 연결선이라 stretch에 기대지 않으므로,
 *  이 min-height는 순수하게 content 칸 자신의 높이에만 영향을 준다). */
function TimelineItem({
  number,
  item,
  isLast,
  routesToNext,
}: {
  number: number;
  item: PlanItem;
  isLast: boolean;
  routesToNext: MockRouteSegment[] | null;
}) {
  const hasTime = item.time !== null;
  return (
    <div className="flex gap-3">
      <div className={`relative flex w-7 shrink-0 flex-col items-center ${hasTime ? "-mt-px" : ""}`}>
        <span className="timeline-badge" aria-hidden="true">
          {number}
        </span>
        {!isLast && <span className="timeline-rail-line" aria-hidden="true" />}
      </div>
      <div className="min-h-14 min-w-0 flex-1">
        <ScheduleItem item={item} />
        {routesToNext !== null && <RouteConnector segments={routesToNext} />}
      </div>
    </div>
  );
}

/** 3차 우선순위(2026-09-04) — 이동정보 커넥터. 한 구간에 이동수단이
 *  여러 개(도보+차량 등)여도 서로 다른 chip으로 쪼개지 않는다 — "같은
 *  구간에 속한 정보"라는 게 분명히 보이도록, 흰 카드 하나
 *  (.route-connector-card) 안에 이동수단별 행을 세로로 쌓고, elbow도
 *  그 카드 하나에만 연결한다(행마다 elbow를 반복하던 이전 구조 제거).
 *  elbow는 CSS만으로 카드 높이의 정확히 절반 지점에서 굽어지도록
 *  만들어(globals.css .route-connector-elbow::before, height:50%)
 *  행이 1개든 여러 개든 팔이 항상 카드 세로 중앙을 가리킨다 — 행
 *  개수에 따라 elbow px 값을 다시 계산할 필요가 없다.
 *
 *  4차 우선순위 — 행 안의 CarIcon/WalkIcon 렌더링을 뺐다(요청: "route
 *  정보가 아이콘보다 텍스트 중심으로 더 빠르게 읽히도록"). 두 아이콘
 *  함수 자체(및 원본 SVG path)는 다른 곳에서 다시 쓸 수 있게 파일에
 *  그대로 남겨둔다 — 지우는 건 이 자리의 렌더링 호출뿐이다. 카드/
 *  elbow/텍스트("도보 15분 · 1km" 등)와 route data/dev mock 로직은
 *  전혀 바뀌지 않았다.
 *
 *  dev mock 주의: segments는 isDevRouteMockEnabled()가 true일 때만
 *  PlanDayBlock에서 넘어오는 화면 검증용 가짜 데이터다. 프로덕션
 *  빌드에서는 이 컴포넌트 자체가 호출되지 않고(게이트는 그대로
 *  PlanDayBlock에 있음), 이 mock 값은 AI 핵심 차이 인사이트 등 다른
 *  로직의 근거로 쓰이지 않는다(dummyComparison.ts 가드레일, 이번
 *  라운드에서도 변경 없음). */
function RouteConnector({ segments }: { segments: MockRouteSegment[] }) {
  return (
    <div className="route-connector-group">
      <span className="route-connector-elbow" aria-hidden="true" />
      <div className="route-connector-card">
        {segments.map((segment, i) => {
          const label = segment.mode === "vehicle" ? "차량" : "도보";
          return (
            <span key={i} className="route-connector-card-row">
              {label} {segment.minutes}분 · {segment.km}km (dev mock)
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** 4차 우선순위(2026-09-04) — 상세 타임라인 첫 줄을 "시간 · 장소"
 *  하나로 합쳤다(이전엔 시간이 별도 줄, 장소가 그다음 줄이었다 —
 *  요청: "세로 길이를 줄이고 한눈에 시간과 장소를 함께 스캔할 수
 *  있게"). 시간/장소 앞 아이콘은 여전히 없다 — 왼쪽 타임라인의
 *  배지/세로선만 구조를 나타내고, 텍스트 자체는 순수 텍스트 위계
 *  (굵기/크기)로만 구분한다. 위계: 장소명(18px/700) > 시간(15px/600)
 *  > 보조 설명(14px/400) > chip 정보 — 크기/굵기 값 자체는 이전
 *  라운드에서 이미 확정된 값을 그대로 쓰고, 배치만 한 줄로 합쳤다.
 *  같은 flex row 안에서 items-center로 정렬해 크기가 다른 두 텍스트
 *  (15px 시간 / 18px 장소)의 세로 중심이 자연스럽게 맞는다. 시간은
 *  " · " 구분자를 자기 텍스트에 붙여 하나의 조각으로 둬서, 줄바꿈이
 *  일어나도 "시간"과 "·"이 따로 떨어지지 않게 한다 — category
 *  chip은 그 뒤에 이어지는 마지막 조각이라 장소명이 길 때 chip만
 *  자연스럽게 다음 줄로 넘어간다(flex-wrap).
 *
 *  시간: item.time이 null이 아니면 항상 보여준다 — 명시적 시각("오전
 *  10시")이든 모호한 표현("오후"/"저녁" 등 원문에 실제로 있던 값)이든
 *  둘 다 실제 입력에 있던 값이라 보여주는 게 맞고, 오직 null일 때만
 *  (사실 자체가 없을 때만) 시간 조각을 생략한다 — "시간 미기재" 같은
 *  문구를 새로 만들어 보여주지 않고, 빈 시간 줄도 만들지 않는다(장소만
 *  첫 줄에 남는다).
 *
 *  버그 수정(2026-09-04) — primary row(18px/bold)는 이제 item.place가
 *  실제로 있을 때만 렌더링한다. 이전엔 `item.place ?? item.activity`로
 *  place가 없으면 activity("씨앗호떡을 사 먹는다", "식사" 등 행동
 *  서술/일반 명사)를 그대로 place 자리에 굵게 승격해서 보여주고
 *  있었다 — API가 place:null을 정확히 돌려줘도(구조화 자체는 이미
 *  맞았다) 이 렌더링 fallback이 화면에서 다시 "장소처럼" 보이게
 *  만들고 있었다. 이제는 place 유무로만 primary row를 결정한다 —
 *  time만 있으면 time만, place까지 있으면 "time · place"까지만
 *  primary에 올라간다. activity는 어떤 경우에도 primary로 승격되지
 *  않고 항상 아래 secondary row(14px)에만 표시된다.
 *
 *  버그 수정(2026-09-05) — 위 수정의 부작용으로, time/place가 둘 다
 *  null이면서 activity는 실제로 있는 item(예: "숙소 이동")까지 무조건
 *  "정보 없음"으로 보여지고 있었다. "정보 없음"은 item에 정말 아무
 *  내용도 없을 때만 써야 하는 문구인데, activity라는 실제 입력값이
 *  있는데도 그걸 무시하고 "정보 없음"을 보여주는 건 오히려 정보
 *  손실처럼 보인다. time/place가 둘 다 없을 때만, activity 유무에 따라
 *  primary 자리를 activity로 대체하거나(activity 있음) 기존처럼
 *  "정보 없음"을 보여준다(activity도 없음 — 진짜 아무 정보도 없는
 *  극단적 케이스). activity를 place 필드로 옮기거나 place 취급하는 게
 *  아니라 이 컴포넌트의 렌더링 fallback만 바꾼 것이라, item.place는
 *  여전히 null 그대로 남고(방문 장소 집계·AI 핵심 차이 장소 비교는
 *  item.place만 보므로 영향 없음) category badge도 여전히 안 뜬다
 *  (item.category는 place가 없으면 항상 null). activity가 primary로
 *  올라간 경우에는 바로 아래 secondary 줄에 같은 텍스트를 중복
 *  표시하지 않는다.
 *
 *  버그 수정(2026-09-05, 2차) — category badge는 이제 item.place
 *  문자열을 키워드로 다시 추측하지 않고(classifyPlaceCategory 호출
 *  제거), structure-plan API가 채워 보내는 item.category를 그대로
 *  쓴다 — "역"/"시장"/"해수욕장" 같은 키워드가 없는 실제 장소(광안리,
 *  청사포, 블루라인파크 등)도 이제 API가 실제 의미를 판단해 채워주므로
 *  배지가 정상적으로 뜬다. */
// 버그 수정(2026-09-06) — QA에서 stated_cost에 숫자 없는 순수 비용
// 용도 단어("식비"/"교통비")가 들어가는 비결정적 케이스가 확인됐다
// (예: "아침 (야마와라와우 샤브샤브) 식비"의 stated_cost가 호출마다
// null/"식비"로 갈림). cost-chip은 원래 "실제 금액"을 보여주는
// 자리라, 숫자가 아예 없는 문자열까지 그대로 노출하면 금액 자리에
// 용도 단어가 뜨는 것처럼 보인다. stated_cost 원본 데이터/description/
// activity/category는 전혀 건드리지 않고 "표시 여부"만 이 조건으로
// 추가 판단한다 — "445,200"처럼 통화 단위가 없어도 숫자가 있으면
// 그대로 실제 금액으로 보고 기존처럼 표시한다(기존 정책 유지).
// isFreeStatedCost("무료"/"0원")는 숫자가 없어도 별도 분기라 이 함수와
// 무관하게 그대로 동작한다.
function hasNumericAmount(statedCost: string): boolean {
  return /\d/.test(statedCost);
}

// 버그 수정(2026-09-06, 2차) — 국내 Excel 이미지 QA에서 stated_cost가
// 순수 "0"(통화 단위 없음)으로 들어오는 케이스가 확인됐다. "0"도
// digit이라 hasNumericAmount만으로는 유료 chip으로 노출돼, 사용자가
// 실제 지불 금액(0원)처럼 오해할 수 있다. isFreeStatedCost는 정확히
// "무료"/"0원" 문자열만 인정하므로 bare "0"은 그 분기를 안 타 그대로
// 유료 chip으로 샜었다 — stated_cost 원본이나 비용 합계 로직은
// 손대지 않고, "표시 여부" 판단에 이 조건 하나만 추가한다.
function isPureZero(statedCost: string): boolean {
  return /^0+$/.test(statedCost.trim());
}

function ScheduleItem({ item }: { item: PlanItem }) {
  const hasPlace = item.place !== null;
  const category = item.category;
  const isExplicit = explicitTimeToMinutes(item.time) !== null;
  const timeLabel = item.time === null ? null : isExplicit ? formatExplicitTime(item.time) : item.time;
  const activityAsPrimary = !hasPlace && timeLabel === null && item.activity !== null;
  // description이 없을 때만 activity를 추가 secondary 줄로 보여주던
  // 규칙(place가 있는 항목의 중복 방지)은 그대로 두되, place가 없는
  // 항목은 activity가 이 item의 핵심 정보이므로 description 유무와
  // 무관하게 항상 보여준다 — "activity를 secondary 자리에서마저
  // 숨기지 않기"가 이번 수정의 핵심이다. activity가 이미 primary로
  // 올라간 경우(activityAsPrimary)는 바로 아래 secondary에 같은
  // 텍스트를 또 보여주지 않는다.
  const showActivity =
    item.activity !== null && !activityAsPrimary && (hasPlace ? item.description === null : true);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {timeLabel !== null && (
          <span className="text-[15px] font-semibold text-text-secondary">
            {hasPlace ? `${timeLabel} ·` : timeLabel}
          </span>
        )}
        {hasPlace && (
          <span className="text-[18px] font-bold leading-[1.3] text-text-primary">{item.place}</span>
        )}
        {activityAsPrimary && (
          <span className="text-[18px] font-bold leading-[1.3] text-text-primary">{item.activity}</span>
        )}
        {category !== null && <span className="category-badge">{category}</span>}
        {timeLabel === null && !hasPlace && item.activity === null && (
          <span className="text-[18px] font-bold leading-[1.3] text-text-primary">정보 없음</span>
        )}
      </div>

      {item.description !== null && (
        <p className="text-[14px] leading-[1.4] text-text-secondary">{item.description}</p>
      )}
      {showActivity && <p className="text-[14px] leading-[1.4] text-text-secondary">{item.activity}</p>}

      {/* 2차 우선순위 — 설명→비용 chip 간격을 mt-1(4px)→mt-2(8px)로
          늘려(부모 gap-1.5의 6px과 합쳐 10px→14px) 정보 덩어리 사이
          숨 쉴 공간을 조금 더 확보했다. 유료(purple)와 무료(mint/
          green)를 다른 색으로 구분한다 — category chip(blue)과도
          헷갈리지 않는 세 번째 색이다. "무료가 더 낫다"는 가치 판단이
          아니라 원문에 있는 유료/무료 사실 자체를 구분해 보여주는
          것뿐이다.
          버그 수정(2026-09-04) — stated_cost가 null이면(비용이 원문에
          아예 없으면) "비용 정보 없음" 텍스트조차 보여주지 않는다 —
          cost chip은 값이 있거나("무료" 포함) 명시됐을 때만 노출한다.
          플랜 요약 카드의 "비용 정보가 없거나 합산 기준이 명확하지
          않은 항목은 제외했어요." 안내 문구(PlanDayBlock)는 이 항목
          단위 표시와 무관하게 그대로 유지한다. */}
      {item.stated_cost !== null &&
        (isFreeStatedCost(item.stated_cost) ? (
          <span className="cost-chip-free mt-2 self-start">
            <CostIcon holeColor="var(--color-free-chip-bg)" />
            {item.stated_cost}
          </span>
        ) : (
          hasNumericAmount(item.stated_cost) && !isPureZero(item.stated_cost) && (
            <span className="cost-chip-v1 mt-2 self-start">
              <CostIcon />
              {item.stated_cost}
            </span>
          )
        ))}
    </div>
  );
}

/** v1.0 — 이동정보 아이콘 4종(지도/차량/도보/비용)은 하나의 pictogram
 *  family로 통일한다: filled(선이 아니라 면), 단순한 실루엣, 24
 *  viewBox 안에서 여백을 넉넉히 둬 작은 크기에서도 잘리지 않게 한다
 *  (stroke 기반 디테일은 작은 크기에서 잘려 보이기 쉬워 전부 fill만
 *  쓴다 — strokeWidth/clip 문제 원천 차단). 색은 각자 쓰이는 맥락의
 *  텍스트 색(currentColor)을 그대로 물려받는다.
 *
 *  지도 CTA 아이콘 — line-only outline + 위치 pin이었던 이전 버전을
 *  걷어내고, "지도/경로를 본다"는 의미가 pin보다 분명한 3단 접이식
 *  지도(folded map) 실루엣으로 바꿨다. 실제 종이지도처럼 안쪽 두 접힘
 *  선을 옅은 흰 선으로만 표시해 "지도"라는 걸 한눈에 알아볼 수 있게
 *  하면서도 다른 3개 아이콘과 같은 filled pictogram 스타일을
 *  유지한다. 4차 우선순위 — 18px→22px로 키웠다("비교 결과가 도움이
 *  되었나요?"의 아쉬워요/도움이 됐어요 아이콘, 20px 필드 기준과
 *  비슷한 시각적 존재감을 맞추기 위함) — CTA 높이/padding/text
 *  size/gap은 그대로 두고 아이콘 크기만 바꿨다. */
function MapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0 text-primary">
      <path d="M9 4.5 3.5 6.3v13.2L9 17.7l6 2.1 5.5-1.8V4.8L15 6.6l-6-2.1z" />
      <path d="M9 4.5v13.2" stroke="white" strokeWidth="1.4" strokeOpacity="0.55" fill="none" />
      <path d="M15 6.6v13.2" stroke="white" strokeWidth="1.4" strokeOpacity="0.55" fill="none" />
    </svg>
  );
}

/** v1.0 — 이동정보 chip 안의 차량 아이콘. Figma에서 export한 원본 SVG
 *  path를 그대로 쓴다(silhouette 수정 없음) — 원본은 24×24 viewBox +
 *  fill="black"였고, 여기서는 크기(17px)와 색(currentColor →
 *  chip의 primary-secondary 텍스트 색을 그대로 물려받음)만 조정했다.
 *  4차 우선순위 — RouteConnector에서 더 이상 렌더링하지 않지만
 *  (요청: "asset 파일 자체는 삭제하지 말고 렌더링만 제거"), 함수와
 *  원본 path는 그대로 남겨둔다. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M21.8281 9.50077C21.6813 9.32347 21.4851 9.23842 21.2542 9.23842C20.6809 9.23785 20.1073 9.23815 19.5339 9.23785C19.4142 9.23785 19.4303 9.24064 19.3961 9.14114C19.1927 8.55059 18.9406 7.98336 18.6018 7.4559C18.1366 6.73222 17.5291 6.15752 16.7926 5.71952C15.9711 5.23095 15.0738 5.00864 14.1233 5.00279C13.0522 4.99612 11.9809 5.00363 10.9099 5.00279C10.5127 5.00222 10.1206 5.04476 9.73236 5.12562C8.90974 5.29711 8.178 5.65782 7.52964 6.18974C6.88212 6.7211 6.39271 7.37697 6.01783 8.12177C5.84885 8.45777 5.71379 8.80822 5.58622 9.16144C5.55843 9.23898 5.5587 9.23926 5.47505 9.23926C5.36305 9.23953 5.25106 9.23926 5.13905 9.23926C4.68077 9.23953 4.22278 9.24035 3.76452 9.24008C3.62695 9.23978 3.49744 9.26646 3.37545 9.33373C3.08614 9.49325 2.96831 9.80034 3.00722 10.0732C3.05668 10.4193 3.36711 10.698 3.73033 10.6885C4.12552 10.6785 4.52126 10.6863 4.91672 10.6863C4.93646 10.6863 4.95617 10.6852 4.97591 10.686C5.02955 10.6888 5.03511 10.6955 5.02177 10.7436C5.01648 10.7625 5.0087 10.7808 5.00232 10.7994C4.85531 11.2399 4.70913 11.6807 4.56071 12.1206C4.48707 12.3385 4.44287 12.5666 4.33922 12.7748C4.32504 12.8031 4.31977 12.8379 4.31671 12.8701C4.26975 13.3706 4.30003 13.8634 4.45621 14.3456C4.62934 14.88 4.91504 15.3369 5.37081 15.6748C5.70069 15.9194 6.06808 16.0717 6.48467 16.0839C6.61973 16.0878 6.75479 16.0886 6.89014 16.0883C7.11163 16.0883 7.32256 16.125 7.51154 16.2509C7.61604 16.3204 7.71441 16.3977 7.80807 16.4807C8.04985 16.6953 8.3247 16.844 8.64541 16.8995C8.79521 16.9254 8.94665 16.9298 9.09868 16.9298C10.1533 16.9293 11.208 16.9298 12.2627 16.9298C13.4919 16.9296 14.7214 16.9293 15.9506 16.9285C16.109 16.9285 16.2665 16.9148 16.4219 16.8826C16.714 16.822 16.9616 16.6769 17.1834 16.483C17.3001 16.3807 17.4207 16.284 17.5569 16.2081C17.6764 16.1417 17.8028 16.0967 17.9415 16.0942C18.1093 16.0914 18.2775 16.0872 18.4453 16.0858C18.7591 16.0831 19.0506 15.9955 19.3241 15.8488C19.9341 15.5214 20.3173 15.0087 20.5288 14.3584C20.6811 13.8906 20.7128 13.4096 20.6844 12.9224C20.6817 12.8732 20.6794 12.8221 20.6575 12.7773C20.5689 12.5956 20.5258 12.3983 20.4616 12.2082C20.3001 11.731 20.1348 11.2549 19.985 10.7739C19.9766 10.7466 19.9569 10.7208 19.9683 10.6888C20.0002 10.6763 20.0333 10.6833 20.0658 10.6833C20.4779 10.6827 20.8898 10.688 21.3017 10.6808C21.5915 10.6758 21.8044 10.5326 21.9248 10.2692C22.0487 9.99658 22.0215 9.73366 21.8281 9.50077ZM7.13917 14.6855C6.47886 14.6663 5.89579 14.1555 5.90164 13.3629C5.90693 12.6615 6.48387 12.0837 7.18808 12.1009C7.89926 12.0884 8.48592 12.7032 8.47536 13.3979C8.46452 14.1255 7.89786 14.7072 7.13917 14.6855ZM6.8051 10.3787C6.79288 10.3598 6.79816 10.344 6.80345 10.3284C6.94658 9.90765 7.07218 9.48078 7.23616 9.06724C7.44738 8.53533 7.73557 8.05037 8.14048 7.64184C8.82302 6.95237 9.64841 6.56217 10.6155 6.47517C10.6942 6.46795 10.7737 6.46877 10.8526 6.4685C11.9531 6.46544 13.0536 6.4557 14.1539 6.46961C14.8267 6.47823 15.4531 6.66526 16.0337 7.00347C16.8357 7.4709 17.3913 8.14956 17.7331 9.00692C17.9051 9.43852 18.041 9.88262 18.1814 10.3251C18.1861 10.3406 18.193 10.3562 18.1819 10.3787L6.8051 10.3787ZM17.7931 14.6863C17.1247 14.6824 16.5092 14.136 16.5228 13.3673C16.5361 12.615 17.1356 12.0656 17.8645 12.099C18.4417 12.1256 19.0973 12.5914 19.0973 13.3951C19.0862 14.1463 18.5168 14.6908 17.7931 14.6863Z"
        fill="currentColor"
      />
      <path
        d="M7.28008 16.6474C7.17414 16.5751 7.05428 16.54 6.92604 16.5392C6.83715 16.5387 6.74823 16.5435 6.65932 16.5457C6.481 16.5501 6.30175 16.5467 6.12833 16.5065C5.34559 16.325 4.75377 15.8816 4.34641 15.1902C4.33733 15.1747 4.3366 15.1499 4.30657 15.1504C4.28812 15.1722 4.2992 15.1992 4.2992 15.2234C4.2992 15.4244 4.30136 15.6253 4.30128 15.8263C4.30107 16.4555 4.29818 17.0848 4.30021 17.714C4.30173 18.1902 4.68807 18.5749 5.16096 18.5756C5.66172 18.5764 6.1625 18.5726 6.66322 18.577C6.82835 18.5784 6.9749 18.5326 7.11138 18.4471C7.35025 18.2975 7.49462 18.082 7.5101 17.8004C7.52401 17.5475 7.5139 17.2932 7.51094 17.0396C7.50891 16.8664 7.41762 16.7413 7.28008 16.6474Z"
        fill="currentColor"
      />
      <path
        d="M20.5966 15.2885C20.3435 15.7004 19.9921 16.0065 19.5748 16.2416C19.3051 16.3936 19.0173 16.4913 18.7077 16.5229C18.527 16.5413 18.3462 16.5437 18.1651 16.5414C18.0627 16.54 17.961 16.5442 17.8626 16.5775C17.625 16.6579 17.4869 16.8474 17.4856 17.0954C17.4845 17.3029 17.4827 17.5103 17.4815 17.7178C17.4811 17.7903 17.4823 17.8626 17.499 17.9339C17.5922 18.3325 17.9667 18.5798 18.2893 18.577C18.8162 18.5724 19.3432 18.5762 19.8701 18.5755C19.916 18.5754 19.9628 18.5728 20.0075 18.5634C20.3911 18.4821 20.6873 18.1183 20.6915 17.7248C20.693 17.5832 20.6933 17.4416 20.6934 17.3C20.6939 16.6907 20.6941 16.0814 20.6942 15.4721C20.6942 15.3616 20.6966 15.2512 20.7111 15.1182C20.6459 15.1764 20.6279 15.2376 20.5966 15.2885Z"
        fill="currentColor"
      />
      <path
        d="M7.21751 12.5739C6.68494 12.5645 6.36057 12.9859 6.35269 13.3916C6.34397 13.8408 6.72016 14.2187 7.17944 14.225C7.64278 14.2314 8.00996 13.8674 8.01682 13.3949C8.02203 12.9218 7.64962 12.5815 7.21751 12.5739Z"
        fill="currentColor"
      />
      <path
        d="M17.7805 12.5711C17.3151 12.5826 16.9735 12.9436 16.9756 13.3992C16.9778 13.8611 17.3519 14.23 17.8078 14.224C18.2674 14.2179 18.6404 13.8496 18.6371 13.4049C18.6337 12.9326 18.2567 12.5593 17.7805 12.5711Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** v1.0 — 이동정보 chip 안의 도보(운동화) 아이콘. Figma에서 export한
 *  원본 SVG path를 그대로 쓴다(silhouette 수정 없음) — 크기(17px)와
 *  색(currentColor)만 조정했다. 4차 우선순위 — CarIcon과 동일하게
 *  RouteConnector에서 렌더링만 뺐고 함수는 남겨둔다. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WalkIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M3.00362 14.4606L3.31651 9.89389C3.31702 9.88637 3.31729 9.87884 3.31731 9.87131C3.31862 9.71183 3.37868 9.25855 3.63752 9.07638C3.88392 8.90296 4.27182 9.01067 4.55382 9.13153C4.69474 9.19192 4.83618 9.26834 4.97423 9.35859C5.38544 9.62749 6.64651 10.3793 7.8736 10.3793C8.12231 10.3794 8.36946 10.3485 8.60803 10.2765C9.24224 10.085 9.7281 9.6368 10.0521 8.94434C10.1552 8.724 10.2904 8.52887 10.454 8.36433C10.7121 8.10473 10.9719 7.98279 11.2262 8.00195C11.5402 8.02559 11.8687 8.26437 12.2024 8.7117C12.284 8.82105 12.3654 8.92298 12.4478 9.01946L11.5723 9.94723C11.4502 10.0765 11.4507 10.2857 11.5732 10.4145C11.6343 10.4786 11.7142 10.5107 11.7942 10.5107C11.8745 10.5107 11.9549 10.4783 12.0161 10.4135L12.8929 9.48433C13.0373 9.62234 13.2071 9.77561 13.4019 9.93723L12.6756 10.6904C12.5523 10.8183 12.5505 11.0275 12.6718 11.1576C12.733 11.2234 12.8141 11.2564 12.8951 11.2564C12.9743 11.2564 13.0536 11.2249 13.1146 11.1617L13.9127 10.334C14.0581 10.4396 14.2127 10.5463 14.3769 10.6524L13.753 11.4481C13.6428 11.5887 13.6614 11.797 13.7947 11.9133C13.8531 11.9642 13.9238 11.9891 13.9941 11.9891C14.0842 11.9891 14.1736 11.9483 14.2356 11.8693L14.929 10.9848C16.1281 11.6558 17.7197 12.2243 19.6716 12.2244C19.7948 12.2244 19.9192 12.2221 20.0452 12.2174C20.4184 12.2038 20.7911 12.279 21.1232 12.4351C21.7925 12.7496 22.0739 13.247 21.9836 13.9552C21.976 13.9953 21.8884 14.425 21.5239 14.8377C21.009 15.4206 20.2063 15.7032 19.1378 15.6785C19.1354 15.6784 19.1331 15.6784 19.1308 15.6784C19.1286 15.6784 19.1265 15.6784 19.1243 15.6784L4.3891 15.9997C4.09071 16.0067 3.794 15.9069 3.55369 15.7201C3.17537 15.4259 2.96974 14.9551 3.00362 14.4606Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** v1.0 — 비용 chip 안의 가격표 아이콘. 펀치홀 원은 chip의 실제
 *  배경색으로 뚫어야 chip 위에서 자연스럽게 "구멍"처럼 보인다(고정된
 *  한 색이면 유료-purple/무료-mint 중 한쪽 배경과 안 맞아 어색해
 *  보임) — holeColor로 호출부에서 chip 배경색을 넘겨준다. 12px에서
 *  살짝 뭉개져 보인다는 피드백으로 13px로 키웠다. */
function CostIcon({ holeColor = "var(--color-primary-soft)" }: { holeColor?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M12.4 3.5 20 11.1a2 2 0 0 1 0 2.8l-6.1 6.1a2 2 0 0 1-2.8 0L3.5 12.4V5.5a2 2 0 0 1 2-2h6.9z" />
      <circle cx="8" cy="9" r="1.3" fill={holeColor} />
    </svg>
  );
}

// 버그 수정(2026-09-04) — 원문 다시보기 modal의 day/date 줄만 style을
// 다르게 주기 위한 순수 표시용 판별. 텍스트 자체(text prop, API/비교
// 로직이 보는 원문)는 전혀 건드리지 않고, 렌더링 시 줄 단위로 어떤
// className을 씌울지만 결정한다 — 원문 내용/줄바꿈은 그대로다.
// joinDayTexts가 항상 만드는 "N일차"뿐 아니라, 사용자가 원문 안에 직접
// 적은 "1일차 (9월 12일)"/"DAY 1" 같은 표현도 같은 규칙으로 굵게
// 보이게 한다(줄이 이 마커로 "시작"하기만 하면 인정 — 뒤에 날짜 등이
// 더 붙어 있어도 헤더로 본다).
const ORIGINAL_TEXT_DAY_HEADING_PATTERN = /^(?:\d+\s*일\s*차|DAY\s*\d+)/i;
// 줄 전체가 정확히 달력 날짜 표현일 때만 인정한다(중간에 다른 말이
// 섞인 일반 일정 문장을 날짜 줄로 오인하지 않도록).
const ORIGINAL_TEXT_CALENDAR_DATE_PATTERN =
  /^(?:\d{4}\s*[.\-]\s*\d{1,2}\s*[.\-]\s*\d{1,2}|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*\/\s*\d{1,2})$/;

/** 한 day의 텍스트를 줄 단위로 렌더링한다 — day heading/달력 날짜 줄만
 *  타이포그래피를 다르게 줄 뿐, 문자열 자체나 줄바꿈 구조는 절대
 *  바꾸지 않는다(빈 줄은 <br/>로, 나머지는 원문 그대로). synthesizedHeading이
 *  있으면(그 day 텍스트가 사용자 자신의 "N일차" 마커로 시작하지 않는
 *  경우) 그 헤더를 이 텍스트 앞에 별도로 붙여 보여준다 — joinDayTexts가
 *  실제로 API에 보내기 전에 붙이는 것과 정확히 같은 문자열이라, 화면에
 *  보이는 헤더와 실제로 구조화에 쓰인 헤더가 어긋나지 않는다. */
function TextLines({ text, synthesizedHeading }: { text: string; synthesizedHeading: string | null }) {
  const lines = text.split("\n");
  return (
    <>
      {synthesizedHeading !== null && <div className="font-bold text-text-primary">{synthesizedHeading}</div>}
      {lines.map((line, i) => {
        if (line.trim() === "") return <br key={i} />;
        if (ORIGINAL_TEXT_DAY_HEADING_PATTERN.test(line.trim())) {
          return (
            <div key={i} className={`font-bold text-text-primary${i === 0 && synthesizedHeading === null ? "" : " mt-4"}`}>
              {line}
            </div>
          );
        }
        if (ORIGINAL_TEXT_CALENDAR_DATE_PATTERN.test(line.trim())) {
          return (
            <div key={i} className="font-medium">
              {line}
            </div>
          );
        }
        return <div key={i}>{line}</div>;
      })}
    </>
  );
}

/** day 하나 — 이미지로 입력했으면 "업로드한 이미지"(미리보기) +
 *  "추출된 내용"(이미지에서 실제로 읽힌 원문 그대로) 두 블록을 시각적으로
 *  구분해 보여준다. 추출한 내용을 원본 텍스트처럼 위장하지 않기
 *  위해, 이미지 day에는 항상 "추출된 내용" 라벨을 붙인다 — 텍스트로
 *  직접 입력한 day와 절대 같은 모양으로 보이지 않게 한다.
 *  버그 수정(2026-09-06, 2차) — "추출된 내용"에는 비교에 쓰인 선별된
 *  text가 아니라 rawText(이미지에 보이는 그대로의 전체 원문)를 보여준다.
 *  둘을 분리하기 전에는 이 자리에 이미 필터링된 text를 보여줘 사용자가
 *  "원문 다시보기"인데 실제 이미지 내용과 다르다고 오해할 수 있었다. */
function OriginalDayBlock({
  dayNumber,
  text,
  rawText,
  imageDataUrl,
  isFirst,
}: {
  dayNumber: number;
  text: string;
  rawText: string;
  imageDataUrl: string | null;
  isFirst: boolean;
}) {
  const synthesizedHeading = startsWithOwnDayMarker(text) ? null : `${dayNumber}일차`;

  if (imageDataUrl !== null) {
    return (
      <div className={isFirst ? "" : "mt-4"}>
        <div className="font-bold text-text-primary">{dayNumber}일차</div>
        <div className="mt-2 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-text-muted">업로드한 이미지</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 data URL 미리보기라 next/image 최적화 대상이 아니다. */}
          <img src={imageDataUrl} alt={`${dayNumber}일차 업로드 이미지`} className="image-preview-thumb" />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-text-muted">추출된 내용</span>
          <div>
            <TextLines text={rawText || text} synthesizedHeading={null} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isFirst ? "" : "mt-4"}>
      <TextLines text={text} synthesizedHeading={synthesizedHeading} />
    </div>
  );
}

/** v1.0 — 원문 다시보기 modal. 각 플랜 헤더 옆 언더라인 텍스트 버튼을
 *  누르면 뜬다.
 *  버그 수정(2026-09-04) — 하단 bottom sheet에서 viewport 중앙에 뜨는
 *  modal로 바꿨다. header(제목+닫기)는 항상 고정, 원문 영역만 세로
 *  스크롤된다(.modal-panel-body가 flex:1+min-height:0으로 스크롤을
 *  맡는다 — .modal-panel 자체의 max-height를 넘지 않는다). 오버레이
 *  클릭 또는 닫기 버튼으로 닫히고, 닫아도 onClose만 부를 뿐 result
 *  화면 state는 그대로다(재구성/재요청 없음).
 *  버그 수정(2026-09-05, 2차) — 이미지 입력을 지원하면서 flat text
 *  문자열 대신 day별 배열(dayTexts/dayImages)을 받아 day 단위로
 *  렌더링한다 — 텍스트 day는 기존과 동일하게 보이고(회귀 없음), 이미지
 *  day만 "업로드한 이미지"+"추출된 내용"으로 시각적으로 구분해 보여준다. */
function OriginalTextModal({
  label,
  dayTexts,
  dayRawTexts,
  dayImages,
  onClose,
}: {
  label: string;
  dayTexts: string[];
  dayRawTexts: string[];
  dayImages: (string | null)[];
  onClose: () => void;
}) {
  const titleId = useId();
  // 요구사항 — modal이 열려 있는 동안 배경 페이지 자체는 스크롤되지
  // 않아야 한다. overlay가 fixed+inset:0로 화면을 덮어 일반적인 마우스
  // 휠/터치 스크롤은 이미 막히지만, 키보드(Page Down 등)나 프로그램적
  // scroll까지 확실히 막기 위해 modal이 떠 있는 동안만 잠근다 — 실측
  // 결과 이 앱의 실제 스크롤 컨테이너(document.scrollingElement)는
  // body가 아니라 documentElement(html)라서, body만 잠그면 스크롤이
  // 그대로 새는 걸 확인했다. 둘 다 잠그고, 닫히면(cleanup) 원래 값으로
  // 되돌려 다른 화면에는 전혀 영향이 없다.
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-panel-header">
          <h3 id={titleId} className="text-[16px] font-bold text-text-primary">
            {label} 원문
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="focus-ring -m-3 p-3 text-text-secondary">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-panel-body">
          <div className="font-sans text-sm text-text-secondary">
            {dayTexts.map((text, i) => (
              <OriginalDayBlock
                key={i}
                dayNumber={i + 1}
                text={text}
                rawText={dayRawTexts[i] ?? ""}
                imageDataUrl={dayImages[i] ?? null}
                isFirst={i === 0}
              />
            ))}
          </div>
        </div>
      </div>
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

/** 3차 우선순위(UI polish) — filled info icon 공통 컴포넌트. 이전엔
 *  outline circle(원 테두리만) + currentColor 점/막대였는데, "filled
 *  circle + 원 안에 white i"로 바꿨다. "비교 범위 안내" 카드(amber)와
 *  요약 카드 하단 비용 안내 helper text(muted gray) 두 곳이 같은
 *  svg 하나를 재사용해 "동일한 visual language"를 보장한다 — 색/
 *  크기만 호출부 className/size로 다르게 준다(각자 기존 강조 위계는
 *  그대로 유지: 비교 범위 안내는 amber로 계속 눈에 띄고, 비용 helper
 *  text는 muted gray로 계속 낮은 위계). 흰 "i"는 배경과 무관하게 항상
 *  선명해야 하므로 currentColor가 아니라 고정 흰색(#ffffff)으로 둔다. */
function FilledInfoIcon({ size, className }: { size: number; className: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <rect x="11" y="10.4" width="2" height="7.1" rx="1" fill="#ffffff" />
      <circle cx="12" cy="7.1" r="1.3" fill="#ffffff" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** v1.0 — AI 핵심 차이 bullet icon. Figma 레퍼런스 기준으로 원형
 *  배경(circle-check)을 없애고 단순 체크 마크만 남긴다. */
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-primary">
      <path d="M5 12.5l4.3 4.3L19 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
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

