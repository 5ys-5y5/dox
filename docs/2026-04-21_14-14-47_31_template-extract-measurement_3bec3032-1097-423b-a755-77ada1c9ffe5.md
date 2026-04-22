# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T05:14:47.459Z
- draftId: 3bec3032-1097-423b-a755-77ada1c9ffe5
- sourceTitle: 안전관리계획서 입력본
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 31

## Events

### 2026-04-21T05:14:47.481Z

- level: info
- phase: prepare
- percent: 2
- stage: 시각 유사도 측정 준비
- detail: 원본 PDF와 output HTML 비교 세션을 시작했습니다.

```json
{
  "draftId": "3bec3032-1097-423b-a755-77ada1c9ffe5",
  "sourceTitle": "안전관리계획서 입력본",
  "sourceFileName": "작업지시서_사일동 주상복합.pdf"
}
```

### 2026-04-21T05:14:47.486Z

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

### 2026-04-21T05:14:47.491Z

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

### 2026-04-21T05:14:47.591Z

- level: info
- phase: uploading
- percent: 18
- stage: 원본 PDF를 측정 서버로 업로드하고 있습니다.
- detail: 업로드 100%

### 2026-04-21T05:14:47.592Z

- level: info
- phase: rendering_pdf
- percent: 22
- stage: 서버 PDF/HTML 렌더 대기
- detail: 업로드가 끝나 서버에서 PDF PNG와 HTML PNG 생성을 시작합니다.

### 2026-04-21T05:15:15.850Z

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

### 2026-04-21T05:15:15.851Z

- level: info
- phase: rendering_html
- percent: 52
- stage: 서버에서 output HTML 페이지 PNG 렌더를 시작했습니다.
- detail: Headless Chrome 으로 추출 HTML을 페이지별 PNG 스크린샷으로 만듭니다.

```json
{
  "htmlLength": 45140
}
```

### 2026-04-21T05:15:17.571Z

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

### 2026-04-21T05:15:17.582Z

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

### 2026-04-21T05:15:17.585Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF 렌더 이미지를 준비하고 있습니다.
- detail: 원본 PDF 페이지 1개 이미지를 비교용 canvas로 읽고 있습니다.

### 2026-04-21T05:15:17.587Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF 렌더 이미지를 브라우저 캔버스로 정규화하고 있습니다.
- detail: PDF 페이지 준비 1/1

### 2026-04-21T05:15:17.611Z

- level: info
- phase: preparing_replica_pages
- percent: 54
- stage: HTML 렌더 이미지를 준비하고 있습니다.
- detail: 서버가 렌더한 HTML 페이지 1개 이미지를 비교용 canvas로 읽고 있습니다.

### 2026-04-21T05:15:17.614Z

- level: info
- phase: preparing_replica_pages
- percent: 54
- stage: 서버에서 렌더된 HTML 페이지 PNG를 브라우저 캔버스로 정규화하고 있습니다.
- detail: HTML 페이지 준비 1/1

### 2026-04-21T05:15:17.639Z

- level: info
- phase: comparing_pages
- percent: 78
- stage: 페이지별 픽셀을 비교하고 있습니다.
- detail: 픽셀 비교 1/1

### 2026-04-21T05:15:17.756Z

- level: info
- phase: aggregating
- percent: 96
- stage: 최종 시각 유사도를 집계하고 있습니다.
- detail: 페이지별 frame/text overlap 결과를 분리해 최종 프레임 일치율을 계산하고 있습니다.

## Final Status

- finishedAt: 2026-04-21T05:15:17.757Z
- status: completed
- summary: 1px 허용 오차 기준 프레임 중첩률 4.05%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measured": true,
  "measurementMode": "server_headless_chrome_capture",
  "tolerancePx": 1,
  "minimumPassScore": 0.95,
  "passed": false,
  "overallScore": 0.040453276673749115,
  "scoreMode": "frame_ink_overlap",
  "frameScore": 0.040453276673749115,
  "textScore": 0.038962747170840785,
  "combinedScore": 0.16586168525226697,
  "measuredAt": "2026-04-21T05:15:17.753Z",
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
      "width": 1190,
      "height": 1684,
      "sourceInkPixelCount": 405356,
      "replicaInkPixelCount": 66754,
      "unionInkPixelCount": 422370,
      "overlapInkPixelCount": 70055,
      "exactOverlapInkPixelCount": 49740,
      "overlapRatio": 0.16586168525226697,
      "exactOverlapRatio": 0.11776404574188508,
      "mismatchRatio": 0.834138314747733,
      "frameLayerReport": {
        "sourceInkPixelCount": 1926,
        "replicaInkPixelCount": 48002,
        "unionInkPixelCount": 48006,
        "overlapInkPixelCount": 1942,
        "exactOverlapInkPixelCount": 1922,
        "overlapRatio": 0.040453276673749115,
        "exactOverlapRatio": 0.04003666208390618,
        "mismatchRatio": 0.9595467233262509
      },
      "textLayerReport": {
        "sourceInkPixelCount": 403430,
        "replicaInkPixelCount": 18752,
        "unionInkPixelCount": 410546,
        "overlapInkPixelCount": 15996,
        "exactOverlapInkPixelCount": 11636,
        "overlapRatio": 0.038962747170840785,
        "exactOverlapRatio": 0.02834274356588543,
        "mismatchRatio": 0.9610372528291592
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
