# Sites Project 설계 문서

상태: 설계 검토 중. 이 문서의 방향이 확정되기 전까지 구현을 시작하지 않는다.

대상 URL:
- `http://localhost:3001/sites`
- 참고 화면: `http://localhost:3001/project`
- 참고 구조: `http://localhost:3001/canvas`

## 목표

`/sites` 페이지를 `/project` 페이지의 운영형 화면 구성 방식에 맞춰 재구성한다.

핵심 목표는 세 가지다.

- `/sites` 화면을 현장 목록, 선택 현장 요약, 체크리스트, 문서/사진/구성원 상태, 작업 액션을 한 화면에서 다루는 운영형 workspace로 바꾼다.
- `/sites` 페이지 기능은 기존 `/api/sites*`와 분리된 독립 API를 사용한다.
- `/canvas`처럼 UI, 상태, 기능 정책, API client 코드를 한 폴더에서 관리하고, 다른 페이지가 같은 코드를 import해서 쓰게 한다.

## 현재 파악한 결론

현재 `/project`는 아래 API와 DTO에 의존한다.

- `GET /api/sites`
- `POST /api/sites`
- `GET /api/sites/:siteId`
- `DELETE /api/sites/:siteId`
- `GET /api/sites/:siteId/checklist`
- `GET /api/sites/:siteId/photo-label-gaps`
- `src/lib/siteChecklistDtos.ts`

따라서 기존 `/api/sites*`, `siteChecklistService`, `siteChecklistDtos`는 `/project`와 여러 페이지의 공유 계약이다. `/sites` 독립화 작업에서 이 계약을 수정하거나 삭제하면 안 된다.

## 설계 원칙

1. 기존 `/project` 동작을 깨지 않는다.
2. `/sites` 전용 API는 기존 `/api/sites*` 경로를 재사용하지 않는다.
3. `/sites` 전용 UI/기능 코드는 한 폴더에 모은다.
4. 다른 페이지가 `/sites` 기능을 쓰려면 이 폴더의 public export만 import한다.
5. 공유 컴포넌트와 서비스 수정은 화이트리스트에 없으면 금지한다.
6. 각 구현 단계는 같은 이름의 백업 파일을 먼저 만든 뒤 진행한다.
7. 체크리스트 항목 이름과 백업 디렉터리 이름을 동일하게 유지한다.
8. 구현은 이 문서에 대한 사용자 승인 후 시작한다.

## 권장 폴더 구조

`/canvas`의 `page.tsx`, `ownerPolicy.tsx`, `ownerSettings.ts`, `accessRolePolicy.ts` 패턴을 `/sites`에 맞게 적용한다.

권장 구조:

```txt
src/app/sites/
  page.tsx
  _workspace/
    index.ts
    SitesWorkspace.tsx
    sitesWorkspaceTypes.ts
    sitesWorkspaceClient.ts
    sitesWorkspacePolicy.ts
    sitesWorkspaceState.ts
    sitesWorkspaceFormatters.ts
    sitesWorkspaceActions.ts
    SitesWorkspace.parts.tsx
```

역할:

- `page.tsx`: route entry. 직접 비즈니스 로직을 갖지 않고 `SitesWorkspace`만 렌더링한다.
- `_workspace/index.ts`: 다른 페이지가 import할 public surface.
- `SitesWorkspace.tsx`: `/project` 방식의 화면 조립, 탭/패널/선택 상태 연결.
- `sitesWorkspaceClient.ts`: `/sites` 전용 독립 API client.
- `sitesWorkspacePolicy.ts`: import 허용 surface, 액션 권한, read/write 모드 정책.
- `sitesWorkspaceState.ts`: 필터, 선택 현장, 대시보드 refresh key 등 상태 계산.
- `sitesWorkspaceActions.ts`: 현장 생성, 체크리스트 재계산, 삭제 준비 등 사용자 액션 함수.
- `SitesWorkspace.parts.tsx`: 반복 UI 조각.

다른 페이지에서 사용할 때는 아래처럼 `_workspace` public export만 사용한다.

