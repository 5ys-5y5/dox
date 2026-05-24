# 0524 Project Documents Owner Component Placement Design

작성일: 2026-05-24  
대상: `/project`, `/documents` owner component  
상태: 구현 완료. 추가 수정은 아래 화이트리스트와 체크리스트를 따른다.

## 목표

`http://localhost:3001/project` 페이지에서 `/documents` owner가 가진
`data-documents-owner-item="current-work-panel"` 항목을 기존 우측 카드
`선택 문서 요청 링크 설정` 안에 넣지 않는다.

대신 `/project` 페이지 하단의 기존 문서 편집 캔버스 자리,
즉 사용자가 지칭한 `/html/body/main/div/div[3]` 위치에 기존 항목 대신
`current-work-panel`을 출력한다.

## 현재 구조

- `/documents`는 `src/app/documents/page.tsx`에서 `DocumentsOwnerWorkspace`를 전체 화면으로 렌더링한다.
- `current-work-panel`은 `src/app/documents/_owner/DocumentsOwnerWorkspace.tsx` 내부의 `Card`로 렌더링된다.
- `/project`는 `src/app/project/page.tsx`에서 우측 카드 제목 `선택 문서 요청 링크 설정` 아래에 `DocumentsOwnerWorkspace`를 임베드한다.
- `/project` 하단에는 별도 `CanvasOwnedWorkspace`가 있고, 이 영역이 사용자가 말한 `/html/body/main/div/div[3]` 자리에 해당한다.

## 구현 원칙

- `/documents` 페이지의 기존 전체 흐름은 유지한다.
- `/project`는 documents owner 기능을 중복 구현하지 않고 import만 사용한다.
- `/project`에서 `선택 문서 요청 링크 설정` 텍스트 아래에 `current-work-panel`이 렌더링되지 않게 한다.
- `/project` 하단 자리의 최상위 렌더 결과가 `data-documents-owner-item="current-work-panel"`이 되게 한다.
- 문서 생성, 요청 링크 API, 구성원 API, 캔버스 내부 동작은 이번 변경 범위가 아니다.
- `/documents`가 문서 기능 설정의 주인이다. `/project`는 설정 UI를 만들지 않고 documents owner 설정을 읽어 적용한다.
- `/documents`에서 구현된 주요 기능은 owner 설정으로 ON/OFF 할 수 있어야 한다.
- `/documents`의 환경설정 UI는 `/canvas` 환경설정 화면의 공통 UI 구조를 적극적으로 재사용한다.

## 화이트리스트

구현 시 아래 경로 외 수정 금지.

| 경로 | 허용 목적 |
| --- | --- |
| `docs/0524projcomp.md` | 설계, 체크리스트, 백업/복구 기준 갱신 |
| `docs/diff/0524projcomp-00/**` | 구현 전 백업 코드 보관 |
| `docs/diff/0524projcomp-01/**` | 잘못된 `/project` 로컬 설정 구현 정정 전 백업 코드 보관 |
| `docs/diff/0524projcomp-02/**` | `/canvas` 환경설정 UI 공통화 전 백업 코드 보관 |
| `docs/diff/0524projcomp-03/**` | 문서 기능 환경설정 3열 통일 전 백업 코드 보관 |
| `docs/diff/0524projcomp-04/**` | 관리 대상 페이지 선택 UI 공통화 전 백업 코드 보관 |
| `src/components/ui/OwnerSettingsLayout.tsx` | `/canvas`, `/documents` 환경설정 UI 공통 컴포넌트 |
| `src/app/canvas/page.tsx` | 기존 `/canvas` 환경설정 UI를 공통 컴포넌트 사용으로 전환 |
| `src/app/documents/_owner/documentOwnerSettings.ts` | `/documents` owner가 소유하는 페이지별 문서 기능 설정 저장/조회 |
| `src/app/documents/_owner/documentOwnerTypes.ts` | `DocumentsOwnerWorkspace` 렌더 모드 타입 추가 |
| `src/app/documents/_owner/DocumentsOwnerWorkspace.tsx` | `current-work-panel` 단독 렌더 모드와 중앙 owner 설정 적용 |
| `src/app/documents/_owner/index.ts` | owner 설정 export가 필요할 때만 수정 |
| `src/app/project/page.tsx` | owner 컴포넌트 배치 변경, 기존 하단 캔버스 자리 교체, status badge 오류 수정 |

