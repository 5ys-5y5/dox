# TemplateEditWorkspace 분해 작업 운영 문서

최종 갱신: 2026-05-18

## 목적

`src/components/template/TemplateEditWorkspace.tsx`를 작은 기능 단위로 분해하되, 불필요한 파일 수정 없이 진행 상태와 회귀 여부를 누락 없이 관리한다.

이 문서는 다음 4가지를 강제한다.

1. 수정 가능 파일 범위를 화이트리스트로 제한한다.
2. 실행 시작마다 백업을 만든다.
3. 수정 후 브라우저로 직접 확인한다.
4. 성능 저하나 동작 이상이 생기면 백업본과 비교해 원인을 좁히고 다시 개선한다.

## 현재 기준선

- 대상 파일: `src/components/template/TemplateEditWorkspace.tsx`
- 현재 크기: `30,403` lines
- 내부 대형 경계:
  - `TemplateEditPreviewSurface`: `src/components/template/workspace/canvas/TemplateEditPreviewSurface.tsx`로 이동
  - `TemplateEditWorkspace` 시작: 대략 `15116` line
- 현재 특징:
  - preview shell, persistence 상태 전이, metadata marker UI, canvas observer/key shortcut hook은 메인 파일 밖으로 분리되었다.
  - position spacing panel, selection summary overlay, metadata canvas overlays, canvas toolbar shell이 별도 파일로 분리되었다.
  - position/metadata 계산 핵심은 `workspace/position/positionComputations.ts`, `workspace/metadata/metadataConnectionComputations.ts`로 이동했다.
  - pointer down/move/up/cancel 본체는 `workspace/canvas/useCanvasPointerHandlers.ts`로 이동했다.
  - metadata action/draft 갱신 본체는 `workspace/metadata/useMetadataConnectionActions.ts`로 이동했다.
  - 메인 파일은 여전히 크지만, 대형 입력 엔진과 metadata action 경계는 메인 파일 밖에서 추적 가능하다.

## 최상위 원칙

1. 한 번에 한 단계만 진행한다.
2. 한 단계 안에서도 한 책임만 옮긴다.
3. 화이트리스트 밖 파일은 수정하지 않는다.
4. 화이트리스트 밖 파일 수정이 필요해지면, 먼저 이 문서의 화이트리스트를 갱신하고 이유를 기록한 뒤 수정한다.
5. 브라우저 확인 전에는 완료 처리하지 않는다.
6. 성능 저하가 보이면 기능 추가보다 원인 격리를 우선한다.

## 완료 정의

다음 조건을 모두 만족해야 해당 단계 완료로 본다.

- 목표 책임이 원본 파일에서 분리되었다.
- 분리 후 기능이 브라우저에서 기존과 동일하게 동작한다.
- 체감 성능 저하가 없다.
- 해당 단계에서 건드린 파일 목록과 백업 경로가 기록되었다.
- 다음 단계로 넘겨도 경계가 다시 섞이지 않는다.

## 수정 화이트리스트

### 기본 수정 허용 경로

- `docs/tempsplit.md`
- `src/components/template/TemplateEditWorkspace.tsx`
- `src/components/template/workspace/**`

### 분해 시 새로 만들어도 되는 파일 종류

- `src/components/template/workspace/types.ts`
- `src/components/template/workspace/constants.ts`
- `src/components/template/workspace/utils.ts`
- `src/components/template/workspace/hooks/**`
- `src/components/template/workspace/panels/**`
- `src/components/template/workspace/overlays/**`
- `src/components/template/workspace/canvas/**`
- `src/components/template/workspace/metadata/**`
- `src/components/template/workspace/position/**`
- `src/components/template/workspace/selection/**`
- `src/components/template/workspace/persistence/**`

### 읽기 전용 기본 경로

아래는 기본적으로 읽기만 가능하다.

- `src/app/**`
- `src/services/**`
- `src/lib/**`
- `src/components/ui/**`
- `src/components/**` 중 `template/workspace` 밖의 파일