```tsx
import { SitesWorkspace } from '../sites/_workspace';
```

## 독립 API 설계

기존 `/api/sites*`는 `/project` 공유 계약으로 보존한다. `/sites` 페이지는 새 API namespace를 사용한다.

권장 namespace:

```txt
src/app/api/sites-workspace/
  route.ts
  [siteId]/
    route.ts
    checklist/route.ts
    photo-label-gaps/route.ts
```

권장 HTTP 계약:

- `GET /api/sites-workspace`: `/sites` 전용 현장 목록과 화면 요약 조회
- `POST /api/sites-workspace`: `/sites` 전용 현장 생성
- `GET /api/sites-workspace/:siteId`: `/sites` 전용 현장 상세/삭제 영향 조회
- `DELETE /api/sites-workspace/:siteId`: `/sites` 전용 현장 삭제
- `GET /api/sites-workspace/:siteId/checklist`: `/sites` 전용 체크리스트 조회
- `POST /api/sites-workspace/:siteId/checklist`: `/sites` 전용 체크리스트 재계산
- `GET /api/sites-workspace/:siteId/photo-label-gaps`: `/sites` 전용 사진 증빙 누락 요약

주의:

- 새 API가 내부적으로 기존 service를 읽는 것은 설계 승인 후 별도 판단한다.
- 외부 계약은 반드시 `/api/sites-workspace*`여야 한다.
- 기존 `/api/sites*` 경로를 `/sites` page client에서 직접 호출하지 않는다.

## 화면 구성 방향

`/project`와 유사한 운영형 구성으로 바꾼다.

필수 영역:

- 현장 선택/검색 영역
- 현장 생성 액션
- 선택 현장 요약
- 문서 상태 요약
- 체크리스트 상태 요약
- 사진 증빙 누락 요약
- 구성원/권한 요약
- 작업 피드백 메시지
- 삭제 영향 확인과 삭제 액션

권장 탭:

- `overview`: 현장 상태와 핵심 할 일
- `documents`: 필요 문서와 연결 문서 상태
- `photos`: 사진 증빙 요구와 누락 상태
- `members`: 현장 구성원과 권한 상태
- `settings`: 현장 생성/규칙/삭제 관리

UI 원칙:

- 마케팅형 hero가 아니라 업무형 dashboard로 구성한다.
- 기존 `Button`, `Badge`, `Card`, `EntityPicker`, `MultiEntityPicker`, `MejaiScrollTable` 등 local UI 컴포넌트를 우선 사용한다.
- 카드 중첩과 장식용 배경 요소를 만들지 않는다.
- `/project`와 같은 현장 운영 용어를 사용하되, `/sites` 독립 API에서 받은 데이터만 렌더링한다.

## Public Import 계약

`src/app/sites/_workspace/index.ts`에서만 외부 export를 허용한다.

허용 export 후보:

- `SitesWorkspace`
- `SitesWorkspaceClient`
- `type SitesWorkspaceProps`
- `type SitesWorkspaceMode`
- `type SitesWorkspaceApi`
- `sitesWorkspacePolicy`

금지:

- 다른 페이지가 `_workspace` 내부 파일을 직접 import하는 것
- 다른 페이지가 `/sites/page.tsx`를 import하는 것
- 다른 페이지가 `/api/sites-workspace*` 응답 shape를 임의 타입으로 재정의하는 것

## 수정 화이트리스트

이 설계가 승인된 뒤에도 아래 경로만 수정할 수 있다.

### 1차 구현 허용

- `src/app/sites/page.tsx`
- `src/app/sites/_workspace/**`
- `src/app/api/sites-workspace/**`
- `src/lib/sitesWorkspaceDtos.ts`
- `src/services/sitesWorkspaceService.ts`
- `docs/siteporj.md`
- `docs/backups/siteporj/**`

### 조건부 허용

아래 파일은 명시 승인 없이는 수정하지 않는다.

- `src/app/page.tsx`
  - `/sites` 링크명 또는 설명 변경이 필요할 때만 허용한다.
