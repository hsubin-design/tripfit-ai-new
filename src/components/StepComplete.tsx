"use client";

import { COMPARISON_CRITERIA, DECISION_REASON_OPTIONS, type Decision, type SelectedReasonId } from "@/types/plan";

// v1.0 — selectedCriteria는 플로우에 따라 COMPARISON_CRITERIA(결정
// 어려움) 또는 DECISION_REASON_OPTIONS(결정함) 중 하나의 id를 담는다
// — 이 요약 화면은 어느 쪽이든 라벨을 보여줄 수 있게 두 목록을 합쳐
// 조회한다.
const REASON_OPTION_LABELS: Record<string, string> = Object.fromEntries(
  [...COMPARISON_CRITERIA, ...DECISION_REASON_OPTIONS].map((option) => [option.id, option.label])
);

// 3차 우선순위(2026-09-04) — "결정" 행이 undecided일 때 "선택한
// 플랜: 아직 결정하기 어려움"처럼 어색하게 읽히지 않도록, 값은 기존
// StepDecision의 문구를 그대로 재사용하고 행 라벨 자체를 아래에서
// 다르게 바꾼다(요청: "결정을 유보한 경우에는 '선택한 플랜' 대신
// 현재 decision 상태에 맞는 문구를 사용").
const DECISION_VALUE_LABEL: Record<Decision, string> = {
  plan_a: "플랜 A",
  plan_b: "플랜 B",
  undecided: "아직 결정하기 어려움",
};

type Props = {
  decision: Decision | null;
  selectedCriteria: SelectedReasonId[];
  reasonText: string;
  // 3차 우선순위 — 별도 "제출하기" 버튼 없이, 숫자를 누르는 즉시
  // 부모(page.tsx)가 저장을 시도한다. 실패해도 이 화면 자체는 막지
  // 않는다(helpfulness는 optional — "새로 비교하기"는 항상 가능).
  helpfulness: number | null;
  onSelectHelpfulness: (score: number) => void;
  isSavingHelpfulness?: boolean;
  helpfulnessSaveError?: string | null;
  onRestart: () => void;
};

