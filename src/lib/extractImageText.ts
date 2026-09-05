// Deep v1.0 — /api/extract-image-text(서버 Route Handler)만 호출한다.
// requestPlanStructuring(structurePlans.ts)과 완전히 같은 패턴 —
// 실패를 조용히 삼키지 않고 타입 있는 에러를 던져 호출부(ImageInputPanel)가
// 실패 상태를 그대로 보여줄 수 있게 한다.
export type ImageExtractionErrorType =
  | "bad_request"
  | "unreadable"
  // 버그 수정(2026-09-06) — 이미지 안 글자는 읽었지만(unreadable 아님)
  // 그 내용이 실제 여행 일정이 아니라고 서버(vision 모델)가 판단한
  // 경우. unreadable과 원인이 다르므로 별도 타입으로 구분한다.
  | "not_travel_content"
  | "config_error"
  | "invalid_response"
  | "api_error"
  | "network"
  | "timeout";

export class ImageExtractionError extends Error {
  type: ImageExtractionErrorType;
  constructor(type: ImageExtractionErrorType, message: string) {
    super(message);
    this.type = type;
  }
}

// 버그 수정(2026-09-06, 2차) — 서버가 이제 두 값을 내려준다: rawText(이미지에
// 보이는 그대로의 전체 전사 — "원문 다시보기" 표시 전용)와 itineraryText
// (그중 실제 일정 비교에 쓸 수 있는 부분만 골라낸 것 — structure-plan에
// 전달할 값). 예전엔 하나의 extractedText를 두 용도(표시+비교) 모두에
// 그대로 썼는데, 그러면 블로그 UI/감상 문장 같은 노이즈가 비교 데이터에
// 섞였다 — 호출부(StepInput.tsx)가 이 둘을 각각 다른 곳에 반영한다.
export type ImageExtractionResult = { rawText: string; itineraryText: string };

export async function extractImageText(imageDataUrl: string): Promise<ImageExtractionResult> {
  let response: Response;
  try {
    response = await fetch("/api/extract-image-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl }),
    });
  } catch {
    throw new ImageExtractionError("network", "네트워크 연결을 확인해주세요.");
  }

  if (!response.ok) {
    let type: ImageExtractionErrorType = "api_error";
    let message = "이미지를 처리하지 못했어요. 잠시 후 다시 시도해주세요.";
    try {
      const body = await response.json();
      if (body?.error?.type) type = body.error.type;
      if (body?.error?.message) message = body.error.message;
    } catch {
      // 응답 본문을 못 읽어도 기본 메시지로 진행한다.
    }
    throw new ImageExtractionError(type, message);
  }

  const data = await response.json();
  return { rawText: data.rawText as string, itineraryText: data.itineraryText as string };
}

/** 선택한 이미지 File을 미리보기/"원문 다시보기"용 data URL로 읽는다 —
 *  브라우저 로컬 동작일 뿐 어디로도 업로드되지 않는다. 버그 수정
 *  (2026-09-06, B3) 이후로는 이 값이 사용자에게 보이는 원본 전용이고,
 *  vision API로 보내는 값은 아래 prepareImageForVision이 별도로
 *  만든다 — 사용자가 올린 원본을 축소본으로 덮어쓰지 않기 위함이다. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// 버그 수정(2026-09-06, B3 1순위 조치) — extract-image-text의 반복
// timeout 조사(B3)에서, 고밀도 이미지(QA01)가 이미지 자체 해상도는
// 크지 않았음에도 timeout이 재현됐다. 하지만 실제 사용자가 카메라로
// 찍어 올리는 사진은 보통 3000~4000px대(스마트폰 기본 해상도)로,
// 이런 "진짜 고해상도" 이미지는 vision 모델이 처리할 타일 수 자체가
// 늘어나 지연의 또 다른 축이 될 수 있다 — 이 값을 줄이는 게 이번
// 수정의 목표다(QA01류의 "저해상도지만 내용이 빽빽한" 케이스까지
// 전부 해결하는 것은 아니며, 그 점은 별도로 보고한다).
//
// MAX_DIMENSION=2000을 고른 근거: 표/캡처/사진 형태의 여행 일정
// 이미지는 긴 변 기준 약 1500~2200px 구간에서도 작은 글씨(시간·가격
// 등)가 실제로 읽히는 걸 QA로 확인했고, 그 이상으로 올려도 OCR
// 정확도가 눈에 띄게 좋아지지 않는 반면 타일 수(및 지연)는 계속
// 늘어난다 — 과도하게 낮은 값(예: 800~1000)은 작은 글씨 인식률을
// 떨어뜨릴 위험이 커서 선택하지 않았다.
const MAX_UPLOAD_DIMENSION = 2000;
// 원본이 JPEG일 때만 재인코딩 품질을 적용한다(PNG는 무손실이라
// 이 값이 무시됨) — 재인코딩으로 인한 추가 화질 손실을 최소화하기
// 위해 여유 있게 높은 값을 쓴다.
const RESIZE_JPEG_QUALITY = 0.92;

/** vision API로 보낼 이미지를 준비한다. 원본 해상도가 MAX_UPLOAD_DIMENSION
 *  이하면 원본 그대로 쓰고(재인코딩·품질 손실 전혀 없음), 그보다 크면
 *  가로세로 비율을 유지한 채 긴 변을 MAX_UPLOAD_DIMENSION으로 줄인
 *  사본을 새로 만들어 그것만 반환한다 — 반환값은 vision 업로드 전용
 *  이며, 미리보기/"원문 다시보기"에 쓰이는 원본(fileToDataUrl 결과)은
 *  이 함수와 무관하게 그대로 보존된다.
 *  EXIF 방향 보정: createImageBitmap의 imageOrientation: "from-image"
 *  옵션으로 브라우저가 EXIF 방향 태그를 반영해 디코딩하므로, 세로로
 *  찍은 사진이 눕는 등의 orientation 깨짐 없이 그대로 축소된다. */
export async function prepareImageForVision(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // 디코딩 자체가 안 되는 드문 경우 — 축소를 포기하고 원본을 그대로
    // 보낸다. 원본이 애초에 못 읽는 이미지라면 서버가 평소처럼
    // unreadable로 처리한다.
    return fileToDataUrl(file);
  }

  const { width, height } = bitmap;
  if (width <= MAX_UPLOAD_DIMENSION && height <= MAX_UPLOAD_DIMENSION) {
    bitmap.close();
    return fileToDataUrl(file);
  }

  const scale = MAX_UPLOAD_DIMENSION / Math.max(width, height);
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return fileToDataUrl(file);
  }
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  // 원본 형식을 그대로 유지한다(PNG 원본은 PNG로, JPEG 원본은 JPEG로)
  // — "JPG/PNG 모두 대응" 요구사항. quality는 JPEG에서만 의미가 있다.
  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, mimeType === "image/jpeg" ? RESIZE_JPEG_QUALITY : undefined)
  );
  if (!blob) return fileToDataUrl(file);
  return blobToDataUrl(blob);
}
