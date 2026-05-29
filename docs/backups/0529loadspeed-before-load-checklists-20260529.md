# 0529 Project 문서 편집 로딩 개선 설계

작성일: 2026-05-29  
상태: 설계 문서. 이 문서 작성 단계에서는 코드 수정 금지.  
대상: `/project` 현장 문서 선택, 문서 상세 조회, `CanvasOwnedWorkspace`, `TemplateEditWorkspace`

## 목적

`/project` 페이지에서 현장 문서 리스트의 문서를 선택한 뒤 하단 문서 편집 캔버스가 출력되는 과정의 로딩을 줄인다.

이 개선은 문서 편집 기능을 축소하거나 우회하기 위한 작업이 아니다. 편집에 필요한 데이터와 기능은 유지하고, 선택 시점에 불필요하게 함께 로드되는 대용량 데이터와 route-local UI 설정 충돌을 제거하는 작업이다.

## 직접 측정된 문제

브라우저에서 직접 `/project?projectId=1b75a399-09c0-45b7-ab2a-c7cb4b7d791c`를 열고 `작업지시서_대구침산더샵` 문서를 선택해 확인했다.

측정 결과:

| 항목 | 측정값 |
| --- | ---: |
| 문서 선택 후 첫 100ms 체크포인트 실제 도달 | 약 3793ms |
| long task | 약 3659ms |
| 기본 `/api/documents/:id` 응답 | 약 6.52MB |
| `/api/documents/:id?profile=owner-workspace` 응답 | 약 496KB |
| 기본 상세 응답 중 `versions` | 약 5.31MB |
| 기본 상세 응답 중 `linkedTemplate` | 약 724KB |
| `latestVersion.htmlCanonical` | 약 425KB |
| 캔버스 출력 후 DOM | 약 2745 elements |
| 반복 호출된 템플릿 목록 | `/api/templates?limit=64`, 약 316KB |

상세 응답 크기 분해:

| top-level key | 대략 크기 |
| --- | ---: |
| `versions` | 5.31MB |
| `linkedTemplate` | 724KB |
| `latestVersion` | 455KB |
| `signatureEvidence` | 23KB |
| `valueEntries` | 6.8KB |

핵심 원인은 다음이다.

1. `/project`의 편집 경로가 기본 문서 상세 API를 호출해 전체 버전의 전체 HTML 이력을 받는다.
2. 문서 선택 시 `CanvasOwnedWorkspace`가 대형 HTML을 가진 `initialDraft`로 새로 마운트된다.
3. 프로젝트 surface에서는 필요 없는 template persistence 경로가 owner settings에 의해 다시 켜질 수 있고, 이때 `/api/templates?limit=64`가 반복 호출된다.
4. 선택 상태를 URL에 반영하는 `router.replace`로 `_rsc` 요청도 함께 발생한다.

## 제1 원칙

문서 편집 성능 개선은 편집 기능을 삭제하거나 데이터 정합성을 포기해서 달성하면 안 된다.

```ts
/**
 * PROJECT DOCUMENT LOAD SAFETY PRINCIPLE
 * Reduce only data and UI work that is not required for the current document editing path.
 * Document editing must keep the current version HTML, recorded values, attachments,
 * signature/photo/checklist state, save callback, and owner canvas contract intact.
 * If an optimization removes data used by diagnostics, history, or side panels,
 * split that data into a lazy secondary load instead of deleting the feature.
 */
```

## 유지해야 하는 기능

아래 기능은 로딩 개선 후에도 깨지면 안 된다.

- 현장 문서 본문 표시
- 문서 값 표시와 저장
- 첨부 파일 표시와 저장
- 전자서명 상태 표시
- 사진 증빙 상태 표시
- 체크리스트 연결 위치 계산
- `onSaveDraftHtml` 기반 문서 저장
- 선택 문서의 최신 저장본 반영
- 문서 상태 상세 패널의 진단 정보
- 문서 버전 이력 표시 또는 진단이 필요한 경우의 접근 경로

성능 개선은 이 기능들을 제거하지 않고, 필요한 시점에 필요한 크기로만 로드하도록 바꾸는 방식이어야 한다.

