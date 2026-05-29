# 0529 Canvas Owner 문서 로드 성능 개선 설계

작성일: 2026-05-29  
상태: 설계 문서 재작성 완료. 이 문서 작성 단계에서는 코드 수정 금지.  
백업 포인트:

- 설계 문서 백업: `docs/backups/0529loadspeed-before-load-checklists-20260529.md`
- 구현 시작 전 코드 스냅샷: `docs/backups/loadspeed-implementation-start-20260529/`

대상: `/canvas`, `/canvas?page=project&documentId=...`, `/project`, 문서 상세 API, 문서 목록 API, 캔버스 owner contract

## 목적

문서 편집 로딩을 줄이되, 캔버스 편집 경험을 위해 의도적으로 만든 preload 설계를 파괴하지 않는다.

이 문서의 기준은 다음이다.

- `/canvas`는 모든 편집 기능의 설정과 구현 책임을 가진 owner이다.
- `/project`만을 위한 route-local 성능 우회는 금지한다.
- 탭 전환, 스타일 변경, 엣지 조정, 상자 속성 편집이 DB 왕복 없이 즉시 반응해야 한다.
- 미리 불러오기 자체를 제거하지 않는다.
- 현재 편집에 필요한 상태 preload와, 현재 편집에 필요 없는 대형 이력/목록 preload를 분리한다.
- 하나의 체크리스트를 끝낼 때마다 사용자에게 실제 성능 확인을 요청하고, 승인 전 다음 체크리스트로 넘어가지 않는다.

## 직접 확인한 현재 상태

측정 대상:

```text
siteId: 1b75a399-09c0-45b7-ab2a-c7cb4b7d791c
documentId: 2f6d0be2-8ba5-4d69-aacf-845275a66908
문서명: 작업지시서_대구침산더샵
```

확인된 수치:

| 항목 | 결과 |
| --- | ---: |
| 기본 `/api/documents/:id` 응답 | 약 6.52MB |
| `?profile=owner-workspace` 응답 | 약 496KB |
| 기본 상세 응답 중 `versions` | 약 5.31MB |
| 기본 상세 응답 중 `linkedTemplate` | 약 724KB |
| `latestVersion.htmlCanonical` | 약 425KB |
| `/canvas?page=project&documentId=...`의 문서 상세 요청 | 약 6.52MB |
| `/canvas?page=project&documentId=...`의 `/api/templates?limit=128` | 약 316KB |
| `/canvas?page=project&documentId=...`의 `/api/documents?latestOnly=true` | 약 461KB |
| `/canvas?page=project&documentId=...`의 `/api/templates?limit=64` | 2회, 각 약 316KB |
| `/project` 문서 클릭 후 long task | 약 2.5초 이상 |

중요한 해석:

- `/canvas?page=project...`도 빠른 것이 아니라, 페이지 진입 뒤 비동기로 대형 데이터를 가져오기 때문에 클릭 지연처럼 덜 체감될 뿐이다.
- 구성원/할 일 데이터 자체는 현재 측정상 매우 작다.
- 가장 큰 데이터는 과거 문서 버전 전체 HTML이다.
- preload 자체가 문제라는 결론은 틀렸다. 문제는 preload 범위가 너무 넓거나, 현재 편집에 필요 없는 대형 데이터를 즉시 가져오는 것이다.

## 제1 원칙

```ts
/**
 * CANVAS OWNER LOAD SAFETY PRINCIPLE
 * Do not remove preload that makes canvas editing immediate.
 * Optimize the shape, scope, timing, and duplication of loads through the canvas owner contract.
 * Route pages must not implement page-local shortcuts for document loading performance.
 */
```

## 유지해야 하는 preload

다음은 제거하면 안 된다.

- 현재 편집 중인 최신 문서 본문
- 현재 문서의 저장값
- 첨부 파일 상태
- 서명 상태
- 사진 증빙 상태
- 체크리스트 연결 위치
- 캔버스 상자/프레임/엣지/스타일 계산에 필요한 상태
- 미리보기, 크기 및 위치, 속성, 역할 탭 전환에 필요한 상태
- 탭 전환 전에 계산을 끝내 즉시 보여주는 메모리 상태
- UI에 즉시 보여야 하는 구성원/할 일 카운트

## 최적화 후보

다음은 제거가 아니라 범위 조정, 요약화, 중복 제거, 조건부 preload 대상으로 본다.

- 과거 문서 버전 전체 HTML
- 문서 목록에서 최신 HTML 본문까지 가져오는 것
- page 종류와 관계없이 템플릿 목록과 문서 목록을 모두 가져오는 것
- project surface에서 template persistence 목록이 반복 로드되는 것
- 저장 후 문서 하나만 바뀌었는데 전체 목록을 다시 불러오는 것
- 같은 문서 상세를 중복 호출하는 것

## 최적화 단위와 확인 게이트

로드 최적화는 아래 단위로만 진행한다. 한 단위를 끝내면 반드시 작업을 멈추고 사용자에게 실제 브라우저 성능 확인을 요청한다.

