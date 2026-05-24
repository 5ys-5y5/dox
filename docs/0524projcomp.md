# 0524 Project Documents Owner Component Placement Design

작성일: 2026-05-24  
대상: `/project`, `/documents` owner component  
상태: 설계 문서. 실제 구현은 별도 지시 전까지 금지.

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

## 화이트리스트

구현 시 아래 경로 외 수정 금지.

| 경로 | 허용 목적 |
| --- | --- |
| `docs/0524projcomp.md` | 설계, 체크리스트, 백업/복구 기준 갱신 |
| `docs/diff/0524projcomp-00/**` | 구현 전 백업 코드 보관 |
| `src/app/documents/_owner/documentOwnerTypes.ts` | `DocumentsOwnerWorkspace` 렌더 모드 타입 추가 |
| `src/app/documents/_owner/DocumentsOwnerWorkspace.tsx` | `current-work-panel` 단독 렌더 모드 추가 |
| `src/app/documents/_owner/index.ts` | 새 타입 export가 필요할 때만 수정 |
| `src/app/project/page.tsx` | owner 컴포넌트 배치 변경, 기존 하단 캔버스 자리 교체 |

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

## 체크리스트

구현 시 아래 항목을 빠뜨리면 완료로 보지 않는다.

- [ ] 구현 전 `docs/diff/0524projcomp-00/`에 백업 코드를 남겼다.
- [ ] 백업 파일의 SHA-256 해시를 기록했다.
- [ ] 화이트리스트 밖 파일을 수정하지 않았다.
- [ ] `DocumentsOwnerRenderMode` 타입을 추가했다.
- [ ] `DocumentsOwnerWorkspaceProps.renderMode`를 추가했다.
- [ ] `DocumentsOwnerWorkspace`의 기본 `renderMode`는 `full`이다.
- [ ] `current-work-panel` 카드 렌더링을 함수로 분리했다.
- [ ] `renderMode="current-work-panel"`일 때 `current-work-panel` 카드만 반환한다.
- [ ] `/documents` 페이지는 기존 전체 화면 구조를 유지한다.
- [ ] `/project` 우측 카드에서 `선택 문서 요청 링크 설정` 아래 owner 임베드를 제거했다.
- [ ] `/project` 하단 기존 `CanvasOwnedWorkspace` 자리를 `DocumentsOwnerWorkspace renderMode="current-work-panel"`로 교체했다.
- [ ] 문서 미선택 빈 상태는 유지했다.
- [ ] 현장 생성 폼이 열린 상태의 안내는 유지했다.
- [ ] `data-documents-owner-item="current-work-panel"`이 `/project` 하단 자리에서 확인된다.
- [ ] `/project`에서 `선택 문서 요청 링크 설정` 텍스트 아래에는 `current-work-panel`이 존재하지 않는다.
- [ ] `/documents`의 `data-documents-owner-item="current-work-panel"`은 기존처럼 존재한다.
- [ ] `rg -n "선택 문서 요청 링크 설정" src/app/project/page.tsx` 결과가 없거나, 해당 텍스트가 owner 패널을 감싸지 않는다.
- [ ] `rg -n "renderMode" src/app/documents/_owner src/app/project/page.tsx`로 연결 상태를 확인했다.
- [ ] `git diff --check`를 통과했다.
- [ ] 가능한 경우 `npx esbuild src/app/documents/page.tsx --bundle --platform=browser --format=esm --outfile=/tmp/documents-page.mjs`를 통과했다.
- [ ] 가능한 경우 `npx esbuild src/app/project/page.tsx --bundle --platform=browser --format=esm --outfile=/tmp/project-page.mjs`를 통과했다.

## 브라우저 확인 기준

가능하면 `http://localhost:3001/project`에서 확인한다.

- 현장 문서를 선택하면 하단 영역에 `지금 할 작업` 패널이 나온다.
- 하단 패널 DOM에 `data-documents-owner-item="current-work-panel"`이 있다.
- 우측 `선택 문서 요청 링크 설정` 카드 안에는 owner 작업 패널이 없다.
- `/documents`는 기존처럼 `작업할 문서 고르기`, `지금 할 작업`, `이 문서 기록`이 모두 보인다.

## 복구 기준

문제가 생기면 아래 파일만 백업에서 되돌린다.

```text
src/app/documents/_owner/documentOwnerTypes.ts
src/app/documents/_owner/DocumentsOwnerWorkspace.tsx
src/app/documents/_owner/index.ts
src/app/project/page.tsx
```

복구 후 `git diff --check`를 실행한다.
