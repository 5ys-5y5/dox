# Template Edit Speed 0515

목표: `/templates`, `/templates/edit` 의 `상자 편집 캔버스` 에서 선택과 수정이 체감상 즉시 반영되고, 주요 상호작용이 100ms 이내에 끝나도록 개선한다.

공유 코드 기준:
- 캔버스: `src/components/template/TemplateEditWorkspace.tsx`
- `/templates` 와 `/templates/edit` 는 같은 캔버스를 사용해야 한다.
- 성능 개선은 공유 코드에만 적용한다.

측정 환경:
- 기준 템플릿: `b5f87a4b-44d9-4cbc-a183-60355a4d6456`
- 기준 페이지:
  - `http://localhost:3001/templates?templateId=b5f87a4b-44d9-4cbc-a183-60355a4d6456`
  - `http://localhost:3001/templates/edit?templateId=b5f87a4b-44d9-4cbc-a183-60355a4d6456`
- 측정 방식:
  - Chrome DevTools 실제 페이지 조작
  - DOM 상태 변경 시점 기준 측정
  - 필요한 경우 performance trace 병행

체크리스트:

| ID | 유형 | 조작 | 기준 | 최초 측정 | 개선 후 | 상태 | 메모 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | 단일 선택 | 단일 상자 클릭 | 100ms 이하 | 240.8ms | 8.8~15.5ms | 완료 | 스타일 패널 열린 상태 기준. 대표값 `band-3-cell-1/2`, `status-history-1`, `band-14-cell-4` |
| P-02 | 다중 선택 | Shift 포함 복수 상자 선택 | 100ms 이하 | 382.3ms | 5.5ms | 완료 | `band-3-cell-1 + band-3-cell-2` 선택 후 width 필드가 `혼합`으로 바뀌는 시점 기준 |
| P-03 | 그룹 선택 | 단일 그룹 선택 | 100ms 이하 | 10.3ms | 10.3ms | 완료 | 임시 그룹 생성 후 프레임 상태 `90` 에서 그룹 상태 `혼합`으로 돌아오는 클릭 체인 기준 |
| P-04 | 텍스트 수정 | 값 상자 텍스트 입력/blur | 100ms 이하 | 0.8ms | 0.8ms | 완료 | 입력 활성화 11.2ms, 실제 input/blur 반영 0.8ms |
| P-05 | 선 두께 | 숫자 입력 후 blur | 100ms 이하 | 4.9ms | 4.9ms | 완료 | `band-3-cell-2` shell border width `1px ↔ 2px` |
| P-06 | 선 종류 | 셀렉트 변경 | 100ms 이하 | 2.8ms | 2.8ms | 완료 | `solid ↔ dashed` |
| P-07 | 선 색 | 셀렉트 변경 | 100ms 이하 | 0.4ms | 0.4ms | 완료 | `#0f172a ↔ #dbeafe` |
| P-08 | 배경색 | 셀렉트 변경 | 100ms 이하 | 0.5ms | 0.5ms | 완료 | `transparent ↔ slate-50` |
| P-09 | 코너 라운딩 | 숫자 입력 후 blur | 100ms 이하 | 0.5ms | 0.5ms | 완료 | `0px ↔ 10px` |
| P-10 | 높이 | 숫자 입력 후 blur | 100ms 이하 | 5.2ms | 5.2ms | 완료 | `25px ↔ 55px` |
| P-11 | 자동 높이 | 버튼 클릭 | 100ms 이하 | 15.0ms | 15.0ms | 완료 | `band-3-cell-1` 단일 선택 기준, `data-template-frame-auto-height=\"true\"` + 버튼 활성 시점 |
| P-12 | 자동 너비 | 버튼 클릭 | 100ms 이하 | 29.6ms | 29.6ms | 완료 | `band-3-cell-1` 단일 선택 기준, `auto-height -> auto-width` 전환 완료 시점 |
| P-13 | 텍스트 스타일 | 글자 크기/색상 변경 | 100ms 이하 | 8.2ms / 0.4ms | 8.2ms / 0.4ms | 완료 | 글자 크기 8.2ms, 글자 색 0.4ms |
| P-14 | 여백 | 상/하/좌/우 변경 | 100ms 이하 | 4.3ms / 3.5ms / 3.2ms / 2.9ms | 4.3ms / 3.5ms / 3.2ms / 2.9ms | 완료 | 상/하/좌/우 각각 측정, 최악값 4.3ms |
| P-15 | 상자 타입 | 자동 높이/자동 너비/고정 전환 | 100ms 이하 | 16.8ms | 16.8ms | 완료 | `band-3-cell-1` 단일 선택 기준. `height -> width -> fixed` 전환을 각 5회 측정했고, 최악값은 `width` 전환 16.8ms |
| P-16 | 오버레이 열기 | 요약 | 100ms 이하 | 33.5ms | 33.5ms | 완료 | `/templates` 33.5ms, `/templates/edit` 33.4ms |
| P-17 | 오버레이 열기 | 상자 스타일 | 100ms 이하 | 35.5ms | 35.5ms | 완료 | `/templates` 33.5ms, `/templates/edit` 35.5ms |
| P-18 | 오버레이 열기 | 상자 크기 타입 | 100ms 이하 | 33.4ms | 33.4ms | 완료 | `/templates` 33.4ms, `/templates/edit` 33.4ms |
| P-19 | 오버레이 열기 | 텍스트 스타일 | 100ms 이하 | 33.4ms | 33.4ms | 완료 | 기존 `/templates` 162.2ms -> 개선 후 `/templates` 33.4ms, `/templates/edit` 33.4ms |
| P-20 | 오버레이 열기 | 기능 버튼 | 100ms 이하 | 33.3ms | 33.3ms | 완료 | `/templates` 33.3ms, `/templates/edit` 33.3ms |
| P-21 | 그룹 동작 | 복수 상자 그룹 만들기 | 100ms 이하 | 미측정 | 미측정 | 진행 중 | 기존 증상: 그룹 생성 직후 즉시 반영되지 않고 저장/정규화 작업이 앞에서 막음 |
| P-22 | 오버레이 열기 | 그룹 생성 직후 기능 버튼 | 100ms 이하 | 미측정 | 미측정 | 진행 중 | 기존 증상: 그룹 생성 이후 `기능 버튼` overlay 파생 상태가 늦게 갱신됨 |
| P-23 | 여백 | 그룹 선택 상태 패딩 blur | 100ms 이하 | 43.4ms / 45.6ms | 45.6ms | 완료 | `position-box-mp94u6e2` 그룹 선택 기준. `paddingTop` 43.4ms, `paddingLeft` 45.6ms |

