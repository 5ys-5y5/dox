# PRINT-03 Diff Note

- 목적: `v28` 에서 frame layer 로 유입되던 mask 기반 text-like micro segment 를 `v29` 에서 차단하고, frame source 정책을 trace/log 에 남기기 위함.
- 범위: `templateExtractPdfHtmlCloneService`, `templateExtractPdfService`, `templateExtractVersionService`, `templateExtractReplicaHtmlNormalizerService`, `templateExtractDtos`, `print.md`

## Measurement Summary

- 샘플: `docs/작업지시서_대구침산더샵.pdf`
- `v28`: `39.12%`
  - cloneBuilder: `work_order_family_frame_segment_text_layer_digital`
  - frame source: `mask_vector`
  - frame segments: `6088`
- `v29` 초기: `27.94%`
  - cloneBuilder: `work_order_family_frame_rule_geometry_text_layer_digital`
  - frame source: `rule_geometry`
  - frame segments: `148`
- `v29` 최고 유지 상태: `34.75%`
  - cloneBuilder: `work_order_family_frame_rule_geometry_text_layer_digital`
  - frame source: `rule_only`
  - frame segments: `25`
- `v30` 현재 유지 상태: `37.46%`
  - cloneBuilder: `work_order_family_table_fragment_frame_text_layer_digital`
  - frame policy: `table_fragmented_rule_geometry`
  - frame source: `rule_geometry`
  - frame segments: `31`
  - fragment count: `13`
  - giant table rejected: `true`

## Discarded Experiments

- `rule_snapped_geometry` 보강
  - 결과: `34.63%`
  - 판정: 점수 하락으로 폐기
- outer-band 밖 explicit segment 제거
  - 결과: `34.73%`
  - 판정: 점수 하락으로 폐기
- page-global geometry cluster 를 local table cluster 로 치환
  - 결과: `31.32%`
  - 로그: `docs/2026-04-21_10-58-21_29_template-extract-log_terminal-1776736563522.md`
  - 판정: 페이지 전체를 한 표로 확장해 전폭 수평선이 과다 생성되어 폐기
- row-axis signature 기반 table split
  - 결과: `27.52%`
  - 로그: `docs/2026-04-21_11-01-50_29_template-extract-log_terminal-1776736775274.md`
  - 판정: 섹션 분리는 일부 성공했지만 프레임 누락이 커져 폐기
- explicit rule anchor 기준 row attach
  - 결과: `30.47%`
  - 로그: `docs/2026-04-21_11-05-35_29_template-extract-log_terminal-1776736998256.md`
  - 판정: 전역 격자 팽창은 줄였지만 최고 점수 `34.75%` 를 넘지 못해 폐기
- `v30` giant-table ban 초기 구현
  - 결과: `27.94%`
  - 로그: `docs/2026-04-21_11-33-57_30_template-extract-log_terminal-1776738703906.md`
  - 판정: 설계 반영은 성공했지만 geometry 내부 축 과생성으로 폐기
- `v30` text bbox axis 기반 local fragment
  - 결과: `28.00%`
  - 로그: `docs/2026-04-21_11-37-39_30_template-extract-log_terminal-1776738922804.md`
  - 판정: `row.cells[].x/right` 를 cell border 로 오인해 선이 글자 bbox 위치에 그어져 폐기

## Current V30 Notes

- `v30` 는 text bbox (`row.cells[].x/right`) 를 frame 축으로 쓰지 않는다.
- `v30` 는 `rule row band + snapped geometry column edge` 로 내부 수직 span 을 계산한다.
- 공통 outer box 와 full-width row rule 은 유지하되, 내부 수직선은 row-band 별 local span 으로만 생성한다.
- `fragmentCount` 와 `giantTableRejected` 를 trace/html root data attribute 에 남긴다.
- 현재 유지 코드는 `82 -> 31` 세그먼트로 줄였고, `docs/작업지시서_사일동 주상복합.pdf` 기준 `37.46%` 로 `v29` 최고 `34.75%` 를 넘겼다.
- 로그: `docs/2026-04-21_12-11-21_30_template-extract-log_terminal-1776740941982.md`