| 게이트 | 로드 단위 | 핵심 목표 | 코드 변경 여부 |
| --- | --- | --- | --- |
| L0 | 기준 측정 | 수정 전 기준치를 고정 | 없음 |
| L1 | 문서 상세 로드 | 최신 버전 중심 상세 응답으로 축소 | 있음 |
| L2 | 문서 목록 로드 | picker/list는 summary만 로드 | 있음 |
| L3 | `/canvas` 목록 preload | page별로 필요한 목록만 우선 preload | 있음 |
| L4 | template persistence runtime | project surface에서 불필요한 template 목록 로드 차단 | 있음 |
| L5 | 할 일/구성원 preload | 실제 병목인지 재측정 후 보존 또는 compact화 | 조건부 |
| L6 | 저장 후 reload | 저장 후 전체 목록 reload 축소 | 있음 |
| L7 | 중복 상세 호출 | 같은 문서 상세 중복 요청 제거 | 있음 |
| L8 | 캔버스 초기화 비용 | API 최적화 후 남는 long task만 후순위 분석 | 조건부 |

## 진행 규칙

각 체크리스트는 독립적으로 처리한다.

1. 체크리스트 시작 전 현재 변경 상태를 확인한다.
2. 필요한 파일만 수정한다.
3. 정적 검사를 실행한다.
4. 브라우저에서 해당 로드만 직접 측정한다.
5. 결과를 사용자에게 보고한다.
6. 사용자에게 성능 확인을 요청한다.
7. 여기서 작업을 멈춘다.
8. 사용자가 승인하기 전 다음 체크리스트로 넘어가지 않는다.

각 단계 종료 보고에는 반드시 다음을 포함한다.

- 변경한 파일
- 줄인 요청 또는 응답 크기
- 유지한 preload
- 문서 편집 기능 보존 여부
- 브라우저 직접 측정 결과
- “다음 체크리스트 진행 전 성능을 확인해 주세요” 요청

## 백업 정책

현재 설계 백업:

- `docs/backups/0529loadspeed-before-load-checklists-20260529.md`

현재 코드 스냅샷:

- `docs/backups/loadspeed-implementation-start-20260529/`

스냅샷에 포함된 파일:

- `src/app/canvas/page.tsx`
- `src/app/project/page.tsx`
- `src/app/canvas/ownerRouteContract.ts`
- `src/app/canvas/ownerSettings.ts`
- `src/app/api/documents/route.ts`
- `src/app/api/documents/[documentId]/route.ts`
- `src/services/documentService.ts`
- `src/lib/documentCanvasHtml.ts`
- `src/lib/documentCanvasState.ts`

체크리스트별 코드 변경 시작 전 추가 백업 포인트:

각 체크리스트 시작 전 변경 대상 파일 백업:

```text
docs/backups/loadspeed-L{번호}-before-YYYYMMDD-HHMM/
```

복구 기준:

- 사용자가 “직전 체크리스트 이전으로 복구”라고 말하면 해당 체크리스트 시작 백업으로 되돌린다.
- 다른 체크리스트 변경까지 함께 되돌리지 않는다.
- 사용자 또는 다른 작업자의 unrelated 변경은 되돌리지 않는다.

체크리스트별 예상 백업 범위:

| 체크리스트 | 예상 백업 파일 |
| --- | --- |
| L1 | `src/services/documentService.ts`, `src/app/api/documents/[documentId]/route.ts`, `src/app/canvas/page.tsx`, `src/app/project/page.tsx` |
| L2 | `src/services/documentService.ts`, `src/app/api/documents/route.ts`, `src/app/canvas/page.tsx` |
| L3 | `src/app/canvas/page.tsx` |
| L4 | `src/app/canvas/ownerRouteContract.ts`, `src/app/canvas/ownerSettings.ts`, 필요 시 owner policy/workspace 파일 |
| L5 | 변경이 필요하다고 확인된 endpoint와 caller만 백업 |
| L6 | `src/app/canvas/page.tsx`, 필요 시 `src/app/project/page.tsx` |
| L7 | 중복 호출이 확인된 caller 파일 |
| L8 | trace로 특정된 캔버스 초기화 함수 파일 |

## 체크리스트 L0: 기준 측정 고정

목표: 수정 전 기준치를 다시 측정해 이후 비교 기준을 고정한다.

수정 파일:

- 없음

측정 대상:

- `/canvas?page=project&documentId=2f6d0be2-8ba5-4d69-aacf-845275a66908`
- `/project?projectId=1b75a399-09c0-45b7-ab2a-c7cb4b7d791c`에서 문서 클릭

확인 항목:

- [ ] `/api/documents/:id` 응답 크기
- [ ] `/api/documents/:id` 응답 시간
- [ ] `/api/documents?latestOnly=true` 응답 크기
- [ ] `/api/templates?limit=128` 호출 여부
- [ ] `/api/templates?limit=64` 호출 횟수
- [ ] request-tasks/document-members/site-members 응답 크기
- [ ] 문서 클릭 후 long task
- [ ] 캔버스 출력 후 DOM element 수
- [ ] `data-template-persistence-panel-visible` 값

완료 후 사용자 확인:

