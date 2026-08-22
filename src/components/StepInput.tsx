"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import AppHeader from "@/components/AppHeader";

const TOAST_DURATION_MS = 2500;

export const MIN_LEN = 50;
export const MAX_LEN = 6000;

// 전체 입력값(trim)이 URL 하나뿐인지 판정한다. 일정 텍스트 안에 URL이
// 섞여 있는 경우(예: "해운대 방문 후 https://... 참고")는 이 패턴에
// 걸리지 않는다 — 문자열 전체가 처음부터 끝까지 URL 하나여야만 막는다.
const URL_ONLY_PATTERN = /^(?:https?:\/\/|www\.)\S+$/i;

type ToastContent = { title: string; subtitle?: string };

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
  onFeedbackClick: () => void;
};

export default function StepInput({
  planAText,
  planBText,
  onChangeA,
  onChangeB,
  onLoadSample,
  onSubmit,
  onFeedbackClick,
}: Props) {
  const [touchedA, setTouchedA] = useState(false);
  const [touchedB, setTouchedB] = useState(false);
  const [toast, setToast] = useState<ToastContent | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      <AppHeader variant="brand" onFeedbackClick={onFeedbackClick} />

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
          <p className="text-body-secondary mt-2">형식이 달라도 TripFit AI가 같은 기준으로 정리해드려요.</p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <PlanTextarea
            label="플랜 A"
            value={planAText}
            onChange={onChangeA}
            onBlur={() => setTouchedA(true)}
            error={touchedA ? errorA : null}
            onShowToast={showToast}
          />
          <PlanTextarea
            label="플랜 B"
            value={planBText}
            onChange={onChangeB}
            onBlur={() => setTouchedB(true)}
            error={touchedB ? errorB : null}
            onShowToast={showToast}
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

function PlanTextarea({
  label,
  value,
  onChange,
  onBlur,
  error,
  onShowToast,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error: string | null;
  onShowToast: (content: ToastContent) => void;
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
    <div className="flex flex-1 flex-col gap-1.5">
      <label className="text-body font-semibold">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        rows={10}
        placeholder="여행 일정 텍스트를 붙여넣어 주세요."
        className="field text-body resize-none p-3"
      />
      <div className="flex items-center justify-end">
        <span className={`text-caption ${error ? "text-error" : ""}`}>
          {error ?? `${value.length} / 6,000자`}
        </span>
      </div>
    </div>
  );
}
