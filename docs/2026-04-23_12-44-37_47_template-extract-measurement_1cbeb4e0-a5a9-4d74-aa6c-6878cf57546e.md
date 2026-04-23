# Template Extract Visual Measurement Log

- startedAt: 2026-04-23T03:44:37.583Z
- draftId: 1cbeb4e0-a5a9-4d74-aa6c-6878cf57546e
- sourceTitle: 안전관리계획서 입력본
- sourceFileName: 사업자등록증.pdf
- engineVersion: 47

## Events

### 2026-04-23T03:44:37.686Z

- level: info
- phase: prepare
- percent: 2
- stage: 시각 유사도 측정 준비
- detail: 원본 PDF와 output HTML 비교 세션을 시작했습니다.

```json
{
  "draftId": "1cbeb4e0-a5a9-4d74-aa6c-6878cf57546e",
  "sourceTitle": "안전관리계획서 입력본",
  "sourceFileName": "사업자등록증.pdf"
}
```

### 2026-04-23T03:44:37.702Z

- level: info
- phase: uploading
- percent: 4
- stage: 원본 PDF 업로드를 시작했습니다.
- detail: 사업자등록증.pdf

```json
{
  "fileName": "사업자등록증.pdf",
  "fileType": "application/pdf",
  "fileSize": 1938473
}
```

### 2026-04-23T03:44:37.713Z

- level: info
- phase: rendering_pdf
- percent: 24
- stage: 서버에서 PDF 페이지 PNG 렌더를 시작했습니다.
- detail: 업로드된 원본 PDF 사업자등록증.pdf 를 페이지 이미지로 변환합니다.

```json
{
  "fileName": "사업자등록증.pdf",
  "fileType": "application/pdf",
  "fileSize": 1938473
}
```

### 2026-04-23T03:44:37.806Z

- level: info
- phase: uploading
- percent: 18
- stage: 원본 PDF를 측정 서버로 업로드하고 있습니다.
- detail: 업로드 100%

### 2026-04-23T03:44:37.808Z

- level: info
- phase: rendering_pdf
- percent: 22
- stage: 서버 PDF/HTML 렌더 대기
- detail: 업로드가 끝나 서버에서 PDF PNG와 HTML PNG 생성을 시작합니다.

### 2026-04-23T03:45:02.733Z

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

### 2026-04-23T03:45:02.736Z

- level: info
- phase: rendering_html
- percent: 52
- stage: 서버에서 output HTML 페이지 PNG 렌더를 시작했습니다.
- detail: Headless Chrome 으로 추출 HTML을 페이지별 PNG 스크린샷으로 만듭니다.

```json
{
  "htmlLength": 90879
}
```

### 2026-04-23T03:45:04.451Z

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

### 2026-04-23T03:45:04.463Z

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

### 2026-04-23T03:45:04.465Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF 렌더 이미지를 준비하고 있습니다.
- detail: 원본 PDF 페이지 1개 이미지를 비교용 canvas로 읽고 있습니다.

### 2026-04-23T03:45:04.466Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF 렌더 이미지를 브라우저 캔버스로 정규화하고 있습니다.
- detail: PDF 페이지 준비 1/1

### 2026-04-23T03:45:04.527Z

- level: info
- phase: preparing_replica_pages
- percent: 54
- stage: HTML 렌더 이미지를 준비하고 있습니다.
- detail: 서버가 렌더한 HTML 페이지 1개 이미지를 비교용 canvas로 읽고 있습니다.

### 2026-04-23T03:45:04.528Z

- level: info
- phase: preparing_replica_pages
- percent: 54
- stage: 서버에서 렌더된 HTML 페이지 PNG를 브라우저 캔버스로 정규화하고 있습니다.
- detail: HTML 페이지 준비 1/1

### 2026-04-23T03:45:04.579Z

- level: info
- phase: comparing_pages
- percent: 78
- stage: 페이지별 픽셀을 비교하고 있습니다.
- detail: 픽셀 비교 1/1

### 2026-04-23T03:45:04.793Z

- level: info
- phase: aggregating
- percent: 96
- stage: 최종 시각 유사도를 집계하고 있습니다.
- detail: 페이지별 frame/text overlap 결과를 분리해 최종 프레임 일치율을 계산하고 있습니다.

## Final Status

- finishedAt: 2026-04-23T03:45:04.794Z
- status: completed
- summary: 1px 허용 오차 기준 프레임 중첩률 54.81%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measured": true,
  "measurementMode": "server_headless_chrome_capture",
  "tolerancePx": 1,
  "minimumPassScore": 0.95,
  "passed": false,
  "overallScore": 0.548061980409552,
  "scoreMode": "combined_ink_overlap",
  "frameScore": 0.548061980409552,
  "textScore": 0.548061980409552,
  "combinedScore": 0.548061980409552,
  "measuredAt": "2026-04-23T03:45:04.791Z",
  "pageCount": 1,
  "notes": [
    "source_pdf_png_vs_server_headless_chrome_screenshot",
    "ink_union_overlap_ratio_with_1px_tolerance",
    "replica_capture_modes:server_headless_chrome",
    "primary_score:combined_ink_overlap",
    "combined_score:available",
    "text_score:reported_not_primary"
  ],
  "pageReports": [
    {
      "pageNumber": 1,
      "width": 1524,
      "height": 2156,
      "sourceInkPixelCount": 1120447,
      "replicaInkPixelCount": 2294628,
      "unionInkPixelCount": 2297242,
      "overlapInkPixelCount": 1259031,
      "exactOverlapInkPixelCount": 1117833,
      "overlapRatio": 0.548061980409552,
      "exactOverlapRatio": 0.4865978421080583,
      "mismatchRatio": 0.451938019590448,
      "frameLayerReport": {
        "sourceInkPixelCount": 0,
        "replicaInkPixelCount": 0,
        "unionInkPixelCount": 0,
        "overlapInkPixelCount": 0,
        "exactOverlapInkPixelCount": 0,
        "overlapRatio": 0,
        "exactOverlapRatio": 0,
        "mismatchRatio": 0
      },
      "textLayerReport": {
        "sourceInkPixelCount": 1120447,
        "replicaInkPixelCount": 2294628,
        "unionInkPixelCount": 2297242,
        "overlapInkPixelCount": 1259031,
        "exactOverlapInkPixelCount": 1117833,
        "overlapRatio": 0.548061980409552,
        "exactOverlapRatio": 0.4865978421080583,
        "mismatchRatio": 0.451938019590448
      },
      "notes": [
        "replica_capture_mode:server_headless_chrome",
        "score_mode:combined_ink_overlap",
        "source_frame_mask:long_axis_runs_24px",
        "replica_frame_mask:long_axis_runs_24px",
        "frame_mask_union_missing"
      ]
    }
  ]
}
```