```text
L0 기준 측정이 끝났습니다. 이 수치를 기준으로 다음 체크리스트를 진행해도 되는지 성능 기준을 확인해 주세요.
```

## 체크리스트 L1: 문서 상세 API 최신 버전 중심화

목표: 편집/열람용 문서 상세 로드에서 과거 버전 전체 HTML을 즉시 가져오지 않는다.

핵심 원칙:

- 최신 본문은 유지한다.
- 저장값/첨부/서명/사진/체크리스트 상태는 유지한다.
- 과거 버전 전체 HTML만 즉시 로드에서 제외한다.
- 문서 이력 기능은 삭제하지 않고 필요 시 lazy load로 분리한다.

대상 파일 후보:

- `src/services/documentService.ts`
- `src/app/api/documents/[documentId]/route.ts`
- `src/app/canvas/page.tsx`
- `src/app/project/page.tsx`

작업 항목:

- [ ] `owner-workspace` 또는 편집용 프로필이 최신 버전 본문 하나만 상세 HTML로 내려주는지 확인한다.
- [ ] `versions`는 요약 정보만 내려주도록 보장한다.
- [ ] 전체 과거 버전 HTML이 필요한 기능은 별도 lazy 조회 후보로 남긴다.
- [ ] `/canvas?page=project...`와 `/project`가 같은 문서 상세 로딩 계약을 쓰도록 맞춘다.
- [ ] `/project`만의 임시 조건문으로 처리하지 않는다.

보존해야 할 데이터:

- [ ] `latestVersion.htmlCanonical`
- [ ] `latestVersion.labelValues`
- [ ] `valueEntries`
- [ ] `valueFiles`
- [ ] `signatureEvidence`
- [ ] `photoEvidence`
- [ ] `photoRequirements`
- [ ] `templateLink`
- [ ] 저장 callback에 필요한 document id

검증:

- [ ] `/api/documents/:id?profile=owner-workspace` 또는 확정 프로필 응답이 600KB 내외인지 확인한다.
- [ ] 캔버스에 최신 문서 본문이 표시된다.
- [ ] 저장이 가능하다.
- [ ] 첨부/서명/사진 상태가 사라지지 않는다.
- [ ] 문서 상태 상세 패널이 기본 정보를 유지한다.

완료 후 사용자 확인:

```text
L1 문서 상세 API 최신 버전 중심화가 끝났습니다. /canvas와 /project에서 문서 로드 속도와 편집 기능을 확인해 주세요. 승인 전 다음 체크리스트로 넘어가지 않겠습니다.
```

## 체크리스트 L2: 문서 목록 API 요약화

목표: 문서 선택 목록은 문서 제목, id, 상태, 최신 버전 번호 같은 요약만 가져오고 HTML 본문은 가져오지 않는다.

대상 파일 후보:

- `src/app/canvas/page.tsx`
- `src/app/api/documents/route.ts`
- `src/services/documentService.ts`

현재 위험:

- `/canvas`는 `/api/documents?latestOnly=true`를 호출한다.
- `profile=picker`가 이미 있지만 사용하지 않는다.
- 목록 용도에서 최신 HTML 본문까지 가져올 수 있다.

작업 항목:

- [ ] `/canvas`의 문서 picker/list 로드는 `profile=picker` 또는 동등한 summary profile을 사용한다.
- [ ] 목록에서 필요한 필드를 정의한다.
- [ ] 목록에 HTML 본문이 포함되지 않는지 확인한다.
- [ ] 문서 선택 후 상세 로드는 L1의 편집용 상세 계약을 사용한다.

보존해야 할 기능:

- [ ] 문서 선택 드롭다운/목록 표시
- [ ] 문서명 검색
- [ ] 최신 버전 번호 표시
- [ ] 선택 문서 id 유지

완료 후 사용자 확인:

```text
L2 문서 목록 API 요약화가 끝났습니다. /canvas 문서 선택 목록과 /project 현장 문서 리스트가 정상이며 로딩이 줄었는지 확인해 주세요.
```

## 체크리스트 L3: `/canvas` page별 목록 preload 분리

목표: `/canvas`가 모든 page에서 템플릿 목록과 문서 목록을 동시에 가져오지 않게 한다.

핵심 주의:

- preload를 없애는 것이 아니다.
- 현재 page에 필요한 목록만 먼저 preload한다.
- 다른 page로 전환할 때 필요한 목록은 전환 전에 또는 전환 시점에 preload한다.

대상 파일 후보:

- `src/app/canvas/page.tsx`

현재 위험:

```ts
Promise.all([
  fetchSuccessData('/api/templates?limit=128'),
  fetchSuccessData('/api/documents?latestOnly=true'),
])
```

작업 항목:

- [ ] `usesTemplateList=true` page에서는 템플릿 목록을 preload한다.
- [ ] 문서 기반 page에서는 문서 목록을 summary profile로 preload한다.
- [ ] page 전환 시 필요한 목록이 없으면 즉시 preload한다.
- [ ] `documentId`가 URL에 있으면 상세 로드가 목록 로드를 불필요하게 기다리지 않게 한다.
- [ ] 목록이 필요한 UI가 보이는 경우에는 즉시 사용할 수 있게 유지한다.

