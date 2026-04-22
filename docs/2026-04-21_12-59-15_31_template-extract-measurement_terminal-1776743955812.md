# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T03:59:15.813Z
- draftId: terminal-1776743955812
- sourceTitle: 작업지시서_사일동 주상복합
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 31

## Events

### 2026-04-21T03:59:15.813Z

- level: info
- phase: resolving_source
- percent: 5
- stage: 터미널에서 PDF -> HTML 초안 생성을 시작했습니다.
- detail: 작업지시서_사일동 주상복합.pdf / engineVersion=31

```json
{
  "filePath": "docs/작업지시서_사일동 주상복합.pdf",
  "fileName": "작업지시서_사일동 주상복합.pdf",
  "version": "31"
}
```

### 2026-04-21T04:00:49.625Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_table_fragment_frame_mask_edge_text_layer_digital / htmlLength=44079

```json
{
  "sourceKind": "html",
  "pipelineTrace": {
    "engineVersion": "31",
    "sourceMode": "digital",
    "documentFamily": "work_order",
    "familyConfidenceScore": 0.97,
    "familyDetectionReasons": [
      "source-mode:text-pages(1)",
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
    "cloneBuilder": "work_order_family_table_fragment_frame_mask_edge_text_layer_digital",
    "frameDiagnostics": {
      "policy": "table_fragmented_rule_geometry_mask_edges",
      "source": "mixed",
      "segmentCount": 31,
      "horizontalSegmentCount": 18,
      "verticalSegmentCount": 13,
      "maskVectorEnabled": true,
      "maskVectorPageCount": 1,
      "maskRuleMinLength": 18,
      "fragmentCount": 13,
      "giantTableRejected": true
    }
  }
}
```

### 2026-04-21T04:01:14.640Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-21T04:01:40.192Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 37.46%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measuredAt": "2026-04-21T04:01:40Z",
  "passed": false,
  "pageCount": 1,
  "measured": true,
  "measurementMode": "server_swift_template_render",
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v31"
  ],
  "minimumPassScore": 0.95,
  "tolerancePx": 1,
  "pageReports": [
    {
      "replicaInkPixelCount": 223772,
      "height": 1684,
      "unionInkPixelCount": 494343,
      "exactOverlapInkPixelCount": 134785,
      "width": 1190,
      "exactOverlapRatio": 0.27265481659495533,
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ],
      "mismatchRatio": 0.6254402307709425,
      "overlapInkPixelCount": 185161,
      "overlapRatio": 0.37455976922905754,
      "pageNumber": 1,
      "sourceInkPixelCount": 405356
    }
  ],
  "overallScore": 0.37455976922905754
}
```
