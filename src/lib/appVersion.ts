// 데이터 수집(Mixpanel 이벤트, Supabase tripfit_ut_responses/
// tripfit_service_feedback 저장)에 실리는 앱 버전의 단일 출처. 이전에는
// analytics.ts와 supabase.ts에 각각 버전 문자열이 하드코딩돼 있어 버전을
// 올릴 때 한 곳을 놓치면 수집되는 값이 서로 어긋날 수 있었다 — 값을
// 바꿀 때 이 상수 하나만 바꾸면 된다.
export const APP_VERSION = "1.0";