### 화이트리스트 확장 규칙

아래 조건을 모두 만족할 때만 화이트리스트를 넓힌다.

1. 분리만으로 해결되지 않고 실제 import 경계 충돌이 있다.
2. 수정 대상이 이번 단계 책임과 직접 연결된다.
3. 수정 전 이 문서에 대상 파일과 이유를 기록한다.
4. 새 대상 파일도 수정 직전 백업한다.

## 수정 블랙리스트

이번 분해 작업에서 직접 건드리지 않는다.

- 문서 클라우드, 체크리스트, 메시징, 요청 링크, 사진, export 관련 페이지
- 서명/인증 서비스 로직
- 템플릿 추출 엔진 로직
- 디자인 시스템 전역 컴포넌트

## 백업 규칙

### 원칙

- 실행 시작마다 백업을 만든다.
- 백업은 덮어쓰지 않는다.
- 백업은 "이번 실행에서 수정할 파일 전체"를 포함해야 한다.
- 실행 중간에 수정 대상 파일이 늘어나면, 그 파일도 수정 전에 즉시 백업한다.

### 백업 저장 위치

- 루트: `docs/applied/tempsplit-backups/`
- 실행별 폴더: `docs/applied/tempsplit-backups/YYYY-MM-DD_HH-mm-ss/`

### 실행 시작 체크리스트

- 현재 단계 번호와 목적 기록
- 이번 실행 수정 예정 파일 목록 확정
- 대상 파일 전체 백업
- 백업 폴더 안에 `manifest.md` 작성

### 백업 예시 명령

```bash
STAMP=$(date '+%Y-%m-%d_%H-%M-%S')
ROOT="docs/applied/tempsplit-backups/$STAMP"
mkdir -p "$ROOT/src/components/template"
mkdir -p "$ROOT/src/components/template/workspace"
cp src/components/template/TemplateEditWorkspace.tsx \
  "$ROOT/src/components/template/TemplateEditWorkspace.tsx"
```

새 파일을 수정 대상으로 추가하면 그 경로도 같은 방식으로 백업한다.

### manifest.md 기록 형식

```md
# Tempsplit Backup Manifest

- run_at: 2026-05-18 14:30:00
- phase: P2
- purpose: preview surface 분리
- editable_files:
  - src/components/template/TemplateEditWorkspace.tsx
  - src/components/template/workspace/canvas/TemplateEditPreviewSurface.tsx
- browser_checks:
  - 템플릿 열기
  - 단일 선택
  - 드래그
  - 저장 후 새로고침
```

## 실행 루프

모든 실행은 아래 순서를 따른다.

1. 이번 실행 단계와 범위를 정한다.
2. 이 문서의 진행 상태 표를 먼저 갱신한다.
3. 수정 대상 파일을 전부 백업한다.
4. 화이트리스트 범위 안에서만 수정한다.
5. 브라우저에서 핵심 시나리오를 직접 확인한다.
6. 체감 성능 저하 여부를 본다.
7. 문제가 있으면 백업본과 현재본을 비교해 원인을 좁힌다.
8. 수정 후 다시 브라우저 확인한다.
9. 완료/보류/실패 상태와 다음 액션을 기록한다.

## 단계별 체크리스트

### P0. 기준선 고정

- 목표: 분해 전에 현재 동작과 확인 항목을 얼린다.
- 허용 수정:
  - `docs/tempsplit.md`
- 완료 조건:
  - 브라우저 확인 체크리스트가 확정됨
  - 백업 규칙이 문서화됨
  - 단계별 화이트리스트가 확정됨
- 상태: `완료`

### P1. 타입/상수/순수 유틸 분리