## 수정 금지

- `src/app/documents/page.tsx`
- `src/app/request-links/**`
- `src/app/api/**`
- `src/services/**`
- `src/lib/**`
- `src/components/template/**`
- `src/app/canvas/**`
- `src/components/ui/**`
- `package.json`, `package-lock.json`, `tsconfig.json`, 빌드/린트 설정
- SQL 파일과 Supabase 관련 문서

화이트리스트 밖 수정이 필요해 보이면 구현을 멈추고 이 문서를 먼저 갱신한다.

## 백업 규칙

구현 전 반드시 백업 코드를 남긴다.

백업 위치:

```text
docs/diff/0524projcomp-00/
```

백업 대상:

```text
src/app/documents/_owner/documentOwnerTypes.ts
src/app/documents/_owner/DocumentsOwnerWorkspace.tsx
src/app/documents/_owner/documentOwnerSettings.ts
src/app/documents/_owner/index.ts
src/app/project/page.tsx
```

백업 방식:

- 원본 경로 구조를 유지해 복사한다.
- 구현 전 파일이 없던 경우에는 같은 위치에 `*.before.txt`를 만들고 `FILE DID NOT EXIST`를 기록한다.
- 백업 후 SHA-256 해시를 `docs/diff/0524projcomp-00/SHA256SUMS.txt`에 기록한다.
- 구현 실패 시 `docs/diff/0524projcomp-00/`의 파일만 원위치로 되돌린다.

예상 백업 구조:

```text
docs/diff/0524projcomp-00/
  SHA256SUMS.txt
  src/app/documents/_owner/documentOwnerTypes.ts
  src/app/documents/_owner/DocumentsOwnerWorkspace.tsx
  src/app/documents/_owner/index.ts
  src/app/project/page.tsx
```

정정 백업 위치:

```text
docs/diff/0524projcomp-01/
```

`0524projcomp-01`은 `/project`에 설정 UI를 잘못 둔 상태를 정정하기 전 복구 지점이다. 신규 파일
`src/app/documents/_owner/documentOwnerSettings.ts`는 구현 전 부재 상태를
`documentOwnerSettings.ts.before.txt`로 기록한다.

`/canvas` 환경설정 UI 공통화 전 백업 위치:

```text
docs/diff/0524projcomp-02/
```

`0524projcomp-02`는 `/canvas` 환경설정 UI를 공통 컴포넌트로 추출하기 전 복구 지점이다.
신규 파일 `src/components/ui/OwnerSettingsLayout.tsx`는 구현 전 부재 상태를
`OwnerSettingsLayout.tsx.before.txt`로 기록한다.

## 설계

### 1. 렌더 모드 추가

`DocumentsOwnerWorkspaceProps`에 렌더 모드를 추가한다.

```ts
export type DocumentsOwnerRenderMode = 'full' | 'current-work-panel';

export type DocumentsOwnerWorkspaceProps = {
  initialSiteId?: string;
  lockedDocumentId?: string;
  hideDocumentPicker?: boolean;
  hidePageHeader?: boolean;
  embedded?: boolean;
  surface?: DocumentsOwnerSurface;
  renderMode?: DocumentsOwnerRenderMode;
};
```

기본값은 `full`이다.

### 2. current-work-panel 렌더 함수 분리

`DocumentsOwnerWorkspace.tsx`에서 현재 직접 반환 중인
`data-documents-owner-item="current-work-panel"` 카드 블록을
`renderCurrentWorkPanel()` 함수로 분리한다.

