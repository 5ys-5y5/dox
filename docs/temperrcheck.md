# Canvas Error Check

대상 템플릿: `b805257f-37ea-40a0-85d3-6bb74f5bde24`  
대상 페이지: `http://localhost:3001/canvas?templateId=b805257f-37ea-40a0-85d3-6bb74f5bde24`

목표: 모든 상자와 상자 종류에 대해 입력, 자동 높이, peer edge, 첨부파일, 서명, 모드 전환 시의 geometry 안정성을 실제 브라우저에서 반복 검증하고, 발견 이슈를 원인군으로 묶어 공용 `TemplateEditWorkspace`에서만 수정한다.

## 체크리스트
- [x] 페이지 로드 후 미리보기 진입 전/후 레이아웃이 사용자의 입력 없이 변하지 않는지 확인
- [x] 모든 텍스트 입력 상자에 한 줄 입력 후 자기 자신 외 무관 상자의 높이/너비가 변하지 않는지 확인
- [x] 모든 텍스트 입력 상자에 여러 줄 입력 후 peer edge 연동 범위만 높이가 변하는지 확인
- [x] 자동 높이 상자는 줄 수 증가에 따라 의도된 방향으로만 확장되는지 확인
- [x] 자동 높이 상자가 아닌 상자는 줄바꿈이 없을 때 높이 변화가 없는지 확인
- [x] 입력 후 너비가 미세하게 흔들리지 않는지 확인
- [x] 서명 상자에 서명 추가/초기화 시 무관 상자의 높이/너비가 변하지 않는지 확인
- [x] 첨부파일 상자에 파일 추가 전/후/저장 후 여백, 높이, peer edge가 유지되는지 확인
- [x] 첨부파일 상자는 저장 전에도 파일 존재 상태를 올바르게 반영하는지 확인
- [x] 템플릿 / 문서 / 읽기 모드별 동일 템플릿 geometry 일관성이 유지되는지 확인
- [x] 발견된 문제를 원인군으로 묶고 공용 캔버스 코드에서만 수정하는지 확인
- [x] 수정 후 전체 시나리오를 다시 반복하여 재발이 없는지 확인

## 발견 이슈
- `band-8-cell-2`에 한 줄 입력만 해도 `band-8-cell-1..4`가 함께 높아지던 이슈가 있었음
- 템플릿 미리보기 진입 후 사용자의 입력 없이 특정 band의 높이/너비가 뒤늦게 바뀌던 이슈가 있었음
- 첨부파일 / 서명 런타임이 초기화되면서 무관한 peer edge 재계산을 유발하던 이슈가 있었음
- `axes=['height']` 보정이어도 x축 boundary를 다시 통일하면서 여러 행의 width가 미세하게 흔들리던 이슈가 있었음
- multiline 입력 시 `band-3-cell-2`처럼 특정 값 상자 입력이 같은 source band 전체의 width를 재정렬하던 이슈가 있었음
- `signature_image` 런타임 상자가 canvas/clear button 같은 내부 UI 때문에 미리보기 진입 직후 높이를 다시 계산하던 이슈가 있었음
- `attachment` 런타임 상자가 same-side peer cluster의 선행 autosize 계산에 휘말려 실제 컨트롤보다 큰 row height를 점유하던 이슈가 있었음
- DB에 이미 저장된 stale geometry가 다시 로드되면서, 공용 runtime이 고쳐져도 다음 페이지 진입 때 같은 auto-height/width 폭주가 재발하던 이슈가 있었음
- `height:100%` textarea를 가진 한 줄 자동 높이 상자가 현재 렌더 높이를 자연 높이로 오인해, `band-10-cell-1/2`처럼 실제 한 줄 높이로 줄어야 하는 상자가 줄어들지 않던 이슈가 있었음

## 원인군
- `auto-size` 결과가 실제 geometry 변경이 없는데도 preview sync / boundary fit / peer edge sync를 계속 타는 경로
- `textarea` 자연 높이 측정값과 shell 높이 비교가 불안정해서 overflow가 과검출되는 경로
- 첨부파일 / 서명 runtime 초기 state 주입과 초기 autosize attach가 템플릿 미리보기까지 강제로 레이아웃 보정을 수행하는 경로
- preview text input의 현재 inset을 frame height / width 계산에 중복 반영하던 경로
- live autosize가 포커스된 frame이 아니라 같은 peer cluster 전체의 latent 요구 크기를 같이 반영하던 경로
- `syncTemplateUsagePreviewNormalizedBandPeerBounds()`가 `allowWidth=false`여도 current column boundary를 재적용해 폭을 바꾸던 경로
- `measurePeerCluster*=false`여도 `applyTemplateAuto*Boxes()`가 같은 peer cluster 전체 current geometry를 먼저 읽고, 첫 번째 셀의 요구치로 나머지 셀까지 같이 줄이거나 키우던 경로
- `signature_image`는 실제 문서 내용이 아니라 runtime 장식 UI를 갖는데도 이를 content-fit 대상으로 간주하던 경로
- 저장 전 geometry materialize와 로드 후 geometry 복원이 분리돼 있어서, stale HTML이 `initialDraft` / `templateDetail` 경로로 다시 주입되던 경로
- `measureNaturalTextControlHeight()`가 줄바꿈 없는 한 줄 값에서 `currentRenderedHeight`를 하한으로 사용해 stale shell height를 자동 높이 규칙보다 우선시키던 경로

