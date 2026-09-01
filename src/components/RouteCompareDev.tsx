"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";

// v1.0 — "지도에서 N일차 동선 보기" CTA의 목적지. 실제 지도/이동 API
// 연동 전, Figma Option B의 UX 흐름(비교 결과 → 동선 비교 → 돌아가기)만
// 로컬에서 확인하기 위한 개발용 화면이다. 장소 pin/route line/구간별
// 이동정보는 아직 그리지 않고, 그 자리에 있을 내용을 placeholder
// 문구로만 안내한다 — 없는 지도 데이터를 있는 것처럼 보여주지 않는다.
// 외부 지도 앱으로 보내지 않고 TripFit 내부 화면으로 유지하는 이유는
// Plan A/B의 동선을 "탐색"이 아니라 "비교"하기 위함이다(요구사항).
type Props = {
  day: number;
  onBack: () => void;
};

export default function RouteCompareDev({ day, onBack }: Props) {
  const [plan, setPlan] = useState<"a" | "b">("a");

  return (
    <div className="w-full">
      <AppHeader variant="back" onBack={onBack} />
      <div className="flex w-full flex-col px-5 pb-28 pt-20">
        <h1 className="heading-page">{day}일차 동선 비교</h1>

        <div className="tab-pill-group mt-6 w-full">
          <button
            type="button"
            data-active={plan === "a"}
            className="tab-pill focus-ring flex-1"
            onClick={() => setPlan("a")}
          >
            플랜 A
          </button>
          <button
            type="button"
            data-active={plan === "b"}
            className="tab-pill focus-ring flex-1"
            onClick={() => setPlan("b")}
          >
            플랜 B
          </button>
        </div>

        <div className="card mt-4 flex min-h-[280px] flex-col items-center justify-center gap-2 bg-subtle-surface p-6 text-center">
          <p className="text-body-secondary text-[14px] leading-[1.5]">
            지도/이동 API 연결 전 개발 화면입니다.
          </p>
          <p className="text-caption text-[12px] leading-[1.5]">
            연동 후 이 자리에 플랜 {plan === "a" ? "A" : "B"} {day}일차의 장소 pin과 route
            line, 구간별 차량·도보 이동시간/거리가 표시될 예정이에요.
          </p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="bottom-cta-bar mx-auto w-full max-w-[430px]">
          <button type="button" onClick={onBack} className="btn-secondary focus-ring w-full">
            비교 결과로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
