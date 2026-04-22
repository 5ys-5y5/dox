# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T00:27:57.857Z
- draftId: terminal-1776731277856
- sourceTitle: 작업지시서_대구침산더샵
- sourceFileName: 작업지시서_대구침산더샵.pdf
- engineVersion: 29

## Events

### 2026-04-21T00:27:57.857Z

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

### 2026-04-21T00:29:24.574Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_frame_rule_geometry_text_layer_digital / htmlLength=39924

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
      "segmentCount": 20,
      "horizontalSegmentCount": 17,
      "verticalSegmentCount": 3,
      "maskVectorEnabled": false,
      "maskVectorPageCount": 1,
      "maskRuleMinLength": null
    }
  }
}
```

### 2026-04-21T00:29:48.457Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-21T00:30:14.163Z
- status: completed
- summary: 1px 허용 오차 기준 중첩률 33.38%
- errorMessage: -

### Visual Similarity Report

```json
{
  "measured": true,
  "passed": false,
  "minimumPassScore": 0.9,
  "pageReports": [
    {
      "exactOverlapInkPixelCount": 122010,
      "mismatchRatio": 0.6662387346399437,
      "notes": [
        "replica_render_mode:server_swift_template_render"
      ],
      "sourceInkPixelCount": 427973,
      "replicaInkPixelCount": 199569,
      "unionInkPixelCount": 505532,
      "width": 1190,
      "height": 1684,
      "overlapInkPixelCount": 168727,
      "pageNumber": 1,
      "overlapRatio": 0.33376126536005635,
      "exactOverlapRatio": 0.2413497068434837
    }
  ],
  "measuredAt": "2026-04-21T00:30:14Z",
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v29"
  ],
  "pageCount": 1,
  "tolerancePx": 1,
  "measurementMode": "server_swift_template_render",
  "overallScore": 0.33376126536005635
}
```
