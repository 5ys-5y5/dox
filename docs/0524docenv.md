# 0524 Documents Owner Environment Settings Design

작성일: 2026-05-24  
대상: `/documents`, `/project`에서 import해 쓰는 documents owner 기능  
상태: 설계 문서. 실제 구현은 별도 지시 전까지 금지.

## 목표

`http://localhost:3001/documents` 페이지도 `http://localhost:3001/canvas`처럼
중앙화된 owner 기능을 사용하는 페이지별 환경설정을 제공한다.

`/canvas`는 `상자 편집 캔버스` 자체의 owner다.  
`/documents`는 문서 요청 흐름의 owner다.

따라서 `/documents` 설정은 아래 기능을 소유한다.

- 문서 선택 패널 표시 여부
- 요청 링크 설정 패널 표시 여부
- 요청 단계 구성
- 상자 담당자 지정 흐름
- 필수 사진/파일 등록 흐름
- 새 구성원 등록 흐름
- 만료 시각 기본값과 상대 시간 표시
- 문서 기록 패널 표시 여부
- `/project` 같은 외부 페이지에 임베드되는 문서 요청 UI 형태

반대로 `/documents` 설정은 아래 기능을 소유하지 않는다.

- `canvasViewMode`
- `canvasSelectionMode`
- `canvasTextInteractionMode`
- `selectionInactiveOverlayOpacity`
- 캔버스 toolbar/persistence 표시 설정
- 상자 선택 활성화 자체의 중앙 로직

위 항목은 계속 `/canvas`와 `CanvasOwnedWorkspace`가 소유한다.

## 현재 구조

- `/documents`는 `src/app/documents/page.tsx`에서 `DocumentsOwnerWorkspace`를 전체 화면으로 렌더링한다.
- `/project`는 `src/app/project/page.tsx`에서 `DocumentsOwnerWorkspace`를 import해 `surface="project"`로 임베드한다.
- `DocumentsOwnerWorkspace`는 이미 `surface`, `embedded`, `hideDocumentPicker`, `hidePageHeader`, `renderMode` prop을 받는다.
- 현재 이 prop들은 `/project`에서 하드코딩된다.
- `DocumentsOwnerWorkspace` 내부의 `CanvasOwnedWorkspace`는 `surface="documents"` 또는 `surface="project"`로 공용 캔버스 설정을 받는다.
- 즉 캔버스 자체 중앙화는 일부 동작하지만, 문서 요청 UI의 페이지별 설정 저장소는 아직 없다.

## 구현 원칙

- `/documents`는 문서 요청 기능의 owner 페이지가 된다.
- `/project`는 문서 요청 UI를 중복 구현하지 않고 `/documents` owner를 import해 사용한다.
- `/documents` 설정과 `/canvas` 설정을 섞지 않는다.
- 기존 props는 호환을 위해 유지하되, 최종 렌더링은 `resolvedDocumentsOwnerSettings`를 통해 결정한다.
- 환경설정 값은 surface 단위로 저장한다.
- 설정 저장값은 SSR hydration 오류를 만들지 않도록 클라이언트 첫 렌더 이후에만 반영한다.
- 화이트리스트 밖 수정이 필요하면 구현을 멈추고 이 문서를 먼저 갱신한다.

## 용어

`Documents owner`  
문서 요청 링크 설정, 담당자 지정, 필수 사진/파일 요청, 만료 시각, 기록 패널을 관리하는 중앙 기능.

`Documents owner surface`  
documents owner를 사용하는 실제 페이지 구분값. 현재는 `documents`, `project` 두 가지다.

`Canvas owner`  
상자 편집 캔버스 자체의 중앙 기능. `/canvas`가 설정을 소유한다.

`Resolved settings`  
기본값, 저장값, props override를 순서대로 병합한 최종 설정.

## 화이트리스트

구현 시 아래 경로 외 수정 금지.

| 경로 | 허용 목적 |
| --- | --- |
| `docs/0524docenv.md` | 설계, 체크리스트, 백업/복구 기준 갱신 |
| `docs/diff/0524docenv-00/**` | 구현 전 백업 코드 보관 |
| `src/app/documents/_owner/documentsOwnerSettings.ts` | documents owner 설정 타입, 기본값, 저장소, hook 추가 |
| `src/app/documents/_owner/documentOwnerTypes.ts` | settings 관련 prop/type 확장 |
| `src/app/documents/_owner/DocumentsOwnerWorkspace.tsx` | settings 적용, 설정 UI, 진단 속성, 기존 prop 병합 |
| `src/app/documents/_owner/index.ts` | 새 settings type/hook export가 필요할 때만 수정 |
| `src/app/project/page.tsx` | `/project`의 하드코딩 prop 축소 및 surface 기반 사용 전환 |

