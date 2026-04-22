# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T04:56:08.178Z
- draftId: terminal-1776747368177
- sourceTitle: 작업지시서_사일동 주상복합
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 31

## Events

### 2026-04-21T04:56:08.178Z

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

### 2026-04-21T04:58:27.379Z

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

### 2026-04-21T04:59:08.234Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-21T04:59:51.146Z
- status: completed
- summary: 1px 허용 오차 기준 프레임 중첩률 21.74%
- errorMessage: -

### Visual Similarity Report

```json
{
  "textScore": 0.5144405693826272,
  "scoreMode": "frame_ink_overlap",
  "minimumPassScore": 0.95,
  "tolerancePx": 1,
  "overallScore": 0.2173503426307536,
  "combinedScore": 0.4293842680068724,
  "measuredAt": "2026-04-21T04:59:51Z",
  "measurementMode": "server_swift_template_render",
  "passed": false,
  "pageCount": 1,
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v31",
    "primary_score:frame_ink_overlap",
    "combined_score:available",
    "text_score:reported_not_primary"
  ],
  "measured": true,
  "pageReports": [
    {
      "exactOverlapInkPixelCount": 152822,
      "overlapInkPixelCount": 200434,
      "width": 1190,
      "unionInkPixelCount": 466794,
      "sourceInkPixelCount": 405356,
      "textLayerReport": {
        "unionInkPixelCount": 172327,
        "overlapInkPixelCount": 88652,
        "sourceInkPixelCount": 93927,
        "exactOverlapInkPixelCount": 63032,
        "replicaInkPixelCount": 141432,
        "overlapRatio": 0.5144405693826272,
        "exactOverlapRatio": 0.3657697284813175,
        "mismatchRatio": 0.48555943061737283
      },
      "overlapRatio": 0.4293842680068724,
      "replicaInkPixelCount": 214260,
      "height": 1684,
      "exactOverlapRatio": 0.3273863845722096,
      "pageNumber": 1,
      "frameLayerReport": {
        "unionInkPixelCount": 325861,
        "overlapInkPixelCount": 70826,
        "sourceInkPixelCount": 311429,
        "exactOverlapInkPixelCount": 59170,
        "replicaInkPixelCount": 73602,
        "overlapRatio": 0.2173503426307536,
        "exactOverlapRatio": 0.18158048984076033,
        "mismatchRatio": 0.7826496573692464
      },
      "notes": [
        "replica_render_mode:server_swift_template_render",
        "score_mode:frame_ink_overlap",
        "source_frame_mask:long_axis_runs_24px"
      ],
      "mismatchRatio": 0.5706157319931275
    }
  ],
  "frameScore": 0.2173503426307536
}
```
