# Template Extract Visual Measurement Log

- startedAt: 2026-04-20T12:51:27.300Z
- draftId: terminal-1776689487299
- sourceTitle: 작업지시서_사일동 주상복합
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 28

## Events

### 2026-04-20T12:51:27.300Z

- level: info
- phase: resolving_source
- percent: 5
- stage: 터미널에서 PDF -> HTML 초안 생성을 시작했습니다.
- detail: 작업지시서_사일동 주상복합.pdf / engineVersion=28

```json
{
  "filePath": "docs/작업지시서_사일동 주상복합.pdf",
  "fileName": "작업지시서_사일동 주상복합.pdf",
  "version": "28"
}
```

### 2026-04-20T12:52:27.966Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_frame_segment_text_layer_digital / htmlLength=69181

```json
{
  "sourceKind": "html",
  "pipelineTrace": {
    "engineVersion": "28",
    "sourceMode": "digital",
    "documentFamily": "work_order",
    "familyConfidenceScore": 0.99,
    "familyDetectionReasons": [
      "source-mode:text-pages(1)",
      "source-hint:작업지시서",
      "text-signal:작업지시서",
      "text-signal:공사내용",
      "text-signal:하도급대금",
      "text-signal:공사착수일",
      "text-signal:공사완료일",
      "text-signal:발급자서명",
      "text-signal:ce",
      "text-signal:pm"
    ],
    "topologySummary": {
      "pageCount": 1,
      "rowBandCount": 35,
      "columnEdgeCount": 25,
      "horizontalSegmentCount": 0,
      "verticalSegmentCount": 0,
      "textBlockCount": 72,
      "cellCandidateCount": 72
    },
    "cloneBuilder": "work_order_family_frame_segment_text_layer_digital"
  }
}
```

### 2026-04-20T12:52:51.578Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-20T12:53:16.981Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 28.47%
- errorMessage: -

### Visual Similarity Report

```json
{
  "minimumPassScore": 0.95,
  "pageCount": 1,
  "overallScore": 0.2847088806811334,
  "tolerancePx": 1,
  "pageReports": [
    {
      "sourceInkPixelCount": 405356,
      "overlapRatio": 0.2847088806811334,
      "unionInkPixelCount": 564236,
      "replicaInkPixelCount": 268909,
      "width": 1190,
      "exactOverlapInkPixelCount": 110029,
      "height": 1684,
      "pageNumber": 1,
      "exactOverlapRatio": 0.19500528147796312,
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ],
      "overlapInkPixelCount": 160643,
      "mismatchRatio": 0.7152911193188666
    }
  ],
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v28"
  ],
  "measurementMode": "server_swift_template_render",
  "measured": true,
  "measuredAt": "2026-04-20T12:53:16Z",
  "passed": false
}
```