## 수정 금지

- `src/app/canvas/**`
- `src/components/template/**`
- `src/components/ui/**`
- `src/app/request-links/**`
- `src/app/member-access/**`
- `src/app/templates/**`
- `src/app/api/**`
- `src/services/**`
- `src/lib/**`
- `package.json`, `package-lock.json`, `tsconfig.json`, lint/build 설정
- SQL 파일과 Supabase 관련 문서

예외가 필요하면 구현을 멈추고 이 문서의 화이트리스트를 먼저 갱신한다.

## 백업 규칙

구현 전 반드시 백업 코드를 남긴다.

백업 위치:

```text
docs/diff/0524docenv-00/
```

백업 대상:

```text
src/app/documents/_owner/documentsOwnerSettings.ts
src/app/documents/_owner/documentOwnerTypes.ts
src/app/documents/_owner/DocumentsOwnerWorkspace.tsx
src/app/documents/_owner/index.ts
src/app/project/page.tsx
```

백업 방식:

- 체크리스트 항목 ID와 같은 이름의 파일로 백업한다.
- 원본 파일이 있으면 원본 내용을 그대로 복사한다.
- 원본 파일이 없던 경우에는 `FILE DID NOT EXIST`를 기록한다.
- 백업 후 SHA-256 해시를 `docs/diff/0524docenv-00/SHA256SUMS.txt`에 기록한다.
- 구현 실패 시 이 백업 묶음만 원위치로 복구한다.

예상 백업 구조:

```text
docs/diff/0524docenv-00/
  SHA256SUMS.txt
  01-documentsOwnerSettings.before.ts
  02-documentOwnerTypes.before.ts
  03-DocumentsOwnerWorkspace.before.tsx
  04-owner-index.before.ts
  05-project-page.before.tsx
```

체크리스트 항목과 백업 파일 대응:

| 체크리스트 ID | 백업 파일 | 원본 경로 |
| --- | --- | --- |
| 01-documentsOwnerSettings | `01-documentsOwnerSettings.before.ts` | `src/app/documents/_owner/documentsOwnerSettings.ts` |
| 02-documentOwnerTypes | `02-documentOwnerTypes.before.ts` | `src/app/documents/_owner/documentOwnerTypes.ts` |
| 03-DocumentsOwnerWorkspace | `03-DocumentsOwnerWorkspace.before.tsx` | `src/app/documents/_owner/DocumentsOwnerWorkspace.tsx` |
| 04-owner-index | `04-owner-index.before.ts` | `src/app/documents/_owner/index.ts` |
| 05-project-page | `05-project-page.before.tsx` | `src/app/project/page.tsx` |

## 설계

### 1. settings 파일 추가

새 파일:

```text
src/app/documents/_owner/documentsOwnerSettings.ts
```

핵심 타입:

```ts
export type DocumentsOwnerSurface = 'documents' | 'project';

export type DocumentsOwnerRequestSetupStepKey =
  | 'box-assignee'
  | 'photo'
  | 'file'
  | 'expiration';

export type DocumentsOwnerSettings = {
  showPageHeader: boolean;
  showRefreshButton: boolean;
  showDocumentPicker: boolean;
  showSelectedDocumentSummary: boolean;
  showRequestSetup: boolean;
  showDocumentHistory: boolean;
  requestSetupLayout: 'two-column' | 'single-column';
  settingsColumnWidth: string;
  enabledSteps: DocumentsOwnerRequestSetupStepKey[];
  defaultStep: DocumentsOwnerRequestSetupStepKey;
  showStepSummary: boolean;
  allowPreviousStep: boolean;
  allowSkipStep: boolean;
  allowNewMemberRegistration: boolean;
  memberSearchScope: 'document' | 'document-and-site';
  allowDocumentLevelMediaRequest: boolean;
  allowAttachmentBoxMediaRequest: boolean;
  requireMediaTagColor: boolean;
  defaultExpirationDays: number;
  showExpirationRelativeTime: boolean;
  renderMode: 'full' | 'current-work-panel';
};
```

저장소 타입:

```ts
export type DocumentsOwnerSettingsStore = {
  version: 1;
  surfaceSettings: Record<string, Partial<DocumentsOwnerSettings>>;
};
```

localStorage key:

```text
mejai.documents.ownerSettings.v1
```

### 2. 기본값 분리

`documents` 기본값:

- `showPageHeader: true`
- `showRefreshButton: true`
- `showDocumentPicker: true`
- `showSelectedDocumentSummary: true`
- `showRequestSetup: true`
- `showDocumentHistory: true`
- `requestSetupLayout: 'two-column'`
- `enabledSteps: ['box-assignee', 'photo', 'file', 'expiration']`
- `defaultStep: 'box-assignee'`
- `allowNewMemberRegistration: true`
- `memberSearchScope: 'document-and-site'`
- `allowDocumentLevelMediaRequest: true`
- `allowAttachmentBoxMediaRequest: true`
- `requireMediaTagColor: true`
- `defaultExpirationDays: 7`
- `showExpirationRelativeTime: true`
- `renderMode: 'full'`

`project` 기본값:

- `showPageHeader: false`
- `showRefreshButton: false`
- `showDocumentPicker: false`
- `showSelectedDocumentSummary: false`
- `showRequestSetup: true`
- `showDocumentHistory: false`
- `requestSetupLayout: 'two-column'`
- `enabledSteps: ['box-assignee', 'photo', 'file', 'expiration']`
- `defaultStep: 'box-assignee'`
- `allowNewMemberRegistration: true`
- `memberSearchScope: 'document-and-site'`
- `allowDocumentLevelMediaRequest: true`
- `allowAttachmentBoxMediaRequest: true`
- `requireMediaTagColor: true`
- `defaultExpirationDays: 7`
- `showExpirationRelativeTime: true`
- `renderMode: 'current-work-panel'`

### 3. 저장값 읽기 hook

`useStoredDocumentsOwnerSettings(context)`를 추가한다.

hydration 원칙:

- `useState` 초기값은 서버와 클라이언트 모두 기본값만 사용한다.
- localStorage 저장값은 `useEffect` 이후 반영한다.
- storage event와 custom event를 구독한다.
- `/canvas`의 `useStoredCanvasOwnerSettings`와 같은 패턴을 따르되 저장 key와 타입은 분리한다.

필요 함수:

```ts
createEmptyDocumentsOwnerSettingsStore()
normalizeDocumentsOwnerSettings()
normalizeDocumentsOwnerSettingsStore()
resolveDocumentsOwnerSettings()
readDocumentsOwnerSettingsFromStorage()
saveDocumentsOwnerSettingsStoreToStorage()
updateDocumentsOwnerSettingsStoreOverride()
useStoredDocumentsOwnerSettings()
```

### 4. prop 병합 규칙

최종 설정 계산 순서:

1. surface 기본값
2. localStorage 저장값
3. 기존 prop override

기존 prop과 settings 대응:

| 기존 prop | settings 대응 |
| --- | --- |
| `hideDocumentPicker` | `showDocumentPicker = false` |
| `hidePageHeader` | `showPageHeader = false` |
| `embedded` | wrapper 레이아웃만 보정, 설정 저장값으로 직접 저장하지 않음 |
| `renderMode` | `renderMode` |
| `surface` | settings surface context |

기존 prop은 제거하지 않는다.  
기존 호출부가 깨지지 않도록 유지하고, 내부에서 settings override로 해석한다.

### 5. DocumentsOwnerWorkspace 적용

`DocumentsOwnerWorkspace`는 아래 값을 만든다.

```ts
const storedDocumentsOwnerSettings = useStoredDocumentsOwnerSettings({
  surface,
});

const resolvedDocumentsOwnerSettings = resolveDocumentsOwnerWorkspaceSettings({
  surface,
  storedSettings: storedDocumentsOwnerSettings.settings,
  props,
});
```

렌더링은 `hideDocumentPicker`, `hidePageHeader`, `renderMode` 직접 조건 대신
`resolvedDocumentsOwnerSettings`를 기준으로 결정한다.

예:

- `showPageHeader === false`면 page header 숨김
- `showDocumentPicker === false`면 문서 선택 패널 숨김
- `showRequestSetup === false`면 지금 할 작업 패널 숨김
- `showDocumentHistory === false`면 문서 기록 숨김
- `renderMode === 'current-work-panel'`이면 current work panel만 반환
- `enabledSteps`에 없는 단계는 stepper에서 렌더링하지 않음
- 현재 단계가 비활성화되면 `defaultStep` 또는 첫 enabled step으로 보정
- `defaultExpirationDays`로 만료 기본값 계산
- `showExpirationRelativeTime === false`면 `N일 Y시간 후` 텍스트 숨김

### 6. 설정 UI

설정 UI는 `/documents` 전체 화면에서만 노출한다.

노출 조건:

```ts
surface === 'documents' && !embedded
```

제안 위치:

- 페이지 헤더 아래
- `1. 작업할 문서 고르기` 위
- 제목: `문서 요청 기능 환경설정`