- `src/components/ui/**`
  - 기존 UI 컴포넌트에 명확한 결함이 있고, `/project`와 `/sites`가 동시에 필요한 경우만 허용한다.

### 수정 금지

아래 파일과 폴더는 이번 작업의 수정 대상이 아니다.

- `src/app/project/page.tsx`
- `src/app/api/sites/**`
- `src/services/siteChecklistService.ts`
- `src/lib/siteChecklistDtos.ts`
- `src/services/templateService.ts`
- `src/lib/templateDtos.ts`
- `src/app/documents/**`
- `src/app/photos/**`
- `src/app/request-links/**`
- `src/app/messaging/**`
- `src/app/exports/**`
- `src/app/bulk-ops/**`
- `docs/applied/**`
- `docs/diff/**`
- DB bootstrap SQL 파일

금지 대상 수정이 필요해 보이면 구현을 중단하고 사용자에게 먼저 확인한다.

## 백업 규칙

구현 전 각 체크리스트 항목마다 같은 이름의 백업 디렉터리를 만든다.

백업 위치:

```txt
docs/backups/siteporj/<CHECKLIST_ID>/
```

백업 파일명 규칙:

```txt
<원본파일명>.before
```

예시:

```txt
docs/backups/siteporj/SITEPORJ-01-FOLDER/page.tsx.before
docs/backups/siteporj/SITEPORJ-02-API/route.ts.before
docs/backups/siteporj/SITEPORJ-03-WORKSPACE/SitesWorkspace.tsx.before
```

규칙:

- 파일을 수정하기 전에 반드시 백업한다.
- 새 파일은 백업 대상이 아니지만, 체크리스트 항목에 새 파일 목록을 기록한다.
- 한 체크리스트 항목에서 여러 파일을 수정하면 모두 같은 항목 디렉터리에 백업한다.
- 파괴적 회귀가 확인되면 해당 항목 디렉터리의 `.before` 파일로 되돌릴 수 있어야 한다.
- 백업 없이 수정된 파일이 발견되면 구현을 중단한다.

## 구현 체크리스트

상태 표기는 `[ ]`, `[~]`, `[x]`만 사용한다.

### SITEPORJ-00-APPROVAL

- [ ] 이 문서의 방향에 대해 사용자 승인을 받는다.
- [ ] API namespace를 `sites-workspace`로 확정한다.
- [ ] `/project` 파일을 이번 구현에서 수정하지 않는다는 점을 확정한다.

### SITEPORJ-01-FOLDER

- [ ] `docs/backups/siteporj/SITEPORJ-01-FOLDER/` 백업 디렉터리를 만든다.
- [ ] 수정 전 `src/app/sites/page.tsx`를 백업한다.
- [ ] `src/app/sites/_workspace/` 폴더를 만든다.
- [ ] `_workspace/index.ts` public export 파일을 만든다.
- [ ] `page.tsx`는 `SitesWorkspace` route wrapper로 축소한다.

### SITEPORJ-02-API

- [ ] `docs/backups/siteporj/SITEPORJ-02-API/` 백업 디렉터리를 만든다.
- [ ] `src/app/api/sites-workspace/**` route를 추가한다.
- [ ] `src/lib/sitesWorkspaceDtos.ts`를 추가한다.
- [ ] `src/services/sitesWorkspaceService.ts`를 추가한다.
- [ ] `/sites` client가 기존 `/api/sites*`를 호출하지 않도록 한다.
- [ ] 기존 `src/app/api/sites/**`는 수정하지 않는다.

### SITEPORJ-03-WORKSPACE

- [ ] `docs/backups/siteporj/SITEPORJ-03-WORKSPACE/` 백업 디렉터리를 만든다.
- [ ] `SitesWorkspace.tsx`를 추가한다.
- [ ] `sitesWorkspaceClient.ts`를 추가한다.
- [ ] `sitesWorkspaceState.ts`를 추가한다.
- [ ] `sitesWorkspaceActions.ts`를 추가한다.
- [ ] `sitesWorkspacePolicy.ts`를 추가한다.
- [ ] `/project`와 유사한 현장 선택, 요약, 작업 피드백 구조를 구현한다.