## 수정 내역
- `measureNaturalTextControlHeight()`에서 한 줄 비개행 입력은 현재 렌더 높이를 유지하도록 보정
- preview text input은 frame height / width 계산 시 기존 inset을 다시 더하지 않도록 수정
- live `applyTemplateUsagePreviewAutoSize()`에서 한 줄 비개행·비랩 입력은 autosize를 아예 타지 않도록 short-circuit 추가
- live autosize는 peer cluster 전체 요구치를 재측정하지 않고 현재 포커스 frame 기준으로만 판단하도록 제한
- `syncTemplateUsagePreviewNormalizedBandPeerBounds()`는 `axes=['height']`일 때 x축 위치/폭 및 colSizes를 절대 수정하지 않도록 수정
- `applyTemplateAutoHeightBoxes()` / `applyTemplateAutoWidthBoxes()`는 `measurePeerCluster*=false`일 때 peer cluster 전체를 선행 계산하지 않고 현재 frame만 local delta로 조정한 뒤, 이후 shared peer sync 단계가 geometry를 통일하게 수정
- `signature_image` runtime frame은 preview/document/read 모드에서 current stored geometry를 기준으로 유지하고, canvas/button 같은 runtime 장식으로는 초기 auto-height / auto-width가 바뀌지 않도록 수정
- 첨부파일 추가/삭제 예정/취소, 서명 완료/지우기 같은 runtime state 변경은 상태만 바꾸지 않고 shared autosize + peer sync를 즉시 다시 타게 수정
- `TemplateEditWorkspace` 공용 경로에 load/save 공통 geometry sanitize 단계를 추가해, 템플릿 로드, `initialDraft` 로드, 저장 전 persistence HTML 모두 같은 autosize/peer-sync 기준으로 정규화되게 수정
- 줄바꿈 없는 한 줄 텍스트는 현재 렌더 높이가 아니라 `padding + border + line-height/font-size` 기준의 실제 한 줄 높이를 반환하도록 수정
- 모든 수정은 `src/components/template/TemplateEditWorkspace.tsx` 공용 경로에서만 수행

## 재검증 결과
- `docs/temperrcheck-preview-stability-page17.json`: 무입력 2.2초 대기 후 geometry 변화 `changed: []`
- `docs/temperrcheck-band8-page17-final.json`: `band-8-cell-2` 한 줄 입력 전/후 `band-8-cell-1..4`, `band-9-cell-1/2`, `status-history-1` geometry 변화 없음
- `docs/temperrcheck-singleline-sweep-page17-after-axisfix.json`: 전 값 입력 상자 한 줄 입력 전수 검사 결과 `[]`
- `docs/temperrcheck-multiline-sweep-page17-after-axisfix.json`: 전 값 입력 상자 multiline 입력 전수 검사 결과 `[]`
- `docs/temperrcheck-signature-page17-final.json`: 서명 추가 / 지우기 전후 geometry 변화 없음
- `docs/temperrcheck-attachment-page17-final.json`: 첨부파일 추가 시 empty-state가 즉시 사라지고, 취소 시 복귀하며 폭 흔들림 없음
- `docs/temperrcheck-mode-consistency-document-read.json`: 같은 저장 문서를 `document / read` 모드로 비교했을 때 box `width / height`는 전부 동일하고, `top`만 툴바 유무에 따라 `-81px`로 균일하게 이동

## 2026-05-19 추가 검증
- `docs/temperrcheck-template-preview-initial-current.json`
  템플릿 미리보기 fresh load 직후 `band-8-cell-1..4` 높이 `36/36/36/36`, `status-history-1` `77`, `band-19-cell-2` `77`
- `docs/temperrcheck-template-preview-after2s-current.json`
  2초 후 동일 값 유지. 무입력 상태에서 뒤늦은 `band-8` 높이 변경 재현 안 됨
- `docs/temperrcheck-current-document-band8-band19-aftercontentkey.json`
  문서 모드에서 `band-8-cell-4`, `status-history-1` runtime control 복구 확인
- `docs/temperrcheck-band19-layout-breakdown-current.json`
  첨부파일 box의 실제 내부 구성은 `registered list 130px + gap 4px + upload 30px + top/bottom padding 5px`로 확인됨
- `docs/temperrcheck-document-signature-state-after-persist.json`
  서명 후 저장/재로딩 뒤에도 `status=signed`, `history=[...]`, `imageDataLength>0` 유지 확인
- `docs/temperrcheck-document-attachment-children-after-hide-input.json`
  숨겨진 file input을 `display:none` 처리해 레이아웃 기여 노드 제거
- 2026-05-19 추가: `band-10-cell-1/2` 자동 높이 전환/로드 보정에서 stale shell height가 자연 높이로 남는 문제를 재검증했고, peer sync가 여러 행을 하나의 연속 범위로 병합해 자동 높이 결과를 되돌리는 원인을 추가로 수정함.
- 2026-05-19 추가: 자동 높이 overflow 보정은 측정 함수 결과뿐 아니라 `scrollHeight - clientHeight` 직접값도 하한으로 사용하도록 수정함. 이로써 미리보기 전환 후 `band-18-cell-1`처럼 텍스트가 클리핑된 채 남는 상태를 방지함.
- 2026-05-19 브라우저 확인: `http://localhost:3001/canvas?mode=template&templateId=c782b232-7db6-49c2-a301-9b575144def4` 로드 후 3초 대기 기준 편집 모드 `band-10-cell-1/2`, `band-18-cell-1/2`는 모두 `height=39`, `scrollHeight=39`, `clientHeight=39`로 클리핑 없음.
- 2026-05-19 브라우저 확인: 같은 페이지 미리보기 전환 후 `band-10-cell-1/2`는 빈 문서 기준 `height=25`, `scrollHeight=25`, `clientHeight=25`로 축소되고, `band-18-cell-1/2`는 키 상자 두 줄 기준 `height=39`, `scrollHeight=39`, `clientHeight=39`를 유지함. 2.2초 추가 대기 후 변화 없음.