export default function StepComplete({
  decision,
  selectedCriteria,
  reasonText,
  helpfulness,
  onSelectHelpfulness,
  isSavingHelpfulness = false,
  helpfulnessSaveError = null,
  onRestart,
}: Props) {
  const isUndecided = decision === "undecided";
  const planRowLabel = isUndecided ? "결정 상태" : "선택한 플랜";
  const planRowValue = decision ? DECISION_VALUE_LABEL[decision] : "정보 없음";

  const criteriaLabels = selectedCriteria
    .map((id) => REASON_OPTION_LABELS[id])
    .filter((label): label is string => label !== undefined);

  // "기타 이유가 있어요"/"다른 이유가 있어요"를 고르지 않으면
  // StepReason에서 자유 서술 textarea 자체가 렌더링되지 않으므로
  // reasonText는 항상 빈 문자열로 남는다 — 별도 플래그 없이 값의
  // 존재 여부만으로 표시 여부를 판단해도 충분하고, 선택을 나중에
  // 해제해도(값은 보존되므로) 실제로 작성한 내용이 있으면 그대로
  // 보여준다.
  const hasFreeReason = reasonText.trim().length > 0;

  return (
    <div className="w-full">
      <div className="flex w-full flex-col px-5 pb-28 pt-20 text-left">
        {/* 1. 완료 상태 — Figma 기준(2026-09-04)으로 완료 아이콘/배지를
            없앴다. 제목은 순수 텍스트만, 큰 장식 일러스트도 쓰지
            않는다. 제목/설명 모두 계속 left-aligned. */}
        <h1 className="heading-page">제출이 완료되었습니다.</h1>
        <p className="text-body-secondary mt-2">비교와 응답을 보내주셔서 감사합니다.</p>

        {/* 2. 선택 결과 + 선택 이유 요약 — 사용자에게 의미가 큰 정보만
            남긴다. 입력 방식(input_mode)은 분석용 데이터로는 그대로
            저장되지만(handleReasonNext의 insertUtResponse), 이 화면
            에서는 더 이상 보여주지 않는다. 비어 있는 항목(선택한 기준
            없음/기타 이유 없음)은 "선택 없음" 같은 placeholder 문구
            대신 행 자체를 생략해 빈 공간이 남지 않게 한다. */}
        <dl className="card mt-7 flex w-full flex-col gap-6 bg-subtle-surface px-4 py-7 text-left">
          <SummaryRow label={planRowLabel} value={planRowValue} />
          {criteriaLabels.length > 0 && (
            <SummaryRow label="선택에 도움이 된 기준" value={criteriaLabels.join(" · ")} />
          )}
          {hasFreeReason && <SummaryRow label="기타 이유" value={reasonText} />}
        </dl>

        {/* 3. helpfulness — Figma 기준(2026-09-04 재조정, compact 버전)으로
            요약 카드와 같은 light-gray 카드 스타일(.card bg-subtle-surface)의
            별도 박스로 감쌌다 — 완료 화면 전체가 center align되는 건 아니고
            (제목/설명/요약 카드는 계속 left-aligned), 이 박스 "안"만
            질문+별 모두 가운데 정렬한다. 카드가 "질문+별점만 담는 compact
            feedback card"로 보이도록 세로 padding(py-7→py-5)과 질문-별
            간격(gap-5→gap-3.5)을 줄였다. n번째 별을 누르면 그 값(1~5)
            까지의 별이 모두 active(purple)로 채워진다 — 저장값 자체는
            그대로 1~5 숫자(onSelectHelpfulness(n))라 Supabase/Mixpanel
            쪽 의미는 바뀌지 않는다. 별도 "제출하기" 버튼 없이 즉시
            저장을 시도하는 동작, 실패해도 화면을 막지 않는 동작
            (optional)도 이전과 동일 — spacing/크기만 바뀌었다. */}
        <div className="card mt-7 flex w-full flex-col items-center gap-3.5 bg-subtle-surface px-4 py-5 text-center">
          {/* 2026-09-04 재보정 — heading-card(18px)가 이 카드 안에서는
              headline처럼 무겁게 느껴진다는 피드백으로, 그 아래 별점
              interaction이 더 중심적으로 보이도록 font-size만 한 단계
              (18→16px) 낮췄다. weight(600)/색은 heading-card 그대로
              유지 — Tailwind utility(text-[16px])가 @layer utilities라
              @layer components인 heading-card보다 캐스케이드 우선순위가
              높아 font-size만 정확히 override된다. */}
          <h2 className="heading-card text-[16px]">이번 비교가 얼마나 도움이 되었나요?</h2>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onSelectHelpfulness(n)}
                disabled={isSavingHelpfulness}
                aria-label={`${n}점`}
                aria-pressed={helpfulness !== null && n <= helpfulness}
                className="star-rating-btn focus-ring"
              >
                <StarIcon filled={helpfulness !== null && n <= helpfulness} />
              </button>
            ))}
          </div>
          {helpfulnessSaveError !== null && (
            <p className="text-error text-[13px] leading-[1.4]">{helpfulnessSaveError}</p>
          )}
        </div>
      </div>

      {/* Fixed strip spans the viewport; the inner div clamps back to the app
          shell's max width so the CTA never grows wider than the app itself. */}
      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
          <button type="button" onClick={onRestart} className="btn-primary focus-ring w-full">
            새로 비교하기
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption font-semibold text-text-secondary">{label}</dt>
      <dd className="text-sm text-text-primary">{value}</dd>
    </div>
  );
}

/** 별점 아이콘 — 미선택은 밝은 light gray(--color-star-empty), 선택(그
 *  별의 인덱스가 현재 helpfulness 이하)은 natural yellow/gold
 *  (--color-star-filled)로 채운 별 하나. outline/filled를 나누지 않고
 *  색만 바꾼다(더 단순한 모양 하나로 두 상태 표현) — 저장값(1~5 숫자)
 *  로직과는 무관한 순수 색 토큰 변경이다.
 *  2026-09-04 — Figma 기준으로 36px→42px로 한 번 더 키워 "이 영역의
 *  핵심 interaction"으로 더 분명히 인식되게 했다(터치 영역
 *  .star-rating-btn은 48px로 여전히 별 자체보다 넉넉하다).
 *  2026-09-04 재보정 — 별 모양이 "뾰족하고 딱딱하다"는 피드백으로,
 *  path는 그대로 두고 채우기 색과 같은 색의 stroke(round join)를
 *  얇게 더해 뾰족한 꼭짓점만 살짝 둥글게 눌러 보이게 했다(emoji/캐릭터
 *  형태로 바꾸지 않는 최소 수정). */
function StarIcon({ filled }: { filled: boolean }) {
  const color = filled ? "var(--color-star-filled)" : "var(--color-star-empty)";
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.75l2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.6l-5.8 3.02 1.11-6.47-4.7-4.58 6.49-.94z"
        fill={color}
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