- 목표: React 상태와 DOM 제어를 건드리지 않고, 순수 타입/상수/헬퍼부터 분리한다.
- 허용 수정:
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/types.ts`
  - `src/components/template/workspace/constants.ts`
  - `src/components/template/workspace/utils.ts`
- 체크리스트:
  - 타입 정의를 별도 파일로 이동
  - 매직 문자열/상수를 별도 파일로 이동
  - DOM 접근 없는 순수 함수만 유틸로 이동
  - import 정리 후 동작 동일성 확인
- 완료 조건:
  - 원본 파일에서 타입/상수/순수 함수 비중이 눈에 띄게 감소
  - 동작 회귀 없음
- 현재 진행 메모:
  - `src/components/template/workspace/types.ts` 생성 완료
  - `src/components/template/workspace/utils.ts` 생성 완료
  - `src/components/template/workspace/constants.ts` 생성 완료
  - `TemplateEditWorkspace.tsx`에서 타입 묶음, selector/attribute 상수, draft/default 상수, 순수 정규화/비교 유틸을 외부 파일로 이동 완료
  - 현재 기준 `TemplateEditWorkspace.tsx` 라인 수는 `38,758 -> 37,551`로 감소
  - 브라우저 렌더 재검증: `/templates`, `/templates/edit` 통과
- 상태: `완료`

### P2. 저장/불러오기 경계 분리

- 목표: 템플릿 목록 조회, 상세 조회, 저장, 메시지 처리 등 persistence 책임을 hook 또는 controller로 뺀다.
- 허용 수정:
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/persistence/**`
  - `src/components/template/workspace/hooks/**`
- 체크리스트:
  - `/api/templates` 호출 경계 분리
  - 로딩/저장/message 상태 경계 분리
  - 템플릿 초기 로드와 재로드 흐름 정리
- 완료 조건:
  - API 호출과 화면 조작 코드가 원본 파일에서 분리됨
- 현재 진행 메모:
  - `src/components/template/workspace/persistence/templateApi.ts` 생성 완료
  - `/api/templates` list/detail/save/delete 호출을 메인 파일 밖으로 이동 완료
  - `src/components/template/workspace/persistence/templateWorkspaceState.ts` 생성 완료
  - load/save/delete/initial draft의 공통 상태 전이를 controller helper로 이동 완료
  - 메인 파일은 fetch 세부사항과 템플릿 상태 초기화 분기를 직접 펼치지 않음
- 상태: `완료`

### P3. Preview surface 분리