병목 후보:
- `syncDraftPreviewHtmlRef`
- `schedulePreviewEditorState`
- `syncSelectionStyleDraft`
- `requestPreviewTextFit`
- 자동 크기 후속 동기화

적용한 개선:
- 위치 탭 단일 선택에서 click-chain 전체를 타지 않는 직접 선택 경로 추가
- marquee hit-entry 생성 지연 로딩으로 일반 클릭 시 full scan 제거
- 선택 즉시 DOM 시각 효과와 패널 control value를 먼저 동기화하고, React selection state는 다음 frame으로 지연
- `selectionStyleDraft` 동기화 시 visible control DOM을 즉시 갱신해 패널 값 표시 지연 제거
- `selectionStyleDraft` 값이 실제로 바뀐 경우에만 React state를 교체하도록 막아 불필요한 전체 패널 rerender 제거
- `syncPreviewSurfaceScale` 의 ref-callback 상태 갱신을 guard 처리해 nested update 루프 차단
- 자동 높이/너비 상자 타입 전환은 즉시 DOM 반영 후, 600ms 뒤에 같은 auto-size 레이아웃 계산을 다시 돌리던 중복 경로를 제거
- 최소 높이/너비 입력은 blur 시 즉시 auto-size 재계산과 spacing 보정을 수행하고, 뒤에서는 저장/패널/텍스트 fit 동기화만 수행하도록 변경
- `텍스트 스타일` 오버레이의 collapsed state를 부모 `TemplateEditWorkspace`에서 공유 preview surface 내부 local state로 내리고, 부모에는 편집 권한 on/off만 전달하도록 분리
- 그룹 구조 파생값(`positionBoxGroups`, `positionBoxGroupById`, 물리 정렬 정보)은 deferred render HTML만 기다리지 않고 현재 live DOM + `positionStructureRevision` 기준으로 즉시 재계산하도록 분리
- 그룹 만들기/해제/포함/제외 후에는 `syncDraftPreviewHtmlRef + requestPreviewTextFit + schedulePreviewEditorState`를 동기 실행하지 않고, 화면 DOM은 즉시 유지한 채 저장용 sync/정규화만 지연 실행하도록 변경
- 그룹 구조 변경 직후 `positionSelectionLayoutCacheRef` 를 즉시 비워 stale selectableGroups 캐시가 다음 클릭/마키 선택에 재사용되지 않도록 변경
- 마키 그룹 hit-entry 와 proxy selection 해석은 항상 큰 rect(최상위 그룹) 우선으로 정렬해 child group/frame 우선 선택을 방지

