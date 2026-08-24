"use client";

import BackButton from "@/components/BackButton";

type Props =
  | { variant: "brand"; onFeedbackClick?: () => void; onLogoClick?: () => void }
  | { variant: "back"; onBack: () => void };

// "TripFit" 로고를 누르면 새 비교를 처음부터 시작한다(초기화) —
// onLogoClick이 없으면(호출부가 아직 안 넘겨줬다면) 예전처럼 그냥
// 텍스트로만 보여준다. 시각 스타일은 기존 <span>과 완전히 동일하게
// 유지하고(text-[18px] font-bold text-text-primary), 버튼으로만
// 바꿔 클릭/키보드(Enter, Space)로 접근 가능하게 한다. hover 배경은
// 추가하지 않는다(요구사항).
function LogoButton({ onLogoClick }: { onLogoClick?: () => void }) {
  if (!onLogoClick) {
    return <span className="text-[18px] font-bold text-text-primary">TripFit</span>;
  }
  return (
    <button
      type="button"
      onClick={onLogoClick}
      className="focus-ring text-[18px] font-bold text-text-primary"
    >
      TripFit
    </button>
  );
}

/** 모든 화면이 공유하는 고정 상단 헤더. 첫 입력 화면만 왼쪽 "TripFit"
 *  브랜드 표시(+ 오른쪽 "의견 보내기")를 쓰고, 그 이후 모든 화면(비교
 *  결과부터 완료 전까지)은 뒤로가기 버튼만 보여준다 — TripFit 로고와
 *  그걸 눌렀을 때의 전체 초기화(reset)는 최초 입력 화면 밖에서는 더
 *  이상 노출하지 않는다(2026-08-24, GNB 재정리: 결과 이후 화면에서
 *  모바일 상단이 복잡해 보이고, 로고를 reset trigger로 쓰는 게 그
 *  화면들에서는 오히려 오해를 살 수 있다는 피드백). 전체 초기화가
 *  다시 필요하면 완료 화면의 "새로 비교하기" CTA를 쓴다. 흰색은
 *  mx-auto/max-w-[430px]로 앱 쉘 폭 안에서만 칠해진다(.bottom-cta-bar와
 *  동일한 패턴) — 그래서 데스크톱 뷰포트에서도 헤더가 모바일 콘텐츠
 *  폭을 벗어나 넓어지지 않는다.
 *
 *  brand variant는 justify-between으로 "TripFit"을 왼쪽, onFeedbackClick이
 *  있을 때만 "의견 보내기"를 오른쪽에 둔다(items-center로 서로 수직
 *  중앙 정렬). Primary CTA처럼 보이면 안 되므로 배경/밑줄 없이 Neutral
 *  텍스트로만 두고, hover 시에도 색이 바뀌지 않는다(별도 :hover 스타일을
 *  주지 않음).
 *
 *  back variant는 뒤로가기 버튼 하나만 두고 반대쪽 자리를 비워둔다 —
 *  TripFit이 빠진 자리를 다른 요소로 채우지 않는다. 뒤로가기 버튼의
 *  위치/크기는 이전과 동일하다(같은 app-header-bar 높이·padding, 같은
 *  items-center 정렬의 첫 번째 자식이므로). */
export default function AppHeader(props: Props) {
  return (
    <div className="fixed inset-x-0 top-0 z-20">
      <div className="app-header-bar mx-auto w-full max-w-[430px]">
        {props.variant === "brand" ? (
          <div className="flex h-full w-full items-center justify-between">
            <LogoButton onLogoClick={props.onLogoClick} />
            {props.onFeedbackClick && (
              <button
                type="button"
                onClick={props.onFeedbackClick}
                className="focus-ring whitespace-nowrap px-1 py-3 text-[14px] font-medium text-text-secondary"
              >
                의견 보내기
              </button>
            )}
          </div>
        ) : (
          <div className="flex h-full w-full items-center">
            <BackButton onClick={props.onBack} />
          </div>
        )}
      </div>
    </div>
  );
}