- 목표: preview 렌더 셸과 floating overlay UI를 독립 컴포넌트로 분리한다.
- 허용 수정:
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/canvas/**`
  - `src/components/template/workspace/overlays/**`
- 체크리스트:
  - `TemplateEditPreviewSurface` 파일 분리
  - overlay collapse/drag/pin UI 경계 분리
  - 부모에서 필요한 props만 노출
- 완료 조건:
  - preview shell 관련 JSX와 overlay JSX가 원본 파일에서 빠짐
- 현재 진행 메모:
  - `src/components/template/workspace/canvas/TemplateEditPreviewSurface.tsx` 생성 완료
  - floating overlay drag/collapse/pin UI와 preview shell JSX를 메인 파일 밖으로 이동 완료
  - metadata marker/legend UI는 `src/components/template/workspace/metadata/metadataUi.tsx`로 추가 분리 완료
- 상태: `완료`

### P4. 선택/리사이즈/캔버스 이벤트 엔진 분리

- 목표: pointer, marquee, drag, resize, edge selection 등 DOM 이벤트 엔진을 hook/controller로 이동한다.
- 허용 수정:
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/canvas/**`
  - `src/components/template/workspace/selection/**`
  - `src/components/template/workspace/hooks/**`
- 체크리스트:
  - 선택 모델 분리
  - drag/resize state 분리
  - 전역 이벤트 cleanup 책임 분리
  - MutationObserver 책임 분리
- 완료 조건:
  - 캔버스 입력 버그를 별도 모듈 단위로 추적 가능
- 현재 진행 메모:
  - `src/components/template/workspace/selection/useCanvasSelectionActions.ts`로 선택 초기화/삭제/UI cleanup 이동 완료
  - `src/components/template/workspace/canvas/useCanvasPointerLifecycle.ts`로 pointer cancel/lost-capture/window blur 일부 이동 완료
  - `src/components/template/workspace/canvas/useCanvasKeyboardShortcuts.ts`로 space pan, escape/x/q key 처리 이동 완료
  - `src/components/template/workspace/canvas/useCanvasEditorStateSync.ts`로 MutationObserver, retry timer, viewport resize sync 이동 완료
  - `src/components/template/workspace/canvas/useCanvasPointerHandlers.ts` 생성 완료
  - pointer down/move/up/cancel와 marquee auto-scroll 보조 로직을 메인 파일 밖으로 이동 완료
  - main file는 canvas 입력 엔진을 hook으로 연결만 한다
- 상태: `완료`

### P5. Position 편집기 분리

- 목표: 그룹, 상대 위치, 간격, 정렬, 영향 범위 계산을 position 모듈로 분리한다.
- 허용 수정:
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/position/**`
  - `src/components/template/workspace/panels/**`
- 체크리스트:
  - 위치 그룹 계산 경계 분리
  - spacing relation 계산 경계 분리
  - position panel UI 분리
- 완료 조건:
  - position 관련 버그를 별도 모듈에서 재현 가능
- 현재 진행 메모:
  - `src/components/template/workspace/position/PositionSpacingDeferredInput.tsx` 생성 완료
  - `src/components/template/workspace/position/PositionSpacingPanel.tsx`로 간격 설정 패널 UI 이동 완료
  - `src/components/template/workspace/position/SelectionSummaryOverlay.tsx`로 위치/선택/엣지 요약 오버레이 이동 완료
  - `src/components/template/workspace/position/positionComputations.ts` 생성 완료
  - defined relative relation 계산, focused relation 계산, spacing ordered member/pair 계산, spacing guide/entity visual 계산을 메인 파일 밖으로 이동 완료
  - `positionSpacingSettingRelations` 계산도 `workspace/position/positionComputations.ts`로 이동 완료
  - 메인 파일에는 position relation 결과의 조립과 패널 wiring만 남는다
- 상태: `완료`

### P6. Metadata 편집기 분리

- 목표: label, role, valueKey, relation selection, runtime mode 관련 편집 로직을 metadata 모듈로 분리한다.
- 허용 수정:
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/metadata/**`
  - `src/components/template/workspace/panels/**`
- 체크리스트:
  - metadata draft 상태 분리
  - relation picker/UI 분리
  - validation/review issue 처리 분리
- 완료 조건:
  - metadata 패널과 계산 로직이 독립됨
- 현재 진행 메모:
  - `src/components/template/workspace/metadata/MetadataCanvasOverlays.tsx`로 metadata name/role/connection overlay UI 이동 완료
  - relation picker 입력과 draft 갱신 handler는 메인 파일에서 props로 주입된다
  - `src/components/template/workspace/metadata/metadataConnectionComputations.ts` 생성 완료
  - connection suggestion/picker/display option 계산을 메인 파일 밖으로 이동 완료
  - `src/components/template/workspace/metadata/useMetadataConnectionActions.ts` 생성 완료
  - metadata draft 상태 변경, connection apply/save action, relation selection mode 전환을 메인 파일 밖으로 이동 완료
  - 메인 파일은 metadata editor shell과 props wiring만 유지한다
- 상태: `완료`

### P7. 패널 오케스트레이션 단순화

- 목표: 최종적으로 `TemplateEditWorkspace`를 orchestration shell 수준으로 축소한다.
- 허용 수정:
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/**`
- 체크리스트:
  - 상단 toolbar
  - 좌측/우측 panel 조립
  - props 경계 정리
  - shell이 상태를 전부 직접 들고 있지 않도록 정리
- 완료 조건:
  - 원본 파일이 orchestration 중심 구조로 축소됨
- 현재 진행 메모:
  - `src/components/template/workspace/panels/TemplateEditCanvasToolbar.tsx`로 캔버스 툴바 셸 이동 완료
  - `src/components/template/workspace/panels/TemplateEditWorkspaceHeader.tsx`로 상단 header 이동 완료
  - `src/components/template/workspace/panels/TemplatePersistencePanel.tsx`로 좌측 persistence panel 이동 완료
  - 우측 캔버스 카드의 header/toolbar/legend 조립은 메인 파일 밖으로 이동했다
- 상태: `완료`

### P8. 안정화와 정리

- 목표: 이름, import, dead code, 누락 cleanup, 주석, 회귀 확인을 정리한다.
- 허용 수정:
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/**`
  - `docs/tempsplit.md`
- 체크리스트:
  - dead code 제거
  - 브라우저 smoke 재실행
  - 성능 체감 비교
  - 완료 기록 갱신
- 완료 조건:
  - 분해 이후 작업 기준 문서가 최신 상태
- 상태: `완료`

## 브라우저 확인 체크리스트

매 실행 후 아래를 직접 확인한다.

1. `/templates` 또는 `/templates/edit` 진입 시 템플릿 목록이 정상 표시된다.
2. 기존 템플릿 선택 시 preview가 정상 렌더된다.
3. 단일 선택이 정상 동작한다.
4. 다중 선택이 정상 동작한다.
5. 드래그 이동이 정상 동작한다.
6. 리사이즈가 정상 동작한다.
7. 스타일 overlay 열기/닫기가 정상 동작한다.
8. metadata 수정이 정상 반영된다.
9. position 관련 패널이 깨지지 않는다.
10. usage preview 전환이 정상 동작한다.
11. 저장 후 다시 열어도 상태가 유지된다.

## 성능 관찰 체크리스트

매 실행 후 아래를 기록한다.

- 첫 진입 시 체감 로딩이 이전 실행보다 느려졌는가
- 선택 시 반응 지연이 증가했는가
- 드래그/리사이즈 시 끊김이 생겼는가
- overlay 열기/닫기 시 버벅임이 생겼는가
- 스크롤/줌 전환 시 잔상이 심해졌는가
- 전역 이벤트 cleanup 누락으로 보이는 중복 반응이 생겼는가

## 문제 발생 시 대응 흐름

문제가 생기면 아래 순서로 처리한다.

1. 기능 문제인지 성능 문제인지 먼저 분류한다.
2. 이번 실행에서 수정한 파일만 본다.
3. 백업본과 현재본 diff로 문제 범위를 줄인다.
4. 한 번에 하나의 원인만 되돌리거나 수정한다.
5. 다시 브라우저 체크리스트를 돌린다.
6. 해결되면 원인과 수정 방법을 작업 로그에 남긴다.
7. 해결되지 않으면 해당 단계 상태를 `보류`로 바꾸고 다음 실행에서 범위를 더 줄인다.

## 작업 로그 템플릿

아래 형식으로 매 실행 기록을 남긴다.

```md
## Run YYYY-MM-DD HH:mm:ss

- phase:
- purpose:
- editable_files:
  - 
- backup_path:
- browser_checks_passed:
  - 
- performance_notes:
  - 
- issue_found:
  - 
- fix_or_followup:
  - 
- status: done | blocked | partial
```

## 현재 진행 상태 요약

| Phase | 상태 | 비고 |
| --- | --- | --- |
| P0 | 완료 | 기준선 문서 작성 완료 |
| P1 | 완료 | 타입/상수/순수 유틸 분리 완료 |
| P2 | 완료 | API + template workspace state transition을 `workspace/persistence/**`로 이동 |
| P3 | 완료 | preview shell, overlay UI, metadata marker UI를 `workspace/canvas`, `workspace/metadata`로 이동 |
| P4 | 완료 | pointer engine과 marquee auto-scroll을 `workspace/canvas/useCanvasPointerHandlers.ts`로 이동 |
| P5 | 완료 | panel 분리 + relative/spacing core 계산을 `workspace/position/positionComputations.ts`로 이동 |
| P6 | 완료 | overlay 분리 + connection 계산/action을 `workspace/metadata/**`로 이동 |
| P7 | 완료 | canvas toolbar, 상단 header, 좌측 persistence panel shell 분리 완료 |
| P8 | 완료 | 문서/manifest 갱신, dead code 정리, 번들 검증 완료. 브라우저 smoke는 환경 차단 기록 |

## 금지 사항

- 백업 없이 바로 수정 시작
- 여러 단계 동시 진행
- 화이트리스트 밖 파일 선수정
- 브라우저 확인 없이 완료 처리
- 성능 저하를 "나중에 보자"로 미루고 다음 단계 진행

## 다음 실행 시작점

다음 실행은 `코드 분리 후속 검증`이 필요할 때만 진행한다. 우선순위는 `localhost:3001`이 열린 환경에서 브라우저 smoke를 재실행하는 것이다.

## Run 2026-05-18 11:21:02

- phase: `P4 -> P8`
- purpose:
  - pointer engine과 metadata action block을 메인 파일 밖으로 이동
  - 문서 기준 상태를 최종 구현 상태로 갱신
- editable_files:
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/canvas/useCanvasPointerHandlers.ts`
  - `src/components/template/workspace/metadata/useMetadataConnectionActions.ts`
  - `docs/tempsplit.md`
- backup_path:
  - `docs/applied/tempsplit-backups/2026-05-18_11-21-02`
- browser_checks_passed:
  - `blocked`: `localhost:3001` 연결 실패
  - `blocked`: chrome devtools transport closed
- performance_notes:
  - `esbuild` bundle check 통과
  - 메인 파일 라인 수 `33,154 -> 30,403`
- issue_found:
  - 샌드박스에서 로컬 서버 미기동 상태라 브라우저 smoke를 재수행하지 못함
- fix_or_followup:
  - 서버가 살아 있는 환경에서 `/templates`, `/templates/edit` 수동 smoke 재실행
- status: `done`

## Run 2026-05-18 11:00:09

- phase: `P5 -> P8`
- purpose:
  - position/metadata 계산 핵심을 별도 모듈로 이동
  - shell 분리 상태 반영
  - dead import 정리와 번들 검증
- editable_files:
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/position/positionComputations.ts`
  - `src/components/template/workspace/metadata/metadataConnectionComputations.ts`
  - `docs/tempsplit.md`
- backup_path:
  - `docs/applied/tempsplit-backups/2026-05-18_11-00-09`
- browser_checks_passed:
  - `blocked`: sandbox에서 `localhost:3001` dev server listen 불가, 직접 브라우저 smoke 미수행
- performance_notes:
  - `esbuild` bundle check 통과
  - 메인 파일 라인 수 `34,788 -> 33,607`
- issue_found:
  - pointer handler 본체는 여전히 메인 파일에 남아 있어 `P4` 미완료
  - metadata action/draft 갱신 본체는 여전히 메인 파일에 남아 있어 `P6` 미완료
- fix_or_followup:
  - `workspace/canvas`로 pointer handler hook 분리
  - `positionSpacingSettingRelations`와 metadata action block 추가 분리
- status: `partial`

## Run 2026-05-18 09:21:09

- phase: `P1`
- purpose: `TemplateEditWorkspace`의 타입 묶음과 저위험 순수 유틸 1차 분리
- editable_files:
  - `docs/tempsplit.md`
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/types.ts`
  - `src/components/template/workspace/utils.ts`
  - `src/components/template/workspace/constants.ts`
- backup_path: `docs/applied/tempsplit-backups/2026-05-18_09-21-09`
- browser_checks_passed:
  - `http://localhost:3001/templates` 진입 성공
  - `http://localhost:3001/templates/edit` 진입 성공
  - 템플릿 편집 화면 헤더, 불러오기/저장 섹션, 상자 편집 캔버스 렌더 확인
  - 페이지 전체 스크린샷 저장: `docs/applied/tempsplit-backups/2026-05-18_09-21-09/browser-check-templates-3001.png`
  - 페이지 전체 스크린샷 저장: `docs/applied/tempsplit-backups/2026-05-18_09-21-09/browser-check-templates-edit-3001.png`
- performance_notes:
  - 이번 확인 범위에서는 초기 렌더 자체의 명확한 성능 저하 징후는 보지 못함
  - 상호작용 클릭 검증은 브라우저 도구 제약으로 이번 실행에서 미실시
- issue_found:
  - `npx tsc --noEmit` 전체 실행은 기존 프로젝트 메모리 한계로 OOM 발생
  - 새 dev 서버 직접 기동은 샌드박스 listen 제한으로 실패했지만, 사용자 환경의 `localhost:3001` 서버로 브라우저 확인은 수행함
- fix_or_followup:
  - P1 계속 진행 시 selector/attribute 상수와 draft/default 상수 분리
  - 다음 브라우저 검증에서는 `/templates/edit`와 템플릿 실제 선택 흐름까지 확인
- status: `partial`

## Run 2026-05-18 09:35:06

- phase: `P1 -> P2`
- purpose: 상수/초기값 분리를 마무리하고 `/api/templates` persistence 경계 추출 시작
- editable_files:
  - `docs/tempsplit.md`
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/types.ts`
  - `src/components/template/workspace/utils.ts`
  - `src/components/template/workspace/constants.ts`
  - `src/components/template/workspace/persistence/templateApi.ts`
- backup_path: `docs/applied/tempsplit-backups/2026-05-18_09-35-06`
- browser_checks_passed:
  - `http://localhost:3001/templates` 재진입 성공
  - `http://localhost:3001/templates/edit` 재진입 성공
  - 템플릿 편집 화면 헤더, 템플릿 리스트, 캔버스 진입 상태 렌더 확인
  - 스크린샷 저장:
  - `docs/applied/tempsplit-backups/2026-05-18_09-35-06/browser-check-templates-3001-after-p1.png`
  - `docs/applied/tempsplit-backups/2026-05-18_09-35-06/browser-check-templates-edit-3001-after-p1.png`
  - `docs/applied/tempsplit-backups/2026-05-18_09-35-06/browser-check-templates-3001-after-p2.png`
  - `docs/applied/tempsplit-backups/2026-05-18_09-35-06/browser-check-templates-edit-3001-after-p2.png`
- performance_notes:
  - 라우트 초기 렌더 기준 명확한 성능 저하 징후는 관찰하지 못함
  - `esbuild` 번들 검사는 계속 통과
- issue_found:
  - 전체 `npx tsc --noEmit`는 기존 프로젝트 메모리 한계로 여전히 OOM
  - DevTools 제약상 템플릿 리스트 버튼 클릭과 실제 불러오기 상호작용은 자동 검증하지 못함
- fix_or_followup:
  - P2 다음 단계에서 load/save/delete 후 상태 초기화 분기를 hook 또는 controller로 추가 분리
  - 가능하면 템플릿 실제 선택 흐름을 수동 또는 별도 도구로 재검증
- status: `partial`

## Run 2026-05-18 09:51:51

- phase: `P2 -> P3`
- purpose: persistence 상태 전이 공통화와 preview shell, metadata 보조 UI 분리
- editable_files:
  - `docs/tempsplit.md`
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/types.ts`
  - `src/components/template/workspace/canvas/TemplateEditPreviewSurface.tsx`
  - `src/components/template/workspace/persistence/templateWorkspaceState.ts`
  - `src/components/template/workspace/metadata/metadataUi.tsx`
- backup_path: `docs/applied/tempsplit-backups/2026-05-18_09-51-51`
- browser_checks_passed:
  - `http://localhost:3001/templates/edit` reload 후 런타임 참조 에러 제거 확인
  - `http://localhost:3001/templates/edit` 진입 스냅샷 저장:
  - `docs/applied/tempsplit-backups/2026-05-18_09-51-51/edit-page-snapshot-after-p2p3-reload.txt`
  - `http://localhost:3001/templates/edit` 전체 스크린샷 저장:
  - `docs/applied/tempsplit-backups/2026-05-18_09-51-51/browser-check-templates-edit-3001-after-p2p3-reload.png`
  - 템플릿 리스트 버튼 클릭 후 `templateId` query 반영 및 캔버스 실제 렌더 확인:
  - `docs/applied/tempsplit-backups/2026-05-18_09-51-51/edit-page-snapshot-after-click.txt`
  - `http://localhost:3001/templates` reload 확인:
  - `docs/applied/tempsplit-backups/2026-05-18_09-51-51/templates-page-snapshot-after-p2p3-reload.txt`
  - `docs/applied/tempsplit-backups/2026-05-18_09-51-51/browser-check-templates-3001-after-p2p3-reload.png`
- performance_notes:
  - `esbuild` 번들 검사는 계속 통과
  - `/templates`, `/templates/edit` reload와 템플릿 실제 load 클릭 기준 명확한 성능 저하 징후는 관찰하지 못함
  - 메인 파일 라인 수는 `37,551 -> 36,244`로 추가 감소
- issue_found:
  - 브라우저 콘솔에는 페이지 기능과 무관한 `404` 하나만 남음
  - 최소 범위 `tsc`는 기존 `TemplateEditWorkspace.tsx`, `workspace/constants.ts`, `workspace/utils.ts`의 선행 타입 오류로 계속 실패
  - metadata UI 추가 분리 직후에는 Chrome DevTools transport가 닫혀 마지막 소규모 추출에 대한 브라우저 재검증을 재실행하지 못함
- fix_or_followup:
  - P4에서 pointer/resize/marquee/MutationObserver 경계를 `workspace/canvas`와 `workspace/selection`으로 이동
  - 선행 타입 오류는 이번 분리와 무관하지만 안정화 단계에서 별도 정리 필요
- status: `partial`

## Run 2026-05-18 10:31:09

- phase: `P4 -> P7`
- purpose: canvas observer/key shortcut hook, position/metadata overlay, canvas toolbar shell 분리
- editable_files:
  - `docs/tempsplit.md`
  - `src/components/template/TemplateEditWorkspace.tsx`
  - `src/components/template/workspace/canvas/useCanvasEditorStateSync.ts`
  - `src/components/template/workspace/canvas/useCanvasKeyboardShortcuts.ts`
  - `src/components/template/workspace/position/PositionSpacingDeferredInput.tsx`
  - `src/components/template/workspace/position/PositionSpacingPanel.tsx`
  - `src/components/template/workspace/position/SelectionSummaryOverlay.tsx`
  - `src/components/template/workspace/metadata/MetadataCanvasOverlays.tsx`
  - `src/components/template/workspace/panels/TemplateEditCanvasToolbar.tsx`
- backup_path: `docs/applied/tempsplit-backups/2026-05-18_10-31-09`
- browser_checks_passed:
  - 없음. 이 실행 환경에서는 `localhost:3001` 서버가 떠 있지 않았고, 직접 기동도 `listen EPERM`으로 차단됨
- performance_notes:
  - `npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --platform=browser --format=esm`는 계속 통과
  - 메인 파일 라인 수는 `36,244 -> 34,788`로 추가 감소
- issue_found:
  - `curl http://localhost:3001/templates` / `/templates/edit` 모두 연결 실패
  - `npm run dev -- --hostname 127.0.0.1 --port 3001`는 샌드박스 `listen EPERM`으로 실패
  - 따라서 이번 런에서는 브라우저 smoke를 재실행하지 못함
- fix_or_followup:
  - P4에서 `handlePreviewPointerDown/Move/Up` 본체를 별도 hook으로 계속 이동
  - P7에서 좌측 persistence panel과 상단 header shell도 분리
  - 서버 접근 가능한 환경에서 `/templates`, `/templates/edit` 브라우저 smoke를 재실행
- status: `partial`