보존해야 할 기능:

- [ ] `/canvas` page 선택 전환
- [ ] 템플릿 page에서 템플릿 picker 즉시 표시
- [ ] 문서 page에서 문서 picker 즉시 표시
- [ ] page 전환 시 빈 상태가 장시간 보이지 않음

완료 후 사용자 확인:

```text
L3 /canvas page별 목록 preload 분리가 끝났습니다. /canvas에서 page 전환, 템플릿 선택, 문서 선택이 즉시 수준으로 유지되는지 확인해 주세요.
```

## 체크리스트 L4: project surface persistence runtime 정리

목표: project surface 문서 편집 런타임에서 template persistence 목록이 불필요하게 마운트/로드되지 않게 한다.

중요 금지:

- `/project` route에서 직접 `hidePersistencePanel` prop을 넣어 우회하지 않는다.
- `/canvas` owner contract를 통해 처리한다.

대상 파일 후보:

- `src/app/canvas/ownerRouteContract.ts`
- `src/app/canvas/ownerSettings.ts`
- `src/app/canvas/ownerPolicy.tsx`
- 필요 시 `src/components/template/TemplateEditWorkspace.tsx`

현재 위험:

- project surface 기본값은 persistence 숨김이다.
- owner settings 적용 후 기본 설정의 `hidePersistencePanel: false`가 route 기본값을 덮어쓸 수 있다.
- 그 결과 `/api/templates?limit=64`가 반복 호출된다.

작업 항목:

- [ ] project surface 문서 편집 런타임에서 persistence panel이 기능적으로 사용 가능한지 owner contract에서 판정한다.
- [ ] 사용 불가능한 경우 runtime mount를 막고 `/canvas` 진단에는 이유를 표시한다.
- [ ] 사용자 설정 ON/OFF 자체는 삭제하지 않는다.
- [ ] 모드 진단과 실제 runtime condition을 분리한다.

검증:

- [ ] `/canvas?page=project...`에서 `data-template-persistence-panel-visible="false"` 또는 동등한 runtime 차단 상태
- [ ] 문서 편집 기능 유지
- [ ] `/api/templates?limit=64` 호출 제거
- [ ] `/canvas` 설정 화면에는 왜 표시/마운트되지 않는지 진단 표시

완료 후 사용자 확인:

```text
L4 project surface persistence runtime 정리가 끝났습니다. /canvas 설정과 /project 문서 편집이 모두 의도대로 유지되는지 확인해 주세요.
```

## 체크리스트 L5: 할 일/구성원 preload 재평가

목표: 할 일/구성원 preload가 실제 병목인지 계측하고, 병목이 아니면 유지한다.

현재 측정:

- request-tasks: 매우 작음
- document-members: 약 600B
- site-members: 약 600B

판단:

- 현재 병목으로 보기 어렵다.
- UI 즉시 전환과 카운트 표시를 위해 preload 유지 가능성이 높다.

작업 항목:

- [ ] 응답 크기와 호출 시간을 다시 측정한다.
- [ ] todo panel/구성원 UI가 즉시 표시되어야 하는지 확인한다.
- [ ] 실제 병목이 아니면 코드 변경하지 않는다.
- [ ] 병목이면 lazy load가 아니라 compact preload 또는 batch endpoint를 검토한다.

허용 가능한 개선:

- [ ] request-tasks, document-members, site-members를 한 endpoint로 묶어 왕복 수를 줄인다.
- [ ] 표시 필드만 내려주는 compact profile을 둔다.

금지:

- [ ] 탭이나 패널을 열 때마다 DB를 다시 조회하는 방식으로 되돌리지 않는다.
- [ ] 즉시 카운트 표시를 깨지 않는다.

완료 후 사용자 확인:

```text
L5 할 일/구성원 preload 재평가가 끝났습니다. 즉시 전환 경험이 유지되는지 확인해 주세요.
```

## 체크리스트 L6: 저장 후 전체 목록 reload 축소

목표: 문서 저장 후 전체 템플릿/문서 목록을 매번 다시 불러오지 않게 한다.

대상 파일 후보:

- `src/app/canvas/page.tsx`
- `src/app/project/page.tsx`

현재 위험:

- 문서 하나 저장 후 `loadLists()`가 실행되면 템플릿 목록과 문서 목록을 모두 다시 읽을 수 있다.

작업 항목:

- [ ] 저장 후 선택 문서 상세는 최신 버전 중심 프로필로 재조회한다.
- [ ] 목록은 해당 문서 row만 갱신할 수 있는지 확인한다.
- [ ] 전체 목록 reload가 필요한 경우를 명확히 분리한다.
- [ ] 템플릿 목록은 문서 저장 후 불필요하면 재조회하지 않는다.

보존해야 할 기능:

- [ ] 저장 후 버전 번호 갱신
- [ ] 저장 후 문서 제목/상태 유지
- [ ] 목록의 최신 정보 반영
- [ ] 저장 성공 메시지 유지

