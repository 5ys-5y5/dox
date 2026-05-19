# Canvas Checklist

`/Users/gy/Documents/dev/docs/src/components/template` 공용 캔버스 코드를 기준으로 `/canvas` owner 페이지에 노출해야 하는 public 설정과 현재 반영 상태를 정리합니다.

## 검토 대상

- [x] `src/components/template/TemplateEditWorkspace.tsx`
- [x] `src/components/template/workspace/types.ts`
- [x] `src/components/template/workspace/panels/TemplatePersistencePanel.tsx`
- [x] `src/components/template/workspace/panels/TemplateEditCanvasToolbar.tsx`
- [x] `src/components/template/workspace/persistence/templateWorkspaceState.ts`

## public props 체크리스트

- [x] `initialTemplateId`
  - `/canvas?mode=template&templateId=...`와 템플릿 선택 상태로 확인 가능
- [x] `initialDraft`
  - `/canvas?mode=document|read&documentId=...`에서 문서 초안을 로드해 확인 가능
- [x] `workspaceMode`
  - `템플릿 / 문서 / 읽기` 모드 버튼으로 확인 가능
- [x] `editableValueKeys`
  - `editableValueKeys 제한` 토글로 샘플 키 제한 상태 확인 가능
- [x] `hideHeader`
  - `헤더 숨김` 토글로 확인 가능
- [x] `hidePersistencePanel`
  - `불러오기 및 저장 숨김` 토글로 확인 가능
- [x] `templateListDisplay`
  - `picker / inline` 선택으로 확인 가능
- [x] `onTemplateSaved`
  - `onTemplateSaved 콜백` 토글과 owner 이벤트 메시지로 확인 가능
- [x] `onSaveDraftHtml`
  - 문서 모드 저장 시 owner 이벤트 메시지로 확인 가능
- [x] `additionalControlPanels`
  - `추가 제어 패널` 토글로 확인 가능
- [x] `topNotice`
  - `topNotice 표시` 토글로 확인 가능
- [x] `suppressInitialDraftLoadedMessage`
  - `초기 draft 안내 억제` 토글 + `draftKey 새로 만들기`로 재확인 가능
- [x] `headerTitle`
  - 입력창으로 변경 확인 가능
- [x] `headerDescription`
  - 입력창으로 변경 확인 가능
- [x] `nameFieldLabel`
  - 입력창으로 변경 확인 가능
- [x] `saveButtonLabel`
  - 입력창으로 변경 확인 가능
- [x] `templateNameReadOnly`
  - `이름 읽기 전용` 토글로 확인 가능
- [x] `saveDisabled`
  - `저장 비활성` 토글로 확인 가능
- [x] `documentAttachmentApiPath`
  - `첨부파일 API 연결` 토글로 확인 가능

## 정책 체크리스트

- [x] 다른 페이지는 `TemplateEditWorkspace`를 직접 쓰지 않고 `CanvasOwnedWorkspace`를 통해 규칙 검증을 거침
- [x] 규칙을 벗어나는 조합은 `notFound()`로 404 처리됨
- [x] `/canvas`는 공용 owner 페이지로 남고, 다른 서비스는 이 규칙을 따라 공용 캔버스를 사용함

## 현재 확인 방식

- [x] `/canvas` 번들 검사
- [x] `ownerPolicy.tsx` 번들 검사
- [x] `/project`, `/documents`, `/request-links/[token]`, `/member-access/document/[documentId]`, `/templates`, `/templates/edit`, `/templates/extract` 번들 검사

## 참고

브라우저 실확인은 `localhost:3001` 실행 환경이 열려 있을 때 별도로 확인합니다. 이 문서는 공용 캔버스 코드 기준의 구현/정책 체크리스트만 다룹니다.
