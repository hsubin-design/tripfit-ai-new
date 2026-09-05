"use client";

// TripFit 로고로 "처음부터 시작하기"를 누를 때, 입력/진행 중인 내용이
// 있으면 실수로 날리지 않도록 보여주는 최소 크기 확인 다이얼로그.
// Figma to-be 기준(2026-09-04) — 세로로 쌓인 full-width primary +
// 텍스트 링크 취소 구조를, 비교 실패 화면(StepProcessing)과 동일한
// 같은 행의 두 버튼(1:1 flex) 패턴으로 맞췄다. onCancel/onConfirm에
// 연결된 리셋/취소 로직 자체는 전혀 건드리지 않고 버튼 UI/문구/배치만
// 바뀌었다. 2026-09-04 재보정 — "취소하기" 배경을 .btn-secondary-tint
// (다른 화면과 공유하는 연한 lavender)에서 이 modal 전용
// .btn-secondary-neutral(더 무채색에 가까운 톤)로 바꿔, 옆의 진한
// purple "다시 시작하기"(primary)와 시각적으로 경쟁하지 않게 했다 —
// "다시 시작하기"가 확정 행동이라는 hierarchy(요청)는 그대로 유지.
type Props = {
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ResetConfirmDialog({ onCancel, onConfirm }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-confirm-title"
        aria-describedby="reset-confirm-desc"
        className="card w-full max-w-[340px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reset-confirm-title" className="text-[17px] font-bold leading-[1.3] text-text-primary text-left">
          새로운 비교를 시작하시겠어요?
        </h2>
        <p id="reset-confirm-desc" className="text-body-secondary mt-2 text-left text-[14px] leading-[1.5]">
          다시 시작하면 현재 입력한 일정과 비교 결과가 모두 초기화돼요.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary-neutral reset-confirm-btn focus-ring flex-1"
          >
            취소하기
          </button>
          <button type="button" onClick={onConfirm} className="btn-primary reset-confirm-btn focus-ring flex-1">
            다시 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
