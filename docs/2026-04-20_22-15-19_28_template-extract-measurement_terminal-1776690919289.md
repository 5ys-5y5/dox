# Template Extract Visual Measurement Log

- startedAt: 2026-04-20T13:15:19.289Z
- draftId: terminal-1776690919289
- sourceTitle: 작업지시서_사일동 주상복합
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 28

## Events

### 2026-04-20T13:15:19.290Z

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

### 2026-04-20T13:16:44.889Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_frame_segment_text_layer_digital / htmlLength=41878

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

### 2026-04-20T13:17:08.795Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-20T13:17:33.570Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 35.70%
- errorMessage: -

### Visual Similarity Report

```json
{
  "minimumPassScore": 0.95,
  "passed": false,
  "measured": true,
  "overallScore": 0.35703856605458184,
  "pageReports": [
    {
      "exactOverlapRatio": 0.26155619856204093,
      "replicaInkPixelCount": 210701,
      "width": 1190,
      "height": 1684,
      "mismatchRatio": 0.6429614339454182,
      "overlapInkPixelCount": 174353,
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ],
      "overlapRatio": 0.35703856605458184,
      "exactOverlapInkPixelCount": 127726,
      "unionInkPixelCount": 488331,
      "pageNumber": 1,
      "sourceInkPixelCount": 405356
    }
  ],
  "tolerancePx": 1,
  "measurementMode": "server_swift_template_render",
  "measuredAt": "2026-04-20T13:17:33Z",
  "pageCount": 1,
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v28"
  ]
}
```
