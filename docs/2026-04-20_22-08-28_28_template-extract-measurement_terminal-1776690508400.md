# Template Extract Visual Measurement Log

- startedAt: 2026-04-20T13:08:28.401Z
- draftId: terminal-1776690508400
- sourceTitle: 작업지시서_사일동 주상복합
- sourceFileName: 작업지시서_사일동 주상복합.pdf
- engineVersion: 28

## Events

### 2026-04-20T13:08:28.401Z

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

### 2026-04-20T13:09:55.157Z

- level: info
- phase: resolved_source
- percent: 22
- stage: PDF -> HTML 초안 생성을 완료했습니다.
- detail: cloneBuilder=work_order_family_frame_segment_text_layer_digital / htmlLength=52320

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

### 2026-04-20T13:10:22.715Z

- level: info
- phase: rendering_pdf
- percent: 48
- stage: 원본 PDF 페이지 PNG 렌더를 완료했습니다.
- detail: pageCount=1

## Final Status

- finishedAt: 2026-04-20T13:10:45.264Z
- status: failed
- summary: 터미널 측정 실행 중 오류가 발생했습니다.
- errorMessage: Command failed: swift /var/folders/w2/nbwrk2bs51j3nhj5f4rysvcc0000gn/T/template-extract-replica-measure-VhK7n2/replica-measure.swift /var/folders/w2/nbwrk2bs51j3nhj5f4rysvcc0000gn/T/template-extract-replica-measure-VhK7n2/replica-measure-input.json
/var/folders/w2/nbwrk2bs51j3nhj5f4rysvcc0000gn/T/template-extract-replica-measure-VhK7n2/replica-measure.swift:169:89: error: multi-line string literal content must begin on a new line
167 | 
168 |   if let familyHint {
169 |     for family in familyHint.split(separator: ",").map({ $0.replacingOccurrences(of: """, with: "").trimmingCharacters(in: .whitespacesAndNewlines) }) {
    |                                                                                         `- error: multi-line string literal content must begin on a new line
170 |       if let font = NSFont(name: family, size: size) {
171 |         return font

/var/folders/w2/nbwrk2bs51j3nhj5f4rysvcc0000gn/T/template-extract-replica-measure-VhK7n2/replica-measure.swift:169:86: error: unterminated string literal
167 | 
168 |   if let familyHint {
169 |     for family in familyHint.split(separator: ",").map({ $0.replacingOccurrences(of: """, with: "").trimmingCharacters(in: .whitespacesAndNewlines) }) {
    |                                                                                      `- error: unterminated string literal
170 |       if let font = NSFont(name: family, size: size) {
171 |         return font

/var/folders/w2/nbwrk2bs51j3nhj5f4rysvcc0000gn/T/template-extract-replica-measure-VhK7n2/replica-measure.swift:622:1: error: expected '}' at end of closure
167 | 
168 |   if let familyHint {
169 |     for family in familyHint.split(separator: ",").map({ $0.replacingOccurrences(of: """, with: "").trimmingCharacters(in: .whitespacesAndNewlines) }) {
    |                                                        `- note: to match this opening '{'
170 |       if let font = NSFont(name: family, size: size) {
171 |         return font
    :
620 | let data = try JSONEncoder().encode(output)
621 | print(String(data: data, encoding: .utf8) ?? "{}")
622 | 
    | `- error: expected '}' at end of closure

/var/folders/w2/nbwrk2bs51j3nhj5f4rysvcc0000gn/T/template-extract-replica-measure-VhK7n2/replica-measure.swift:622:1: error: expected '{' to start the body of for-each loop
620 | let data = try JSONEncoder().encode(output)
621 | print(String(data: data, encoding: .utf8) ?? "{}")
622 | 
    | `- error: expected '{' to start the body of for-each loop

/var/folders/w2/nbwrk2bs51j3nhj5f4rysvcc0000gn/T/template-extract-replica-measure-VhK7n2/replica-measure.swift:622:1: error: expected '}' at end of brace statement
166 |   let systemWeight: NSFont.Weight = weight >= 600 ? .bold : .medium
167 | 
168 |   if let familyHint {
    |                     `- note: to match this opening '{'
169 |     for family in familyHint.split(separator: ",").map({ $0.replacingOccurrences(of: """, with: "").trimmingCharacters(in: .whitespacesAndNewlines) }) {
170 |       if let font = NSFont(name: family, size: size) {
    :
620 | let data = try JSONEncoder().encode(output)
621 | print(String(data: data, encoding: .utf8) ?? "{}")
622 | 
    | `- error: expected '}' at end of brace statement

/var/folders/w2/nbwrk2bs51j3nhj5f4rysvcc0000gn/T/template-extract-replica-measure-VhK7n2/replica-measure.swift:622:1: error: expected '}' at end of brace statement
163 | }
164 | 
165 | func makeFont(size: CGFloat, weight: Double, familyHint: String?) -> NSFont {
    |                                                                             `- note: to match this opening '{'
166 |   let systemWeight: NSFont.Weight = weight >= 600 ? .bold : .medium
167 | 
    :
620 | let data = try JSONEncoder().encode(output)
621 | print(String(data: data, encoding: .utf8) ?? "{}")
622 | 
    | `- error: expected '}' at end of brace statement

/var/folders/w2/nbwrk2bs51j3nhj5f4rysvcc0000gn/T/template-extract-replica-measure-VhK7n2/replica-measure.swift:169:81: error: missing arguments for parameters 'of', 'with' in call
167 | 
168 |   if let familyHint {
169 |     for family in familyHint.split(separator: ",").map({ $0.replacingOccurrences(of: """, with: "").trimmingCharacters(in: .whitespacesAndNewlines) }) {
    |                                                                                 `- error: missing arguments for parameters 'of', 'with' in call
170 |       if let font = NSFont(name: family, size: size) {
171 |         return font

Foundation.StringProtocol.replacingOccurrences:2:13: note: 'replacingOccurrences(of:with:options:range:)' declared here
1 | protocol StringProtocol {
2 | public func replacingOccurrences<Target, Replacement>(of target: Target, with replacement: Replacement, options: String.CompareOptions = [], range searchRange: Range<Self.Index>? = nil) -> String where Target : StringProtocol, Replacement : StringProtocol}
  |             `- note: 'replacingOccurrences(of:with:options:range:)' declared here
3 |

### Visual Similarity Report

```json
null
```
