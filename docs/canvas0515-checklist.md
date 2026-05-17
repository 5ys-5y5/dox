# Canvas 0515 Checklist

목표: 공유 `상자 편집 캔버스`에서 아래 3개 버그를 재현, 원인 확인, 수정, 브라우저 검증까지 끝낸다.

공유 코드 기준:
- `src/components/template/TemplateEditWorkspace.tsx`
- `/templates`
- `/templates/edit`

원칙:
- 페이지별 분기 수정 금지
- extract / edit / templates 간 기능 복제 금지
- 기존 기능 회귀 금지

| ID | 항목 | 재현 기준 | 원인 | 수정 | 검증 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | `0515test2`에서 `band-0-header:left` 이동 시 `그룹1`, `band-22-footer`가 같이 이동 | `/templates`, `/templates/edit` 에서 `band-0-header` 좌측 엣지 30px 이동 | extract auto-group tree / group-relative anchor 정규화가 적용되지 않으면 unrelated footer/body가 같이 묶일 수 있음 | 추가 코드 수정 없이 현재 공유 정규화 상태 유지 | 브라우저에서 `/templates`, `/templates/edit` 모두 `header 675 -> 645`, `footer 675 유지`, `body 675 유지` 확인 | 완료 |
| C-02 | 순환 선택이 `최하위 상자`부터 시작 | position 탭에서 그룹이 있는 상자를 클릭할 때 첫 선택이 frame임 | `handlePreviewPointerDown` fast path가 click-chain을 우회함 | fast path 진입 전에 `resolvePositionSelectionClickChain(...)` 결과에 group entry가 있으면 frame 단일 선택 fast path를 금지 | 브라우저에서 `/templates`, `/templates/edit` 모두 임시 group 멤버십 주입 후 첫 클릭 시 `data-v106-position-group-proxy-selection-ui` 생성 확인 | 완료 |
| C-03 | peer edge / 명시 spacing이 없어도 spacing처럼 수정됨 | extract 기반 템플릿에서 상대 앵커 fallback relation이 spacing 관계처럼 계산됨 | `positionSpacingSettingRelations` 가 stored group-relative anchor를 fallback spacing 관계로 승격함 | extract auto-group / relative anchor 정규화 상태 검증, extract 기반 템플릿에서는 `간격 설정` 버튼 비노출 | 브라우저에서 `/templates` 기준 `relativeCount 0`, `적용된 간격 0개` 확인 | 완료 |
| C-04 | 범위 선택 시 최상위 그룹이 아니라 하위 그룹/상자가 선택됨 | `position-box-mp94u6e2` 기준 contained/intersected 마키 선택 후 하위 그룹 또는 frame이 별도 선택됨 | 마키 hit-entry / proxy selection 정렬이 입력 순서 의존이고, 그룹 변경 뒤 `positionSelectionLayoutCacheRef` 가 stale 상태로 남음 | 그룹 hit-entry 를 면적 큰 순서(최상위 우선)로 정렬하고, 그룹 구조 변경 직후 선택 레이아웃 캐시를 즉시 무효화 | 코드 수정 완료, 브라우저 재현/검증 대기 | 진행 중 |
| C-05 | 저장된 extract 템플릿에서도 `간격 설정` 이 사라짐 | `/templates`, `/templates/edit` 에서 저장 후 불러온 extract 템플릿의 `기능 버튼`에 `간격 설정` 미노출 | `canOpenPositionSpacingSettings = !isExtractFrameTemplate` 가 persisted template 까지 전부 차단 | `unsaved extract draft` 일 때만 숨기고, 저장된 템플릿에서는 다시 노출 | 코드 수정 완료, 브라우저 재현/검증 대기 | 진행 중 |

## 재현 메모

- 기준 템플릿: `0515test2`
- 기준 URL:
  - `http://localhost:3001/templates?templateId=b5f87a4b-44d9-4cbc-a183-60355a4d6456`
  - `http://localhost:3001/templates/edit?templateId=b5f87a4b-44d9-4cbc-a183-60355a4d6456`

## 현재 확인된 원인

### C-01
- `band-3-cell-1` 등 본문 프레임 다수가 `data-template-frame-position-mode="relative"` + `anchorKind="group"` + `anchorId="position-box-mp6yfgmx"` 상태다.
- `band-22-footer` 는 `anchorId="position-box-mp6ycgsx"` 상태다.
- 즉 header 그룹 -> body 그룹 -> footer 순으로 저장된 상대 앵커 체인이 존재한다.
- 현재 공유 캔버스 로드 경로에서는 `normalizeExtractAutoPositionGroups(...)` 가 이 자동 그룹/상대 앵커를 제거한 상태로 시작한다.

### C-02
- `resolvePositionSelectionClickChain(...)` 자체는 `group -> frame` 순서를 만든다.
- 하지만 `handlePreviewPointerDown(...)` 안의 fast path가 이 click-chain을 건너뛰고 frame 단일 선택을 먼저 적용한다.
- 수정 후에는 click-chain 안에 `group` entry가 하나라도 있으면 fast path를 타지 않는다.

### C-03
- `positionSpacingSettingRelations` 는 저장된 명시 spacing relation 뿐 아니라 stored relative anchor로부터 fallback relation도 만든다.
- extract가 만든 group-relative anchor가 남아 있으면, 사용자가 spacing을 만든 적이 없어도 spacing 관계처럼 해석된다.
- 현재 `0515test2` 검증 상태에서는 extract auto-group 정규화 후 상대 앵커 자체가 0개라 spacing fallback도 0개로 유지된다.
- 현재 규칙은 `저장되지 않은 extract 초안` 에서만 `간격 설정` 을 숨기고, 저장된 템플릿 편집에서는 다시 노출하는 것이다.

### C-04
- `resolveMarqueeSelectionIdsFromHitEntries(...)` 와 `resolvePositionMarqueeProxySelectionsFromHitEntries(...)` 가 group hit-entry 입력 순서를 그대로 사용하고 있었다.
- nested group 이 child-first 순서로 들어오면 parent 가 아니라 child proxy selection 이 먼저 고정될 수 있다.
- 또한 그룹 만들기/해제 직후에는 `positionSelectionLayoutCacheRef` 가 이전 그룹 구조를 캐시한 채 남아서, 이후 클릭/마키가 stale selectableGroups 를 읽을 수 있다.

### C-05
- `간격 설정` 비노출 범위를 `extract 기반 템플릿 전체` 로 잡아 버려서, 저장 후 다시 불러온 템플릿도 함께 숨겨졌다.
- 숨겨야 하는 범위는 `저장되지 않은 extract 초안` 뿐이다.