UI 구성:

- surface 선택: `문서 관리`, `현장 관리`
- 표시 항목:
  - 페이지 헤더
  - 새로고침 버튼
  - 문서 선택
  - 선택 문서 요약
  - 지금 할 작업
  - 이 문서 기록
- 요청 단계:
  - 상자에 담당자 지정
  - 필수 사진 등록
  - 필수 파일 등록
  - 만료 시각 설정
- 레이아웃:
  - 2열
  - 1열
  - 오른쪽 설정 열 너비
- 구성원:
  - 새 구성원 등록 허용
  - 문서 구성원만 검색
  - 문서 + 현장 구성원 검색
- 사진/파일:
  - 문서 직접 등록 허용
  - 첨부파일 상자 연결 허용
  - 태그 색상 필수
- 만료:
  - 기본 만료 일수
  - 상대 시간 표시

### 7. 진단 속성

최상위 wrapper에 아래 속성을 추가한다.

```tsx
data-documents-owner-surface={surface}
data-documents-owner-render-mode={resolvedDocumentsOwnerSettings.renderMode}
data-documents-owner-settings-source={...}
data-documents-owner-enabled-steps={resolvedDocumentsOwnerSettings.enabledSteps.join(',')}
```

브라우저 검증과 소통 오류 방지를 위한 속성이다.

### 8. `/project` 전환

최종 목표는 `/project`에서 하드코딩 prop을 줄이는 것이다.

현재:

```tsx
<DocumentsOwnerWorkspace
  initialSiteId={selectedOwnerSiteId}
  lockedDocumentId={selectedOwnerDocumentId}
  hideDocumentPicker
  hidePageHeader
  embedded
  surface="project"
  renderMode="current-work-panel"
/>
```

전환 후 권장:

```tsx
<DocumentsOwnerWorkspace
  initialSiteId={selectedOwnerSiteId}
  lockedDocumentId={selectedOwnerDocumentId}
  embedded
  surface="project"
/>
```

단, 기존 동작 보존이 우선이다.  
초기 구현에서는 기존 prop을 유지하되, settings와 충돌하지 않는지 확인한 뒤 단계적으로 줄인다.

## 체크리스트

구현 시 아래 항목을 빠뜨리면 완료로 보지 않는다.

