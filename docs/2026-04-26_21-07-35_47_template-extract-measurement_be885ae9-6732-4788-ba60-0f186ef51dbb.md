# Template Extract Visual Measurement Log

- startedAt: 2026-04-26T12:07:35.517Z
- draftId: be885ae9-6732-4788-ba60-0f186ef51dbb
- sourceTitle: 안전관리계획서 입력본
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 47

## Events

### 2026-04-26T12:07:35.557Z

- level: info
- phase: prepare
- percent: 2
- stage: 시각 유사도 측정 준비
- detail: 원본 PDF와 output HTML 비교 세션을 시작했습니다.

```json
{
  "draftId": "be885ae9-6732-4788-ba60-0f186ef51dbb",
  "sourceTitle": "안전관리계획서 입력본",
  "sourceFileName": "작업지시서_사일동 주상복합.pdf"
}
```

### 2026-04-26T12:07:35.586Z

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

### 2026-04-26T12:07:35.707Z

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

### 2026-04-26T12:07:35.710Z

- level: info
- phase: uploading
- percent: 18
- stage: 원본 PDF를 측정 서버로 업로드하고 있습니다.
- detail: 업로드 100%

### 2026-04-26T12:07:35.738Z

- level: info
- phase: rendering_pdf
- percent: 22
- stage: 서버 PDF/HTML 렌더 대기
- detail: 업로드가 끝나 서버에서 PDF PNG와 HTML PNG 생성을 시작합니다.

### 2026-04-26T12:08:15.699Z

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

### 2026-04-26T12:08:15.700Z

- level: info
- phase: rendering_html
- percent: 52
- stage: 서버에서 output HTML 페이지 PNG 렌더를 시작했습니다.
- detail: Headless Chrome 으로 추출 HTML을 페이지별 PNG 스크린샷으로 만듭니다.

```json
{
  "htmlLength": 113167
}
```

### 2026-04-26T12:08:17.354Z

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

### 2026-04-26T12:08:17.369Z

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

### 2026-04-26T12:08:17.371Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF 렌더 이미지를 준비하고 있습니다.
- detail: 원본 PDF 페이지 1개 이미지를 비교용 canvas로 읽고 있습니다.

### 2026-04-26T12:08:17.373Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF 렌더 이미지를 브라우저 캔버스로 정규화하고 있습니다.
- detail: PDF 페이지 준비 1/1

### 2026-04-26T12:08:17.449Z

- level: info
- phase: preparing_replica_pages
- percent: 54
- stage: HTML 렌더 이미지를 준비하고 있습니다.
- detail: 서버가 렌더한 HTML 페이지 1개 이미지를 비교용 canvas로 읽고 있습니다.

### 2026-04-26T12:08:17.451Z

- level: info
- phase: preparing_replica_pages
- percent: 54
- stage: 서버에서 렌더된 HTML 페이지 PNG를 브라우저 캔버스로 정규화하고 있습니다.
- detail: HTML 페이지 준비 1/1

### 2026-04-26T12:08:17.510Z

- level: info
- phase: comparing_pages
- percent: 78
- stage: 페이지별 픽셀을 비교하고 있습니다.
- detail: 픽셀 비교 1/1

### 2026-04-26T12:08:17.730Z

- level: info
- phase: aggregating
- percent: 96
- stage: 최종 시각 유사도를 집계하고 있습니다.
- detail: 페이지별 frame/text overlap 결과를 분리해 최종 프레임 일치율을 계산하고 있습니다.

## Final Status

- finishedAt: 2026-04-26T12:08:17.732Z
- status: completed
- summary: 1px 허용 오차 기준 프레임 중첩률 17.03%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measured": true,
  "measurementMode": "server_headless_chrome_capture",
  "tolerancePx": 1,
  "minimumPassScore": 0.95,
  "passed": false,
  "overallScore": 0.17031458382364478,
  "scoreMode": "frame_ink_overlap",
  "frameScore": 0.17031458382364478,
  "textScore": 0.2965439803541878,
  "combinedScore": 0.29465519438426974,
  "measuredAt": "2026-04-26T12:08:17.727Z",
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
      "width": 1524,
      "height": 2156,
      "sourceInkPixelCount": 736453,
      "replicaInkPixelCount": 354953,
      "unionInkPixelCount": 902465,
      "overlapInkPixelCount": 265916,
      "exactOverlapInkPixelCount": 188941,
      "overlapRatio": 0.29465519438426974,
      "exactOverlapRatio": 0.20936102785149563,
      "mismatchRatio": 0.7053448056157303,
      "frameLayerReport": {
        "sourceInkPixelCount": 33413,
        "replicaInkPixelCount": 9086,
        "unionInkPixelCount": 38241,
        "overlapInkPixelCount": 6513,
        "exactOverlapInkPixelCount": 4258,
        "overlapRatio": 0.17031458382364478,
        "exactOverlapRatio": 0.11134646060510969,
        "mismatchRatio": 0.8296854161763552
      },
      "textLayerReport": {
        "sourceInkPixelCount": 703040,
        "replicaInkPixelCount": 345867,
        "unionInkPixelCount": 866546,
        "overlapInkPixelCount": 256969,
        "exactOverlapInkPixelCount": 182361,
        "overlapRatio": 0.2965439803541878,
        "exactOverlapRatio": 0.2104458389975835,
        "mismatchRatio": 0.7034560196458122
      },
      "notes": [
        "replica_capture_mode:server_headless_chrome",
        "score_mode:frame_ink_overlap",
        "frame_mask:current_preview_frame_segments",
        "source_mask:replica_text_window_subtracted",
        "source_frame_mask:expected_frame_segments_windowed",
        "source_frame_validation:window_ink_detected",
        "replica_frame_mask:rendered_frame_segments"
      ]
    }
  ]
}
```
