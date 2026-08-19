"use client";

type Props = {
  score: number | null;
  onChangeScore: (score: number) => void;
  onBack: () => void;
  onSubmit: () => void;
};

export default function StepRating({ score, onChangeScore, onBack, onSubmit }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">
        두 일정의 차이를 파악하는 데 얼마나 도움이 되었나요?
      </h1>

      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChangeScore(n)}
            className={`flex h-12 w-12 items-center justify-center rounded-full border text-base font-semibold transition-colors ${
              score === n
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-600 hover:border-slate-500"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>전혀 도움 안 됨</span>
        <span>매우 도움 됨</span>
      </div>

      <div className="mt-4 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:border-slate-500"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={score === null}
          className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          제출하기
        </button>
      </div>
    </div>
  );
}
