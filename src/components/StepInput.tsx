"use client";

import { useState } from "react";

const MIN_LEN = 50;
const MAX_LEN = 6000;

function validate(text: string): string | null {
  if (text.length === 0) return null;
  if (text.length < MIN_LEN) return `${MIN_LEN}자 이상 입력해주세요. (현재 ${text.length}자)`;
  if (text.length > MAX_LEN) return `${MAX_LEN}자를 초과했습니다. (현재 ${text.length}자)`;
  return null;
}

type Props = {
  planAText: string;
  planBText: string;
  onChangeA: (v: string) => void;
  onChangeB: (v: string) => void;
  onLoadSample: () => void;
  onSubmit: () => void;
};

export default function StepInput({ planAText, planBText, onChangeA, onChangeB, onLoadSample, onSubmit }: Props) {
  const [touchedA, setTouchedA] = useState(false);
  const [touchedB, setTouchedB] = useState(false);

  const errorA = validate(planAText);
  const errorB = validate(planBText);
  const isValid =
    planAText.length >= MIN_LEN &&
    planAText.length <= MAX_LEN &&
    planBText.length >= MIN_LEN &&
    planBText.length <= MAX_LEN;

  function handleSubmit() {
    setTouchedA(true);
    setTouchedB(true);
    if (isValid) onSubmit();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">여행 일정 비교하기</h1>
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          TripFit AI는 더 좋은 일정을 대신 골라주는 서비스가 아닙니다. 서로 다른 형식의 여행
          일정을 같은 기준으로 정리해 차이를 확인하기 쉽게 돕습니다.
        </p>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <PlanTextarea
          label="플랜 A"
          value={planAText}
          onChange={onChangeA}
          onBlur={() => setTouchedA(true)}
          error={touchedA ? errorA : null}
        />
        <PlanTextarea
          label="플랜 B"
          value={planBText}
          onChange={onChangeB}
          onBlur={() => setTouchedB(true)}
          error={touchedB ? errorB : null}
        />
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onLoadSample}
          className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900"
        >
          예시 일정 불러오기
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
        >
          두 일정 비교하기
        </button>
      </div>
    </div>
  );
}

function PlanTextarea({
  label,
  value,
  onChange,
  onBlur,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-800">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={10}
        placeholder="여행 일정 텍스트를 붙여넣어 주세요 (50~6,000자)"
        className="w-full resize-none rounded-lg border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-slate-500"
      />
      <div className="flex items-center justify-between text-xs">
        <span className={error ? "text-red-600" : "text-slate-400"}>
          {error ?? `${value.length} / 6,000자`}
        </span>
      </div>
    </div>
  );
}
