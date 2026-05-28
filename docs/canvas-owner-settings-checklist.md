# Canvas Owner Settings Verification Checklist

검증 일시: 2026-05-28

검증 대상:
- `http://localhost:3000/canvas?page=canvas&templateId=dc080119-76a5-4785-a698-4dca1e1609f1`
- `http://localhost:3000/templates?templateId=dc080119-76a5-4785-a698-4dca1e1609f1`
- `src/app/canvas/ownerSettings.ts`
- `src/app/canvas/page.tsx`
- `src/app/canvas/ownerPolicy.tsx`
- `CanvasOwnedWorkspace`를 사용하는 실제 페이지 라우트

수정 전 기록:
- `docs/diff/2026-05-28_canvas-owner-settings-consistency-before.md`

## 결론

이번 구현 후, 사용자에게 노출되는 canonical owner 설정은 48개이며 `CanvasOwnerSettings`, `defaultCanvasOwnerSettings`, `/canvas` 환경설정 UI, `applyCanvasOwnerSettingsToWorkspaceProps` 공용 적용 경로가 모두 48개로 일치한다.

`useSpecifiedCanvasHeight`는 모드 제거 이후 `autoCanvasHeight`와 의미가 겹치는 legacy 설정이므로 사용자 설정 정의에서는 제거했다. 다만 과거 저장값은 버리지 않고, 저장소 정규화 단계에서 `useSpecifiedCanvasHeight=true`를 `autoCanvasHeight=false`로 변환한다.

Chrome DevTools MCP로 `/canvas` 기준 owner 설정 반영 35개를 직접 조작 검증했고 35개 모두 통과했다. `/templates` 실제 라우트에서도 같은 저장 설정이 `additionalControlPanels`, 상단 저장 버튼, persistence 저장 버튼에 반영되는 것을 확인했다.

## 정적 검증 체크리스트

| 항목 | 기대 | 결과 | 판정 |
| --- | --- | --- | --- |
| 설정 타입 정의 | canonical `CanvasOwnerSettings` 48개 | 48개 | PASS |
| 기본값 정의 | `defaultCanvasOwnerSettings` 48개 | 48개 | PASS |
| 환경설정 UI 연결 | 48개 모두 UI에서 변경 가능 | 48개 | PASS |
| 공용 적용 함수 연결 | 48개 모두 공용 적용 경로에서 처리 | 48개 | PASS |
| legacy 높이 설정 | 과거 `useSpecifiedCanvasHeight` 저장값 보존 | `autoCanvasHeight`로 migration | PASS |
| 실제 페이지 wrapper | 공용 캔버스 페이지는 `CanvasOwnedWorkspace` 사용 | 7개 관리 페이지가 wrapper 사용 | PASS |

정적 커버리지 결과:

```json
{
  "counts": { "type": 48, "default": 48, "ui": 48, "apply": 48 },
  "missingFromDefault": [],
  "missingFromUi": [],
  "missingFromApply": [],
  "extraUi": [],
  "extraApply": []
}
```

## 구현 반영 체크리스트

| 항목 | 구현 내용 | 판정 |
| --- | --- | --- |
| `saveDisabled` | `TemplatePersistencePanel`에도 prop을 전달하여 상단/하단 저장 버튼이 같은 비활성 정책을 따른다. | PASS |
| `showTopNotice` | 공용 적용 함수에서 false이면 `topNotice=null`, true이면 base prop 유지. | PASS |
| `showAdditionalControlPanels` | 공용 적용 함수에서 false이면 `additionalControlPanels=null`, true이면 base prop 유지. | PASS |
| `limitEditableValueKeys` | 공용 적용 함수에서 false이면 `editableValueKeys=null`, true이면 base prop 유지. | PASS |
| `enableOnTemplateSaved` | 공용 적용 함수에서 false이면 `onTemplateSaved=undefined`, true이면 base prop 유지. | PASS |
| `allowCanvasBoxSelection` | 환경설정 UI 추가. true이면 `canvasSelectionMode='box'`, `canvasTextInteractionMode='selection-only'`; false이면 각각 `none`, `default`. | PASS |
| `pageContainerWidth` | 환경설정 UI 추가 및 공용 적용 경로 유지. | PASS |
| `pageContainerHeight` | 환경설정 UI 추가 및 공용 적용 경로 유지. | PASS |
| `useSpecifiedCanvasHeight` | 사용자 설정에서 제거하고 legacy migration으로만 유지. | PASS |

## 페이지 연결 체크리스트

| 페이지 | surface | wrapper | 정적 판정 |
| --- | --- | --- | --- |
| `/canvas` | `canvas` | `CanvasOwnedWorkspace` | PASS |
| `/templates` | `templates` | `CanvasOwnedWorkspace` | PASS |
| `/templates/edit` | `templates-edit` | `CanvasOwnedWorkspace` | PASS |
| `/project` | `project` | `CanvasOwnedWorkspace` | PASS |
| `/request-links/[token]` | `request-links` | `CanvasOwnedWorkspace` | PASS |
| `/member-access/document/[documentId]` | `member-access` | `CanvasOwnedWorkspace` | PASS |
| `/templates/extract` preview | `templates-extract-preview` | `CanvasOwnedWorkspace` | PASS |

