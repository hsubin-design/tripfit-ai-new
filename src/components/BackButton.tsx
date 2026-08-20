"use client";

type Props = {
  onClick: () => void;
};

export default function BackButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="이전 화면으로"
      className="back-button"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M15 18L9 12L15 6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