현재 브라우저 상태 메모:
- `P-21`, `P-22` 는 여전히 별도 재측정이 남아 있다.
- 이번 패딩 최적화는 상태 구조나 레이아웃 규칙을 바꾸지 않고, live text control 측정 경로와 autosize peer snapshot 재사용만 줄인 변경이다.

2026-05-17 `/templates?templateId=c782b232-7db6-49c2-a301-9b575144def4` 재측정:
- 측정 방식: synthetic click 이후 `data-template-selected`, `data-v106-position-group-proxy-overlay`, `data-template-position-impact-focus` 의 첫 DOM mutation 시점을 완료로 본다.
- 대표 타깃: `제 목` (`band-9-cell-1`, `position-box-mp94u6e2` click-chain 소속)
- 결과:
  - 1차 클릭: `2.8ms` (`position-box-mp94u6e2` 그룹 proxy)
  - 2차 클릭: `1.4ms` (`position-box-mp94u2y4` 그룹 proxy)
  - 3차 클릭: `1.5ms` (단일 상자 선택)
  - 4차 클릭: `1.6ms` (`position-box-mp94u6e2` 그룹 proxy)
- 즉 현재 체감 선택 지연은 `1.4ms ~ 2.8ms` 범위로 즉시 수준이다.

2026-05-17 적용한 추가 최적화:
- position 탭 선택에서 React selection state 는 강제 동기 커밋하지 않고, visible control DOM 동기화 뒤 transition 으로 넘기도록 조정
- 선택 톤다운은 per-frame DOM overlay 생성/삭제 대신 CSS-only 표현으로 전환
- `selectedMetadataValues` 는 metadata 탭에서만 계산
- `selectedTextAutoSizeState` 는 `상자 크기 타입` 오버레이가 열려 있을 때만 계산
- 단일 선택 fast-path 는 전체 frame map scan 대신 frame id 직접 query 를 우선 사용

2026-05-17 오버레이 캐시 리팩토링:
- 오버레이 값 집계 source of truth 를 `live DOM 전체 재수집`에서 `frame id별 브라우저 메모리 캐시`로 변경
- 캐시 항목:
  - `SelectionStyleDraft`
  - `FrameMetadataDraft`
- 선택 시:
  - 선택된 frame id 들에 대해 cache miss 인 항목만 계산
  - overlay open 시 전체 computed style scan 을 다시 수행하지 않음
- 변경 시:
  - 스타일 patch, 메타데이터 patch, auto-size, 최소 높이/너비 변경 뒤 해당 frame 만 force refresh
  - 열린 overlay 는 cache 기반으로 즉시 다시 그려짐
- 로드/초안 전환 시:
  - 템플릿/초안 교체 경로에서만 cache clear

브라우저 확인:
- `/templates/edit?templateId=c782b232-7db6-49c2-a301-9b575144def4`
- 그룹 선택 상태에서 `상자 스타일`을 닫았다가 다시 열었을 때
  - immediate: `width=\"혼합\"`, `borderWidth=\"0.1\"`
  - frame+1: 동일
  - frame+2: 동일
- 즉 `상자 스타일` 값은 open 직후 첫 프레임 이전 상태에서 이미 채워져 있고, 뒤늦게 DOM 재수집으로 값이 들어오는 경로는 제거됨

2026-05-17 오버레이 open 지연 후속 정리:
- `keepMountedWhenCollapsed` 를 쓰는 오버레이가 collapsed 상태에서 실제 content 대신 빈 placeholder (`<div aria-hidden=\"true\" />`)를 렌더링하고 있었다.
- 해당 구조 때문에 `상자 스타일`, `텍스트 스타일`은 클릭 시점에 실제 패널 subtree 를 새로 mount 했고, `상자 크기 타입`, `기능 버튼`은 collapsed 상태에서 아예 unmount 되어 있었다.
- 수정:
  - `상자 스타일`, `텍스트 스타일`은 collapsed 상태에서도 실제 content 를 유지
  - `상자 크기 타입`, `기능 버튼`도 keep-mounted 로 전환
  - selection React state 는 더 이상 `requestAnimationFrame + transition` 으로 지연 커밋하지 않고 즉시 커밋