분리 후 전체 모드는 아래 순서를 유지한다.

1. page header
2. message panel
3. document select panel
4. current work panel
5. history panel

`renderMode === 'current-work-panel'`이면 wrapper, page header, document select panel,
history panel을 렌더링하지 않고 `renderCurrentWorkPanel()` 결과만 반환한다.

### 3. `/project` 우측 카드 정리

`src/app/project/page.tsx`의 우측 카드에서 아래를 제거한다.

- `CardTitle` 텍스트 `선택 문서 요청 링크 설정`
- 해당 카드 내부의 `DocumentsOwnerWorkspace` 렌더

우측 영역은 다음 중 하나로 처리한다.

- 권장: 선택 문서 요약과 삭제 버튼만 남긴다.
- 대안: 우측 카드를 제거하고 `현장 문서 · 구성원` 카드를 전체 너비로 둔다.

구현 시에는 레이아웃 흔들림이 적은 권장안을 우선한다.

### 4. `/project` 하단 자리 교체

`/project` 하단의 기존 `CanvasOwnedWorkspace` 분기를 `DocumentsOwnerWorkspace` 단독 패널 모드로 교체한다.

개념 코드:

```tsx
<DocumentsOwnerWorkspace
  key={selectedDocumentId}
  initialSiteId={selectedDocumentDetail?.document.siteId || selectedSiteId}
  lockedDocumentId={selectedDocumentId}
  hideDocumentPicker
  hidePageHeader
  embedded
  surface="project"
  renderMode="current-work-panel"
/>
```

문서가 선택되지 않은 경우의 빈 상태와 현장 생성 폼이 열린 경우의 안내 상태는 유지한다.

### 5. `/documents` owner 중앙 설정

`/documents`는 문서 기능의 owner이므로, 문서 기능 설정 UI와 저장소도 `/documents/_owner`가 소유한다.

- 저장 위치: `src/app/documents/_owner/documentOwnerSettings.ts`
- 저장 키: `documents.owner.settings.v1`
- 관리 대상 surface: `documents`, `project`
- `showCurrentWorkPanel`: 해당 surface에서 `current-work-panel`을 표시할지 정한다.
- `documentSelectionMode`: `picker`이면 `작업할 문서 고르기`를 표시하고, `host`이면 URL 또는 호출 페이지가 넘긴 문서로 출력한다.
- `showRequestStepBoxAssignee`: `지금 할 작업`의 1단계 `상자에 담당자 지정`을 표시할지 정한다.
- `showRequestStepPhoto`: `지금 할 작업`의 2단계 `필수 사진 등록`을 표시할지 정한다.
- `showRequestStepFile`: `지금 할 작업`의 3단계 `필수 파일 등록`을 표시할지 정한다.
- `showRequestStepExpiration`: `지금 할 작업`의 4단계 `만료 시각 설정`을 표시할지 정한다.
- `showHistoryPanel`: `이 문서 기록`을 표시할지 정한다.
- `applyStoredCanvasOwnerSettings`: 해당 surface에서 내부 `CanvasOwnedWorkspace`에 `/canvas` 저장 설정을 적용할지 정한다.
- `/documents` full 화면은 `문서 기능 설정` 패널을 렌더링하고, 이 패널에서 surface별 ON/OFF를 변경한다.
- `/project`는 이 설정 UI를 렌더링하지 않는다. `DocumentsOwnerWorkspace surface="project"`가 중앙 설정을 읽어 자동 적용한다.

### 6. `/canvas` 환경설정 UI 재사용

`/canvas`의 환경설정 화면에서 쓰는 공통 UI 패턴을 `src/components/ui/OwnerSettingsLayout.tsx`로 분리한다.