완료 후 사용자 확인:

```text
L6 저장 후 전체 목록 reload 축소가 끝났습니다. 저장 후 목록 갱신과 편집 상태가 모두 정상인지 확인해 주세요.
```

## 체크리스트 L7: 중복 상세 호출 제거

목표: 같은 문서 상세를 같은 시점에 중복 호출하지 않게 한다.

작업 항목:

- [ ] 문서 선택, URL 동기화, 저장 후 재조회, owner preview 로드 경로에서 중복 호출을 계측한다.
- [ ] 같은 documentId/profile의 in-flight 요청을 재사용할 수 있는지 검토한다.
- [ ] 중복 제거가 편집 최신성 보장을 깨지 않는지 확인한다.

금지:

- [ ] 저장 후 반드시 필요한 최신 상세 재조회까지 생략하지 않는다.
- [ ] stale detail을 저장 기준으로 사용하지 않는다.

완료 후 사용자 확인:

```text
L7 중복 상세 호출 제거가 끝났습니다. 같은 문서를 반복 선택하거나 저장한 뒤 최신 내용이 유지되는지 확인해 주세요.
```

## 체크리스트 L8: 캔버스 초기화 비용 계측 및 후순위 개선

목표: API/목록/persistence 최적화 후에도 남는 long task를 분석한다.

이 단계는 후순위다. 캔버스 편집 기능 파괴 위험이 가장 크기 때문이다.

점검 대상:

- `sanitizeTemplateCanvasHtmlGeometry`
- `applyTemplateWorkspaceDocumentState`
- `buildInitialDraftWorkspaceDocumentState`
- preview text fit
- auto-size 초기 계산
- DOM 대량 삽입 후 style/layout recalculation

작업 항목:

- [ ] API 최적화 후 long task를 다시 측정한다.
- [ ] 어떤 함수가 long task를 만드는지 trace로 확인한다.
- [ ] 탭 전환 즉시성에 필요한 계산은 유지한다.
- [ ] 계산을 쪼개도 편집 반응성이 좋아지는 경우에만 개선한다.

금지:

- [ ] 미리보기/크기 및 위치/속성/역할 탭의 즉시성을 깨지 않는다.
- [ ] 상자 스타일 변경 시 DB 왕복 구조로 되돌리지 않는다.
- [ ] 엣지 위치 변경 시 DB 재조회 구조로 되돌리지 않는다.

완료 후 사용자 확인:

```text
L8 캔버스 초기화 비용 점검이 끝났습니다. 탭 전환과 상자 편집 반응성이 유지되는지 확인해 주세요.
```

## 우선순위

1. L0 기준 측정 고정
2. L1 문서 상세 API 최신 버전 중심화
3. L2 문서 목록 API 요약화
4. L4 project surface persistence runtime 정리
5. L6 저장 후 전체 목록 reload 축소
6. L7 중복 상세 호출 제거
7. L5 할 일/구성원 preload 재평가
8. L8 캔버스 초기화 비용 계측

L5는 현재 측정상 병목 가능성이 낮으므로 제거 대상이 아니라 보존/검증 대상이다.

## 완료 정의

전체 작업은 다음 조건을 만족해야 완료로 본다.

- 각 체크리스트 종료마다 사용자 성능 확인을 받았다.
- `/canvas` owner contract를 우회하는 `/project` 전용 성능 코드가 없다.
- 문서 편집 중 필요한 preload는 유지됐다.
- 과거 버전 전체 HTML은 편집 초기 로드에서 제외됐다.
- 문서 목록은 summary/picker 데이터만 사용한다.
- template persistence 목록은 project 문서 편집 런타임에서 불필요하게 로드되지 않는다.
- 저장 후 최신 문서 상태와 목록 갱신이 유지된다.
- 탭 전환, 스타일 변경, 엣지 변경이 DB 왕복 없이 즉시 반응한다.

## 추가 설계 O1: Canvas owner 설정 충돌 진단 보강

작성일: 2026-05-29

요청 배경:

- `/canvas?page=project...`와 `/project...`에서 선택 버튼은 보이지만 실제 선택 정책은 `none`으로 내려가 선택이 되지 않았다.
- 원인은 `allowCanvasBoxSelection=false`가 `canvasSelectionMode="none"`과 `canvasTextInteractionMode="default"`를 만들었기 때문이다.
- 이 값은 "읽기 출력 상자 선택 허용"처럼 보이지만 편집 화면의 상자 선택까지 차단한다.
- 사용자는 설정값 자체를 자동 수정하지 않고, 문제가 되는 조건만 `/canvas`에서 식별 가능한 알림으로 드러내기를 원한다.

백업 포인트:

- 문서 수정 전 백업: `docs/backups/0529loadspeed-before-owner-diagnostics-20260529.md`

### O1 원칙

환경설정 값은 그대로 둔다.

