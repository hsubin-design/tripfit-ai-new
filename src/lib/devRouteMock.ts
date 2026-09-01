// v1.0 — DEV-ONLY 이동정보 mock. 실제 Kakao Mobility(또는 다른) API
// 기술검토가 끝나기 전까지, Figma "Route Connector" UX를 로컬에서만
// 눈으로 확인하기 위한 자리표시 데이터다.
//
// 반드시 지켜야 하는 것:
// - production build(NODE_ENV==="production")에서는 절대 쓰지 않는다.
//   호출부는 항상 isDevRouteMockEnabled()로 먼저 게이트한다.
// - 이 값은 실제 ComparisonResult(비교 데이터)에 섞이거나, Supabase/
//   Mixpanel로 전송되거나, key_differences(핵심 차이)에 인용되지
//   않는다 — 오직 화면에 "이렇게 보일 예정"을 보여주는 용도.
// - 장소명/입력 내용과 무관한 고정 mock이라 "없는 사실을 생성"하는
//   것과는 다르다(값 자체가 애초에 "가짜"라고 명시돼 있음).
export type RouteMode = "vehicle" | "walk";
export type MockRouteSegment = { mode: RouteMode; minutes: number; km: number };

const MOCK_SEGMENTS: MockRouteSegment[] = [
  { mode: "vehicle", minutes: 12, km: 3.1 },
  { mode: "walk", minutes: 15, km: 1.0 },
  { mode: "vehicle", minutes: 22, km: 8.4 },
  { mode: "walk", minutes: 9, km: 0.6 },
  { mode: "vehicle", minutes: 18, km: 5.2 },
];

export function isDevRouteMockEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

/** 같은 index는 항상 같은 mock 구간을 돌려준다(렌더마다 랜덤하게
 *  바뀌면 화면이 흔들려 QA하기 어렵다) — 순수히 화면 확인용 결정론적
 *  값일 뿐, 실제 장소 사이 거리와는 무관하다. */
export function getMockRouteSegment(index: number): MockRouteSegment {
  return MOCK_SEGMENTS[index % MOCK_SEGMENTS.length];
}

export function sumMockRoute(segmentCount: number): { minutes: number; km: number } {
  let minutes = 0;
  let km = 0;
  for (let i = 0; i < segmentCount; i++) {
    const seg = getMockRouteSegment(i);
    minutes += seg.minutes;
    km += seg.km;
  }
  return { minutes, km: Math.round(km * 10) / 10 };
}