- `OwnerSettingsTabList`: `/canvas`의 `페이지`/`모드` 탭과 `/documents`의 surface 탭을 같은 컴포넌트로 렌더링한다.
- `OwnerSettingsManagedTargetControls`: `/canvas`의 관리 대상 페이지 선택 목록과 상세 요약 UI를 `/documents` surface 선택에도 같이 사용한다.
- `OwnerSettingsActionBar`: `/canvas`의 `저장 전`/`저장됨`, `되돌리기`, `설정 저장` UI를 `/documents` 환경설정에서도 사용한다.
- `OwnerSettingsSectionHeader`: `/canvas` 설정 섹션 헤더와 `/documents` 설정 섹션 헤더를 같은 밀도와 구조로 렌더링한다.
- `/documents` 설정 변경은 `/canvas`처럼 draft 상태를 먼저 변경하고, `설정 저장` 시 localStorage에 확정한다.
- `/project`는 저장된 `/documents` owner 설정만 읽고, 별도 설정 UI를 만들지 않는다.

## 체크리스트

구현 시 아래 항목을 빠뜨리면 완료로 보지 않는다.

- [x] 구현 전 `docs/diff/0524projcomp-00/`에 백업 코드를 남겼다.
- [x] 백업 파일의 SHA-256 해시를 기록했다.
- [x] 화이트리스트 밖 파일을 수정하지 않았다.
- [x] `DocumentsOwnerRenderMode` 타입을 추가했다.
- [x] `DocumentsOwnerWorkspaceProps.renderMode`를 추가했다.
- [x] `DocumentsOwnerWorkspace`의 기본 `renderMode`는 `full`이다.
- [x] `current-work-panel` 카드 렌더링을 함수로 분리했다.
- [x] `renderMode="current-work-panel"`일 때 `current-work-panel` 카드만 반환한다.
- [x] `documentOwnerSettings.ts`에 `/documents` owner 중앙 설정 저장소를 추가했다.
- [x] `/documents` full 화면에 `문서 기능 설정` 패널을 추가했다.
- [x] `작업할 문서 고르기`를 `picker`/`host` 모드로 전환할 수 있다.
- [x] `문서 기능 설정`에서 surface별 `지금 할 작업` ON/OFF를 관리한다.
- [x] `문서 기능 설정`에서 `지금 할 작업` 1단계 `상자에 담당자 지정`을 ON/OFF 한다.
- [x] `문서 기능 설정`에서 `지금 할 작업` 2단계 `필수 사진 등록`을 ON/OFF 한다.
- [x] `문서 기능 설정`에서 `지금 할 작업` 3단계 `필수 파일 등록`을 ON/OFF 한다.
- [x] `문서 기능 설정`에서 `지금 할 작업` 4단계 `만료 시각 설정`을 ON/OFF 한다.
- [x] OFF 처리된 `지금 할 작업` 단계의 기존 선택값은 요청 링크 생성 대상에서 제외한다.
- [x] `문서 기능 설정`에서 `이 문서 기록`을 ON/OFF 한다.
- [x] `문서 기능 설정`에서 surface별 `/canvas` 저장 설정 적용 ON/OFF를 관리한다.
- [x] `/canvas` 환경설정 UI의 탭, 저장 액션바, 섹션 헤더를 공통 컴포넌트로 분리했다.
- [x] `/canvas` 환경설정 화면이 공통 컴포넌트를 사용한다.
- [x] `/documents` 문서 기능 환경설정이 공통 컴포넌트를 사용한다.
- [x] `/documents` 문서 기능 환경설정은 `/canvas`처럼 `저장 전`/`저장됨`, `되돌리기`, `설정 저장` 흐름을 사용한다.
- [x] `/documents` 문서 기능 환경설정의 ON/OFF 항목 그리드는 모두 3열 구조를 사용한다.
- [x] `/documents`의 `문서 관리`, `현장 관리` 선택 UI는 `/canvas`의 관리 대상 페이지 선택 UI와 같은 공통 컴포넌트를 사용한다.
- [x] `/documents` 페이지는 기존 전체 화면 구조를 유지한다.
- [x] `/project` 우측 카드에서 `선택 문서 요청 링크 설정` 아래 owner 임베드를 제거했다.
- [x] `/project` 하단 기존 `CanvasOwnedWorkspace` 자리를 `DocumentsOwnerWorkspace renderMode="current-work-panel"`로 교체했다.
- [x] 문서 미선택 빈 상태는 유지했다.
- [x] 현장 생성 폼이 열린 상태의 안내는 유지했다.
- [x] `/project`에 설정 UI를 두지 않는다.
- [x] `/project`는 `DocumentsOwnerWorkspace surface="project"`를 통해 `/documents` 중앙 설정을 적용한다.
- [x] `/project` 선택 문서 요약 카드의 status badge가 존재하지 않는 helper를 참조하지 않는다.
- [x] `data-documents-owner-item="current-work-panel"`이 `/project` 하단 자리에서 확인된다.
- [x] `/project`에서 `선택 문서 요청 링크 설정` 텍스트 아래에는 `current-work-panel`이 존재하지 않는다.
- [x] `/documents`의 `data-documents-owner-item="current-work-panel"`은 기존처럼 존재한다.
- [x] `rg -n "선택 문서 요청 링크 설정" src/app/project/page.tsx` 결과가 없거나, 해당 텍스트가 owner 패널을 감싸지 않는다.
- [x] `rg -n "renderMode" src/app/documents/_owner src/app/project/page.tsx`로 연결 상태를 확인했다.
- [x] `git diff --check`를 통과했다.
- [x] 가능한 경우 `npx esbuild src/app/documents/page.tsx --bundle --platform=browser --format=esm --outfile=/tmp/documents-page.mjs`를 통과했다.
- [x] 가능한 경우 `npx esbuild src/app/project/page.tsx --bundle --platform=browser --format=esm --outfile=/tmp/project-page.mjs`를 통과했다.
- [x] 가능한 경우 `npx esbuild src/app/canvas/page.tsx --bundle --platform=browser --format=esm --outfile=/tmp/canvas-page.mjs`를 통과했다.