- 목적:
  - 박스 선택 직후 overlay open 시 stale selection state 와 mount 지연이 겹쳐 값이 비었다가 채워지는 현상을 제거

2026-05-17 패딩 입력 지연 정리:
- `applySelectionStylePatch(...)`가 패딩 변경에도 모든 선택 상자에 대해 autosize 재계산을 시도하고 있었다.
- 고정 상자는 패딩만 바뀌어도 outer rect 가 즉시 변하지 않으므로, 이 경로는 불필요하게 무거웠다.
- 수정:
  - `padding/font/line-height` 계열 변경은 `선택된 상자 중 auto-height/auto-width 가 있는 경우`에만 autosize 재계산
  - autosize 가 필요한 경우에도 일반 `applyTemplateAutoSizeBoxes(...)` 대신 `applyTemplateAutoSizeBoxesWithPreservedLayout(...)` 사용
- 목적:
  - 여백 변경 blur 시 고정 상자에서 즉시 DOM patch 만 반영되고, 필요 없는 layout 재계산으로 UI가 멎지 않게 함

2026-05-17 패딩 입력 지연 추가 최적화:
- `collectAutoSizeSameSidePeerNodes(...)` 가 같은 autosize 실행 안에서 edge topology snapshot 을 매번 다시 만들고 있었다.
- `measureNaturalTextControlHeight/Width(...)` 가 live textarea/input 의 `scrollHeight/scrollWidth` 를 바로 쓸 수 있는 경우에도 clone 기반 측정을 수행하고 있었다.
- 수정:
  - `applyTemplateAutoHeightBoxes(...)`, `applyTemplateAutoWidthBoxes(...)` 에서 edge topology snapshot 을 1회만 만들고 peer 조회에 재사용
  - textarea 는 live `scrollHeight`, input 은 live `scrollHeight` + computed padding/line-height 를 우선 사용
  - text width 도 live `scrollWidth` 를 우선 사용하고, 불가능할 때만 기존 clone 측정으로 fallback
- 재측정:
  - `/templates/edit?templateId=c782b232-7db6-49c2-a301-9b575144def4`
  - `position-box-mp94u6e2` 그룹 선택 + `상자 크기 타입 > 여백`
  - `paddingTop` blur: `121.8ms -> 43.4ms`
  - `paddingLeft` blur: `45.6ms`
- 구조 안전성:
  - frame/group/relative anchor/spacing 규칙은 건드리지 않았고, autosize 측정 함수 내부에서만 비용을 줄였다.

재측정 기준 추가:
- P-15 `상자 타입`은 `band-3-cell-1` 단일 선택 상태에서 `fixed -> height -> width -> fixed` 체인을 반복 측정한다.
- 완료 시점은 선택 상자 DOM의 `data-template-frame-auto-height` / `data-template-frame-auto-width` 와 상자 타입 버튼 활성 상태가 함께 목표 상태에 도달한 시점으로 본다.
- 2026-05-15 재측정 결과:
  - `height`: 7.2~8.4ms, 평균 7.6ms
  - `width`: 12.8~16.8ms, 평균 14.3ms
  - `fixed`: 0.9~1.1ms, 평균 1.0ms

공유 검증 메모:
- 모든 수정은 `src/components/template/TemplateEditWorkspace.tsx` 공유 코드에만 적용했다.
- `/templates`, `/templates/edit` 는 같은 캔버스를 사용한다.
- `/templates` 대표 smoke check에서는 `Space + Drag` 와 단일 선택 경로가 같은 방식으로 동작하는 것을 확인했다.
- P-15 재측정 후 `/templates` 에서도 `band-3-cell-1` 기준 상자 타입 전환 smoke check를 수행했고, `height 5.8ms / width 25.6ms / fixed 1.0ms` 로 100ms 이내임을 확인했다.
- P-16 ~ P-20 재측정 후 `/templates`, `/templates/edit` 모두 5개 오버레이 열기 반응이 `33.3ms ~ 35.5ms` 범위로 들어왔음을 확인했다.

원칙:
- 선택 시각 효과는 즉시 적용
- 저장용 HTML 동기화는 필요한 경우에만 지연
- 레이아웃 재계산과 무관한 변경은 전체 preview normalize 를 강제하지 않음
- 기존 기능 회귀 금지
