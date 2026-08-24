"use client";

// TripFit 로고로 "처음부터 시작하기"를 누를 때, 입력/진행 중인 내용이
// 있으면 실수로 날리지 않도록 보여주는 최소 크기 확인 다이얼로그.
// 프로젝트에 기존 dialog 패턴이 없어 새 시스템을 만들지 않고, 이미
// 쓰이는 토큰(.card, .btn-primary, .focus-ring, 보조 텍스트 링크
// 버튼 스타일)만 그대로 재사용한다.
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
        <h2 id="reset-confirm-title" className="text-[17px] font-bold leading-[1.3] text-text-primary">
          새로운 비교를 시작할까요?
        </h2>
        <p id="reset-confirm-desc" className="text-body-secondary mt-2 text-[14px] leading-[1.5]">
          현재 입력한 일정과 비교 결과가 모두 초기화돼요.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <button type="button" onClick={onConfirm} className="btn-primary focus-ring w-full">
            처음부터 시작하기
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring w-full rounded text-sm font-medium text-text-secondary underline underline-offset-4"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