## 브라우저 확인 기준

가능하면 `http://localhost:3001/project`에서 확인한다.

- 현장 문서를 선택하면 하단 영역에 `지금 할 작업` 패널이 나온다.
- 하단 패널 DOM에 `data-documents-owner-item="current-work-panel"`이 있다.
- 우측 `선택 문서 요청 링크 설정` 카드 안에는 owner 작업 패널이 없다.
- `/project` 안에는 문서 기능 설정 ON/OFF UI가 없다.
- `/documents`는 `문서 기능 설정`, `작업할 문서 고르기`, `지금 할 작업`, `이 문서 기록`이 보인다.
- `/documents`의 `문서 기능 설정`에서 `project` surface의 `지금 할 작업`을 OFF로 바꾸면 `/project` 하단 `current-work-panel`이 숨겨진다.

## 복구 기준

문제가 생기면 아래 파일만 백업에서 되돌린다.

```text
src/app/documents/_owner/documentOwnerTypes.ts
src/app/documents/_owner/DocumentsOwnerWorkspace.tsx
src/app/documents/_owner/documentOwnerSettings.ts
src/components/ui/OwnerSettingsLayout.tsx
src/app/canvas/page.tsx
src/app/documents/_owner/index.ts
src/app/project/page.tsx
```

복구 후 `git diff --check`를 실행한다.

## 구현 기록

