# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T00:34:03.457Z
- draftId: terminal-1776731643457
- sourceTitle: 작업지시서_대구침산더샵
- sourceFileName: 작업지시서_대구침산더샵.pdf
- engineVersion: 29

## Events

### 2026-04-21T00:34:03.458Z

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

### 2026-04-21T00:35:31.149Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_frame_rule_geometry_text_layer_digital / htmlLength=40696

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
      "segmentCount": 24,
      "horizontalSegmentCount": 17,
      "verticalSegmentCount": 7,
      "maskVectorEnabled": false,
      "maskVectorPageCount": 1,
      "maskRuleMinLength": null
    }
  }
}
```

### 2026-04-21T00:35:55.177Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-21T00:36:20.425Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 34.73%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measuredAt": "2026-04-21T00:36:20Z",
  "pageCount": 1,
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v29"
  ],
  "overallScore": 0.3473071108233863,
  "tolerancePx": 1,
  "measurementMode": "server_swift_template_render",
  "pageReports": [
    {
      "height": 1684,
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ],
      "overlapRatio": 0.3473071108233863,
      "unionInkPixelCount": 511291,
      "overlapInkPixelCount": 177575,
      "width": 1190,
      "sourceInkPixelCount": 427973,
      "exactOverlapInkPixelCount": 129161,
      "replicaInkPixelCount": 212479,
      "exactOverlapRatio": 0.25261739400850003,
      "mismatchRatio": 0.6526928891766137,
      "pageNumber": 1
    }
  ],
  "measured": true,
  "passed": false,
  "minimumPassScore": 0.9
}
```
