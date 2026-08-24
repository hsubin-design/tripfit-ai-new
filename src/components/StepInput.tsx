"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import AppHeader from "@/components/AppHeader";
import { allDaysFilled } from "@/lib/planDayText";

const TOAST_DURATION_MS = 2500;

export const MIN_LEN = 50;
export const MAX_LEN = 6000;

// 일차별 입력 구조 실험(2026-08-24) — 여행 기간 선택지. 예시로 주어진
// 두 개만 우선 둔다(범위를 임의로 넓히지 않음). days는 일차 textarea
// 개수와 동일하다.
const DURATION_OPTIONS: { label: string; days: number }[] = [
  { label: "1박 2일", days: 2 },
  { label: "2박 3일", days: 3 },
];

// 전체 입력값(trim)이 URL 하나뿐인지 판정한다. 일정 텍스트 안에 URL이
// 섞여 있는 경우(예: "해운대 방문 후 https://... 참고")는 이 패턴에
// 걸리지 않는다 — 문자열 전체가 처음부터 끝까지 URL 하나여야만 막는다.
const URL_ONLY_PATTERN = /^(?:https?:\/\/|www\.)\S+$/i;

type ToastContent = { title: string; subtitle?: string };

// 글자수 정책(MIN_LEN~MAX_LEN)은 "N일차" 헤더를 붙이기 전, 사용자가
// 실제로 일차 입력칸에 타이핑한 내용만으로 잰다 — joinDayTexts 결과
// (API로 보내는 조합 문자열)로 재면 일차가 전부 비어 있어도 헤더
// 글자 수("1일차\n\n\n2일차\n..." 등)만으로 카운터가 0이 아닌 값을
// 보여주는 문제가 있었다. 실제로 보낼 문자열(joined)과 사용자에게
// 보여줄/검증할 글자수(typedLength)를 의도적으로 분리한다.
function typedLength(dayTexts: string[]): number {
  return dayTexts.reduce((sum, t) => sum + t.trim().length, 0);
}

// duration이 없으면(아직 기간을 안 골랐으면) 에러를 보여주지 않는다 —
// "기간을 먼저 선택하세요"는 CTA 비활성 상태로 충분히 전달된다. 기간을
// 고른 뒤에는 (1) 모든 일차 입력칸이 채워졌는지 → (2) 실제 입력한
// 글자수가 기존 정책(MIN_LEN~MAX_LEN) 안에 있는지 순서로 검사한다 —
// 기존 정책을 새로 만들지 않고 그대로 재사용한다.
function planError(duration: number | null, dayTexts: string[]): string | null {
  if (duration === null) return null;
  if (!allDaysFilled(dayTexts)) return "모든 일차에 일정을 입력해주세요.";
  const len = typedLength(dayTexts);
  if (len < MIN_LEN) return `${MIN_LEN}자 이상 입력해주세요. (현재 ${len}자)`;
  if (len > MAX_LEN) return `${MAX_LEN}자를 초과했습니다. (현재 ${len}자)`;
  return null;
}

function isPlanValid(duration: number | null, dayTexts: string[]): boolean {
  if (duration === null) return false;
  if (!allDaysFilled(dayTexts)) return false;
  const len = typedLength(dayTexts);
  return len >= MIN_LEN && len <= MAX_LEN;
}

type Props = {
  planADuration: number | null;
  planADayTexts: string[];
  onChangePlanADuration: (days: number) => void;
  onChangePlanADayText: (index: number, value: string) => void;
  planBDuration: number | null;
  planBDayTexts: string[];
  onChangePlanBDuration: (days: number) => void;
  onChangePlanBDayText: (index: number, value: string) => void;
  onLoadSample: () => void;
  onSubmit: () => void;
  onFeedbackClick: () => void;
  onLogoClick?: () => void;
  // not_travel_content 오류에서 "플랜 A/B 수정하기"로 돌아왔을 때만
  // 채워진다 — 일차별 구조라 정확히 어느 일차가 문제인지는 알 수
  // 없으므로, 문제였던 플랜의 1일차 입력칸에 포커스를 옮긴다. 소비
  // 즉시 onAutoFocusConsumed로 부모 state를 되돌려 한 번만 동작하게
  // 한다.
  autoFocusPlan?: "a" | "b" | null;
  onAutoFocusConsumed?: () => void;
};

