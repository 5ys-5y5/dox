# Template Extract Visual Measurement Log

- startedAt: 2026-04-22T03:56:56.397Z
- draftId: 70789f66-1fba-4ab1-8a8e-735c8ba11cdd
- sourceTitle: 안전관리계획서 입력본
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 32

## Events

### 2026-04-22T03:56:56.425Z

- level: info
- phase: prepare
- percent: 2
- stage: 시각 유사도 측정 준비
- detail: 원본 PDF와 output HTML 비교 세션을 시작했습니다.

```json
{
  "draftId": "70789f66-1fba-4ab1-8a8e-735c8ba11cdd",
  "sourceTitle": "안전관리계획서 입력본",
  "sourceFileName": "작업지시서_사일동 주상복합.pdf"
}
```

### 2026-04-22T03:56:56.431Z

- level: info
- phase: uploading
- percent: 4
- stage: 원본 PDF 업로드를 시작했습니다.
- detail: 작업지시서_사일동 주상복합.pdf

```json
{
  "fileName": "작업지시서_사일동 주상복합.pdf",
  "fileType": "application/pdf",
  "fileSize": 152926
}
```

### 2026-04-22T03:56:56.442Z

- level: info
- phase: rendering_pdf
- percent: 24
- stage: 서버에서 PDF 페이지 PNG 렌더를 시작했습니다.
- detail: 업로드된 원본 PDF 작업지시서_사일동 주상복합.pdf 를 페이지 이미지로 변환합니다.

```json
{
  "fileName": "작업지시서_사일동 주상복합.pdf",
  "fileType": "application/pdf",
  "fileSize": 152926
}
```

### 2026-04-22T03:56:56.537Z

- level: info
- phase: uploading
- percent: 18
- stage: 원본 PDF를 측정 서버로 업로드하고 있습니다.
- detail: 업로드 100%

### 2026-04-22T03:56:56.538Z

- level: info
- phase: rendering_pdf
- percent: 22
- stage: 서버 PDF/HTML 렌더 대기
- detail: 업로드가 끝나 서버에서 PDF PNG와 HTML PNG 생성을 시작합니다.

### 2026-04-22T03:57:22.306Z

- level: info
- phase: rendering_pdf
- percent: 40
- stage: 서버에서 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: 총 1개 페이지 이미지를 생성했습니다.

```json
{
  "pageCount": 1
}
```

### 2026-04-22T03:57:22.307Z

- level: info
- phase: rendering_html
- percent: 52
- stage: 서버에서 output HTML 페이지 PNG 렌더를 시작했습니다.
- detail: Headless Chrome 으로 추출 HTML을 페이지별 PNG 스크린샷으로 만듭니다.

```json
{
  "htmlLength": 39687
}
```

### 2026-04-22T03:57:24.264Z

- level: info
- phase: rendering_html
- percent: 68
- stage: 서버에서 output HTML 페이지 PNG 렌더를 완료했습니다.
- detail: 총 1개 페이지 이미지를 생성했습니다.

```json
{
  "pageCount": 1
}
```

### 2026-04-22T03:57:24.275Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF 렌더 이미지를 준비하고 있습니다.
- detail: 원본 PDF 페이지 1개 이미지를 비교용 canvas로 읽고 있습니다.

### 2026-04-22T03:57:24.276Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF/HTML 페이지 PNG를 브라우저 비교 입력으로 넘겼습니다.
- detail: PDF 1개, HTML 1개 페이지 이미지를 브라우저 canvas 비교 단계로 넘깁니다.

```json
{
  "sourcePageCount": 1,
  "replicaPageCount": 1
}
```

### 2026-04-22T03:57:24.277Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF 렌더 이미지를 브라우저 캔버스로 정규화하고 있습니다.
- detail: PDF 페이지 준비 1/1

### 2026-04-22T03:57:24.310Z

- level: info
- phase: preparing_replica_pages
- percent: 54
- stage: HTML 렌더 이미지를 준비하고 있습니다.
- detail: 서버가 렌더한 HTML 페이지 1개 이미지를 비교용 canvas로 읽고 있습니다.

### 2026-04-22T03:57:24.313Z

- level: info
- phase: preparing_replica_pages
- percent: 54
- stage: 서버에서 렌더된 HTML 페이지 PNG를 브라우저 캔버스로 정규화하고 있습니다.
- detail: HTML 페이지 준비 1/1

### 2026-04-22T03:57:24.348Z

- level: info
- phase: comparing_pages
- percent: 78
- stage: 페이지별 픽셀을 비교하고 있습니다.
- detail: 픽셀 비교 1/1

### 2026-04-22T03:57:24.563Z

- level: info
- phase: aggregating
- percent: 96
- stage: 최종 시각 유사도를 집계하고 있습니다.
- detail: 페이지별 frame/text overlap 결과를 분리해 최종 프레임 일치율을 계산하고 있습니다.

## Final Status

- finishedAt: 2026-04-22T03:57:24.564Z
- status: completed
- summary: 1px 허용 오차 기준 프레임 중첩률 0.00%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measured": true,
  "measurementMode": "server_headless_chrome_capture",
  "tolerancePx": 1,
  "minimumPassScore": 0.95,
  "passed": false,
  "overallScore": 0,
  "scoreMode": "frame_ink_overlap",
  "frameScore": 0,
  "textScore": 0.1461823000055209,
  "combinedScore": 0.14977035564080454,
  "measuredAt": "2026-04-22T03:57:24.560Z",
  "pageCount": 1,
  "notes": [
    "source_pdf_png_vs_server_headless_chrome_screenshot",
    "ink_union_overlap_ratio_with_1px_tolerance",
    "replica_capture_modes:server_headless_chrome",
    "primary_score:frame_ink_overlap",
    "combined_score:available",
    "text_score:reported_not_primary"
  ],
  "pageReports": [
    {
      "pageNumber": 1,
      "width": 1522,
      "height": 2970,
      "sourceInkPixelCount": 1009974,
      "replicaInkPixelCount": 317255,
      "unionInkPixelCount": 1193367,
      "overlapInkPixelCount": 178731,
      "exactOverlapInkPixelCount": 133862,
      "overlapRatio": 0.14977035564080454,
      "exactOverlapRatio": 0.11217169571472983,
      "mismatchRatio": 0.8502296443591955,
      "frameLayerReport": {
        "sourceInkPixelCount": 0,
        "replicaInkPixelCount": 20476,
        "unionInkPixelCount": 20476,
        "overlapInkPixelCount": 0,
        "exactOverlapInkPixelCount": 0,
        "overlapRatio": 0,
        "exactOverlapRatio": 0,
        "mismatchRatio": 1
      },
      "textLayerReport": {
        "sourceInkPixelCount": 1009974,
        "replicaInkPixelCount": 296779,
        "unionInkPixelCount": 1177345,
        "overlapInkPixelCount": 172107,
        "exactOverlapInkPixelCount": 129408,
        "overlapRatio": 0.1461823000055209,
        "exactOverlapRatio": 0.10991510559776446,
        "mismatchRatio": 0.8538176999944791
      },
      "notes": [
        "replica_capture_mode:server_headless_chrome",
        "score_mode:frame_ink_overlap",
        "source_frame_mask:long_axis_runs_24px",
        "replica_frame_mask:long_axis_runs_24px"
      ]
    }
  ]
}
```