### SITEPORJ-04-UI

- [ ] `docs/backups/siteporj/SITEPORJ-04-UI/` 백업 디렉터리를 만든다.
- [ ] `SitesWorkspace.parts.tsx`를 추가한다.
- [ ] overview/documents/photos/members/settings 탭 구성을 구현한다.
- [ ] 현장 생성, 체크리스트 재계산, 삭제 영향 확인 액션을 같은 UI 흐름 안에 둔다.
- [ ] 텍스트가 버튼이나 카드 안에서 넘치지 않도록 반응형 제약을 둔다.

### SITEPORJ-05-PUBLIC-IMPORT

- [ ] `docs/backups/siteporj/SITEPORJ-05-PUBLIC-IMPORT/` 백업 디렉터리를 만든다.
- [ ] 외부 import는 `src/app/sites/_workspace/index.ts`만 허용한다.
- [ ] 내부 파일 직접 import가 없는지 `rg "sites/_workspace/" src`로 확인한다.
- [ ] 향후 다른 페이지에서 `SitesWorkspace`를 import할 때 API adapter를 주입할 수 있게 한다.

### SITEPORJ-06-REGRESSION

- [ ] `docs/backups/siteporj/SITEPORJ-06-REGRESSION/` 백업 디렉터리를 만든다.
- [ ] `/project`가 여전히 기존 `/api/sites*`를 사용하는지 확인한다.
- [ ] `/project` 파일이 git diff에 포함되지 않는지 확인한다.
- [ ] `/api/sites*` 파일이 git diff에 포함되지 않는지 확인한다.
- [ ] `/sites`가 `/api/sites-workspace*`만 호출하는지 확인한다.

### SITEPORJ-07-VERIFY

- [ ] `npm run lint`를 실행한다.
- [ ] `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false`를 실행한다.
- [ ] dev server에서 `http://localhost:3001/sites`를 연다.
- [ ] dev server에서 `http://localhost:3001/project`를 열어 회귀가 없는지 확인한다.
- [ ] `curl http://localhost:3001/api/sites`가 기존 응답 계약을 유지하는지 확인한다.
- [ ] `curl http://localhost:3001/api/sites-workspace`가 새 응답 계약을 반환하는지 확인한다.

## 승인 전 결정 필요 사항

아래 항목은 구현 전 사용자와 확정한다.

- 독립 API namespace를 `/api/sites-workspace`로 확정할지 여부
- `/sites` 전용 service가 내부적으로 기존 `SiteChecklistService`를 읽어도 되는지 여부
- `/project`가 이번 단계에서 새 `SitesWorkspace`를 import하지 않고 그대로 남는지 여부
- `/sites` 화면에서 구성원 영역을 1차 구현에 포함할지, placeholder로 둘지 여부
- 백업 파일을 `docs/backups/siteporj`에 남기는 방식이 충분한지 여부

## 중단 조건

아래 상황이 발생하면 즉시 구현을 중단하고 사용자 확인을 받는다.

- 화이트리스트 밖 파일 수정이 필요해진 경우
- 기존 `/api/sites*` 계약 변경이 필요해진 경우
- `/project` 구현 수정이 필요해진 경우
- `/sites` 독립 API와 기존 현장 데이터 모델의 책임 경계가 불명확한 경우
- 타입/런타임 검증에서 `/project` 회귀가 확인된 경우

## 완료 기준

구현 완료 판단 기준:

- `/sites/page.tsx`는 route wrapper 역할만 한다.
- `/sites` 기능 코드는 `src/app/sites/_workspace/**`에 모여 있다.
- `/sites` client는 `/api/sites-workspace*`만 호출한다.
- 기존 `/api/sites*`와 `/project`는 수정되지 않았다.
- 다른 페이지는 `_workspace/index.ts` public export를 통해서만 `/sites` 기능 코드를 import할 수 있다.
- 백업 디렉터리와 체크리스트 항목 이름이 일치한다.
- lint, typecheck, `/sites`, `/project`, 기존 `/api/sites`, 새 `/api/sites-workspace` 검증을 통과한다.
