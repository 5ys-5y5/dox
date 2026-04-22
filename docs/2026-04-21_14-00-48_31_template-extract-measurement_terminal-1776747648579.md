# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T05:00:48.579Z
- draftId: terminal-1776747648579
- sourceTitle: 작업지시서_사일동 주상복합
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 31

## Events

### 2026-04-21T05:00:48.580Z

- level: info
- phase: resolving_source
- percent: 5
- stage: 터미널에서 PDF -> HTML 초안 생성을 시작했습니다.
- detail: 작업지시서_사일동 주상복합.pdf / engineVersion=31

```json
{
  "filePath": "docs/작업지시서_사일동 주상복합.pdf",
  "fileName": "작업지시서_사일동 주상복합.pdf",
  "version": "31"
}
```

### 2026-04-21T05:03:17.713Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_table_fragment_frame_mask_edge_text_layer_digital / htmlLength=44905

```json
{
  "sourceKind": "html",
  "pipelineTrace": {
    "engineVersion": "31",
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

### 2026-04-21T05:04:00.406Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-21T05:04:45.869Z
- status: completed
- summary: 1px 허용 오차 기준 프레임 중첩률 3.27%
- errorMessage: -

### Visual Similarity Report

```json
{
  "passed": false,
  "tolerancePx": 1,
  "measurementMode": "server_swift_template_render",
  "measured": true,
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v31",
    "primary_score:frame_ink_overlap",
    "combined_score:available",
    "text_score:reported_not_primary"
  ],
  "scoreMode": "frame_ink_overlap",
  "overallScore": 0.032659493533311594,
  "measuredAt": "2026-04-21T05:04:45Z",
  "combinedScore": 0.4293842680068724,
  "textScore": 0.28712695785501735,
  "pageReports": [
    {
      "frameLayerReport": {
        "overlapInkPixelCount": 2404,
        "overlapRatio": 0.032659493533311594,
        "replicaInkPixelCount": 73602,
        "exactOverlapInkPixelCount": 1920,
        "unionInkPixelCount": 73608,
        "exactOverlapRatio": 0.026084121291164004,
        "mismatchRatio": 0.9673405064666885,
        "sourceInkPixelCount": 1926
      },
      "width": 1190,
      "height": 1684,
      "unionInkPixelCount": 466794,
      "sourceInkPixelCount": 405356,
      "replicaInkPixelCount": 214260,
      "notes": [
        "replica_render_mode:server_swift_template_render",
        "score_mode:frame_ink_overlap",
        "source_frame_mask:long_axis_runs_24px"
      ],
      "exactOverlapInkPixelCount": 152822,
      "mismatchRatio": 0.5706157319931275,
      "pageNumber": 1,
      "exactOverlapRatio": 0.3273863845722096,
      "overlapInkPixelCount": 200434,
      "textLayerReport": {
        "overlapInkPixelCount": 129587,
        "overlapRatio": 0.28712695785501735,
        "replicaInkPixelCount": 141432,
        "exactOverlapInkPixelCount": 93539,
        "unionInkPixelCount": 451323,
        "exactOverlapRatio": 0.20725511440808467,
        "mismatchRatio": 0.7128730421449827,
        "sourceInkPixelCount": 403430
      },
      "overlapRatio": 0.4293842680068724
    }
  ],
  "frameScore": 0.032659493533311594,
  "pageCount": 1,
  "minimumPassScore": 0.95
}
```
