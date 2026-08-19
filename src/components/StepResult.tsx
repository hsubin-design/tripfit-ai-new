"use client";

import { useState } from "react";
import type { ComparisonResult, PlanItem } from "@/types/plan";

type Props = {
  result: ComparisonResult;
  planAText: string;
  planBText: string;
  onBack: () => void;
  onNext: () => void;
  onReopenOriginal: (plan: "a" | "b") => void;
};

function fieldOrFallback(value: string | null) {
  return value ?? "정보 없음";
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
  const { comparison } = result;

  function toggleOriginal(plan: "a" | "b") {
    setOpenOriginal((prev) => {
      const next = { ...prev, [plan]: !prev[plan] };
      if (next[plan]) onReopenOriginal(plan);
      return next;
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">비교 결과</h1>
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          아래 내용은 두 일정의 차이를 같은 기준으로 정리한 결과입니다. 어느 일정이 더
          적합한지는 취향·체력·예산 등 개인 조건에 따라 달라질 수 있습니다. 지금 정보만으로
          고르기 어렵다면 &quot;결정 어려움&quot;을 선택해도 됩니다.
        </p>
        <p className="text-xs text-slate-400">
          지도 기반 거리·교통시간 정보는 제공하지 않습니다.
        </p>

        <div>
          <h2 className="text-sm font-semibold text-slate-800">핵심 차이 요약</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-slate-700">
            {comparison.key_differences.map((diff, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-slate-400">·</span>
                <span>{diff}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
        <FixedCriterion
          title="일정 규모"
          a={`${result.plans.a.duration_days ?? "정보 없음"}일 · 총 ${sumItems(comparison.daily_item_counts.a)}항목`}
          b={`${result.plans.b.duration_days ?? "정보 없음"}일 · 총 ${sumItems(comparison.daily_item_counts.b)}항목`}
        />
        <FixedCriterion
          title="장소 구성"
          a={`A만: ${comparison.unique_to_a.length}곳`}
          b={`B만: ${comparison.unique_to_b.length}곳`}
          note={`공통 ${comparison.common_places.length}곳`}
        />
        <FixedCriterion
          title="날짜별 구성"
          a={comparison.daily_item_counts.a.join(" / ") || "정보 없음"}
          b={comparison.daily_item_counts.b.join(" / ") || "정보 없음"}
          note="일차별 항목 수"
        />
        <FixedCriterion
          title="정보 완성도"
          a={`시간 ${comparison.missing_information.a.time}·장소 ${comparison.missing_information.a.place}·비용 ${comparison.missing_information.a.cost} 누락`}
          b={`시간 ${comparison.missing_information.b.time}·장소 ${comparison.missing_information.b.place}·비용 ${comparison.missing_information.b.cost} 누락`}
        />
        <FixedCriterion
          title="명시 비용"
          a="원문에 적힌 값만 표시"
          b="원문에 적힌 값만 표시"
          note="합산·환산 없음"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PlanColumn label="플랜 A" plan={result.plans.a} />
        <PlanColumn label="플랜 B" plan={result.plans.b} />
      </section>

      <section className="flex flex-col gap-3">
        <OriginalToggle label="플랜 A 원문" text={planAText} open={openOriginal.a} onToggle={() => toggleOriginal("a")} />
        <OriginalToggle label="플랜 B 원문" text={planBText} open={openOriginal.b} onToggle={() => toggleOriginal("b")} />
      </section>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:border-slate-500"
        >
          이전: 입력으로
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          다음: 결정하기
        </button>
      </div>
    </div>
  );
}

function sumItems(counts: number[]) {
  return counts.reduce((sum, n) => sum + n, 0);
}

function FixedCriterion({ title, a, b, note }: { title: string; a: string; b: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <p className="text-slate-700">
        <span className="font-medium">A</span> {a}
      </p>
      <p className="text-slate-700">
        <span className="font-medium">B</span> {b}
      </p>
      {note && <p className="text-xs text-slate-400">{note}</p>}
    </div>
  );
}

function PlanColumn({ label, plan }: { label: string; plan: ComparisonResult["plans"]["a"] }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-slate-800">{label}</h2>
      {plan.days.map((day) => (
        <div key={day.day} className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{day.day}일차</h3>
          <ul className="flex flex-col gap-2">
            {day.items.map((item, i) => (
              <ItemRow key={i} item={item} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ItemRow({ item }: { item: PlanItem }) {
  return (
    <li className="rounded border border-slate-100 bg-slate-50 p-2.5 text-sm">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-700">
        <span>
          <span className="text-slate-400">시간</span> {fieldOrFallback(item.time)}
        </span>
        <span>
          <span className="text-slate-400">장소</span> {fieldOrFallback(item.place)}
        </span>
        <span>
          <span className="text-slate-400">비용</span> {fieldOrFallback(item.stated_cost)}
        </span>
      </div>
      {item.activity && <p className="mt-1 text-slate-600">{item.activity}</p>}
    </li>
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
  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700"
      >
        {label} 다시보기
        <span className="text-slate-400">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600">{text}</pre>
        </div>
      )}
    </div>
  );
}