- [ ] `/canvas`가 저장한 page별 설정값을 자동으로 바꾸지 않는다.
- [ ] `/project`, `/member-access`, `/request-links` 등 route-local 코드에서 설정을 강제로 덮어쓰지 않는다.
- [ ] 중앙 owner contract와 owner diagnostics만 확장한다.
- [ ] 실제 기능이 막히거나, 설정은 켜져 있지만 런타임 조건이 없어 동작할 수 없거나, 현재 모드에서 의미가 없는 설정을 알림으로 표시한다.
- [ ] 반대 방향도 진단한다. 예를 들어 편집 화면인데 선택이 차단된 경우와 읽기 화면인데 편집 UI가 노출된 경우를 모두 식별한다.

### O1 진단 모델

현재 진단은 `resolveCanvasOwnerUiFeatureDiagnostics`가 주로 UI 표시 기능 19개를 다룬다. 추가 설계에서는 48개 `CanvasOwnerSettings` 전체를 별도 진단 대상으로 확장한다.

진단 결과는 설정 적용을 바꾸지 않고 다음 정보만 노출한다.

- `settingKey`: 문제가 연결된 설정 키
- `definitionName`: 사용자가 보는 설정 정의 이름
- `severity`: `none | info | warning | blocking-risk`
- `category`: `mode-mismatch | runtime-missing | capability-blocked | inactive-setting | persistence-performance | layout-risk | feedback-risk`
- `configuredValue`: 사용자가 저장했거나 현재 초안으로 둔 값
- `effectiveValue`: 실제 workspace props로 변환된 값
- `message`: 왜 문제가 되는지 한 문장 설명
- `recommendedAction`: 사용자가 직접 판단할 수 있는 권장 조치

중요: `blocking-risk`도 자동 차단이 아니라 알림이다. 설정값과 실제 출력은 사용자가 저장한 상태 그대로 유지한다.

### O1 구현 대상 파일

- [ ] `src/app/canvas/ownerSettings.ts`
- [ ] `src/app/canvas/page.tsx`
- [ ] 필요 시 `src/app/canvas/ownerPolicy.tsx`
- [ ] 필요 시 `src/app/canvas/ownerRouteContract.ts`

### O1 구현 단계

1. 전체 설정 진단 타입 추가
   - [ ] `CanvasOwnerSettingDiagnostic` 타입을 추가한다.
   - [ ] 기존 `CanvasOwnerUiFeatureDiagnostic`는 유지한다.
   - [ ] UI 기능 진단과 설정 충돌 진단을 혼합하지 않고 별도 배열로 계산한다.

2. owner context 확장
   - [ ] `baseProps` 기준으로 template edit mode, document save mode, read-only output mode를 계산한다.
   - [ ] `onSaveDraftHtml`, `onTemplateSaved`, `documentAttachmentApiPath`, `todoPanel`, `additionalControlPanels`, `topNotice` 존재 여부를 runtime capability로 기록한다.
   - [ ] `previewWorkspaceProps` 기준으로 실제 `canvasSelectionMode`, `canvasTextInteractionMode`, `canvasToolbarVisibility`, `persistenceVisibility`, `saveDisabled`, `editableValueKeys`를 기록한다.

3. 문제 조건만 진단
   - [ ] 설정값은 변경하지 않는다.
   - [ ] mode와 capability가 충돌하는 경우만 warning 이상으로 올린다.
   - [ ] 설정이 꺼져 있어도 해당 mode에서 필요 없으면 알림을 띄우지 않는다.
   - [ ] 설정이 켜져 있어도 런타임 연결이 없으면 "보이지만 동작 불가"로 표시한다.
   - [ ] 설정이 꺼져 있어 핵심 편집 기능이 차단되면 "편집 화면인데 기능 차단"으로 표시한다.

4. `/canvas` 표시 추가
   - [ ] 기존 "UI 기능 진단 상태"와 별도로 "설정 충돌 진단" 섹션을 추가한다.
   - [ ] 경고 개수와 blocking-risk 개수를 상단 badge로 표시한다.
   - [ ] 각 설정 row에도 해당 설정의 진단 badge를 표시한다.
   - [ ] 저장 전 초안 상태에서도 진단이 즉시 갱신되게 한다.

5. 브라우저 검증
   - [ ] `/canvas?page=project&documentId=2f6d0be2-8ba5-4d69-aacf-845275a66908`
   - [ ] `/project?projectId=1b75a399-09c0-45b7-ab2a-c7cb4b7d791c&documentId=2f6d0be2-8ba5-4d69-aacf-845275a66908`
   - [ ] `/canvas?page=member-access&documentId=...`
   - [ ] `/canvas?page=request-links&documentId=...`
   - [ ] `/canvas?page=templates`
   - [ ] `/canvas?page=templates-edit`
   - [ ] `/canvas?page=templates-extract-preview`

완료 후 사용자 확인:

```text
O1 Canvas owner 설정 충돌 진단을 추가했습니다. /canvas에서 각 page를 전환하며 경고가 문제 조건만 표시되는지 확인해 주세요.
```

### O1 전체 설정 점검표

아래 48개 설정을 모두 점검 대상으로 둔다.

