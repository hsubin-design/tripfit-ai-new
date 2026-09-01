"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import AppHeader from "@/components/AppHeader";
import { allDaysFilled, resizeDayTexts } from "@/lib/planDayText";
import { SAMPLE_PLAN_A_DAY_TEXTS, SAMPLE_PLAN_B_DAY_TEXTS } from "@/lib/sampleData";
import { MIN_LEN, MAX_LEN } from "@/components/StepInput";

// v1.0 dev — Input Exploration variant. 기존 StepInput.tsx는 전혀
// 건드리지 않고 그대로 보존한 채, "일차 구조까지만 명확하게 주고
// 내용은 자유 텍스트로 유지"하는 원칙 아래 두 가지 입력 방식(붙여넣기
// / 직접 일정 추가)을 플랜별로 고를 수 있게 하는 별도 실험 화면이다.
// 시간/장소/비용/활동을 4개의 필수 form field로 쪼개지 않는다 — 직접
// 일정 추가 모드의 각 item도 결국 한 줄짜리 자유 텍스트일 뿐이다.
//
// 제출 시에는 두 모드 모두 최종적으로 "일차별 자유 텍스트 배열"
// (기존 StepInput과 동일한 모양)로 합쳐 부모(page.tsx)의 기존
// planADayTexts/planBDayTexts state와 handleSubmitInput 파이프라인에
// 그대로 흘려보낸다 — API/Processing/Result 쪽은 무엇 하나 바뀌지
// 않는다.

const DURATION_OPTIONS: { label: string; days: number }[] = [
  { label: "1박 2일", days: 2 },
  { label: "2박 3일", days: 3 },
];

type Mode = "paste" | "manual";

type PlanState = {
  duration: number | null;
  mode: Mode;
  // 두 모드의 데이터는 서로 다른 저장소에 독립적으로 남아있다 — 모드를
  // 전환해도 반대쪽 모드에 입력해둔 내용은 지워지지 않는다(요구사항:
  // "mode별로 데이터 보존").
  pasteDayTexts: string[];
  manualDayItems: string[][];
};

const EMPTY_PLAN_STATE: PlanState = { duration: null, mode: "paste", pasteDayTexts: [], manualDayItems: [] };

function resizeManualItems(current: string[][], newLength: number): string[][] {
  const next = current.slice(0, newLength);
  while (next.length < newLength) next.push([""]);
  return next;
}

/** 현재 활성 모드 기준으로, 기존 API가 받는 것과 동일한 모양(일차별
 *  자유 텍스트 배열)을 만든다. 직접 일정 추가 모드는 빈 item을 걸러낸
 *  뒤 줄바꿈으로 합친다(요구사항 9 — newline 기반 자유 텍스트 조합). */
function activeDayTexts(state: PlanState): string[] {
  if (state.mode === "paste") return state.pasteDayTexts;
  return state.manualDayItems.map((items) =>
    items
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .join("\n")
  );
}

function typedLength(dayTexts: string[]): number {
  return dayTexts.reduce((sum, t) => sum + t.trim().length, 0);
}

function planError(state: PlanState): string | null {
  if (state.duration === null) return null;
  const dayTexts = activeDayTexts(state);
  if (!allDaysFilled(dayTexts)) return "모든 일차에 일정을 입력해주세요.";
  const len = typedLength(dayTexts);
  if (len < MIN_LEN) return `${MIN_LEN}자 이상 입력해주세요. (현재 ${len}자)`;
  if (len > MAX_LEN) return `${MAX_LEN}자를 초과했습니다. (현재 ${len}자)`;
  return null;
}

function isPlanValid(state: PlanState): boolean {
  if (state.duration === null) return false;
  const dayTexts = activeDayTexts(state);
  if (!allDaysFilled(dayTexts)) return false;
  const len = typedLength(dayTexts);
  return len >= MIN_LEN && len <= MAX_LEN;
}