## 안전한 개선 방향

### 1. 편집 경로는 owner-workspace 상세 프로필을 사용한다

현재 `/project` 문서 선택 효과는 기본 상세 API를 호출한다.

대상 경로:

- `src/app/project/page.tsx`
- `loadSelectedDocumentDetail`
- `selectedDocumentId` 변경 effect
- 문서 저장 후 상세 재조회 경로

편집 경로에서 필요한 데이터:

- `document`
- `latestVersion.htmlCanonical`
- `valueEntries`
- `valueFiles`
- `signatureEvidence`
- `photoEvidence`
- `photoRequirements`
- `templateLink`
- `queryDebug`

편집 경로에서 즉시 필요하지 않은 데이터:

- 모든 version의 전체 `htmlCanonical`
- linked template의 전체 `draftHtml` 중 최신 version HTML로 대체 가능한 중복 데이터
- template persistence 목록

허용 방향:

```text
/project 문서 편집 선택
  -> /api/documents/:id?profile=owner-workspace
  -> 최신 문서 본문과 편집 필수 데이터만 즉시 로드
  -> 버전 이력/진단이 필요할 때 별도 lazy load
```

금지 방향:

```text
/api/documents/:id 응답에서 versions를 삭제
```

이 방식은 다른 화면의 상세 진단이나 이력 기능을 깨뜨릴 수 있다. 프로필 분리 또는 lazy endpoint 분리가 안전하다.

### 2. 문서 이력과 편집 본문을 분리한다

문서 편집 캔버스는 현재 편집할 최신 본문만 필요하다. 전체 버전의 HTML은 이력 패널, 비교 기능, 진단 기능이 필요할 때만 로드한다.

권장 구조:

| 목적 | API |
| --- | --- |
| 문서 편집 즉시 출력 | `/api/documents/:id?profile=owner-workspace` |
| 문서 버전 목록 요약 | `/api/documents/:id/versions?profile=summary` 또는 기존 상세의 요약 select |
| 특정 버전 본문 | `/api/documents/:id/versions/:versionId` |
| 문서 상태 진단 확장 | lazy query |

`owner-workspace` 응답의 `versions`는 요약 정보만 허용한다. 전체 HTML은 `latestVersion` 하나에만 유지한다.

### 3. 프로젝트 surface의 persistence panel은 중앙 owner contract에서 차단한다

`/project`는 문서 편집 화면이지 템플릿 선택/템플릿 저장 화면이 아니다.

현재 위험:

- `resolveCanvasOwnerRouteDefaults(surface === 'project')`는 `hidePersistencePanel: true`를 반환한다.
- 하지만 `applyCanvasOwnerSettingsToWorkspaceProps`가 기본 owner setting의 `hidePersistencePanel: false`를 덮어쓸 수 있다.
- 그 결과 project surface에서도 `data-template-persistence-panel-visible="true"`가 되고 `/api/templates?limit=64`가 반복 호출된다.

안전한 기준:

- route page에서 직접 `hidePersistencePanel`을 넘기지 않는다.
- `/canvas` owner contract에서 project surface의 persistence 차단 조건을 중앙화한다.
- owner settings는 사용자 설정이지만, project 문서 편집 경로에서 템플릿 persistence가 기능적으로 연결되지 않는다면 진단만 표시하고 런타임 로드는 막는다.

금지 구조:

```ts
// project page에서 임시로 직접 UI prop override
<CanvasOwnedWorkspace hidePersistencePanel />
```

허용 구조:

```text
surface=project
  -> CanvasOwnerRouteContract
  -> project document editing mode
  -> persistence runtime condition: unavailable
  -> no TemplatePersistencePanel mount
  -> /api/templates?limit=64 호출 없음
```

### 4. 캔버스 remount는 필요한 경우에만 발생해야 한다

현재 `CanvasOwnedWorkspace`는 `key`에 `selectedDocumentInitialDraft.draftKey`를 사용한다. 이 키가 문서 본문 content hash까지 포함하면 같은 문서의 같은 편집 경로에서도 불필요한 remount가 생길 수 있다.

안전한 기준:

- 문서 id가 바뀌면 캔버스 상태 초기화는 허용한다.
- 같은 문서에서 상세 재조회만 발생하면 remount가 아니라 내부 draft 갱신으로 처리할 수 있는지 검토한다.
- 저장 후 최신 본문 반영은 필요하지만, 사용자가 입력 중인 상태를 덮어쓰지 않아야 한다.

금지 기준:

- 저장 중 또는 입력 중인 사용자의 편집 draft를 자동 remount로 소실시키는 것
- remount를 막기 위해 최신 저장 본문 반영을 누락하는 것

### 5. URL 동기화와 편집 로딩을 분리한다

문서 선택 시 `router.replace`로 `_rsc` 요청이 발생한다. URL 반영은 필요하지만, 편집 캔버스 초기 출력보다 우선하면 안 된다.

안전한 기준:

- 문서 id state 변경과 상세 API 로드를 먼저 처리한다.
- URL 동기화는 사용자 경험을 막지 않는 방식으로 지연하거나 transition 처리한다.
- URL이 늦게 반영되어도 현재 선택 문서와 저장 대상은 state 기준으로 일관되어야 한다.

## 구현 순서

### 1단계: 측정 기준 고정

코드 수정 전에 다음 수치를 기록한다.

- 문서 클릭부터 loading panel 표시까지 시간
- 문서 클릭부터 `CanvasOwnedWorkspace` 존재까지 시간
- `/api/documents/:id` 응답 크기와 시간
- `/api/documents/:id?profile=owner-workspace` 응답 크기와 시간
- `/api/templates?limit=64` 호출 횟수
- `_rsc` 요청 발생 여부
- 캔버스 출력 후 DOM element 수
- long task 최대값

측정 대상 문서:

```text
siteId: 1b75a399-09c0-45b7-ab2a-c7cb4b7d791c
documentId: 2f6d0be2-8ba5-4d69-aacf-845275a66908
문서명: 작업지시서_대구침산더샵
```

### 2단계: 편집 상세 조회 프로필 전환

`/project` 문서 편집 경로만 `owner-workspace` 프로필을 사용한다.

적용 대상:

- 최초 선택 로드
- 같은 문서 재시도 로드
- 저장 후 상세 재조회
- 서명/사진/첨부 변경 후 상세 재조회

적용 후 확인:

- 문서 본문이 동일하게 출력되는지
- 저장이 정상 동작하는지
- 첨부/서명/사진 체크 상태가 유지되는지
- 문서 상태 상세 패널에서 필요한 진단이 유지되는지

### 3단계: persistence runtime 차단

project surface에서는 template persistence panel이 마운트되지 않아야 한다.

확인 기준:

- `data-template-persistence-panel-visible="false"`
- `/api/templates?limit=64` 호출 없음
- 문서 저장 버튼, 값 입력, 첨부 기능은 유지

이 작업은 `/project` route-local prop으로 처리하지 않고 `/canvas` owner contract에서 처리한다.

### 4단계: 캔버스 초기화 비용 점검

API 응답과 persistence 로딩을 줄인 뒤에도 long task가 남으면 `TemplateEditWorkspace` 초기 draft 적용 경로를 점검한다.

점검 대상:

- `sanitizeTemplateCanvasHtmlGeometry`
- `applyTemplateWorkspaceDocumentState`
- `buildInitialDraftWorkspaceDocumentState`
- preview text fit / auto-size 초기 실행
- DOM 대량 삽입 직후 layout/style recalculation

이 단계는 캔버스 기능 파괴 위험이 크므로 API 최적화와 persistence 차단 후에만 진행한다.

## 기능 보존 검증 체크리스트

수정 후 다음을 모두 통과해야 한다.