| 설정 키 | 문제 조건 진단 설계 |
| --- | --- |
| `hideHeader` | standalone 문서/구성원/요청 화면인데 header가 숨겨져 사용자가 현재 문맥을 잃을 수 있으면 info. owner preview에서는 기본적으로 문제 없음. |
| `hidePersistencePanel` | 템플릿 생성/편집처럼 persistence가 필요한 화면에서 숨김이면 warning. 문서 저장/읽기 화면에서 표시되어 template list 로드가 발생하면 persistence-performance warning. |
| `templateListDisplay` | persistence panel이 숨겨져 있으면 inactive-setting info. 문서 기반 page에서 template list UI가 표시되면 persistence-performance warning. |
| `showTopNotice` | true인데 `topNotice`가 없으면 runtime-missing info. false인데 route가 필수 경고를 전달해야 하는 경우 feedback-risk warning. |
| `showWorkspaceMessages` | false이고 저장/편집 동작이 가능한 화면이면 feedback-risk warning. 읽기 전용 출력에서는 문제 없음. |
| `showAdditionalControlPanels` | true인데 `additionalControlPanels`가 없으면 runtime-missing info. false인데 해당 page가 외부 제어 패널을 제공하면 inactive-setting info. |
| `showCanvasTitle` | 제목 숨김 자체는 기능 차단이 아니므로 기본 none. 다른 header도 모두 숨김이면 문맥 상실 info. |
| `showCanvasNameField` | 템플릿 생성/편집에서 숨김이면 이름 편집 차단 warning. 읽기 전용 문서에서 표시되면 mode-mismatch info. |
| `showCanvasSaveButton` | 저장 callback이 있는데 숨김이면 capability-blocked warning. true인데 저장 callback이 없거나 `saveDisabled=true`이면 runtime-missing warning. |
| `showCanvasTodoButton` | true인데 `todoPanel`이 없으면 runtime-missing warning. false인데 todo count가 있으면 inactive-setting info. |
| `showCanvasPreviewToggle` | 문서 저장/읽기 흐름에서 노출되면 mode-mismatch info. 템플릿 편집에서 숨김이면 미리보기 전환 차단 warning. |
| `showCanvasInteractionToolControls` | true인데 `canvasSelectionMode=none`이면 capability-blocked blocking-risk. false인데 편집 화면에서 선택/이동이 가능해야 하면 capability-blocked warning. |
| `showCanvasHistoryControls` | 편집 화면에서 숨김이면 undo/redo 차단 warning. 읽기 전용에서 표시되면 mode-mismatch info. |
| `showCanvasZoomControls` | 숨김 자체는 기능 차단이 아니므로 none. 작은 container 또는 mobile preview에서 숨김이면 접근성 info. |
| `showCanvasFullscreenControl` | 숨김 자체는 기능 차단이 아니므로 none. embedded/project에서 큰 문서 편집인데 숨김이면 사용성 info. |
| `defaultCanvasFullscreen` | embedded page에서 true이면 레이아웃 점유 위험 info. standalone canvas에서는 none. |
| `pageContainerWidth` | 빈 값/정규화 실패/너무 작은 고정폭이면 layout-risk warning. auto width와 충돌해 실제 적용되지 않으면 inactive-setting info. |
| `pageContainerHeight` | 너무 작은 고정높이로 편집 영역이 압축되면 layout-risk warning. 빈 값은 none. |
| `autoCanvasHeight` | false인데 `specifiedCanvasHeight`가 너무 작으면 layout-risk warning. true이면 `specifiedCanvasHeight`는 inactive-setting info. |
| `autoCanvasWidth` | false인데 `specifiedCanvasWidth`가 너무 작으면 layout-risk warning. true이면 `specifiedCanvasWidth`는 inactive-setting info. |
| `specifiedCanvasHeight` | auto height true이면 inactive-setting info. auto height false이고 값이 유효하지 않으면 layout-risk warning. |
| `specifiedCanvasWidth` | auto width true이면 inactive-setting info. auto width false이고 값이 유효하지 않으면 layout-risk warning. |
| `showCanvasEditSettingsToggle` | 편집 화면에서 false이면 상자 편집 패널 진입 차단 warning. 읽기 전용 출력에서 true이면 mode-mismatch info. |
| `showCanvasSelectionPanelTabs` | 편집 화면에서 false이면 크기/속성/역할 탭 접근 차단 warning. 읽기 전용 출력에서 true이면 mode-mismatch info. |
| `showPersistenceTemplateList` | persistence panel이 숨겨져 있으면 inactive-setting info. 문서 기반 page에서 true이고 panel이 표시되면 persistence-performance warning. |
| `showPersistenceTemplateNameField` | persistence panel 숨김이면 inactive-setting info. 문서 기반 page에서 표시되면 mode-mismatch info. |
| `showPersistenceLayoutResizePolicyField` | persistence panel 숨김이면 inactive-setting info. 문서 기반 page에서 표시되면 mode-mismatch info. |
| `showPersistenceSourceDocumentNameField` | persistence panel 숨김이면 inactive-setting info. 문서 기반 page에서 표시되면 mode-mismatch info. |
| `showPersistenceSaveButton` | 템플릿 저장 가능 화면에서 false이면 capability-blocked warning. 문서 저장/읽기 화면에서 true이고 panel이 표시되면 mode-mismatch warning. |
| `suppressInitialDraftLoadedMessage` | true이고 긴 로딩이 발생하면 feedback-risk info. false로 인해 반복 알림이 과하면 feedback-risk info. |
| `headerTitle` | 빈 문자열은 fallback되므로 none. fallback 발생 사실만 inactive-setting info로 표시 가능. |
| `headerDescription` | 빈 문자열은 fallback되므로 none. fallback 발생 사실만 inactive-setting info로 표시 가능. |
| `nameFieldLabel` | 빈 문자열은 fallback되므로 none. name field가 숨겨져 있으면 inactive-setting info. |
| `saveButtonLabel` | 빈 문자열은 fallback되므로 none. save button이 숨겨져 있거나 runtime 저장 불가이면 inactive-setting info. |
| `templateNameReadOnly` | 템플릿 생성/편집에서 true이면 이름 수정 차단 warning. 문서 출력/저장 page에서 false이면 mode-mismatch warning. |
| `saveDisabled` | 저장 callback이 있는데 true이면 capability-blocked warning. 저장 callback이 없는데 false이면 runtime-missing warning. |
| `enableDocumentAttachmentApiPath` | true인데 API path가 없으면 runtime-missing warning. false인데 API path가 있고 문서 편집 화면이면 capability-blocked warning. |
| `limitEditableValueKeys` | 요청/구성원처럼 권한 제한 page에서 false이면 권한 위험 warning. 일반 project 편집에서 true이고 editable key 목록이 비어 있으면 capability-blocked warning. |
| `enableOnTemplateSaved` | 템플릿 저장 화면에서 false이면 저장 후 콜백 차단 warning. true인데 callback이 없으면 runtime-missing info. |
| `stabilizeInitialLayout` | false이고 자동 크기/peer edge/문서 출력이 있으면 layout-risk warning. 단순 템플릿 편집에서는 info 이하. |
| `enableRuntimeInitialAutoSize` | false이고 auto size 대상이 있으면 layout-risk warning. auto size 대상이 없으면 none. |
| `preventInitialValueClearShrink` | false이고 값 제거 과정에서 shrink 위험이 있는 문서면 layout-risk warning. |
| `preventRuntimeAutoSizeShrink` | false이고 runtime 값 변경 후 shrink 위험이 관측되면 layout-risk info. true로 인한 레이아웃 고정 부작용도 info로 표시. |
| `blockPeerClusterHeightTargets` | true이고 peer height cluster가 있으면 layout-risk warning. peer cluster가 없으면 inactive-setting info. |
| `blockPeerClusterWidthTargets` | true이고 peer width cluster가 있으면 layout-risk warning. peer cluster가 없으면 inactive-setting info. |
| `selectionInactiveOverlayOpacity` | 선택이 꺼져 있으면 inactive-setting info. 선택이 켜져 있고 0.85 이상이면 선택 외 항목 가독성 warning. |
| `initialCanvasTab` | 해당 tab UI가 숨겨져 있으면 capability-blocked warning. 읽기 전용 출력에서 편집 tab으로 시작하면 mode-mismatch info. |
| `allowCanvasBoxSelection` | 편집 화면인데 false이면 `canvasSelectionMode=none`이 되어 선택 차단 blocking-risk. 읽기 출력인데 true이면 텍스트 상호작용 대신 상자 선택 정책이 적용됨을 mode-mismatch info로 표시. |