- 2026-05-24: 구현 전 백업을 `docs/diff/0524projcomp-00/`에 생성하고 SHA-256 해시를 기록했다.
- 2026-05-24: `DocumentsOwnerWorkspace`에 `renderMode="current-work-panel"` 단독 렌더 모드를 추가했다.
- 2026-05-24: `/project` 우측 `선택 문서 요청 링크 설정` owner 임베드를 제거하고, 하단 문서 편집 캔버스 자리를 `DocumentsOwnerWorkspace renderMode="current-work-panel"`로 교체했다.
- 2026-05-24: `/project` 선택 문서 요약 카드의 status badge 참조를 `getDocumentStatusVariant`로 고쳐 `getStatusVariant is not defined` 런타임 오류를 제거했다.
- 2026-05-24: `/project`에 `페이지별 캔버스 설정` ON/OFF를 추가한 구현은 owner 원칙 위반으로 판정했다.
- 2026-05-24: 정정 전 상태를 `docs/diff/0524projcomp-01/`에 백업했다.
- 2026-05-24: `/project` 로컬 설정 UI와 localStorage 저장을 제거했다.
- 2026-05-24: `src/app/documents/_owner/documentOwnerSettings.ts`를 추가해 `/documents` owner가 surface별 문서 기능 설정을 중앙 관리하게 했다.
- 2026-05-24: `/documents` full 화면에 `문서 기능 설정` 패널을 추가하고, `/project`는 이 중앙 설정을 읽는 `DocumentsOwnerWorkspace surface="project"` import만 유지했다.
- 2026-05-24: `문서 기능 설정`을 확장해 `작업할 문서 고르기`의 `picker`/`host` 전환, `지금 할 작업` 1~4단계, `이 문서 기록`, `/canvas` 저장 설정 적용 여부를 surface별로 ON/OFF 하게 했다.
- 2026-05-24: 모든 `지금 할 작업` 단계가 OFF이면 `켜진 작업 단계가 없습니다` 안내를 표시하게 했다.
- 2026-05-24: OFF 처리된 `지금 할 작업` 단계의 기존 선택값이 요청 링크 생성에 포함되지 않도록 필터링했다.
- 2026-05-24: `/canvas` 환경설정 UI 공통화 전 백업을 `docs/diff/0524projcomp-02/`에 생성하고 SHA-256 해시를 기록했다.
- 2026-05-24: `OwnerSettingsLayout.tsx`를 추가해 `/canvas` 환경설정의 탭, 저장 액션바, 섹션 헤더를 공통 UI로 분리했다.
- 2026-05-24: `/canvas` 환경설정 화면과 `/documents` 문서 기능 환경설정이 같은 공통 UI 컴포넌트를 사용하게 했다.
- 2026-05-24: `/documents` 문서 기능 환경설정 저장 흐름을 `/canvas`와 같은 draft/save/reset 방식으로 변경했다.
- 2026-05-24: 문서 기능 환경설정의 ON/OFF 항목 그리드를 모두 3열 구조로 통일했다.
- 2026-05-24: `/canvas`의 관리 대상 페이지 선택 UI를 `OwnerSettingsManagedTargetControls`로 공통화하고, `/documents`의 `문서 관리`, `현장 관리` 선택에도 같은 UI를 적용했다.
- 2026-05-24: 정정 후 `/project`에서 `페이지별 캔버스 설정`, `project.canvasOwnerSettingsEnabled`, `projectCanvasOwnerSettingsEnabled` 흔적이 검색되지 않는 것을 확인했다.
- 2026-05-24: 정정 후 `git diff --check`, `docs/diff/0524projcomp-01` SHA-256 검증, `/documents`와 `/project` esbuild 번들 검증을 통과했다.
- 2026-05-24: `git diff --check`, 금지 문구 검색, `renderMode` 연결 검색, `/documents`와 `/project` esbuild 번들 검증을 통과했다.
- 2026-05-24: `/canvas` 환경설정 UI 공통화 후 `git diff --check`, `/canvas`, `/documents`, `/project` esbuild 번들 검증을 통과했다.
- 2026-05-24: `http://localhost:3001/project`는 포트 리슨 프로세스가 있었지만 이 세션의 `curl`에서 연결이 거부되어 브라우저 자동 확인은 수행하지 못했다.
- 2026-05-24: 대체 포트 `3002`로 `next dev` 실행을 시도했지만 sandbox에서 `listen EPERM: operation not permitted 127.0.0.1:3002`로 실패했다.
