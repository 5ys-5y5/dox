# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T02:31:43.906Z
- draftId: terminal-1776738703906
- sourceTitle: 작업지시서_대구침산더샵
- sourceFileName: 작업지시서_대구침산더샵.pdf
- engineVersion: 30

## Events

### 2026-04-21T02:31:43.907Z

- level: info
- phase: resolving_source
- percent: 5
- stage: 터미널에서 PDF -> HTML 초안 생성을 시작했습니다.
- detail: 작업지시서_대구침산더샵.pdf / engineVersion=30

```json
{
  "filePath": "docs/작업지시서_대구침산더샵.pdf",
  "fileName": "작업지시서_대구침산더샵.pdf",
  "version": "30"
}
```

### 2026-04-21T02:33:09.250Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_table_fragment_frame_text_layer_digital / htmlLength=65760

```json
{
  "sourceKind": "html",
  "pipelineTrace": {
    "engineVersion": "30",
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
    "cloneBuilder": "work_order_family_table_fragment_frame_text_layer_digital",
    "frameDiagnostics": {
      "policy": "table_fragmented_rule_geometry",
      "source": "rule_geometry",
      "segmentCount": 144,
      "horizontalSegmentCount": 59,
      "verticalSegmentCount": 85,
      "maskVectorEnabled": false,
      "maskVectorPageCount": 1,
      "maskRuleMinLength": null,
      "fragmentCount": 23,
      "giantTableRejected": true
    }
  }
}
```

### 2026-04-21T02:33:32.788Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-21T02:33:57.628Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 27.94%
- errorMessage: -

### Visual Similarity Report

```json
{
  "pageCount": 1,
  "measured": true,
  "minimumPassScore": 0.95,
  "pageReports": [
    {
      "mismatchRatio": 0.7206328852339143,
      "overlapInkPixelCount": 158169,
      "exactOverlapInkPixelCount": 109411,
      "exactOverlapRatio": 0.19324795246648968,
      "unionInkPixelCount": 566169,
      "height": 1684,
      "sourceInkPixelCount": 427973,
      "replicaInkPixelCount": 247607,
      "overlapRatio": 0.2793671147660857,
      "width": 1190,
      "pageNumber": 1,
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ]
    }
  ],
  "measurementMode": "server_swift_template_render",
  "overallScore": 0.2793671147660857,
  "passed": false,
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v30"
  ],
  "measuredAt": "2026-04-21T02:33:57Z",
  "tolerancePx": 1
}
```