- 문서 선택 시 하단 캔버스가 표시된다.
- 선택한 문서 제목이 캔버스 문서명으로 유지된다.
- 기존 최신 본문 HTML이 누락되지 않는다.
- 저장 버튼이 작동한다.
- 저장 후 문서 목록의 버전/상태가 갱신된다.
- 저장 후 하단 캔버스가 최신 본문을 유지한다.
- 첨부 파일 표시와 업로드 경로가 유지된다.
- 서명 상태가 문서 상세에 유지된다.
- 사진 증빙 상태가 문서 상세에 유지된다.
- 문서 상태 상세 패널이 필요한 정보를 표시한다.
- 버전 이력 전체 HTML이 필요한 UI는 lazy load로 접근 가능하다.
- project surface에서 템플릿 persistence 패널은 보이지 않는다.
- project surface에서 `/api/templates?limit=64`는 문서 선택만으로 호출되지 않는다.
- 문서 선택 중 URL 동기화가 편집 로딩을 막지 않는다.

## 성능 통과 기준

같은 문서 기준으로 다음을 목표로 한다.

| 항목 | 목표 |
| --- | ---: |
| 편집 상세 API 응답 크기 | 600KB 이하 |
| 편집 상세 API 시간 | 800ms 이하 |
| 문서 선택 후 loading panel 첫 표시 | 200ms 이하 |
| 문서 선택 후 캔버스 owner workspace 생성 | 1500ms 이하 |
| 문서 선택 중 `/api/templates?limit=64` 호출 | 0회 |
| 문서 선택 중 long task | 500ms 이하 |

대형 HTML 자체가 425KB 수준이므로 캔버스 완전 초기화는 즉시 완료를 보장하기 어렵다. 하지만 네트워크와 불필요한 템플릿 목록 로딩은 먼저 제거해야 한다.

## 금지 사항

- 문서 편집 기능을 빠르게 보이게 하려고 `CanvasOwnedWorkspace`를 제거하지 않는다.
- `latestVersion.htmlCanonical`을 제거하지 않는다.
- `valueEntries`, `valueFiles`, `signatureEvidence`, `photoEvidence`를 편집 상세에서 제거하지 않는다.
- 전체 `versions` 기능을 삭제하지 않는다. 필요하면 lazy load로 분리한다.
- `/project` route에서 canvas UI prop을 직접 덮어쓰지 않는다.
- owner contract를 우회해서 `hidePersistencePanel`만 임시 처리하지 않는다.
- 저장 후 상세 재조회 자체를 삭제하지 않는다.
- 사용자가 편집 중인 draft를 자동 remount로 잃게 만들지 않는다.

## 허용 사항

- `/project` 편집 상세 조회에 `profile=owner-workspace`를 사용한다.
- 전체 버전 HTML을 즉시 응답에서 제외하고, 필요 시 별도 lazy endpoint로 가져온다.
- project surface에서 template persistence panel을 중앙 contract 기준으로 마운트하지 않는다.
- URL 동기화를 transition 또는 지연 처리한다.
- 캔버스 초기화 중 최소 loading UI를 먼저 표시한다.
- 대형 HTML sanitize/apply 비용을 별도 계측한다.

## 예상 변경 대상

| 파일 | 목적 |
| --- | --- |
| `src/app/project/page.tsx` | 문서 상세 조회 프로필 적용, URL 동기화/로딩 순서 점검 |
| `src/app/api/documents/[documentId]/route.ts` | `profile=owner-workspace` 응답 보존 확인 |
| `src/services/documentService.ts` | owner-workspace 프로필이 편집 필수 데이터만 내려주는지 보증 |
| `src/app/canvas/ownerRouteContract.ts` | project surface persistence runtime 차단 기준 중앙화 |
| `src/app/canvas/ownerSettings.ts` | owner settings가 route 필수 차단 조건을 덮어쓰지 못하게 진단/적용 경계 정리 |
| `src/components/template/TemplateEditWorkspace.tsx` | API 최적화 후에도 남는 캔버스 초기화 비용 계측 및 개선 |

## 완료 정의

이 설계의 작업은 다음 조건을 만족할 때 완료로 본다.

- 문서 선택 로딩이 측정 기준 대비 명확히 줄어든다.
- 편집 기능 보존 체크리스트를 통과한다.
- `/canvas` owner first 원칙과 충돌하는 route-local UI override가 없다.
- 문서 이력/진단 기능은 삭제되지 않고 즉시 로드 또는 lazy load 중 하나로 명시된다.
- 브라우저 직접 측정 결과가 문서에 기록된다.
