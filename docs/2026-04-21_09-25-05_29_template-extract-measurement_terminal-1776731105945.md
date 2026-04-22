# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T00:25:05.946Z
- draftId: terminal-1776731105945
- sourceTitle: 작업지시서_대구침산더샵
- sourceFileName: 작업지시서_대구침산더샵.pdf
- engineVersion: 29

## Events

### 2026-04-21T00:25:05.946Z

- level: info
- phase: resolving_source
- percent: 5
- stage: 터미널에서 PDF -> HTML 초안 생성을 시작했습니다.
- detail: 작업지시서_대구침산더샵.pdf / engineVersion=29

```json
{
  "filePath": "docs/작업지시서_대구침산더샵.pdf",
  "fileName": "작업지시서_대구침산더샵.pdf",
  "version": "29"
}
```

### 2026-04-21T00:26:31.965Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_frame_rule_geometry_text_layer_digital / htmlLength=39730

```json
{
  "sourceKind": "html",
  "pipelineTrace": {
    "engineVersion": "29",
    "sourceMode": "digital",
    "documentFamily": "work_order",
    "familyConfidenceScore": 0.99,
    "familyDetectionReasons": [
      "source-mode:text-pages(1)",
      "source-hint:작업지시서",
      "text-signal:작업지시서",
      "text-signal:공사내용",
      "text-signal:대표수량및단가",
      "text-signal:하도급대금",
      "text-signal:공사착수일",
      "text-signal:공사완료일",
      "text-signal:발급자서명",
      "text-signal:ce",
      "text-signal:pm"
    ],
    "topologySummary": {
      "pageCount": 1,
      "rowBandCount": 34,
      "columnEdgeCount": 24,
      "horizontalSegmentCount": 0,
      "verticalSegmentCount": 0,
      "textBlockCount": 69,
      "cellCandidateCount": 69
    },
    "cloneBuilder": "work_order_family_frame_rule_geometry_text_layer_digital",
    "frameDiagnostics": {
      "policy": "rule_geometry_only",
      "source": "rule_only",
      "segmentCount": 19,
      "horizontalSegmentCount": 17,
      "verticalSegmentCount": 2,
      "maskVectorEnabled": false,
      "maskVectorPageCount": 1,
      "maskRuleMinLength": null
    }
  }
}
```

### 2026-04-21T00:26:55.499Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-21T00:27:19.993Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 33.36%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measuredAt": "2026-04-21T00:27:19Z",
  "passed": false,
  "tolerancePx": 1,
  "overallScore": 0.33359708188601317,
  "measurementMode": "server_swift_template_render",
  "minimumPassScore": 0.9,
  "measured": true,
  "pageCount": 1,
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v29"
  ],
  "pageReports": [
    {
      "unionInkPixelCount": 505532,
      "exactOverlapRatio": 0.2412132169674719,
      "width": 1190,
      "overlapRatio": 0.33359708188601317,
      "replicaInkPixelCount": 199500,
      "sourceInkPixelCount": 427973,
      "pageNumber": 1,
      "overlapInkPixelCount": 168644,
      "height": 1684,
      "exactOverlapInkPixelCount": 121941,
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ],
      "mismatchRatio": 0.6664029181139868
    }
  ]
}
```
