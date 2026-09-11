"use client";

import { useEffect, useId, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import AppHeader from "@/components/AppHeader";
import { allDaysFilled, joinDayTexts } from "@/lib/planDayText";
import { extractImageText, fileToDataUrl, ImageExtractionError, prepareImageForVision } from "@/lib/extractImageText";
import { trackImageParseFailed, trackImageParseStarted, trackImageParseSucceeded } from "@/lib/analytics";
import { countDayHeaderLines } from "@/lib/dayMarkerDetection";

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
// 텍스트 탭 textarea에 URL만 붙여넣으려는 시도를 막는 handlePasteGuard
// 전용이라, 링크 탭 제거와 무관하게 그대로 유지한다.
const URL_ONLY_PATTERN = /^(?:https?:\/\/|www\.)\S+$/i;

type ToastContent = { title: string; subtitle?: string };

// 버그 수정(2026-09-05) — 입력 방식을 "텍스트/이미지" 두 가지로 좁혔다
// (링크 탭 완전 제거, 파일 탭은 이미지 전용으로 축소·PDF/TXT는 다음
// 단계 확장 범위로 제외).
//
// 버그 수정(2026-09-05, 2차) — 이미지 입력을 실제 비교 플로우까지
// 연결한다. 이미지를 고르면 즉시(입력 화면을 벗어나지 않고)
// /api/extract-image-text로 이미지 안의 텍스트를 옮겨 적어 그 결과를
// "이 day에 타이핑한 텍스트"와 완전히 동일하게 취급한다 — 이미지
// 전용 Plan 구조나 place/activity/category/time 규칙을 새로 만들지
// 않고, 추출된 텍스트를 기존 /api/structure-plan 파이프라인에 그대로
// 흘려보낸다. 추출 실패 시에는 그 day의 텍스트를 채우지 않으므로
// allDaysFilled/MIN_LEN 검증이 기존과 동일하게 CTA를 막는다 —
// "이미지를 고르기만 해도 비교 요청이 나가는" 일은 구조적으로 생기지
// 않는다.
type PasteSubTab = "text" | "image";
const PASTE_SUBTABS: { id: PasteSubTab; label: string }[] = [
  { id: "text", label: "텍스트" },
  { id: "image", label: "이미지" },
];

// 버그 수정(2026-09-04) — 글자수 정책(MIN_LEN~MAX_LEN)은 이제 실제로
// 서버에 전송되는 문자열(joinDayTexts 결과 — "N일차" 헤더 + 일차 사이
// 구분자까지 포함)을 기준으로 잰다. 예전엔 이 헤더를 뺀 "타이핑한
// 내용만"으로 클라이언트가 판단해서, 헤더 오버헤드(일차당 약
// 4~6자)만큼 클라이언트는 통과시켰는데 서버(route.ts의 isValidPlanText,
// 같은 joinDayTexts 결과를 검증)는 6000자 초과로 거부하는 경계 버그가
// 있었다 — 클라이언트에서 CTA가 활성화됐는데 제출하면 400으로 실패하는
// 상황. allDaysFilled가 먼저 모든 일차에 내용이 있는지 확인하므로, 이
// 시점엔 헤더만 있고 내용이 없는 일차는 없다 — "빈 일차인데 헤더 글자
// 수만으로 0보다 큰 값이 나오는" 문제는 재현되지 않는다.
function payloadLength(dayTexts: string[]): number {
  return joinDayTexts(dayTexts).length;
}

// duration이 없으면(아직 기간을 안 골랐으면) 에러를 보여주지 않는다 —
// "기간을 먼저 선택하세요"는 CTA 비활성 상태로 충분히 전달된다. 기간을
// 고른 뒤에는 (1) 모든 일차 입력칸이 채워졌는지 → (2) 실제 전송될
// 글자수가 기존 정책(MIN_LEN~MAX_LEN, 서버와 완전히 동일한 기준) 안에
// 있는지 순서로 검사한다. dayTexts는 부모(page.tsx)가 현재 활성 입력
// 방식(붙여넣기/직접 일정 추가) 기준으로 이미 계산해 내려준 값이라,
// 여기서는 모드를 신경 쓰지 않고 그대로 검증만 한다.
function planError(duration: number | null, dayTexts: string[]): string | null {
  if (duration === null) return null;
  if (!allDaysFilled(dayTexts)) return "모든 일차에 일정을 입력해주세요.";
  const len = payloadLength(dayTexts);
  if (len < MIN_LEN) return `${MIN_LEN}자 이상 입력해주세요. (현재 ${len}자)`;
  if (len > MAX_LEN) return "일정 내용이 너무 길어요. 조금 줄여서 다시 시도해주세요.";
  return null;
}

function isPlanValid(duration: number | null, dayTexts: string[]): boolean {
  if (duration === null) return false;
  if (!allDaysFilled(dayTexts)) return false;
  const len = payloadLength(dayTexts);
  return len >= MIN_LEN && len <= MAX_LEN;
}

type Props = {
  planADuration: number | null;
  planAPasteDayTexts: string[];
  /** day별 업로드 이미지(data URL) — 그 day가 이미지 입력이면 non-null,
   *  텍스트 입력(직접 타이핑)이면 null. planAPasteDayTexts[i]와 항상
   *  같은 길이/순서를 공유한다. */
  planAImages: (string | null)[];
  /** 부모가 계산해 준 최종 일차별 텍스트 — 글자수/에러 검증에만 쓴다. */
  planADayTexts: string[];
  onChangePlanADuration: (days: number) => void;
  onChangePlanAPasteText: (index: number, value: string) => void;
  /** 이미지 추출 성공 시 호출 — 해당 day의 텍스트/이미지 슬롯을
   *  한 번에 채운다. itineraryText는 비교(structure-plan)에 쓰일
   *  선별된 값, rawText는 "원문 다시보기"에 그대로 보여줄 전체 전사다. */
  onImageExtractedPlanA: (index: number, dataUrl: string, itineraryText: string, rawText: string) => void;
  planBDuration: number | null;
  planBPasteDayTexts: string[];
  planBImages: (string | null)[];
  planBDayTexts: string[];
  onChangePlanBDuration: (days: number) => void;
  onChangePlanBPasteText: (index: number, value: string) => void;
  onImageExtractedPlanB: (index: number, dataUrl: string, itineraryText: string, rawText: string) => void;
  onLoadSample: () => void;
  onSubmit: () => void;
  onFeedbackClick: () => void;
  onLogoClick?: () => void;
  // not_travel_content 오류에서 "플랜 A/B 수정하기"로 돌아왔을 때만
  // 채워진다 — 일차별 구조라 정확히 어느 일차가 문제인지는 알 수
  // 없으므로, 문제였던 플랜의 1일차 입력칸(현재 활성 모드 기준)에
  // 포커스를 옮긴다. 소비 즉시 onAutoFocusConsumed로 부모 state를
  // 되돌려 한 번만 동작하게 한다.
  autoFocusPlan?: "a" | "b" | null;
  onAutoFocusConsumed?: () => void;
};

export default function StepInput({
  planADuration,
  planAPasteDayTexts,
  planAImages,
  planADayTexts,
  onChangePlanADuration,
  onChangePlanAPasteText,
  onImageExtractedPlanA,
  planBDuration,
  planBPasteDayTexts,
  planBImages,
  planBDayTexts,
  onChangePlanBDuration,
  onChangePlanBPasteText,
  onImageExtractedPlanB,
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
          <p className="text-body-secondary mt-2">여행 기간을 고르고, 알고 있는 만큼 자유롭게 적어주세요.</p>
          <p className="text-caption text-text-muted mt-1 text-[13px] leading-[1.5]">
            형식은 신경 쓰지 않아도 괜찮아요. 블로그·메모·AI 일정도 그대로 붙여넣을 수 있어요.
          </p>
        </div>

        {/* v1.0 — 예전 "어떻게 적으면 될까요?" Guide Card를 완전히
            없애지 않고 축소했다. 기본 화면에는 한 줄짜리 예시 문구만
            보여주고, 더 자세한 예시는 "입력 예시 보기"를 눌렀을 때만
            펼쳐진다 — UT에서 "무엇을 어떻게 입력해야 할지 모르겠다"는
            문제가 있었기 때문에 예시 자체는 없애지 않되, 화면 상단의
            정보 밀도는 낮춘다. */}
        {/* v1.0 — "예: ..." 문장을 여기(기본 화면)와 accordion 안쪽
            두 곳에서 중복해서 보여주던 걸 정리했다. 기본 화면은
            accordion trigger 한 줄(짧은 진입점)만 두고, 구체적인
            예시 문장은 펼쳤을 때만 보여준다. */}
        {/* 1차 우선순위 — 상단 설명(h1+보조 문구)과 이 아코디언 트리거
            사이 간격이 너무 넓어 두 영역이 별개 섹션처럼 보인다는
            요청으로 mt-6(24px)→mt-3(12px)으로 줄였다 — 한 섹션처럼
            읽히게 한다. */}
        <div className="mt-3">
          <InputExampleToggle />
        </div>

        {/* Primary CTA(하단 "두 일정 비교하기")와 경쟁하지 않도록
            .btn-secondary(무채색) 톤을 그대로 쓴다. */}
        <button type="button" onClick={onLoadSample} className="btn-secondary focus-ring mt-4 w-full">
          예시 일정으로 시작하기
        </button>

        <div className="mt-6 flex flex-col gap-6">
          <PlanSection
            label="플랜 A"
            plan="a"
            duration={planADuration}
            pasteDayTexts={planAPasteDayTexts}
            images={planAImages}
            dayTexts={planADayTexts}
            onChangeDuration={onChangePlanADuration}
            onChangePasteText={onChangePlanAPasteText}
            onImageExtracted={onImageExtractedPlanA}
            onBlur={() => setTouchedA(true)}
            error={errorA}
            onShowToast={showToast}
            dayRefs={planADayRefs}
          />
          <PlanSection
            label="플랜 B"
            plan="b"
            duration={planBDuration}
            pasteDayTexts={planBPasteDayTexts}
            images={planBImages}
            dayTexts={planBDayTexts}
            onChangeDuration={onChangePlanBDuration}
            onChangePasteText={onChangePlanBPasteText}
            onImageExtracted={onImageExtractedPlanB}
            onBlur={() => setTouchedB(true)}
            error={errorB}
            onShowToast={showToast}
            dayRefs={planBDayRefs}
          />
        </div>
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
            <ToastWarningIcon />
            <div className="min-w-0 flex-1">
              <p>{toast?.title ?? ""}</p>
              {toast?.subtitle && <p className="input-toast-subtitle">{toast.subtitle}</p>}
            </div>
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

// v1.0 — 예전 Guide Card 본문을 그대로 담은 collapsed 아코디언. 기본
// 화면에는 트리거만 보이고, 눌렀을 때만 문장형 예시 + 보조 설명이
// 펼쳐진다.
function InputExampleToggle() {
  const [open, setOpen] = useState(false);
  return (
    <div className="accordion mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="accordion-trigger focus-ring"
      >
        <span>입력 예시 보기</span>
        <ChevronDownIcon open={open} />
      </button>
      {/* 버그 수정(2026-09-05) — 한 줄짜리 짧은 예시를 실제 입력 수준을
          가늠할 수 있는 4줄짜리 예시로 늘렸다.
          버그 수정(2026-09-06) — 4줄 중 2줄(부산역/12,000원)만 보라색으로
          강조했던 이전 버전은 "왜 이 두 항목만 강조되는지" 기준이
          불분명해 오히려 사용자가 그 두 값을 더 중요한 정보로 오해할
          수 있었다. 강조를 전부 제거하고 4줄 모두 같은 본문색
          (text-text-primary)으로 통일한다 — 예시는 "입력 형식 참고"
          역할만 하면 되고, 실제 입력 영역보다 시각적으로 튀어서는 안
          된다는 요구사항. 시간/장소/비용/활동 중 무엇을 강조할지 새
          기준을 만들지 않는다. */}
      {open && (
        <div className="accordion-panel">
          <div className="flex flex-col gap-1 text-[13px] leading-[1.6] text-text-primary">
            <p>오전 10시 부산역 도착 · 교통비 20,000원</p>
            <p>오전 11시 감천문화마을 구경</p>
            <p>오후 1시 밀면집 점심 · 12,000원</p>
            <p>오후 3시 카페에서 휴식</p>
          </div>
          <p className="text-caption mt-2 whitespace-pre-line text-[11px] leading-[1.45]">
            {"시간·장소·활동·비용 중 알고 있는 내용만 자유롭게 적어주세요.\n순서나 형식을 맞추지 않아도 괜찮아요."}
          </p>
        </div>
      )}
    </div>
  );
}

/** 버그 수정(2026-09-05) — toast 왼쪽 warning icon. StepProcessing.tsx의
 *  NoticeInfoIcon/StepResult.tsx의 FilledInfoIcon과 같은 "채워진 원 +
 *  도형" 패턴을 그대로 재사용하되, 그 두 아이콘은 세로 막대가 아래쪽에
 *  있는 "i" 모양(정보 안내용)인 반면 이 아이콘은 막대가 위쪽에 있는
 *  "!" 모양(경고용)이다 — 같은 두 도형(막대+점)의 위치만 바꾼 것이라
 *  새 아이콘 시스템을 만들지 않고 기존 패턴을 그대로 따른다. 색은
 *  --color-toast-warning-icon(amber)을 쓴다 — 빨간 --color-error는
 *  쓰지 않는다(요청). 이 파일에도 같은 패턴을 복제하는 이유는
 *  NoticeInfoIcon 자체의 주석에 있는 것과 같다("구조 변경 최소화
 *  원칙상 새로 import 배선을 만들지 않음").
 *
 *  버그 수정(2026-09-06, 2차) — informational notice 아이콘(--color-notice-icon)만
 *  더 옅게 바꾸면서 이 "!" 아이콘까지 같이 옅어지면 warning 의미가
 *  약해진다 — 그래서 --color-toast-warning-icon을 따로 분리해 이
 *  아이콘 전용으로 옛 값(#f0a020)을 그대로 유지한다.
 *
 *  버그 수정(2026-09-06) — 20px 크기에서 흰색 오버레이 막대/점의 대비가
 *  약하다는 피드백으로, "!" 를 흰 도형을 얹는 방식이 아니라 mask로
 *  원형에서 그 모양만큼 뚫어내는 subtract/negative-space 방식으로
 *  바꿨다. 뚫린 자리는 투명이라 toast의 어두운 배경이 그대로 비쳐
 *  보이므로 새 색상을 추가하지 않고도(요청사항) 더 또렷한 대비를 얻는다.
 *  mask id는 이 아이콘이 페이지에 두 번 이상 그려질 가능성을 배제할 수
 *  없어(예: 여러 곳에서 재사용) useId로 고유하게 만든다 — 같은 id의
 *  mask가 여러 개 있으면 브라우저가 먼저 것만 참조해 나머지 아이콘이
 *  깨진다. */
function ToastWarningIcon() {
  const maskId = useId();
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <mask id={maskId}>
        <rect width="24" height="24" fill="#ffffff" />
        <rect x="11" y="6.5" width="2" height="7.1" rx="1" fill="#000000" />
        <circle cx="12" cy="16.9" r="1.3" fill="#000000" />
      </mask>
      <circle cx="12" cy="12" r="10" fill="var(--color-toast-warning-icon)" mask={`url(#${maskId})`} />
    </svg>
  );
}

/** 이미지 입력 안내(.scope-notice) 첫 문장 앞의 filled info icon.
 *  StepProcessing.tsx의 NoticeInfoIcon/StepResult.tsx의 FilledInfoIcon과
 *  같은 모양(채워진 원 + 흰 i)이지만, 그 컴포넌트들을 import하지 않고
 *  로컬로 하나 더 둔다 — 이유는 NoticeInfoIcon 자체의 주석과 같다
 *  ("구조 변경 최소화 원칙상 새로 import 배선을 만들지 않음"). .scope-notice는
 *  align-items:flex-start라 ComparisonScopeNotice의 FilledInfoIcon과
 *  동일하게 mt-0.5로 첫 줄 텍스트와 눈높이를 맞춘다(이 컴포넌트가
 *  단일 용도라 className을 prop으로 받지 않고 고정한다 — ToastWarningIcon과
 *  동일한 패턴). */
function NoticeInfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
      style={{ color: "var(--color-notice-icon)" }}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <rect x="11" y="10.4" width="2" height="7.1" rx="1" fill="#ffffff" />
      <circle cx="12" cy="7.1" r="1.3" fill="#ffffff" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
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

function PlanSection({
  label,
  plan,
  duration,
  pasteDayTexts,
  images,
  dayTexts,
  onChangeDuration,
  onChangePasteText,
  onImageExtracted,
  onBlur,
  error,
  onShowToast,
  dayRefs,
}: {
  label: string;
  plan: "a" | "b";
  duration: number | null;
  pasteDayTexts: string[];
  images: (string | null)[];
  dayTexts: string[];
  onChangeDuration: (days: number) => void;
  onChangePasteText: (index: number, value: string) => void;
  onImageExtracted: (index: number, dataUrl: string, itineraryText: string, rawText: string) => void;
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
          {/* 버그 수정(2026-09-05) — 상단 "입력 방식"(이미 정리된 일정이
              있어요 / 직접 작성할래요) 선택 카드를 제거했다. 이제 각
              일차는 항상 아래 PasteDayInput(텍스트/링크/파일 서브탭)
              하나로만 입력받는다 — 새 입력 구조를 만든 게 아니라 이미
              있던 두 모드 중 하나(paste)만 남기고 전환 UI/분기를
              없앴을 뿐이다. */}
          <div className="flex flex-col gap-6">
            {Array.from({ length: duration }, (_, i) => i).map((dayIndex) => (
              <PasteDayInput
                key={dayIndex}
                dayNumber={dayIndex + 1}
                plan={plan}
                duration={duration}
                value={pasteDayTexts[dayIndex] ?? ""}
                imageDataUrl={images[dayIndex] ?? null}
                onChange={(v) => onChangePasteText(dayIndex, v)}
                onImageExtracted={(dataUrl, itineraryText, rawText) =>
                  onImageExtracted(dayIndex, dataUrl, itineraryText, rawText)
                }
                onShowToast={onShowToast}
                inputRef={(el) => {
                  if (dayIndex === 0) dayRefs.current[0] = el;
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-end">
            <span className={`text-caption ${error ? "text-error" : ""}`}>
              {error ?? `${payloadLength(dayTexts)} / ${MAX_LEN.toLocaleString()}자`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// 클립보드/드롭에 파일(이미지 등)이 들어 있으면 텍스트만 받는다는
// 원칙에 따라 붙여넣기/드롭 자체를 막고 토스트로 안내한다. 순수 텍스트
// 붙여넣기는 브라우저 기본 동작 그대로 둔다. URL 단독 붙여넣기는
// 별도로 막는다 — 결과 값(trim) 전체가 URL 하나뿐일 때만 막고, 일정
// 텍스트 안에 URL이 섞여 있는 경우는 허용한다. 붙여넣기 textarea와
// 직접 일정 추가의 item textarea가 동일한 규칙을 쓴다.
function handlePasteGuard(
  value: string,
  e: ClipboardEvent<HTMLTextAreaElement>,
  onShowToast: (content: ToastContent) => void
) {
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
function handleDropGuard(e: DragEvent<HTMLTextAreaElement>, onShowToast: (content: ToastContent) => void) {
  if (e.dataTransfer.files.length > 0) {
    e.preventDefault();
    onShowToast({ title: "현재는 텍스트 붙여넣기만 지원해요." });
  }
}

function PasteDayInput({
  dayNumber,
  plan,
  duration,
  value,
  imageDataUrl,
  onChange,
  onImageExtracted,
  onShowToast,
  inputRef,
}: {
  dayNumber: number;
  plan: "a" | "b";
  duration: number;
  value: string;
  imageDataUrl: string | null;
  onChange: (v: string) => void;
  onImageExtracted: (dataUrl: string, itineraryText: string, rawText: string) => void;
  onShowToast: (content: ToastContent) => void;
  inputRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  // not_travel_content 오류 후 복귀 등으로 이 컴포넌트가 다시 마운트될
  // 때, 그 day가 이미 이미지로 채워져 있었다면 텍스트 탭이 아니라
  // 이미지 탭이 기본으로 보여야 한다 — 실제 활성 입력 방식과 화면이
  // 어긋나지 않게 한다.
  const [subTab, setSubTab] = useState<PasteSubTab>(imageDataUrl !== null ? "image" : "text");
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-semibold text-text-primary">{dayNumber}일차</span>

      {/* 1차 우선순위 — 하나의 입력 영역 안에서 텍스트/링크/파일을
          구분하는 작은 세그먼트. 큰 카드 3개를 새로 만들지 않고 여행
          기간과 같은 계열의 더 작은 segmented control(.input-subtab-group)을
          쓴다. */}
      <div className="input-subtab-group" role="tablist" aria-label={`${dayNumber}일차 입력 방식`}>
        {PASTE_SUBTABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={subTab === tab.id}
            data-active={subTab === tab.id}
            className="input-subtab focus-ring"
            onClick={() => setSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === "text" && (
        // 버그 수정(2026-09-06) — 길게 입력한 내용을 처음부터 다시 쓰고
        // 싶을 때 전체 삭제할 방법이 textarea 자체를 드래그 선택하는
        // 것뿐이었다는 피드백으로, iOS/Android 검색창에서 익숙한 원형
        // clear(X) 버튼을 추가한다. relative 래퍼로 감싸고 버튼을
        // absolute로 얹는 순수 레이아웃 변경이라 textarea의 value/onChange
        // 배선은 그대로다 — 버튼도 새 상태 없이 기존 onChange("")를
        // 그대로 재사용해 지운다(입력 파싱/구조화 로직과 무관).
        <div className="relative">
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => handlePasteGuard(value, e, onShowToast)}
            onDrop={(e) => handleDropGuard(e, onShowToast)}
            onDragOver={(e) => e.preventDefault()}
            rows={3}
            placeholder={
              dayNumber === 1
                ? "예: 오전 10시 부산역 도착, 점심 해운대 식당 15,000원..."
                : `${dayNumber}일차 일정을 자유롭게 적어주세요.`
            }
            className="field text-body resize-none p-3 pr-9"
          />
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label={`${dayNumber}일차 입력 내용 지우기`}
              className="focus-ring absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-tint-bg text-text-muted hover:bg-disabled-bg active:bg-disabled-bg"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      )}
      {subTab === "image" && (
        <ImageInputPanel
          plan={plan}
          duration={duration}
          dataUrl={imageDataUrl}
          onExtracted={onImageExtracted}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}

const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"];
const MAX_IMAGE_SIZE_MB = 20;

// 버그 수정(2026-09-05, 3차) — 오류 상태를 이 컴포넌트 안에 오래
// 남기지 않는다. 형식/용량/업로드/분석 오류는 전부 상단 toast로만
// 잠깐 보여주고(showToast — 기존 자동 닫힘 타이머·중복 방지 그대로
// 재사용), 이 로컬 status는 "idle/loading/success" 세 가지 화면
// 상태만 추적한다 — 오류가 나도 실패 직전 상태(성공한 이미지가
// 있었다면 그 이미지+"읽었어요" 문구, 없었다면 idle 안내)로 그대로
// 되돌아간다. 같은 오류를 inline 텍스트와 toast 두 곳에 동시에
// 보여주지 않기 위한 구조다.
type LocalImageStatus = { kind: "idle" } | { kind: "loading" } | { kind: "success" };

function validateImageFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return "JPG 또는 PNG 이미지만 업로드할 수 있어요.";
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return `이미지는 최대 ${MAX_IMAGE_SIZE_MB}MB까지 업로드할 수 있어요.`;
  }
  return null;
}

/** 이미지 첨부 + 실제 일정 텍스트 추출 UI. 브라우저 파일 선택창은
 *  그대로 열리지만(OS 로컬 동작일 뿐 이 컴포넌트가 직접 어디로도
 *  업로드하지 않음), 선택 즉시 /api/extract-image-text로 이미지 안의
 *  텍스트를 옮겨 적어 그 결과를 onExtracted로 부모에 올려보낸다 —
 *  부모(page.tsx)가 이 값을 그 day의 텍스트 슬롯에 "타이핑한 것처럼"
 *  그대로 반영한다. 실패해도 이 화면을 벗어나지 않는다("기존 입력
 *  화면으로 안전하게 돌아갈 수 있어야 한다" 요구사항 — 애초에 화면을
 *  떠난 적이 없어 자동으로 만족된다). dataUrl(이미지 미리보기)과
 *  실제 추출 텍스트는 모두 부모 state에 lifted돼 있어, structure-plan의
 *  plan 단위 not_travel_content 오류 후 이 화면이 다시 마운트돼도
 *  그대로 남아있다.
 *  버그 수정(2026-09-05, 3차) — 오류 유형을 4가지로 구분한다: 형식
 *  오류/용량 초과(선택 즉시, 파일 읽기 전)는 validateImageFile에서,
 *  업로드 실패(fileToDataUrl 자체가 실패 — 드문 브라우저 파일 읽기
 *  오류)는 별도 catch에서, 분석 실패(extractImageText 실패 — 서버
 *  vision 호출 결과)는 그 다음 catch에서 각각 다른 문구로 toast에
 *  보여준다. trackImageParseStarted는 예전과 정확히 같은 시점(형식/
 *  용량 검증을 통과한 직후, 업로드 시도 전)에 호출해 이벤트 발화
 *  타이밍을 바꾸지 않았다 — "업로드 실패"는 새 이벤트가 아니라
 *  기존 image_parse_failed에 reason만 "upload_failed"로 다르게 실어
 *  분석 실패와 구분한다.
 *  버그 수정(2026-09-06) — 분석 실패 안에 5번째 유형을 추가했다:
 *  extractImageText는 성공했지만(글자는 읽었지만) 그 내용이 실제
 *  여행 일정이 아니라고 서버가 판단한 "not_travel_content"(이미지
 *  단위 — plan 전체를 보는 structure-plan의 동명 오류와는 다른
 *  레이어다). 이게 없으면 디자인 문서/업무 메모처럼 글자는 읽히지만
 *  일정과 무관한 이미지도 이 day를 "성공"으로 보이게 만들어, 나중에
 *  비교 요청까지 가서야 plan 단위로 실패가 드러나는 문제가 있었다 —
 *  이미지를 고른 시점에 바로 걸러 fake success를 만들지 않는다.
 *  버그 수정(2026-09-06, 2차) — extractImageText가 이제 rawText/
 *  itineraryText 두 값을 돌려준다. onExtracted로 부모에 올려보낼 때도
 *  둘 다 전달해, 부모(page.tsx)가 itineraryText는 비교용 day 텍스트
 *  슬롯에, rawText는 "원문 다시보기" 전용 슬롯에 각각 나눠 담는다 —
 *  블로그 캡처처럼 실제 일정과 무관한 텍스트(사이트 UI, 감상 문장 등)가
 *  섞인 이미지에서도 비교 데이터는 선별된 itineraryText만 쓰인다. */
function ImageInputPanel({
  plan,
  duration,
  dataUrl,
  onExtracted,
  onShowToast,
}: {
  plan: "a" | "b";
  duration: number;
  dataUrl: string | null;
  onExtracted: (dataUrl: string, itineraryText: string, rawText: string) => void;
  onShowToast: (content: ToastContent) => void;
}) {
  const [status, setStatus] = useState<LocalImageStatus>(dataUrl !== null ? { kind: "success" } : { kind: "idle" });
  const inputId = useId();

  function revertToPreviousState() {
    setStatus(dataUrl !== null ? { kind: "success" } : { kind: "idle" });
  }

  async function handleFileChange(file: File | null) {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      onShowToast({ title: validationError });
      return;
    }

    setStatus({ kind: "loading" });
    trackImageParseStarted(plan);

    let nextDataUrl: string;
    let uploadDataUrl: string;
    try {
      // 버그 수정(2026-09-06, B3 1순위 조치) — nextDataUrl(원본)은
      // 미리보기/"원문 다시보기"/onExtracted로 그대로 저장되는 값이고,
      // uploadDataUrl(vision 업로드 전용, 큰 이미지만 축소됨)은 이
      // 요청에서만 쓰고 어디에도 저장하지 않는다 — 사용자가 올린
      // 원본을 축소본으로 덮어쓰지 않기 위함(요구사항).
      nextDataUrl = await fileToDataUrl(file);
      uploadDataUrl = await prepareImageForVision(file);
    } catch {
      trackImageParseFailed(plan, "upload_failed");
      onShowToast({ title: "이미지 업로드에 실패했어요. 다시 시도해주세요." });
      revertToPreviousState();
      return;
    }

    try {
      const { rawText, itineraryText } = await extractImageText(uploadDataUrl);
      // 버그 수정(2026-09-06, multi-day 이미지 validation) — v1.0 정책은
      // "이미지 1장 = 한 일차"다. 이미지 안에 day/date heading이 2개
      // 이상 있으면(예: 1일차 슬롯에 1~4일차가 모두 담긴 이미지) 이
      // day 입력으로 확정하지 않는다 — 자동으로 다른 day slot에
      // 나누어 담거나 여행 기간을 바꾸지 않고, 사용자에게 다시 나누어
      // 올리도록 안내만 한다. dummyComparison.ts와 공유하는
      // countDayHeaderLines(day marker/date heading 감지, 새 정규식
      // 아님)를 그대로 재사용한다. itineraryText 기준으로 판단하는
      // 이유: extract-image-text 규칙 4-2가 day marker를 항상 별도
      // 줄로 분리해두므로(rawText는 원본 그대로라 마커가 문장 중간에
      // 섞여 있을 수 있어 줄 단위 판정이 불안정하다) 이 값이 더
      // 안정적으로 감지된다.
      //
      // 버그 수정(2026-09-06, 2차) — 실제 Notion/브라우저 캡처처럼
      // 화면 주변에 다른 날짜가 우연히 같이 찍힌 이미지에서도 이
      // 차단이 정상적으로 발동하는데("여러 일차의 일정이 확인됐어요"),
      // 문구가 "일차"라는 내부 용어를 그대로 써서 사용자가 왜
      // 막혔는지 바로 이해하기 어렵다는 피드백으로 "여러 날짜가
      // 확인됐어요 / 한 일차의 일정만 보이도록 잘라서 다시 올려주세요"로
      // 문구만 바꿨다 — 감지 로직(countDayHeaderLines, overDuration
      // 분기)과 상태 보존(revertToPreviousState)은 그대로다.
      const detectedDays = countDayHeaderLines(itineraryText);
      if (detectedDays >= 2) {
        const overDuration = detectedDays > duration;
        onShowToast(
          overDuration
            ? {
                title: "이미지에서 선택한 여행 기간보다 많은 일정이 확인됐어요.",
                subtitle: "일차별로 나누어 올리거나 여행 기간을 확인해주세요.",
              }
            : {
                title: "이미지에서 여러 날짜가 확인됐어요.",
                subtitle: "한 일차의 일정만 보이도록 잘라서 다시 올려주세요.",
              }
        );
        revertToPreviousState();
        return;
      }
      trackImageParseSucceeded(plan);
      setStatus({ kind: "success" });
      onExtracted(nextDataUrl, itineraryText, rawText);
    } catch (err) {
      const type = err instanceof ImageExtractionError ? err.type : "unknown";
      trackImageParseFailed(plan, type);
      // 버그 수정(2026-09-06) — "unreadable"만 제목/부제 2줄로 하드코딩
      // 재현하던 걸, 서버 메시지(err.message)를 "\n" 기준으로 나눠
      // 제목/부제를 만드는 방식으로 일반화했다. 서버가 이미 두 줄짜리
      // 문구를 "\n" 포함해서 내려주므로(unreadable도, 새로 추가된
      // not_travel_content도 동일), 클라이언트에 같은 문구를 다시
      // 하드코딩해 두 곳이 어긋날 여지를 없앤다 — 한 줄짜리 오류(예:
      // network/timeout)는 그대로 제목만 있는 토스트가 된다.
      const message =
        err instanceof ImageExtractionError ? err.message : "이미지를 처리하지 못했어요. 잠시 후 다시 시도해주세요.";
      const [title, ...restLines] = message.split("\n");
      onShowToast(restLines.length > 0 ? { title, subtitle: restLines.join("\n") } : { title });
      revertToPreviousState();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="file-picker-btn focus-ring">
        <AttachIcon />
        <span className="truncate">{dataUrl !== null ? "다른 이미지 선택" : "이미지 선택"}</span>
      </label>
      <input
        id={inputId}
        type="file"
        accept=".jpg,.jpeg,.png"
        className="sr-only"
        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
      />

      {dataUrl !== null && status.kind !== "loading" && (
        // eslint-disable-next-line @next/next/no-img-element -- 로컬 data URL 미리보기라 next/image 최적화 대상이 아니다.
        <img src={dataUrl} alt="선택한 이미지 미리보기" className="image-preview-thumb" />
      )}

      {status.kind === "loading" && (
        <p className="text-[12px] leading-[1.45] text-text-muted">이미지에서 일정 내용을 확인하고 있어요.</p>
      )}
      {status.kind === "success" && (
        <p className="text-[12px] leading-[1.45] text-text-muted">
          이미지에서 일정 내용을 읽었어요. &quot;원문 다시보기&quot;에서 추출된 내용을 확인할 수 있어요.
        </p>
      )}
      {status.kind === "idle" && (
        <>
          <p className="whitespace-pre-line text-[12px] leading-[1.45] text-text-muted">
            {`이미지에서 일정 내용을 읽어 비교에 반영해요.\nJPG · PNG, 최대 ${MAX_IMAGE_SIZE_MB}MB`}
          </p>
          {/* 버그 수정(2026-09-06, 4차) — "이미지 1장 = 한 일차" 정책 안내를
              일반 helper text 한 줄로 뒀더니 눈에 잘 안 띈다는 피드백으로
              subtle info box로 바꿨다(2차: 보라 계열, 3차: 색만 amber로
              교체하되 .image-day-notice*라는 별도 class를 유지). 결과
              화면의 "비교 범위 안내"(.scope-notice)와 나란히 비교했을 때
              색/폰트는 이미 같았지만 "같은 class를 재사용"하지는 않아
              구조적으로 별개였다 — 지금부터는 .scope-notice/
              .scope-notice-title/.scope-notice-text를 그대로 재사용한다
              (새 .image-day-notice* class 없음, globals.css에서도 제거).
              ComparisonScopeNotice와 동일한 마크업이되 아이콘만 없는
              형태(요청사항) — 아이콘이 없어도 .scope-notice는 flex
              child가 하나뿐인 상태로 동일하게 동작한다.

              버그 수정(2026-09-06, 5차) — "아이콘이 없어서 다른 informational
              notice와 구조가 다르다"는 피드백으로 첫 문장 앞에만 아이콘을
              추가한다(둘째 문장에는 없음, 요청사항). ComparisonScopeNotice가
              쓰는 FilledInfoIcon과 같은 모양이지만 이 파일은 그 컴포넌트를
              StepResult.tsx에서 import하지 않고 로컬로 하나 더 둔다 —
              NoticeInfoIcon(StepProcessing.tsx)과 동일한 이유("구조 변경
              최소화 원칙상 새로 import 배선을 만들지 않음")다.

              버그 수정(2026-09-11) — 옛 단체여행 표처럼 표가 복잡하고
              항목이 많은 이미지는 구조화(비교 요청 이후)에 시간이 오래
              걸릴 수 있다는 걸 업로드 시점에 미리 안내하는 세 번째 줄을
              추가했다(실측 QA: 20행짜리 밀도 높은 표 하나가 70초 이상
              걸린 사례 확인, 원인 분석 결과 timeout 값/모델/구조화
              prompt는 그대로 두기로 함 — 이 안내는 그 결정에 맞춰
              "미리 알려주기"만 하는 최소 보완이다). 기존 두 줄(한 이미지
              = 한 일차, 여러 날짜는 나누어 올리기)은 문구를 바꾸지
              않았다 — 이미 여러 차례 다듬어진 문구라 새 정보 한 줄만
              보탠다. */}
          <div className="scope-notice">
            <NoticeInfoIcon />
            <div>
              <p className="scope-notice-title">한 이미지에는 한 일차의 일정을 올려주세요.</p>
              <p className="scope-notice-text">여러 일차가 있다면 일차별로 나누어 올려주세요.</p>
              <p className="scope-notice-text">표가 복잡하거나 항목이 많으면 처리 시간이 오래 걸릴 수 있어요.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AttachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M8 12L15 5A4 4 0 1 1 20.5 10.5L12 19A6 6 0 1 1 3.5 10.5L11.5 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

