"use client";

import BackButton from "@/components/BackButton";

type Props = { variant: "brand" } | { variant: "back"; onBack: () => void };

/** 모든 화면이 공유하는 고정 상단 헤더. 첫 화면은 가운데 정렬된
 *  "TripFit" 브랜드 표시, 이후 화면은 동일한 높이·padding의 뒤로가기
 *  버튼만 다르게 보여준다. 흰색은 mx-auto/max-w-[430px]로 앱 쉘 폭
 *  안에서만 칠해진다(.bottom-cta-bar와 동일한 패턴) — 그래서 데스크톱
 *  뷰포트에서도 헤더가 모바일 콘텐츠 폭을 벗어나 넓어지지 않는다. */
export default function AppHeader(props: Props) {
  return (
    <div className="fixed inset-x-0 top-0 z-20">
      <div className="app-header-bar mx-auto w-full max-w-[430px]">
        {props.variant === "brand" ? (
          <span className="mx-auto text-[18px] font-bold text-text-primary">TripFit</span>
        ) : (
          <BackButton onClick={props.onBack} />
        )}
      </div>
    </div>
  );
}
