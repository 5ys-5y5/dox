# Template Extract Visual Measurement Log

- startedAt: 2026-04-21T05:06:07.601Z
- draftId: terminal-1776747967600
- sourceTitle: 작업지시서_사일동 주상복합
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 31

## Events

### 2026-04-21T05:06:07.601Z

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

### 2026-04-21T05:08:37.551Z

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

### 2026-04-21T05:09:18.468Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-21T05:10:05.272Z
- status: completed
- summary: 1px 허용 오차 기준 프레임 중첩률 62.77%
- errorMessage: -

### Visual Similarity Report

```json
{
  "combinedScore": 0.4293842680068724,
  "pageCount": 1,
  "passed": false,
  "notes": [
    "render_model_version:positioned-v1",
    "clone_id:pdf-frame-text-v31",
    "primary_score:frame_ink_overlap",
    "combined_score:available",
    "text_score:reported_not_primary"
  ],
  "overallScore": 0.6277487642568949,
  "scoreMode": "frame_ink_overlap",
  "measuredAt": "2026-04-21T05:10:05Z",
  "measurementMode": "server_swift_template_render",
  "measured": true,
  "tolerancePx": 1,
  "textScore": 0.35957751885471706,
  "pageReports": [
    {
      "sourceInkPixelCount": 405356,
      "height": 1684,
      "exactOverlapRatio": 0.3273863845722096,
      "frameLayerReport": {
        "exactOverlapRatio": 0.5223481738948177,
        "sourceInkPixelCount": 100716,
        "overlapRatio": 0.6277487642568949,
        "replicaInkPixelCount": 73602,
        "exactOverlapInkPixelCount": 59812,
        "overlapInkPixelCount": 71881,
        "mismatchRatio": 0.37225123574310515,
        "unionInkPixelCount": 114506
      },
      "overlapInkPixelCount": 200434,
      "replicaInkPixelCount": 214260,
      "pageNumber": 1,
      "unionInkPixelCount": 466794,
      "mismatchRatio": 0.5706157319931275,
      "overlapRatio": 0.4293842680068724,
      "width": 1190,
      "exactOverlapInkPixelCount": 152822,
      "notes": [
        "replica_render_mode:server_swift_template_render",
        "score_mode:frame_ink_overlap",
        "source_frame_mask:source_ink_near_rendered_frame_segments"
      ],
      "textLayerReport": {
        "exactOverlapRatio": 0.2590660705414804,
        "sourceInkPixelCount": 304640,
        "overlapRatio": 0.35957751885471706,
        "replicaInkPixelCount": 141432,
        "exactOverlapInkPixelCount": 91784,
        "overlapInkPixelCount": 127394,
        "mismatchRatio": 0.640422481145283,
        "unionInkPixelCount": 354288
      }
    }
  ],
  "minimumPassScore": 0.95,
  "frameScore": 0.6277487642568949
}
```
