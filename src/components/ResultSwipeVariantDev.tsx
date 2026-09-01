"use client";

import { useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import type { ComparisonResult, PlanDay, PlanItem } from "@/types/plan";
import { classifyPlaceCategory } from "@/lib/placeCategory";
import { sumDayCost } from "@/lib/costSummary";
import { explicitTimeToMinutes, formatExplicitTime, sortItemsByExplicitTime } from "@/lib/timeSort";

// v1.0 — Result Option B의 "같은 일차 안에서 Plan A → Plan B를 세로로
//이어 보여주는" 기본 구조는 그대로 두고(요구사항: 좌우 swipe carousel로
// 바꾸지 않기), 이 화면은 "만약 swipe 방식이었다면" 어떤 모습일지
// 비교해보기 위한 별도의 작은 실험안이다. 실제 Result 화면에서는 dev
// 전용 링크로만 진입하고, production 흐름에는 포함되지 않는다.
const WON_FORMATTER = new Intl.NumberFormat("ko-KR");
function formatWon(amount: number): string {
  return `${WON_FORMATTER.format(amount)}원`;
}

type Props = {
  result: ComparisonResult;
  onBack: () => void;
};

export default function ResultSwipeVariantDev({ result, onBack }: Props) {
  const dayCount = Math.max(result.plans.a.days.length, result.plans.b.days.length);
  const [selectedDay, setSelectedDay] = useState(1);
  const [activePlan, setActivePlan] = useState<0 | 1>(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // key_differences는 dummyComparison.ts buildComparison() 한 곳에서만
  // 생성된 문장을 그대로 재사용할 뿐, 여기서 새로 만들지 않는다 — swipe로
  // 카드를 넘기는 동안에도 "핵심 차이는 항상 화면에 남아있어야 한다"는
  // 요구사항을 충족하기 위해 상단에 고정으로 둔다.
  const topLines = result.comparison.key_differences.slice(0, 2).map((k) => k.text);

  function scrollToPlan(index: 0 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setActivePlan(index);
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActivePlan(index === 1 ? 1 : 0);
  }

  return (
    <div className="w-full">
      <AppHeader variant="back" onBack={onBack} />
      <div className="flex w-full flex-col px-5 pb-28 pt-20">
        <h1 className="heading-page">A/B 스와이프 비교 (실험안)</h1>
        <p className="text-caption text-text-muted mt-2 text-[12px] leading-[1.5]">
          결과 화면의 기본 구조는 아니고, vertical 비교와 비교해보기 위한 실험용 화면이에요.
        </p>

        {topLines.length > 0 && (
          <div className="scope-notice mt-4">
            <div>
              <p className="scope-notice-title">핵심 차이</p>
              <ul className="mt-1 flex flex-col gap-1">
                {topLines.map((text, i) => (
                  <li key={i} className="scope-notice-text">
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="tab-pill-group mt-5 w-full">
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

        {/* Position indicator + swipe 가능 힌트 — 애니메이션 없이도
            "지금 A를 보고 있고 옆에 B가 더 있다"는 사실이 텍스트/점으로
            전달된다. */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => scrollToPlan(0)}
            aria-label="플랜 A로 이동"
            className="swipe-dot focus-ring"
            data-active={activePlan === 0}
          />
          <button
            type="button"
            onClick={() => scrollToPlan(1)}
            aria-label="플랜 B로 이동"
            className="swipe-dot focus-ring"
            data-active={activePlan === 1}
          />
        </div>
        <p className="text-caption text-text-muted mt-1 text-center text-[12px]">
          {activePlan === 0 ? "플랜 A" : "플랜 B"} · 좌우로 스와이프해서 비교해보세요
        </p>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="swipe-track mt-3"
        >
          <div className="swipe-card">
            <SwipePlanCard label="플랜 A" day={result.plans.a.days[selectedDay - 1]} />
          </div>
          <div className="swipe-card">
            <SwipePlanCard label="플랜 B" day={result.plans.b.days[selectedDay - 1]} />
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => scrollToPlan(0)}
            disabled={activePlan === 0}
            className="btn-secondary focus-ring flex-1"
          >
            ← 플랜 A
          </button>
          <button
            type="button"
            onClick={() => scrollToPlan(1)}
            disabled={activePlan === 1}
            className="btn-secondary focus-ring flex-1"
          >
            플랜 B →
          </button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
          <button type="button" onClick={onBack} className="btn-secondary focus-ring w-full">
            비교 결과로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

function SwipePlanCard({ label, day }: { label: string; day: PlanDay | undefined }) {
  if (!day) {
    return (
      <div className="rounded-container bg-subtle-surface p-4">
        <h3 className="heading-card">{label}</h3>
        <p className="text-caption mt-2">이 플랜에는 해당 일차 일정이 없습니다.</p>
      </div>
    );
  }

  const sortedItems = sortItemsByExplicitTime(day.items);
  const daySum = sumDayCost(day);

  return (
    <div className="rounded-container bg-subtle-surface flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="heading-card">{label}</h3>
        <span className="text-[13px] font-semibold text-text-primary">
          {daySum.total !== null ? formatWon(daySum.total) : "비용 정보 없음"}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {sortedItems.map((item, i) => (
          <SwipeItemRow key={i} item={item} />
        ))}
      </div>
    </div>
  );
}

function SwipeItemRow({ item }: { item: PlanItem }) {
  const primary = item.place ?? item.activity ?? "정보 없음";
  const category = classifyPlaceCategory(item.place);
  const isExplicit = explicitTimeToMinutes(item.time) !== null;
  const timeLabel = isExplicit && item.time !== null ? formatExplicitTime(item.time) : "시간 미기재";

  return (
    <div className="border-border flex flex-col gap-1 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[15px] font-semibold text-text-primary">{primary}</span>
        {category !== null && <span className="category-badge">{category}</span>}
      </div>
      <p className="text-[13px] text-text-secondary">
        {timeLabel} · {item.stated_cost ?? "비용 정보 없음"}
      </p>
    </div>
  );
}
