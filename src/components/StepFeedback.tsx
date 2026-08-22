"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { trackFeedbackOpened, trackFeedbackSubmitted } from "@/lib/analytics";
import { insertServiceFeedback } from "@/lib/supabase";

type Props = {
  onBack: () => void;
};

// "의견 보내기" 진입점이 현재 첫 화면(입력 화면) AppHeader 하나뿐이라
// 고정값으로 둔다 — 다른 화면에도 진입점이 생기면 그때 prop으로 받는
// 구조로 바꾼다.
const SOURCE_SCREEN = "input";

/** 의견 보내기 화면. 제출은 Supabase INSERT가 성공한 뒤에만 완료
 *  상태로 넘어가고, Mixpanel feedback_submitted도 그 이후에만 보낸다
 *  — 실패하면 입력한 텍스트를 그대로 두고 재시도할 수 있게 한다.
 *  feedback_text 원문은 Supabase에만 저장되고 Mixpanel에는 절대
 *  실리지 않는다(trackFeedbackSubmitted는 글자 수만 받는다). */
export default function StepFeedback({ onBack }: Props) {
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    trackFeedbackOpened(SOURCE_SCREEN);
  }, []);

  const isValid = feedbackText.trim().length > 0;

  async function handleSubmit() {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const { success } = await insertServiceFeedback({
      feedbackText,
      sourceScreen: SOURCE_SCREEN,
    });

    setIsSubmitting(false);

    if (!success) {
      setSubmitError("의견을 보내지 못했어요. 다시 시도해주세요.");
      return;
    }

    trackFeedbackSubmitted(SOURCE_SCREEN, feedbackText.trim().length);
    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="w-full">
        <AppHeader variant="back" onBack={onBack} />
        <div className="flex w-full flex-col px-5 pb-28 pt-20">
          <h1 className="heading-page">의견을 보내주셔서 감사합니다.</h1>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
            <button type="button" onClick={onBack} className="btn-primary focus-ring w-full">
              확인
            </button>
          </div>
        </div>
      </div>
    );
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
          {submitError !== null && (
            <p className="text-error mb-2 text-[13px] leading-[1.4]">{submitError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="btn-primary focus-ring w-full"
          >
            {isSubmitting ? "제출 중..." : "의견 보내기"}
          </button>
        </div>
      </div>
    </div>
  );
}