주의: 동적 토큰이나 문서 ID가 필요한 `/request-links/[token]`, `/member-access/document/[documentId]`는 이번 실행에서 실제 데이터 라우트까지 열어보지는 않았다. 단, 이 페이지들도 `CanvasOwnedWorkspace`와 같은 `applyCanvasOwnerSettingsToWorkspaceProps` 경로를 사용하므로, 정적 연결 기준으로는 같은 설정 적용 경로에 포함된다.

## 브라우저 검증 체크리스트

브라우저 검증은 Chrome DevTools MCP로 수행했다. 검증 중 `localStorage`에 임시로 기록한 owner 설정은 종료 후 원래 상태로 복구했다.

### `/canvas` owner 검증

검증 파일:
- `/tmp/canvas-owner-verification-after.json`

결과:

```json
{
  "total": 35,
  "passed": 35,
  "failed": 0,
  "failedKeys": [],
  "setupFailures": []
}
```

확인한 동작:
- 헤더, persistence 패널, 템플릿 목록 표시 방식, 상단 안내, 추가 제어 패널, 캔버스 제목, 이름 필드, 저장 버튼, 할 일 버튼, 미리보기 탭, 도구 버튼, 히스토리 버튼, 줌 버튼, 전체 화면 버튼, 편집 설정 버튼, 선택 패널 탭이 설정대로 표시/숨김 처리된다.
- `pageContainerWidth`, `pageContainerHeight`, `autoCanvasHeight`, `autoCanvasWidth`, `specifiedCanvasHeight`, `specifiedCanvasWidth`가 설정대로 style/prop에 반영된다.
- `headerTitle`, `headerDescription`, `nameFieldLabel`, `saveButtonLabel`, `templateNameReadOnly`, `saveDisabled`가 설정대로 반영된다.
- `selectionInactiveOverlayOpacity`, `initialCanvasTab`, `allowCanvasBoxSelection`이 설정대로 반영된다.

### `/templates` 실제 라우트 검증

검증 페이지:
- `http://localhost:3000/templates?templateId=dc080119-76a5-4785-a698-4dca1e1609f1`

검증 1:
- `showAdditionalControlPanels=false`
- `saveDisabled=true`
- `showCanvasSaveButton=true`
- `showPersistenceSaveButton=true`

결과:
- `PDF 추출` 추가 제어 패널이 출력되지 않는다.
- `persistenceVisibility.showSaveButton` 영역의 `현재 템플릿 저장` 버튼이 disabled 처리된다.
- `canvasToolbarVisibility.showSaveButton` 영역의 `문서 저장` 버튼이 disabled 처리된다.
- 판정: PASS

검증 2:
- `showAdditionalControlPanels=true`
- `saveDisabled=false`
- `showCanvasSaveButton=true`
- `showPersistenceSaveButton=true`

결과:
- `PDF 추출` 추가 제어 패널이 출력된다.
- `현재 템플릿 저장` 버튼과 `문서 저장` 버튼이 `saveDisabled` 때문에 비활성화되지 않는다.
- 판정: PASS

## 품질 검증 기록

| 명령 | 결과 |
| --- | --- |
| `npm run lint` | FAIL: ESLint 9가 `eslint.config.(js|mjs|cjs)`를 찾지 못함. 프로젝트 설정 문제로 실행 차단. |
| `npx tsc --noEmit` | FAIL: 기본 메모리에서 OOM 발생. |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false` | FAIL: 기존 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 문법 오류로 전체 타입 검사 차단. |
| targeted `npx tsc --noEmit ... src/app/canvas/ownerSettings.ts src/app/canvas/page.tsx src/components/template/TemplateEditWorkspace.tsx src/components/template/workspace/panels/TemplatePersistencePanel.tsx` | FAIL: 기존 workspace 계열 타입 오류가 함께 노출됨. 이번 변경의 새 prop 전달 자체에서 별도 오류는 확인되지 않음. |

## 재검증 기준

앞으로 이 영역을 수정할 때는 다음 기준을 모두 통과해야 한다.

- [x] canonical 설정 수가 `CanvasOwnerSettings`, `defaultCanvasOwnerSettings`, 환경설정 UI, 공용 적용 함수에서 모두 일치한다.
- [x] 사용자에게 노출하지 않는 legacy 설정은 사용자 설정 목록이 아니라 migration 경로에만 남긴다.
- [x] `/canvas`에서 각 설정을 ON/OFF 또는 값 변경했을 때 `data-canvas-owner-item="canvas-container"` 출력이 설정과 일치한다.
- [x] 실제 페이지 하나 이상에서 `/canvas`와 같은 저장 설정이 같은 출력으로 반영되는지 확인한다.
- [ ] 동적 데이터가 필요한 `/request-links/[token]`, `/member-access/document/[documentId]`는 유효 토큰/문서 ID가 준비된 상태에서 브라우저로 추가 검증한다.

## 남은 제한

현재 구현은 "설정 정의, owner UI, 공용 적용 경로, `/canvas`, `/templates` 실제 라우트" 기준으로 일치한다. 다만 모든 동적 라우트를 실제 데이터로 열어 본 것은 아니므로, 운영 데이터가 필요한 라우트는 별도 검증 데이터가 준비되면 위 재검증 기준에 따라 추가 확인해야 한다.