- [ ] 01-documentsOwnerSettings 백업 파일을 만들었다.
- [ ] 02-documentOwnerTypes 백업 파일을 만들었다.
- [ ] 03-DocumentsOwnerWorkspace 백업 파일을 만들었다.
- [ ] 04-owner-index 백업 파일을 만들었다.
- [ ] 05-project-page 백업 파일을 만들었다.
- [ ] `docs/diff/0524docenv-00/SHA256SUMS.txt`를 작성했다.
- [ ] 화이트리스트 밖 파일을 수정하지 않았다.
- [ ] `documentsOwnerSettings.ts`를 추가했다.
- [ ] `DocumentsOwnerSettings` 타입을 정의했다.
- [ ] `DocumentsOwnerSettingsStore` 타입을 정의했다.
- [ ] `documents`, `project` surface 기본값을 분리했다.
- [ ] localStorage key를 `mejai.documents.ownerSettings.v1`로 분리했다.
- [ ] settings normalize 함수를 추가했다.
- [ ] settings resolve 함수를 추가했다.
- [ ] settings 저장 함수와 custom event dispatch를 추가했다.
- [ ] `useStoredDocumentsOwnerSettings` hook을 추가했다.
- [ ] hook 초기 렌더가 localStorage를 직접 읽지 않게 했다.
- [ ] `DocumentsOwnerWorkspace`가 `resolvedDocumentsOwnerSettings`를 사용한다.
- [ ] 기존 `hideDocumentPicker`, `hidePageHeader`, `renderMode` prop 호환을 유지했다.
- [ ] `showPageHeader` 설정이 page header에 반영된다.
- [ ] `showRefreshButton` 설정이 새로고침 버튼에 반영된다.
- [ ] `showDocumentPicker` 설정이 문서 선택 패널에 반영된다.
- [ ] `showSelectedDocumentSummary` 설정이 선택 문서 요약에 반영된다.
- [ ] `showRequestSetup` 설정이 지금 할 작업 패널에 반영된다.
- [ ] `showDocumentHistory` 설정이 이 문서 기록 패널에 반영된다.
- [ ] `enabledSteps` 설정이 stepper에 반영된다.
- [ ] 비활성 단계가 현재 단계인 경우 안전하게 보정된다.
- [ ] `defaultStep` 설정이 초기 단계에 반영된다.
- [ ] `allowPreviousStep` 설정이 이전 버튼에 반영된다.
- [ ] `allowSkipStep` 설정이 건너뛰기 버튼에 반영된다.
- [ ] `allowNewMemberRegistration` 설정이 새 구성원 등록 버튼에 반영된다.
- [ ] `memberSearchScope` 설정이 구성원 검색 옵션에 반영된다.
- [ ] `allowDocumentLevelMediaRequest` 설정이 문서 직접 등록 흐름에 반영된다.
- [ ] `allowAttachmentBoxMediaRequest` 설정이 첨부파일 상자 연결 흐름에 반영된다.
- [ ] `requireMediaTagColor` 설정이 태그 색상 흐름에 반영된다.
- [ ] `defaultExpirationDays` 설정이 기본 만료 시각에 반영된다.
- [ ] `showExpirationRelativeTime` 설정이 `N일 Y시간 후` 출력에 반영된다.
- [ ] `requestSetupLayout` 설정이 1열/2열 레이아웃에 반영된다.
- [ ] `settingsColumnWidth` 설정이 2열 설정 열 너비에 반영된다.
- [ ] `/documents` 전체 화면에 환경설정 UI를 추가했다.
- [ ] 환경설정 UI는 `embedded` 상태에서 보이지 않는다.
- [ ] 환경설정 UI에서 `documents` surface를 수정할 수 있다.
- [ ] 환경설정 UI에서 `project` surface를 수정할 수 있다.
- [ ] `/project`는 documents owner 기능을 중복 구현하지 않는다.
- [ ] `/project`의 기존 동작이 settings 적용 후에도 유지된다.
- [ ] `/documents` 내부 `CanvasOwnedWorkspace`의 캔버스 설정은 여전히 `/canvas` 설정을 따른다.
- [ ] `/documents` 설정에서 `canvasViewMode`, `canvasSelectionMode`, `canvasTextInteractionMode`, `selectionInactiveOverlayOpacity`를 다루지 않는다.
- [ ] 최상위 wrapper에 `data-documents-owner-surface`가 출력된다.
- [ ] 최상위 wrapper에 `data-documents-owner-render-mode`가 출력된다.
- [ ] 최상위 wrapper에 `data-documents-owner-settings-source`가 출력된다.
- [ ] 최상위 wrapper에 `data-documents-owner-enabled-steps`가 출력된다.
- [ ] `rg -n "mejai.documents.ownerSettings.v1" src/app/documents/_owner`로 저장소 key를 확인했다.
- [ ] `rg -n "canvasViewMode|canvasSelectionMode|canvasTextInteractionMode|selectionInactiveOverlayOpacity" src/app/documents/_owner` 결과가 settings 구현에 새로 섞이지 않았음을 확인했다.
- [ ] `git diff --check`를 통과했다.
- [ ] `npm run check:no-shadow-app`를 통과했다.
- [ ] 가능한 경우 `/documents` 브라우저 검증을 했다.
- [ ] 가능한 경우 `/project` 브라우저 검증을 했다.

## 브라우저 확인 기준

### `/documents`

- 환경설정 패널이 보인다.
- `문서 관리` surface 설정을 변경할 수 있다.
- 표시 항목 설정을 바꾸면 해당 패널이 보이거나 숨겨진다.
- 요청 단계 설정을 바꾸면 stepper 항목이 바뀐다.
- 만료 기본 일수를 바꾸면 새로 열린 만료 단계 기본값이 바뀐다.
- `N일 Y시간 후` 출력은 설정으로 숨길 수 있다.
- 상자 편집 캔버스 자체의 view/mode는 `/canvas` 설정을 계속 따른다.

### `/project`

- `/project`는 documents owner를 import해 사용한다.
- `project` surface 설정을 변경하면 `/project` 임베드 형태에 반영된다.
- 문서 선택은 `/project`에서 고정된 문서 기준으로 유지된다.
- `/project`가 문서 요청 UI를 중복 구현하지 않는다.

## 복구 기준

문제가 생기면 아래 파일만 백업에서 되돌린다.

```text
src/app/documents/_owner/documentsOwnerSettings.ts
src/app/documents/_owner/documentOwnerTypes.ts
src/app/documents/_owner/DocumentsOwnerWorkspace.tsx
src/app/documents/_owner/index.ts
src/app/project/page.tsx
```

복구 후 실행:

```text
git diff --check
npm run check:no-shadow-app
```

`tsc --noEmit`은 현재 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts`의 기존 문법 오류로 실패할 수 있으므로, 실패 시 변경 파일과 무관한 기존 오류인지 분리해서 기록한다.