const URL_ONLY_PATTERN = /^(?:https?:\/\/|www\.)\S+$/i;
const TOAST_DURATION_MS = 2500;
type ToastContent = { title: string; subtitle?: string };

type Props = {
  onBack: () => void;
  onSubmit: (planADuration: number, planADayTexts: string[], planBDuration: number, planBDayTexts: string[]) => void;
};

export default function StepInputExplorationDev({ onBack, onSubmit }: Props) {
  const [planA, setPlanA] = useState<PlanState>(EMPTY_PLAN_STATE);
  const [planB, setPlanB] = useState<PlanState>(EMPTY_PLAN_STATE);
  const [touchedA, setTouchedA] = useState(false);
  const [touchedB, setTouchedB] = useState(false);
  const [toast, setToast] = useState<ToastContent | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(content: ToastContent) {
    setToast(content);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  function handleLoadSample() {
    setPlanA({
      duration: SAMPLE_PLAN_A_DAY_TEXTS.length,
      mode: "paste",
      pasteDayTexts: [...SAMPLE_PLAN_A_DAY_TEXTS],
      manualDayItems: resizeManualItems([], SAMPLE_PLAN_A_DAY_TEXTS.length),
    });
    setPlanB({
      duration: SAMPLE_PLAN_B_DAY_TEXTS.length,
      mode: "paste",
      pasteDayTexts: [...SAMPLE_PLAN_B_DAY_TEXTS],
      manualDayItems: resizeManualItems([], SAMPLE_PLAN_B_DAY_TEXTS.length),
    });
  }

  const errorA = touchedA ? planError(planA) : null;
  const errorB = touchedB ? planError(planB) : null;
  const isValid = isPlanValid(planA) && isPlanValid(planB);

  function handleSubmit() {
    setTouchedA(true);
    setTouchedB(true);
    if (!isValid || planA.duration === null || planB.duration === null) return;
    onSubmit(planA.duration, activeDayTexts(planA), planB.duration, activeDayTexts(planB));
  }

  return (
    <div className="w-full">
      <AppHeader variant="back" onBack={onBack} />
      <div className="flex w-full flex-col px-5 pb-28 pt-20">
        <div className="scope-notice">
          <div>
            <p className="scope-notice-title">Input Exploration (dev)</p>
            <p className="scope-notice-text">
              장소·시간·비용·활동을 각각의 필수 입력칸으로 나누지 않고, 일차 구조만 명확히 준 채 내용은
              자유 텍스트로 유지하는 실험 화면이에요.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <h1 className="heading-page">두 일정, 뭐가 다른지 비교해봐요.</h1>
          <p className="text-body-secondary mt-2">여행 기간을 고르고, 일차별로 일정을 입력해주세요.</p>
          <p className="text-caption text-text-muted mt-1 text-[13px] leading-[1.5]">
            블로그·메모·AI 일정도 그대로 붙여넣을 수 있어요.
          </p>
        </div>

        <button type="button" onClick={handleLoadSample} className="btn-secondary focus-ring mt-6 w-full">
          예시 일정으로 시작하기
        </button>

        <div className="mt-6 flex flex-col gap-6">
          <PlanSection
            label="플랜 A"
            state={planA}
            onChange={setPlanA}
            onBlur={() => setTouchedA(true)}
            error={errorA}
            onShowToast={showToast}
          />
          <PlanSection
            label="플랜 B"
            state={planB}
            onChange={setPlanB}
            onBlur={() => setTouchedB(true)}
            error={errorB}
            onShowToast={showToast}
          />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[100px] z-20 flex justify-center px-5">
        <div
          className={`mx-auto w-full max-w-[390px] transition-opacity duration-200 ${
            toast ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="input-toast">
            <p>{toast?.title ?? ""}</p>
            {toast?.subtitle && <p className="input-toast-subtitle">{toast.subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className="btn-primary focus-ring w-full"
          >
            두 일정 비교하기
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanSection({
  label,
  state,
  onChange,
  onBlur,
  error,
  onShowToast,
}: {
  label: string;
  state: PlanState;
  onChange: (updater: (prev: PlanState) => PlanState) => void;
  onBlur: () => void;
  error: string | null;
  onShowToast: (content: ToastContent) => void;
}) {
  function changeDuration(days: number) {
    onChange((prev) => ({
      ...prev,
      duration: days,
      pasteDayTexts: resizeDayTexts(prev.pasteDayTexts, days),
      manualDayItems: resizeManualItems(prev.manualDayItems, days),
    }));
  }

  function changeMode(mode: Mode) {
    onChange((prev) => ({ ...prev, mode }));
  }

  function changePasteText(dayIndex: number, value: string) {
    onChange((prev) => {
      const next = [...prev.pasteDayTexts];
      next[dayIndex] = value;
      return { ...prev, pasteDayTexts: next };
    });
  }

  function changeManualItem(dayIndex: number, itemIndex: number, value: string) {
    onChange((prev) => {
      const days = prev.manualDayItems.map((items, di) =>
        di === dayIndex ? items.map((it, ii) => (ii === itemIndex ? value : it)) : items
      );
      return { ...prev, manualDayItems: days };
    });
  }

  function addManualItem(dayIndex: number) {
    onChange((prev) => {
      const days = prev.manualDayItems.map((items, di) => (di === dayIndex ? [...items, ""] : items));
      return { ...prev, manualDayItems: days };
    });
  }

  function removeManualItem(dayIndex: number, itemIndex: number) {
    onChange((prev) => {
      const days = prev.manualDayItems.map((items, di) => {
        if (di !== dayIndex) return items;
        if (items.length <= 1) return [""];
        return items.filter((_, ii) => ii !== itemIndex);
      });
      return { ...prev, manualDayItems: days };
    });
  }

  return (
    <div className="flex flex-col gap-3" onBlur={onBlur}>
      <span className="text-body font-semibold">{label}</span>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text-secondary">기간</span>
        <div className="tab-pill-group w-full">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              data-active={state.duration === opt.days}
              className="tab-pill focus-ring flex-1"
              onClick={() => changeDuration(opt.days)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {state.duration !== null && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text-secondary">입력 방식</span>
            <div className="tab-pill-group w-full">
              <button
                type="button"
                data-active={state.mode === "paste"}
                className="tab-pill focus-ring flex-1"
                onClick={() => changeMode("paste")}
              >
                붙여넣기
              </button>
              <button
                type="button"
                data-active={state.mode === "manual"}
                className="tab-pill focus-ring flex-1"
                onClick={() => changeMode("manual")}
              >
                직접 일정 추가
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {Array.from({ length: state.duration }, (_, i) => i).map((dayIndex) =>
              state.mode === "paste" ? (
                <PasteDayInput
                  key={dayIndex}
                  dayNumber={dayIndex + 1}
                  value={state.pasteDayTexts[dayIndex] ?? ""}
                  onChange={(v) => changePasteText(dayIndex, v)}
                  onShowToast={onShowToast}
                />
              ) : (
                <ManualDayInput
                  key={dayIndex}
                  dayNumber={dayIndex + 1}
                  items={state.manualDayItems[dayIndex] ?? [""]}
                  onChangeItem={(itemIndex, v) => changeManualItem(dayIndex, itemIndex, v)}
                  onAddItem={() => addManualItem(dayIndex)}
                  onRemoveItem={(itemIndex) => removeManualItem(dayIndex, itemIndex)}
                  onShowToast={onShowToast}
                />
              )
            )}
          </div>

          <p className="text-caption text-[12px] leading-[1.45]">
            {state.mode === "paste"
              ? "형식은 신경 쓰지 않아도 괜찮아요. 알고 있는 내용만 입력해주세요."
              : "모든 항목을 채울 필요는 없어요. 알고 있는 내용만 적어주세요."}
          </p>

          <div className="flex items-center justify-end">
            <span className={`text-caption ${error ? "text-error" : ""}`}>
              {error ?? `${typedLength(activeDayTexts(state))} / ${MAX_LEN.toLocaleString()}자`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function usePasteGuard(onShowToast: (content: ToastContent) => void) {
  function handlePaste(value: string, selectionStart: number, selectionEnd: number, e: ClipboardEvent<HTMLTextAreaElement>) {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      onShowToast({ title: "현재는 텍스트 붙여넣기만 지원해요." });
      return;
    }
    const pastedText = e.clipboardData.getData("text/plain");
    const resultingValue = value.slice(0, selectionStart) + pastedText + value.slice(selectionEnd);
    if (URL_ONLY_PATTERN.test(resultingValue.trim())) {
      e.preventDefault();
      onShowToast({
        title: "현재는 여행 일정 텍스트만 입력할 수 있어요.",
        subtitle: "링크의 내용은 불러오지 않아요. 일정 내용을 직접 붙여넣어 주세요.",
      });
    }
  }
  function handleDrop(e: DragEvent<HTMLTextAreaElement>) {
    if (e.dataTransfer.files.length > 0) {
      e.preventDefault();
      onShowToast({ title: "현재는 텍스트 붙여넣기만 지원해요." });
    }
  }
  return { handlePaste, handleDrop };
}

function PasteDayInput({
  dayNumber,
  value,
  onChange,
  onShowToast,
}: {
  dayNumber: number;
  value: string;
  onChange: (v: string) => void;
  onShowToast: (content: ToastContent) => void;
}) {
  const { handlePaste, handleDrop } = usePasteGuard(onShowToast);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] font-semibold text-text-secondary">{dayNumber}일차</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => handlePaste(value, e.currentTarget.selectionStart ?? value.length, e.currentTarget.selectionEnd ?? value.length, e)}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        rows={3}
        placeholder="블로그·메모·AI에서 가져온 일정을 그대로 붙여넣어 주세요."
        className="field text-body resize-none p-3"
      />
    </div>
  );
}

const ITEM_PLACEHOLDERS = ["예: 오전 10시 부산역 도착 · 교통비 20,000원", "예: 흰여울문화마을에서 산책"];

function ManualDayInput({
  dayNumber,
  items,
  onChangeItem,
  onAddItem,
  onRemoveItem,
  onShowToast,
}: {
  dayNumber: number;
  items: string[];
  onChangeItem: (itemIndex: number, v: string) => void;
  onAddItem: () => void;
  onRemoveItem: (itemIndex: number) => void;
  onShowToast: (content: ToastContent) => void;
}) {
  const { handlePaste, handleDrop } = usePasteGuard(onShowToast);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-text-secondary">{dayNumber}일차</span>
      <div className="flex flex-col gap-2">
        {items.map((item, itemIndex) => (
          <div key={itemIndex} className="flex items-start gap-2">
            <textarea
              value={item}
              onChange={(e) => onChangeItem(itemIndex, e.target.value)}
              onPaste={(e) =>
                handlePaste(item, e.currentTarget.selectionStart ?? item.length, e.currentTarget.selectionEnd ?? item.length, e)
              }
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              rows={1}
              placeholder={ITEM_PLACEHOLDERS[itemIndex % ITEM_PLACEHOLDERS.length]}
              className="field text-body min-h-0 flex-1 resize-none p-3"
            />
            <button
              type="button"
              onClick={() => onRemoveItem(itemIndex)}
              aria-label="이 일정 삭제"
              className="focus-ring mt-1 shrink-0 text-[13px] font-medium text-text-muted"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAddItem}
        className="focus-ring self-start text-[13px] font-medium text-primary"
      >
        + 일정 추가
      </button>
    </div>
  );
}
