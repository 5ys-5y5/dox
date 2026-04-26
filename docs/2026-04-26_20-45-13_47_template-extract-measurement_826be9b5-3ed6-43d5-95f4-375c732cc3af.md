# Template Extract Visual Measurement Log

- startedAt: 2026-04-26T11:45:13.587Z
- draftId: 826be9b5-3ed6-43d5-95f4-375c732cc3af
- sourceTitle: 안전관리계획서 입력본
- sourceFileName: 사업자등록증.pdf
- engineVersion: 47

## Events

### 2026-04-26T11:45:13.654Z

- level: info
- phase: prepare
- percent: 2
- stage: 시각 유사도 측정 준비
- detail: 원본 PDF와 output HTML 비교 세션을 시작했습니다.

```json
{
  "draftId": "826be9b5-3ed6-43d5-95f4-375c732cc3af",
  "sourceTitle": "안전관리계획서 입력본",
  "sourceFileName": "사업자등록증.pdf"
}
```

### 2026-04-26T11:45:13.660Z

- level: info
- phase: uploading
- percent: 4
- stage: 원본 PDF 업로드를 시작했습니다.
- detail: 사업자등록증.pdf

```json
{
  "fileName": "사업자등록증.pdf",
  "fileType": "application/pdf",
  "fileSize": 1938473
}
```

### 2026-04-26T11:45:13.672Z

- level: info
- phase: rendering_pdf
- percent: 24
- stage: 서버에서 PDF 페이지 PNG 렌더를 시작했습니다.
- detail: 업로드된 원본 PDF 사업자등록증.pdf 를 페이지 이미지로 변환합니다.

```json
{
  "fileName": "사업자등록증.pdf",
  "fileType": "application/pdf",
  "fileSize": 1938473
}
```

### 2026-04-26T11:45:13.764Z

- level: info
- phase: uploading
- percent: 18
- stage: 원본 PDF를 측정 서버로 업로드하고 있습니다.
- detail: 업로드 100%

### 2026-04-26T11:45:13.766Z

- level: info
- phase: rendering_pdf
- percent: 22
- stage: 서버 PDF/HTML 렌더 대기
- detail: 업로드가 끝나 서버에서 PDF PNG와 HTML PNG 생성을 시작합니다.

### 2026-04-26T11:45:47.013Z

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

### 2026-04-26T11:45:47.014Z

- level: info
- phase: rendering_html
- percent: 52
- stage: 서버에서 output HTML 페이지 PNG 렌더를 시작했습니다.
- detail: Headless Chrome 으로 추출 HTML을 페이지별 PNG 스크린샷으로 만듭니다.

```json
{
  "htmlLength": 90382
}
```

### 2026-04-26T11:45:48.794Z

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

### 2026-04-26T11:45:48.813Z

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

### 2026-04-26T11:45:48.815Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF 렌더 이미지를 준비하고 있습니다.
- detail: 원본 PDF 페이지 1개 이미지를 비교용 canvas로 읽고 있습니다.

### 2026-04-26T11:45:48.816Z

- level: info
- phase: preparing_pdf_pages
- percent: 42
- stage: PDF 렌더 이미지를 브라우저 캔버스로 정규화하고 있습니다.
- detail: PDF 페이지 준비 1/1

### 2026-04-26T11:45:48.952Z

- level: info
- phase: preparing_replica_pages
- percent: 54
- stage: HTML 렌더 이미지를 준비하고 있습니다.
- detail: 서버가 렌더한 HTML 페이지 1개 이미지를 비교용 canvas로 읽고 있습니다.

### 2026-04-26T11:45:48.956Z

- level: info
- phase: preparing_replica_pages
- percent: 54
- stage: 서버에서 렌더된 HTML 페이지 PNG를 브라우저 캔버스로 정규화하고 있습니다.
- detail: HTML 페이지 준비 1/1

### 2026-04-26T11:45:49.111Z

- level: info
- phase: comparing_pages
- percent: 78
- stage: 페이지별 픽셀을 비교하고 있습니다.
- detail: 픽셀 비교 1/1

### 2026-04-26T11:45:49.328Z

- level: info
- phase: aggregating
- percent: 96
- stage: 최종 시각 유사도를 집계하고 있습니다.
- detail: 페이지별 frame/text overlap 결과를 분리해 최종 프레임 일치율을 계산하고 있습니다.

## Final Status

- finishedAt: 2026-04-26T11:45:49.334Z
- status: completed
- summary: 1px 허용 오차 기준 프레임 중첩률 20.16%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measured": true,
  "measurementMode": "server_headless_chrome_capture",
  "tolerancePx": 1,
  "minimumPassScore": 0.95,
  "passed": false,
  "overallScore": 0.20161249343654195,
  "scoreMode": "frame_ink_overlap",
  "frameScore": 0.20161249343654195,
  "textScore": 0.08146429392896223,
  "combinedScore": 0.10114503973990523,
  "measuredAt": "2026-04-26T11:45:49.320Z",
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
      "sourceInkPixelCount": 1120447,
      "replicaInkPixelCount": 170578,
      "unionInkPixelCount": 1214019,
      "overlapInkPixelCount": 122792,
      "exactOverlapInkPixelCount": 77006,
      "overlapRatio": 0.10114503973990523,
      "exactOverlapRatio": 0.06343063823548066,
      "mismatchRatio": 0.8988549602600948,
      "frameLayerReport": {
        "sourceInkPixelCount": 148468,
        "replicaInkPixelCount": 46586,
        "unionInkPixelCount": 177117,
        "overlapInkPixelCount": 35709,
        "exactOverlapInkPixelCount": 17937,
        "overlapRatio": 0.20161249343654195,
        "exactOverlapRatio": 0.10127204051559138,
        "mismatchRatio": 0.798387506563458
      },
      "textLayerReport": {
        "sourceInkPixelCount": 971979,
        "replicaInkPixelCount": 123992,
        "unionInkPixelCount": 1039081,
        "overlapInkPixelCount": 84648,
        "exactOverlapInkPixelCount": 56890,
        "overlapRatio": 0.08146429392896223,
        "exactOverlapRatio": 0.054750303393094474,
        "mismatchRatio": 0.9185357060710377
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