### O1 알림 예시

현재 재현된 문제에는 다음 알림이 떠야 한다.

```text
blocking-risk · allowCanvasBoxSelection
편집 가능한 현장 관리 화면이지만 상자 선택 정책이 none입니다.
선택/이동 버튼은 표시되어도 상자를 선택할 수 없습니다.
```

반대 조건에는 다음 알림이 떠야 한다.

```text
info · allowCanvasBoxSelection
읽기 출력 화면에서 상자 선택 정책이 켜져 있습니다.
텍스트 기본 상호작용 대신 selection-only 정책이 적용됩니다.
```

### O1 완료 정의

- [ ] 48개 설정 키가 모두 진단 점검표에 연결되어 있다.
- [ ] 기존 저장값과 기본값을 자동 변경하지 않는다.
- [ ] `/canvas`에서 page 전환 시 진단이 선택 page 기준으로 갱신된다.
- [ ] `allowCanvasBoxSelection=false` + 편집 가능 project 화면에서 blocking-risk가 표시된다.
- [ ] `showCanvasInteractionToolControls=true` + `canvasSelectionMode=none`도 같은 문제로 표시된다.
- [ ] 저장 callback, 첨부 API, todo panel, topNotice, additionalControlPanels처럼 runtime 연결이 필요한 설정은 연결 누락을 표시한다.
- [ ] persistence 관련 설정은 문서 기반 page에서 불필요한 template list runtime을 유발할 때 성능 경고를 표시한다.
- [ ] layout 관련 설정은 실제 적용 여부와 위험 조건을 구분해 표시한다.
- [ ] 사용자가 알림을 보고 직접 설정을 저장하거나 유지할 수 있다.