export default function StepInput({
  planADuration,
  planADayTexts,
  onChangePlanADuration,
  onChangePlanADayText,
  planBDuration,
  planBDayTexts,
  onChangePlanBDuration,
  onChangePlanBDayText,
  onLoadSample,
  onSubmit,
  onFeedbackClick,
  onLogoClick,
  autoFocusPlan,
  onAutoFocusConsumed,
}: Props) {
  const [touchedA, setTouchedA] = useState(false);
  const [touchedB, setTouchedB] = useState(false);
  const [toast, setToast] = useState<ToastContent | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planADayRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
  const planBDayRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  useEffect(() => {
    if (!autoFocusPlan) return;
    const refs = autoFocusPlan === "a" ? planADayRefs : planBDayRefs;
    const first = refs.current[0];
    first?.focus();
    first?.scrollIntoView({ behavior: "smooth", block: "center" });
    onAutoFocusConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusPlan]);

  const errorA = touchedA ? planError(planADuration, planADayTexts) : null;
  const errorB = touchedB ? planError(planBDuration, planBDayTexts) : null;
  const isValid = isPlanValid(planADuration, planADayTexts) && isPlanValid(planBDuration, planBDayTexts);

  function handleSubmit() {
    setTouchedA(true);
    setTouchedB(true);
    if (isValid) onSubmit();
  }

  // 텍스트 입력만 지원한다 — 이미지/파일을 붙여넣거나 끌어다 놓으려는
  // 시도, URL 단독 붙여넣기 시도는 조용히 무시하지 않고 잠깐 토스트로
  // 알려준 뒤, textarea 값은 건드리지 않는다(붙여넣기 자체만 막을 뿐
  // 기존 입력은 그대로 둠).
  function showToast(content: ToastContent) {
    setToast(content);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  return (
    <div className="w-full">
      <AppHeader variant="brand" onFeedbackClick={onFeedbackClick} onLogoClick={onLogoClick} />

      {/* pt-20(80px) = 모든 화면 공통 header(56px) + 콘텐츠 시작 전
          간격(24px). AppHeader가 fixed라 문서 흐름에 공간을 차지하지
          않으므로 여기서 직접 확보한다 — 다른 화면들과 동일한 값. */}
      <div className="flex w-full flex-col px-5 pb-28 pt-20">
        {/* 서비스 기대 조절 안내 — 결과 화면의 "TripFit AI가 정리한 핵심
            요약" 카드와 같은 계열의 옅은 Primary Purple 톤으로 맞추되,
            그 카드의 움직이는 gradient 테두리는 결과 화면 전용 시그니처라
            여기서는 쓰지 않고 은은한 배경 gradient만 사용한다. 첫 문장만
            강조해 TripFit이 무엇을 하지 않는지부터 분명히 한다. */}
        <div className="intro-notice-card px-4 py-3">
          <p className="text-[15px] font-semibold leading-[1.5] text-text-primary">
            TripFit AI는 더 좋은 일정을 대신 골라주지 않아요.
          </p>
          <p className="text-body-secondary mt-1 text-[14px] leading-[1.5]">
            서로 다른 형식의 일정을 같은 기준으로 정리해 차이를 확인하기 쉽게 도와드려요.
          </p>
        </div>

        <div className="mt-7">
          <h1 className="heading-page">두 일정, 뭐가 다른지 비교해봐요.</h1>
          <p className="text-body-secondary mt-2">여행 기간을 고르고, 일차별로 자유롭게 적어주세요.</p>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <PlanSection
            label="플랜 A"
            duration={planADuration}
            dayTexts={planADayTexts}
            onChangeDuration={onChangePlanADuration}
            onChangeDayText={onChangePlanADayText}
            onBlur={() => setTouchedA(true)}
            error={errorA}
            onShowToast={showToast}
            dayRefs={planADayRefs}
          />
          <PlanSection
            label="플랜 B"
            duration={planBDuration}
            dayTexts={planBDayTexts}
            onChangeDuration={onChangePlanBDuration}
            onChangeDayText={onChangePlanBDayText}
            onBlur={() => setTouchedB(true)}
            error={errorB}
            onShowToast={showToast}
            dayRefs={planBDayRefs}
          />
        </div>

        <button
          type="button"
          onClick={onLoadSample}
          className="focus-ring mt-6 w-fit rounded text-sm font-medium text-text-secondary underline underline-offset-4 hover:text-primary"
        >
          예시 일정 불러오기
        </button>
      </div>

      {/* CTA 바로 위, 같은 앱 쉘 폭(430px) 안에서 뜨는 토스트. 텍스트가
          아닌 형식을 붙여넣거나(이미지/파일) URL 하나만 단독으로
          붙여넣으려 할 때만 잠깐 보였다가 사라진다 — CTA를 가리지
          않도록 CTA 바 높이보다 위에 둔다. */}
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

      {/* Fixed strip spans the viewport; the inner div clamps back to the app
          shell's max width so the CTA never grows wider than the app itself. */}
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
  duration,
  dayTexts,
  onChangeDuration,
  onChangeDayText,
  onBlur,
  error,
  onShowToast,
  dayRefs,
}: {
  label: string;
  duration: number | null;
  dayTexts: string[];
  onChangeDuration: (days: number) => void;
  onChangeDayText: (index: number, value: string) => void;
  onBlur: () => void;
  error: string | null;
  onShowToast: (content: ToastContent) => void;
  dayRefs: React.RefObject<Array<HTMLTextAreaElement | null>>;
}) {
  // React는 focus/blur를 위임(bubbling)해 전달하므로, 안의 textarea
  // 중 아무거나 blur되면 이 onBlur가 한 번 호출된다 — 일차 textarea마다
  // 따로 touched를 추적할 필요가 없다.
  return (
    <div className="flex flex-col gap-3" onBlur={onBlur}>
      <span className="text-body font-semibold">{label}</span>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text-secondary">여행 기간</span>
        <div className="tab-pill-group w-full">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              data-active={duration === opt.days}
              className="tab-pill focus-ring flex-1"
              onClick={() => onChangeDuration(opt.days)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {duration !== null && (
        <>
          <div className="flex flex-col gap-2.5">
            {dayTexts.map((text, i) => (
              <DayTextarea
                key={i}
                dayNumber={i + 1}
                value={text}
                onChange={(v) => onChangeDayText(i, v)}
                onShowToast={onShowToast}
                inputRef={(el) => {
                  dayRefs.current[i] = el;
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-end">
            <span className={`text-caption ${error ? "text-error" : ""}`}>
              {error ?? `${typedLength(dayTexts)} / ${MAX_LEN.toLocaleString()}자`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function DayTextarea({
  dayNumber,
  value,
  onChange,
  onShowToast,
  inputRef,
}: {
  dayNumber: number;
  value: string;
  onChange: (v: string) => void;
  onShowToast: (content: ToastContent) => void;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  // 클립보드/드롭에 파일(이미지 등)이 들어 있으면 텍스트만 받는다는
  // 원칙에 따라 붙여넣기/드롭 자체를 막고 토스트로 안내한다. 순수 텍스트
  // 붙여넣기는 브라우저 기본 동작 그대로 둔다.
  //
  // URL 단독 붙여넣기는 별도로 막는다 — 붙여넣기 결과로 만들어질 전체
  // 값(trim)이 URL 하나뿐일 때만 막고, "해운대 방문 후 https://... 참고"
  // 처럼 일정 텍스트 안에 URL이 섞여 있는 경우는 그대로 허용한다. URL을
  // fetch하거나 내용을 분석하지 않으며, 순수 문자열 패턴 검사만 한다.
  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      onShowToast({ title: "현재는 텍스트 붙여넣기만 지원해요." });
      return;
    }

    const pastedText = e.clipboardData.getData("text/plain");
    const target = e.currentTarget;
    const selectionStart = target.selectionStart ?? value.length;
    const selectionEnd = target.selectionEnd ?? value.length;
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

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] font-semibold text-text-secondary">{dayNumber}일차</span>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        rows={3}
        placeholder={`${dayNumber}일차 일정을 자유롭게 적어주세요.`}
        className="field text-body resize-none p-3"
      />
    </div>
  );
}
