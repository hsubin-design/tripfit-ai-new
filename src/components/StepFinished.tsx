"use client";

// 신규(2026-09-14) — helpfulness "제출하기"까지 성공한 뒤에만 도달하는
// 진짜 최종 화면.
// 버그 수정(2026-09-14, 4차) — 완료 콘텐츠를 체크 아이콘 + 제목 한
// 줄로 더 간결하게 줄였다("비교와 응답을 보내주셔서 감사합니다."/
// "이제 이 페이지를 닫아도 괜찮아요." 두 문구 제거) — 아이콘+제목을
// 하나의 완료 상태 묶음으로 보고 gap으로만 간격을 준다.
// 버그 수정(2026-09-14, 3차) — 중앙보다 살짝 위에 완료 콘텐츠를
// 배치한다. 부모(page.tsx)의 flex-col
// 컨테이너가 이미 min-h-dvh라 이 화면이 그 유일한 flex item일 때
// flex-1로 남는 높이를 그대로 채우게 하고, 그 안에서 justify-center로
// 세로 중앙 정렬한 뒤 하단 고정 CTA 바(.bottom-cta-bar)가 차지하는
// 만큼의 여유(pb)를 줘서 시각적 중심이 정확한 중앙보다 살짝 위로
// 올라가게 한다 — 다른 화면들의 top-aligned(px-5 pt-20) 레이아웃과는
// 이 화면만 다르게 의도적으로 중앙 정렬한다.
// 체크 아이콘은 클릭되지 않는 순수 상태 안내 요소라 버튼이 아닌
// 장식용 div로 만들고 aria-hidden을 준다.
// 버그 수정(2026-09-14, 3차) — "새로 비교하기"를 이 화면 맨 아래에
// 다시 노출한다(제출 완료 이후의 선택 행동). onRestart는 page.tsx의
// handleRestart를 그대로 재사용 — 새 comparison_id 발급/
// comparison_started 재발화 로직은 그 함수 안에 이미 있고 여기서는
// 아무것도 새로 만들지 않는다. 이 CTA는 primary(.btn-primary, 진한
// purple)보다 위계를 낮춘 .btn-secondary-tint(연한 purple 배경 + 진한
// purple 텍스트)를 쓴다 — 이미 다른 화면(비교 실패 화면의 "입력으로
// 돌아가기")에서 쓰던 것과 같은 톤, 이 화면엔 CTA가 하나뿐이라 그
// 자체가 primary처럼 눌리진 않게 하기 위함. .bottom-cta-bar가 이미
// env(safe-area-inset-bottom)을 포함하고 있어(globals.css) 모바일
// safe area는 따로 처리할 필요가 없다.
type Props = {
  onRestart: () => void;
};

export default function StepFinished({ onRestart }: Props) {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-5 pb-16 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full bg-primary"
        aria-hidden="true"
      >
        <CheckIcon />
      </div>
      <h1 className="heading-page">제출이 완료되었습니다.</h1>

      {/* Fixed strip spans the viewport; the inner div clamps back to the app
          shell's max width so the CTA never grows wider than the app itself. */}
      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
          <button type="button" onClick={onRestart} className="btn-secondary-tint focus-ring w-full">
            새로 비교하기
          </button>
        </div>
      </div>
    </div>
  );
}

// 클릭 불가능한 상태 안내 아이콘 — StepResult.tsx의 전송 성공
// 체크마크(SendSuccessIcon)와 같은 polyline 모양을 재사용하되, 원형
// 배경 안에서 보이도록 크기만 키웠다.
function CheckIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
