# EDGE-EDIT-001 Design Log

- 작성 일시: 2026-04-29
- 사용자 확정: 완료 (`확정`)
- 현재 턴 목적: `docs/edgedit.md` 설계 문서 작성
- 현재 턴 runtime 코드 수정: 없음

## 체크리스트 매핑

- `CHK-PLAN-EDGE-001`
  - 내용: 특정 사례가 아닌 일반화된 엣지 연결성 기준을 문서화한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/edgedit.md`

- `CHK-PLAN-EDGE-002`
  - 내용: 첫 클릭 그룹 선택, 두 번째 클릭 개별 선택 규칙을 문서화한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/edgedit.md`

- `CHK-PLAN-EDGE-003`
  - 내용: 엣지 위상 해석, 선택 상태 전이, 리사이즈 의도 계산을 서비스 단위로 분해한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/edgedit.md`

- `CHK-PLAN-EDGE-004`
  - 내용: 수정 허용 화이트리스트와 백업 파일명을 고정한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/edgedit.md`

- `CHK-PLAN-EDGE-005`
  - 내용: MCP 테스트 수행 결과와 제한 사항을 기록한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/edgedit.md`

## 후속 구현 승인 시 생성해야 할 백업 파일

- `docs/diff/2026-04-29_EDGE-EDIT-101_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-04-29_EDGE-EDIT-102_templateEdgeTopologyService.before.ts`
- `docs/diff/2026-04-29_EDGE-EDIT-103_templateEdgeSelectionService.before.ts`
- `docs/diff/2026-04-29_EDGE-EDIT-104_templateEdgeSelectionDtos.before.ts`

## 비고

- 이번 턴은 설계 문서만 작성한다.
- `chrome-devtools` MCP는 실행을 시도했지만 `chrome-profile` 점유로 attach에 실패했다.
- `supabase.list_migrations` 호출은 성공했다.

## 후속 구현 로그

- `2026-04-29_EDGE-EDIT-101_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-IMPL-EDGE-003`, `CHK-IMPL-EDGE-004`, `CHK-IMPL-EDGE-005`, `CHK-IMPL-EDGE-006`
  - 목적: edge token state와 preview pointer 경로 연결 전 백업

- `2026-04-29_EDGE-EDIT-102_templateEdgeTopologyService.before.ts`
  - 체크리스트: `CHK-IMPL-EDGE-001`, `CHK-IMPL-EDGE-002`
  - 목적: 신규 topology service 추가 전 부재 상태 기록

- `2026-04-29_EDGE-EDIT-103_templateEdgeSelectionService.before.ts`
  - 체크리스트: `CHK-IMPL-EDGE-001`, `CHK-IMPL-EDGE-003`, `CHK-IMPL-EDGE-004`
  - 목적: 신규 selection service 추가 전 부재 상태 기록

- `2026-04-29_EDGE-EDIT-104_templateEdgeSelectionDtos.before.ts`
  - 체크리스트: `CHK-IMPL-EDGE-001`
  - 목적: 신규 edge DTO 파일 추가 전 부재 상태 기록

- 구현 반영 요약
  - `src/lib/templateEdgeSelectionDtos.ts` 추가
  - `src/services/templateEdgeTopologyService.ts` 추가
  - `src/services/templateEdgeSelectionService.ts` 추가
  - `src/components/template/TemplateEditWorkspace.tsx` 에 edge token state, live topology snapshot, connected/isolated toggle, edge-target resize 수집 경로 추가
  - `esbuild` 번들 검증 통과

- `2026-04-29_EDGE-EDIT-105_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-IMPL-EDGE-006`
  - 목적: edge group resize 중 자기 그룹을 snap sibling으로 다시 참조하던 상태 백업
  - 구현 결과:
    - edge selection resize 시 active edge target 집합을 sibling snap 후보에서 제외
    - connected edge group이 자기 경계에 다시 스냅되어 이동량이 0처럼 보이던 경로 차단

- `2026-04-29_EDGE-EDIT-106_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-IMPL-EDGE-003`, `CHK-IMPL-EDGE-006`
  - 목적: edge click selection과 edge drag resize가 같은 pointerdown에서 동시에 처리되던 상태 백업
  - 구현 결과:
    - edge click selection 확정 시점을 `pointerup`으로 이동
    - drag threshold를 넘길 때만 edge resize state를 시작
    - 같은 press 안에서 선택 토글만 일어나고 드래그가 시작되지 않던 경로 차단

- `2026-04-29_EDGE-EDIT-107_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-IMPL-EDGE-003`
  - 목적: `buildLiveEdgeTopologySnapshot`가 선언 전 callback들을 dependency array에서 참조하던 상태 백업
  - 구현 결과:
    - `buildLiveEdgeTopologySnapshot` dependency array를 실제 사용값인 `getFrameNodes`만 남기도록 수정
    - `Cannot access 'collectEdgeResizeTargets' before initialization` 런타임 오류 제거

- `2026-04-29_EDGE-EDIT-108_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-IMPL-EDGE-003`, `CHK-IMPL-EDGE-006`
  - 목적: edge drag 시작 시 React state를 즉시 갱신하면서 stale preview HTML이 다시 렌더되던 상태 백업
  - 구현 결과:
    - edge drag threshold 진입 시 box/edge 선택 상태를 React state가 아니라 ref와 런타임 selection UI로 먼저 반영
    - pointer stop 시점에만 `previewHtml`, box selection state, edge selection state를 최종 동기화
    - drag 중 일시적으로 적용된 좌표가 stale `dangerouslySetInnerHTML` 재렌더로 원위치 복원되던 경로 차단

- `2026-04-29_EDGE-EDIT-109_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-IMPL-EDGE-006`
  - 목적: edge resize가 시작점 기준 총 delta를 매 pointermove마다 현재 DOM에 다시 적용하던 상태 백업
  - 구현 결과:
    - edge resize state에 마지막 실제 적용 delta를 축별로 저장
    - 각 pointermove에서 총 delta가 아니라 직전 move 이후의 증분 delta만 적용
    - 마우스 드래그 거리 대비 n배로 너비/높이가 커지거나 줄어들던 누적 적용 경로 차단

- `2026-04-29_EDGE-EDIT-110_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-IMPL-EDGE-004`, `CHK-IMPL-EDGE-006`
  - 목적: edge resize target를 `shell + boundaryIndex` 단위로 합쳐서 isolated/connected가 모두 같은 giant-table boundary를 수정하던 상태 백업
  - 구현 결과:
    - edge resize target를 edge/node 단위로 수집하도록 변경
    - edge selection resize는 shared table column resize가 아니라 selected node의 local rect만 수정하도록 분리
    - `isolated`는 anchor edge 한 개만 이동하고, `connected`는 token member 각각에 같은 증분 delta를 적용하도록 수정
    - `status-history-1:left` 같은 단일 edge 조정이 무관한 `band-*` 셀 경계까지 광범위하게 전파되던 경로 차단

- `2026-04-29_EDGE-EDIT-111_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-IMPL-EDGE-004`, `CHK-IMPL-EDGE-006`
  - 목적: giant-table `td` 자체를 시각 박스로 가정해 local width/left가 실제 출력 박스와 어긋나던 상태 백업
  - 구현 결과:
    - frame cell 내부에 저장 가능한 `data-template-frame-box` visual wrapper를 도입
    - box selection UI, edge selection UI, local width/height/offset 저장을 wrapper 기준으로 전환
    - `status-history-1` 같은 shared cell도 wrapper 기준으로 실제 출력 박스와 선택 박스가 일치하도록 기반 변경

- `2026-04-29_EDGE-EDIT-112_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-IMPL-EDGE-004`
  - 목적: wrapper 정규화가 mount 시점 DOM에 확실히 반영되지 않던 상태 백업
  - 구현 결과:
    - preview ref bind 시점과 HTML sync 시점에도 wrapper 정규화와 selection UI 적용을 보강
    - 편집 첫 진입 직후와 저장 직전에 동일한 visual box 구조가 유지되도록 경로 추가

- `2026-04-29_EDGE-EDIT-113_TemplateEditWorkspace.before.tsx`
  - 체크리스트: `CHK-IMPL-EDGE-004`, `CHK-IMPL-EDGE-006`
  - 목적: wrapper 정규화 호출 시점에 의존해 첫 선택 전까지 giant-table cell이 원본 `td` 상태로 남아 있던 상태 백업
  - 구현 결과:
    - `resolveFrameVisualBox()`가 first access 시점에 lazy wrapper 정규화를 수행하도록 변경
    - box selection을 한 번만 해도 해당 frame은 즉시 wrapper 기반 편집 대상으로 전환
    - 브라우저 실측으로 `status-history-1` wrapper width/left 변경 시 `band-11-cell-3`가 영향을 받지 않음을 확인
