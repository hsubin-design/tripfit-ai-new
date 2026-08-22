"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";

type Props = {
  onBack: () => void;
};

/** 의견 보내기 화면. 이번 턴은 UI/interaction state(빈 textarea → CTA
 *  disabled, 한 글자 이상 → Primary Purple 활성화)만 확인하는 범위라
 *  textarea 값은 이 컴포넌트 안에서만 관리한다 — Supabase/Mixpanel
 *  연결은 별도 요청으로 진행하고, 그때 이 상태를 어디로 끌어올릴지
 *  다시 정한다. */
export default function StepFeedback({ onBack }: Props) {
  const [feedbackText, setFeedbackText] = useState("");

  const isValid = feedbackText.trim().length > 0;

  // TODO: 다음 턴에서 Supabase tripfit_service_feedback INSERT와
  // Mixpanel feedback_opened/feedback_submitted를 연결한다. 지금은
  // 화면 UI/state 확인만 대상이라 임시로 아무 동작도 하지 않는다.
  function handleSubmit() {
    if (!isValid) return;
  }

  return (
    <div className="w-full">
      <AppHeader variant="back" onBack={onBack} />
      <div className="flex w-full flex-col px-5 pb-28 pt-20">
        <h1 className="heading-page">TripFit에 대한 의견을 남겨주세요.</h1>
        <p className="text-body-secondary mt-2">
          사용하면서 불편했던 점이나 필요한 기능이 있다면 편하게 알려주세요.
        </p>

        <textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          rows={8}
          placeholder="사용하면서 느낀 점을 자유롭게 적어주세요."
          className="field text-body mt-6 resize-none p-3"
        />
        <p className="text-caption mt-3">
          작성한 의견은 서비스 개선을 위해 활용됩니다. 여행 일정 원문은 저장하지 않습니다.
        </p>
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
            의견 보내기
          </button>
        </div>
      </div>
    </div>
  );
}
