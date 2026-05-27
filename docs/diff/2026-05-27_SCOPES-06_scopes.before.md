# scopes 설계 문서

작성일: 2026-05-27

## 1. 목적

`data-canvas-owner-item="canvas-container-상자-편집-탭-역할"` 탭의 기존 "담당자 배정" 사고방식을 폐기하고, DB에 이미 구현된 `scopes` 모델을 기준으로 상자 편집 권한을 설계한다.

핵심 원칙은 다음이다.

```text
사용자를 상자에 직접 배정하지 않는다.
key 상자들을 scope에 배정하고, 사용자는 scope에 배정한다.
사용자는 자신이 배정된 scope에 속한 key/value 상자만 편집할 수 있다.
```

즉 역할 탭은 "상자 담당자 지정" 탭이 아니라 "상자 권한 scope 지정" 탭이다.

## 2. 검증된 DB 기준

### 2.1 검증 대상

앱의 실제 Supabase 프로젝트는 다음 URL이다.

```text
https://xniijnjihcjjyuwjjsrc.supabase.co
```

주의: 현재 Supabase MCP가 연결한 프로젝트 URL은 `https://grfkmbrhbvcyahflqttl.supabase.co`였고, 이 프로젝트에는 `scopes` 스키마가 없었다.
따라서 scope 설계 검증은 MCP 결과가 아니라 브라우저에서 `xniijnjihcjjyuwjjsrc.supabase.co` REST API에 직접 접근하여 확인한 결과를 기준으로 한다.

### 2.2 확인 결과

브라우저에서 `https://xniijnjihcjjyuwjjsrc.supabase.co`의 REST schema를 확인한 결과:

- `scopes.scope_registry` 존재
- `scopes.site_scope_assignments` 존재
- REST path는 `/scope_registry`, `/site_scope_assignments`
- 현재 두 테이블 모두 row 수는 `0`
- OpenAPI definitions에 두 테이블 정의가 노출되어 있음

### 2.3 `scopes.scope_registry`

`scope_registry`는 템플릿 안의 key 상자를 scope에 편입시키는 테이블이다.

확인된 컬럼:

| 컬럼 | 타입 | 필수 | 의미 |
| --- | --- | --- | --- |
| `id` | uuid | yes | scope registry row의 PK |
| `template_id` | uuid | yes | 어떤 템플릿의 scope 항목인지 |
| `template_revision_id` | uuid | no | 특정 템플릿 revision에 묶을 때 사용 |
| `key_frame_group_id` | text | yes | scope에 속한 key 상자의 frame group id |
| `value_key` | text | no | key에 연결된 value 식별자 |
| `scope_key` | text | yes | 같은 논리 scope를 묶는 key |
| `display_name` | text | yes | 화면 표시명 |
| `description` | text | no | scope 설명 |
| `status` | text | yes | 기본값 `active` |
| `created_by_member_id` | uuid | no | 생성자 member id |
| `created_at` | timestamptz | yes | 생성 시각 |
| `updated_at` | timestamptz | yes | 수정 시각 |

### 2.4 `scopes.site_scope_assignments`

`site_scope_assignments`는 특정 현장 안에서 scope registry row에 사용자를 배정하는 테이블이다.

확인된 컬럼:

| 컬럼 | 타입 | 필수 | 의미 |
| --- | --- | --- | --- |
| `id` | uuid | yes | assignment row의 PK |
| `site_id` | uuid | yes | 어느 현장에서의 scope 배정인지 |
| `scope_id` | uuid | yes | `scope_registry.id` FK |
| `member_id` | uuid | yes | 이 scope에 배정된 사용자 |
| `status` | text | yes | 기본값 `active` |
| `created_by_member_id` | uuid | no | 배정 생성자 member id |
| `created_at` | timestamptz | yes | 생성 시각 |
| `updated_at` | timestamptz | yes | 수정 시각 |

## 3. 도메인 모델

### 3.1 시각 구조

```text
[템플릿]
   |
   | contains
   v
[key 상자 A] ─┐
[key 상자 B] ─┼──> [논리 scope: 안전관리자 입력영역]
[key 상자 C] ─┘              |
                              | assigned to
                              v
                    [사용자 1, 사용자 2, 사용자 3]
```

DB row 기준으로는 다음 흐름이다.

```text
key 상자들
  -> scopes.scope_registry rows
  -> 같은 template_id + scope_key 기준의 논리 scope
  -> scopes.site_scope_assignments rows
  -> member 편집 권한
```

최종 권한 판정 방향:

```text
사용자
  -> site_scope_assignments
  -> scope_registry
  -> key 상자
  -> 연결 value 상자 편집 권한
```

### 3.2 논리 scope와 물리 scope row

현재 DB 구조에서 `scope_registry.id`는 `site_scope_assignments.scope_id`의 FK 대상이다.
또한 `scope_registry`에는 `key_frame_group_id`가 필수 컬럼으로 존재한다.

따라서 복수 key 상자를 하나의 scope로 묶으려면 다음처럼 해석해야 한다.

```text
논리 scope = template_id + scope_key
물리 scope entry = scope_registry.id 하나
물리 scope entry는 key_frame_group_id 하나를 소유한다.
```

예시:

```text
scope_key = "safety_manager_scope"

scope_registry
┌────┬─────────────┬────────────────────┬──────────────────────┐
│ id │ template_id │ key_frame_group_id │ scope_key             │
├────┼─────────────┼────────────────────┼──────────────────────┤
│ 1  │ template-1  │ key-box-10         │ safety_manager_scope  │
│ 2  │ template-1  │ key-box-11         │ safety_manager_scope  │
│ 3  │ template-1  │ key-box-12         │ safety_manager_scope  │
└────┴─────────────┴────────────────────┴──────────────────────┘

논리적으로는:

[key-box-10]
[key-box-11]  ->  [safety_manager_scope]
[key-box-12]
```

사용자에게는 `safety_manager_scope` 하나로 보여야 하지만, DB 저장 시에는 해당 논리 scope에 속한 `scope_registry.id`들의 assignment를 batch로 다루어야 한다.

## 4. 금지 구조

아래 구조는 구현하면 안 된다.

```text
사용자 -> key 상자
사용자 -> value 상자
사용자 -> 선택된 상자 목록
```

이 방식은 "담당자 배정"이며, DB의 scope 모델을 우회한다.

역할 탭에서 금지되는 구현:

- `selectedBox.assigneeMemberId` 같은 형태로 상자 DTO에 사용자를 직접 저장
- 선택된 key/value 상자마다 member id를 직접 저장
- `/documents`의 request task 담당자 배정 로직을 역할 탭에 복사
- scope를 거치지 않고 member id로 편집 가능 여부를 판정
- 탭 전환, 드래그 선택, 상자 선택 시 DB 조회
- value 상자에 독립 scope를 직접 부여하는 것

## 5. 역할 탭 UX 계약

### 5.1 사용자 흐름

```text
역할 탭 진입
  -> key/value 쌍 선택
  -> 선택 결과에서 key 상자 추출
  -> scope 선택 또는 생성
  -> 선택 key 상자들을 scope에 편입
  -> scope에 사용자 배정
  -> 저장 버튼 클릭 시 DB 반영
```

### 5.2 선택 방식

역할 탭의 상자 선택은 `/documents`의 `request-link-settings-column`과 같은 방식이어야 한다.

필수 조건:

- key/value 쌍이 선택 단위로 움직인다.
- value를 선택해도 연결된 key를 기준으로 scope 대상이 결정된다.
- key를 선택하면 연결된 value는 highlight에 포함된다.
- 드래그 중간 상태에서도 key/value가 같이 선택되어야 한다.
- 드래그 종료 후 뒤늦게 key를 계산하여 추가하는 방식은 실패다.

역할 탭에서 scope 편입 대상은 최종적으로 key 상자다.
value 상자는 편집 권한 판정에서 key의 scope를 따라간다.

### 5.3 패널 구성

역할 탭 오른쪽 패널은 다음 순서로 구성한다.

```text
[선택한 상자]
  - /documents와 같은 MultiEntityPicker
  - 선택된 key/value 쌍 개수
  - scope 편입 대상 key 상자 목록

[scope 선택]
  - 기존 scope 선택
  - 새 scope 생성
  - display_name / scope_key / description 입력

[scope 구성원]
  - 현재 scope에 배정된 구성원 목록
  - 구성원 추가/제거
  - site_id가 없으면 구성원 배정 비활성

[저장]
  - scope_registry 변경분 저장
  - site_scope_assignments 변경분 저장
```

### 5.4 template context와 site context

`scope_registry`는 `template_id`를 가진다.
`site_scope_assignments`는 `site_id`를 가진다.

따라서 역할 탭은 두 context를 분리해야 한다.

```text
template_id 있음, site_id 없음:
  - scope 정의 가능
  - key 상자 scope 편입 가능
  - 사용자 배정은 비활성 또는 보류 상태

template_id 있음, site_id 있음:
  - scope 정의 가능
  - key 상자 scope 편입 가능
  - scope 사용자 배정 가능
```

site context가 없는 템플릿 편집 화면에서 사람 배정을 실제 저장하려고 하면 안 된다.
이 경우 UI는 "scope 정의는 가능하지만 현장 구성원 배정은 현장 선택 후 가능" 상태를 표시해야 한다.

## 6. 서비스 경계

이 기능은 처음부터 단독 서비스로 분리 가능한 단위로 설계한다.
컴포넌트는 DB 스키마를 직접 알지 않고, 계약된 DTO와 command만 사용한다.

### 6.1 TemplateScopeRegistryService

기능 목적:

- 템플릿 key 상자와 scope의 관계를 관리한다.

단독 서비스로서의 가치:

- 템플릿 편집 화면 외부에서도 "이 템플릿의 어떤 key가 어떤 scope에 속하는가"를 조회할 수 있다.
- 향후 scope 자동 생성, scope 추천, 템플릿 권한 설계 API로 분리 가능하다.

책임 범위:

- `template_id` 기준 scope registry preload
- `template_id + scope_key` 기준 논리 scope 구성
- key 상자들의 scope 편입/해제 draft 생성
- 저장 시 `scope_registry` upsert/delete 또는 status 변경 command 생성

비책임 범위:

- 사용자 배정
- 문서 요청 링크 생성
- value 입력 저장
- 캔버스 DOM 직접 조작

API 계약:

```ts
type TemplateScopeRegistryEntryDto = {
  id: string;
  templateId: string;
  templateRevisionId: string | null;
  keyFrameGroupId: string;
  valueKey: string | null;
  scopeKey: string;
  displayName: string;
  description: string | null;
  status: 'active' | string;
};

type TemplateLogicalScopeDto = {
  scopeKey: string;
  templateId: string;
  displayName: string;
  description: string | null;
  registryIds: string[];
  keyFrameGroupIds: string[];
  valueKeys: string[];
  status: 'active' | string;
};

type LoadTemplateScopesInput = {
  templateId: string;
  templateRevisionId?: string | null;
};

type StageTemplateScopeKeysInput = {
  templateId: string;
  scopeKey: string;
  displayName: string;
  description?: string | null;
  keyFrameGroupIds: string[];
  valueKeyByKeyFrameGroupId: Record<string, string | null>;
};
```

데이터 소유권:

- `scope_registry` row의 소유자는 `TemplateScopeRegistryService`다.
- UI는 `scope_key`, `display_name`, 선택된 key 목록만 command로 전달한다.

의존 서비스:

- Template repository
- Canvas selection service
- Supabase repository adapter

분리 배포 최소 조건:

- `template_id` 기반 read API
- logical scope DTO
- scope key 변경 command
- batch 저장 API

### 6.2 SiteScopeAssignmentService

기능 목적:

- 현장별로 scope에 구성원을 배정한다.

단독 서비스로서의 가치:

- 템플릿 편집 화면 없이도 현장 구성원 권한을 관리할 수 있다.
- 현장 관리, 문서 편집, 요청 링크 제한 편집에서 같은 권한 판정 모델을 재사용할 수 있다.

책임 범위:

- `site_id` 기준 assignment preload
- logical scope에 속한 registry ids와 member ids 매핑
- scope 구성원 추가/제거 draft 생성
- 저장 시 `site_scope_assignments` batch 반영

비책임 범위:

- scope registry 생성
- member 초대 문자 발송
- document task 생성
- canvas selection 계산

API 계약:

```ts
type SiteScopeAssignmentDto = {
  id: string;
  siteId: string;
  scopeId: string;
  memberId: string;
  status: 'active' | string;
};

type LogicalScopeMemberAssignmentDto = {
  siteId: string;
  templateId: string;
  scopeKey: string;
  registryIds: string[];
  memberIds: string[];
};

type StageLogicalScopeMembersInput = {
  siteId: string;
  templateId: string;
  scopeKey: string;
  registryIds: string[];
  memberIds: string[];
};
```

데이터 소유권:

- `site_scope_assignments` row의 소유자는 `SiteScopeAssignmentService`다.
- UI는 logical scope와 member id 목록만 전달한다.

의존 서비스:

- `TemplateScopeRegistryService`
- member access service
- Supabase repository adapter

분리 배포 최소 조건:

- `site_id + template_id` 기반 read API
- logical scope assignment DTO
- batch assignment 저장 API

### 6.3 CanvasScopeDraftService

기능 목적:

- 역할 탭에서 사용자가 변경한 scope/key/member 상태를 저장 버튼 전까지 브라우저 메모리에 보관한다.

단독 서비스로서의 가치:

- UI 즉시성과 DB 저장 안정성을 분리한다.
- 탭 전환, 드래그 선택, 선택 변경이 DB latency에 묶이지 않는다.

책임 범위:

- preload된 scope registry/assignment를 메모리 map으로 변환
- 선택된 key 상자의 scope 변경 draft 관리
- scope 구성원 변경 draft 관리
- 저장 전 validation
- 저장 payload 생성

비책임 범위:

- DB 직접 호출
- DOM 직접 mutation
- member 초대

API 계약:

```ts
type CanvasScopeDraftSnapshot = {
  loadedAt: number;
  templateId: string;
  siteId: string | null;
  logicalScopes: TemplateLogicalScopeDto[];
  assignmentsByScopeKey: Record<string, string[]>;
  scopeKeyByKeyFrameGroupId: Record<string, string>;
  dirty: boolean;
};

type CanvasScopeDraftCommand =
  | {
      type: 'assign_keys_to_scope';
      scopeKey: string;
      keyFrameGroupIds: string[];
    }
  | {
      type: 'assign_members_to_scope';
      scopeKey: string;
      memberIds: string[];
    }
  | {
      type: 'create_scope';
      scopeKey: string;
      displayName: string;
      description?: string | null;
    };
```

데이터 소유권:

- 저장 전 변경분은 `CanvasScopeDraftService`가 소유한다.
- 원본 canonical canvas state와 DB state를 직접 덮어쓰지 않는다.

의존 서비스:

- `TemplateScopeRegistryService`
- `SiteScopeAssignmentService`

분리 배포 최소 조건:

- storage-free pure state machine
- command/reducer 테스트
- repository 없는 validation 테스트

### 6.4 CanvasPermissionResolver

기능 목적:

- 현재 사용자가 어떤 상자를 편집할 수 있는지 판정한다.

단독 서비스로서의 가치:

- 편집 캔버스, 문서 읽기 화면, 요청 링크 화면에서 같은 권한 판정을 재사용할 수 있다.

책임 범위:

- value 상자에서 parent key 추적
- key 상자의 scope 조회
- scope에 현재 member가 배정되어 있는지 확인
- 편집 가능/불가 reason 반환

비책임 범위:

- UI 표시
- DB 저장
- member 초대

API 계약:

```ts
type ResolveFrameEditPermissionInput = {
  memberId: string;
  siteId: string;
  frameGroupId: string;
  frameRole: 'key' | 'value' | 'key_value' | 'group' | string;
  parentKeyFrameGroupId?: string | null;
  scopeKeyByKeyFrameGroupId: Record<string, string>;
  memberIdsByScopeKey: Record<string, string[]>;
};

type ResolveFrameEditPermissionOutput = {
  editable: boolean;
  scopeKey: string | null;
  reason:
    | 'member_assigned_to_scope'
    | 'no_scope_for_key'
    | 'member_not_assigned_to_scope'
    | 'missing_parent_key'
    | 'site_context_missing';
};
```

데이터 소유권:

- Permission resolver는 데이터를 소유하지 않는다.
- preload된 DTO/map을 입력받아 순수 계산만 한다.

의존 서비스:

- 없음. 순수 도메인 서비스로 유지한다.

분리 배포 최소 조건:

- DOM 없는 테스트 fixture
- scope map/member map 입력
- permission output snapshot

## 7. 저장 전략

### 7.1 preload

역할 탭에서 사용할 DB 데이터는 진입 전에 preload한다.

필요 데이터:

- `template_id` 기준 active `scope_registry`
- `site_id`가 있으면 active `site_scope_assignments`
- member picker용 site/document member 목록

preload 결과는 아래 map으로 변환한다.

```ts
type ScopeRuntimeMaps = {
  logicalScopeByScopeKey: Map<string, TemplateLogicalScopeDto>;
  scopeKeyByKeyFrameGroupId: Map<string, string>;
  registryIdsByScopeKey: Map<string, string[]>;
  memberIdsByScopeKey: Map<string, string[]>;
};
```

### 7.2 편집 중 동작

편집 중에는 DB를 호출하지 않는다.

허용되는 작업:

- 선택된 key들을 scope draft에 편입
- scope display name 변경 draft
- scope description 변경 draft
- scope member 변경 draft
- 화면 highlight 변경
- 메모리 map 갱신

금지되는 작업:

- 상자 선택 중 DB select
- 탭 전환 중 DB select
- scope picker 열 때마다 DB select
- member picker 검색 중 DB select
- 각 key 선택마다 DB upsert

### 7.3 저장 버튼

저장 버튼에서만 DB 반영을 수행한다.

저장 순서:

1. draft validation
2. 새 logical scope가 있으면 `scope_registry` row 생성 계획 수립
3. 선택 key별 `scope_registry` upsert/status update 계획 수립
4. `site_id`가 있으면 `site_scope_assignments` batch 계획 수립
5. DB 저장 실행
6. 저장 성공 후 preload snapshot 갱신
7. 저장 실패 시 draft 유지 및 오류 표시

`site_scope_assignments.scope_id`는 물리 `scope_registry.id`를 참조하므로, logical scope에 사용자 배정을 저장할 때는 해당 logical scope에 속한 모든 active registry id에 대해 assignment를 맞춰야 한다.

## 8. 속도 조건

역할 탭 scope 설계는 기존 "즉시" 조건을 훼손하면 안 된다.

필수 성능 기준:

- 탭 전환 handler에서 DB 호출 0회
- 상자 선택 handler에서 DB 호출 0회
- 드래그 중 전체 scope 재계산 0회
- key/value 선택 highlight는 기존 fast DOM path 사용
- scope/member 판정은 메모리 map 조회만 사용
- 저장 버튼 전까지 DB write 0회
- 선택 변경 10ms 이하 목표

성능상 허용되는 작업:

- preload 완료 후 map lookup
- 선택된 key id 목록만 scope draft에 반영
- 선택 badge와 summary DOM 즉시 갱신

성능상 금지되는 작업:

- 선택 변경마다 `scope_registry` REST 조회
- 선택 변경마다 `site_scope_assignments` REST 조회
- 선택 변경마다 전체 template HTML 재파싱
- scope 변경마다 preview/metadata/position/role 4개 view 동시 재빌드

## 9. 구현 파일 후보

후속 구현 시 수정이 예상되는 파일은 아래로 제한한다.
목록 외 파일 수정이 필요하면 즉시 중단하고 사용자 승인을 받아야 한다.

| 파일 | 목적 |
| --- | --- |
| `src/services/templateScopeRegistryService.ts` | `scope_registry` DTO, preload, logical scope grouping, 저장 payload |
| `src/services/siteScopeAssignmentService.ts` | `site_scope_assignments` DTO, preload, logical assignment 저장 payload |
| `src/services/canvasScopeDraftService.ts` | 브라우저 메모리 draft reducer/state machine |
| `src/services/canvasPermissionResolver.ts` | scope 기반 편집 권한 순수 판정 |
| `src/components/template/TemplateEditWorkspace.tsx` | 역할 탭 UI 연결, 선택 결과를 scope draft command로 변환 |
| `src/app/api/scopes/template-scopes/route.ts` | template scope preload/save API 후보 |
| `src/app/api/scopes/site-scope-assignments/route.ts` | site scope assignment preload/save API 후보 |
| `src/app/project/page.tsx` | 현장 구성원의 문서 접근을 `보기/편집/서명`이 아니라 template scope 배정으로 전환 |
| `docs/scopes.md` | 본 설계 문서 유지 |

금지:

- 폴더 단위 수정 허용으로 확장하지 않는다.
- `/src/components` 공통 UI 컴포넌트는 수정하지 않는다. 필요 시 기존 picker/button/badge를 사용한다.
- `/documents` request task 담당자 로직을 복사하지 않는다.

## 10. 테스트 계획

### 10.1 DB 구조 확인

브라우저에서 `https://xniijnjihcjjyuwjjsrc.supabase.co` 기준으로 확인한다.

확인 항목:

- `scopes.scope_registry` OpenAPI definition 존재
- `scopes.site_scope_assignments` OpenAPI definition 존재
- `site_scope_assignments.scope_id`가 `scope_registry.id` FK인지 확인
- row가 0건이어도 schema는 존재해야 함

### 10.2 역할 탭 동작 확인

확인 항목:

- 역할 탭 진입 시 scope preload는 1회만 수행
- 탭 전환 중 DB 요청 0회
- 상자 선택 중 DB 요청 0회
- value 선택 시 parent key 기준 scope 후보가 표시
- key 선택 시 연결 value highlight 유지
- scope 선택/생성은 draft에만 반영
- 저장 전 새로고침하면 DB가 변경되지 않음
- 저장 버튼 후에만 DB row 변경

### 10.3 권한 판정 확인

fixture:

```text
key-box-10, key-box-11 -> scope_key: safety_manager_scope
safety_manager_scope -> member-a
member-b는 미배정
```

기대 결과:

- member-a는 key-box-10 및 연결 value 편집 가능
- member-a는 key-box-11 및 연결 value 편집 가능
- member-b는 편집 불가
- scope가 없는 key/value는 편집 불가 또는 정책상 기본 권한으로 분기하되, 이 정책은 별도 명시 필요

### 10.4 성능 확인

브라우저 DevTools에서 확인한다.

- 역할 탭 클릭 후 active tab 반영 10ms 이하 목표
- 드래그 선택 pointer handler 10ms 이하 목표
- 역할 탭 선택 중 Supabase REST request 0회
- 저장 버튼 클릭 전 `scope_registry`, `site_scope_assignments` write 0회
- long task 없음

## 11. 구현 체크리스트

- [x] `xniijnjihcjjyuwjjsrc.supabase.co` 기준 scope schema 재확인
- [x] `TemplateScopeRegistryService` DTO 작성
- [x] `SiteScopeAssignmentService` DTO/저장 경로 작성
- [x] `CanvasScopeDraftService` pure reducer 작성
- [x] `CanvasPermissionResolver` pure function 작성
- [x] 역할 탭의 "담당자" 문구를 "scope 구성원" 문구로 변경
- [x] 역할 탭에서 선택 key들을 scope draft에 편입하는 UI/command 작성
- [x] `site_id` 없는 template context에서 사용자 배정 비활성 처리
- [x] 저장 버튼에서만 scope DB 반영하도록 API route 작성
- [x] 탭 전환 중 DB 요청 0회 검증
- [ ] 상자 선택 중 DB 요청 0회 검증
- [ ] 브라우저에서 key/value linked selection 유지 검증
- [x] Supabase REST/API route로 scope 조회 검증
- [ ] 저장 버튼 후 DB row 변경 검증

### 11.1 2026-05-27 SCOPES-01 구현 기록

수정 전 백업:

- `docs/diff/2026-05-27_SCOPES-01_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-05-27_SCOPES-01_template-workspace-types.before.ts`
- `docs/diff/2026-05-27_SCOPES-01_scopes.before.md`

구현 파일:

- `src/services/canvasScopeDraftService.ts`
- `src/services/canvasPermissionResolver.ts`
- `src/services/templateScopeRegistryService.ts`
- `src/services/siteScopeAssignmentService.ts`
- `src/app/api/scopes/template-scopes/route.ts`
- `src/components/template/TemplateEditWorkspace.tsx`

브라우저 확인:

- URL: `http://localhost:3001/canvas?page=templates&mode=template&templateId=dc080119-76a5-4785-a698-4dca1e1609f1`
- 역할 탭 클릭 return: `1.7ms`
- `position -> role` 재전환 click return: `0.3ms`
- 역할 탭 전환 중 `/api/scopes/template-scopes` 추가 호출: `0`
- `/api/scopes/template-scopes?templateId=dc080119-76a5-4785-a698-4dca1e1609f1` 응답: `200`, `registryEntries=[]`, `logicalScopes=[]`
- 새 scope 생성 UI는 메모리 draft만 변경했고 POST 호출은 `0`

검증 제한:

- 전체 `tsc`는 기존 `docs/diff/*.ts` 문법 오류와 기존 컴포넌트 타입 오류 때문에 통과하지 않는다.
- 신규 서비스/API 파일 단독 타입 검사는 통과했다.
- ESLint는 현재 ESLint 9 설정 파일이 없어 실행되지 않는다.

## 12. 결론

역할 탭의 올바른 모델은 "선택 상자에 담당자 배정"이 아니다.

올바른 모델은 다음이다.

```text
복수 key 상자 -> logical scope -> site별 member assignment -> 편집 권한
```

`scope_registry`는 템플릿 key 상자를 scope에 편입시키는 소유권 테이블이고, `site_scope_assignments`는 scope에 사람을 배정하는 현장별 권한 테이블이다.

따라서 후속 구현은 반드시 scope 서비스를 통해 상자와 사람을 연결해야 하며, 상자 DTO나 캔버스 DOM에 member id를 직접 붙이는 방식은 금지한다.

## 13. 2026-05-27 SCOPES-02 보완 설계: optional 만료 시간, scope CRUD, 중첩 scope

본 보완 설계는 역할 탭을 "scope 지정과 요청 조건 설정" 화면으로 확정하기 위한 추가 조건이다.
아래 내용은 기존 설계를 대체하는 것이 아니라, 기존 scope 설계에 반드시 병합되어야 하는 제약이다.

### 13.1 만료 시간은 값이 있을 때만 제한이다

scope 기반 요청 설정에서 만료 시간은 필수값이 아니다.
만료 시간은 실제 timestamp 값이 존재할 때만 "기한 제한 있음"으로 해석한다.
`undefined`와 `null`은 모두 "기한 제한 없음"으로 동일하게 해석한다.

해석 규칙:

```text
expires_at = undefined
  -> 기한 제한 없음

expires_at = null
  -> 기한 제한 없음

expires_at = timestamp string
  -> 해당 시각 이후 요청/편집/업로드/서명 흐름을 만료 처리
```

정규화 규칙:

```ts
function normalizeExpiresAt(value: string | null | undefined): string | null {
  return value ? value : null;
}
```

UI 규칙:

- 만료 시간 단계는 항상 존재한다.
- 기본 표시 상태는 "기한 제한 없음"이다.
- draft 값이 `undefined`이거나 `null`이면 모두 "기한 제한 없음"으로 표시한다.
- 사용자가 날짜/시간을 선택한 경우에만 `expires_at` 값을 가진다.
- 사용자가 "기한 제한 없음"으로 되돌리면 domain draft는 `null` 또는 `undefined` 어느 쪽이어도 무방하지만, service boundary에서는 `null`로 정규화한다.

저장 규칙:

- domain 의미에서 `undefined`와 `null`은 구분하지 않는다.
- 둘 다 "기한 제한 없음"이다.
- timestamp 문자열이 있을 때만 제한 시간이 저장된다.
- 부분 수정 API에서 "만료 시간 필드를 변경하지 않음"이 필요하면 `undefined`에 그 의미를 부여하지 않는다.
- "변경하지 않음"은 `updateExpiresAt: false` 같은 별도 command 플래그로 표현한다.
- 저장 payload가 request condition 전체를 저장하는 형태라면 `expires_at`은 정규화된 `null` 또는 timestamp 문자열을 가진다.

성능 규칙:

- 만료 시간 변경은 브라우저 메모리 draft만 갱신한다.
- 탭 전환, 상자 선택, 날짜 입력 중 DB 요청을 발생시키지 않는다.
- 저장 버튼을 누르기 전까지 만료 시간 변경은 서버 상태가 아니다.

### 13.2 "상자에 scope 지정" 단계는 scope CRUD를 포함한다

역할 탭의 첫 단계는 단순 scope 선택기가 아니다.
이 단계에서는 템플릿 안에서 사용할 scope를 등록, 수정, 삭제할 수 있어야 한다.

필수 기능:

- 새 scope 등록
- 기존 scope 이름 수정
- 기존 scope 설명 수정
- 기존 scope key 수정 가능 여부 판단
- scope 비활성화 또는 삭제
- 선택 상자를 하나 이상의 scope에 편입
- 선택 상자를 특정 scope에서 해제

권장 UX:

```text
상자에 scope 지정
  - scope 목록
  - 새 scope 추가
  - scope 이름/설명 편집
  - 선택 상자를 이 scope에 포함
  - 선택 상자를 이 scope에서 제외
  - 사용하지 않는 scope 비활성화
```

scope key 수정 규칙:

- 아직 저장되지 않은 draft scope는 `scope_key`를 자유롭게 수정할 수 있다.
- 이미 저장된 scope는 외부 assignment, 요청 이력, 권한 판정에서 참조될 수 있으므로 `scope_key` 직접 변경을 기본 금지한다.
- 저장된 scope의 표시명 변경은 허용한다.
- 저장된 scope의 의미를 바꾸어야 하는 경우 새 scope를 만들고 기존 scope는 `inactive` 처리한다.

삭제 규칙:

- 아직 저장되지 않은 draft scope는 draft에서 제거한다.
- 저장된 scope는 기본적으로 hard delete하지 않고 `status = inactive`로 비활성화한다.
- 해당 scope에 `site_scope_assignments` 또는 요청 이력이 있으면 hard delete 금지다.
- hard delete가 가능한 경우라도 API/service 계층에서만 판단하며 UI는 "삭제" 명령을 서비스 command로 전달한다.

서비스 책임:

```text
TemplateScopeRegistryService
  - scope CRUD draft 생성
  - scope 표시명/설명 변경
  - scope 활성/비활성 상태 변경
  - 상자와 scope membership 변경
  - 저장 payload 생성
```

컴포넌트 금지 사항:

- 컴포넌트가 직접 `scope_registry` row 형태를 조립하지 않는다.
- 컴포넌트가 삭제 가능 여부를 DB 구조 기준으로 직접 판단하지 않는다.
- 컴포넌트가 `scope_key` rename을 단순 문자열 치환으로 처리하지 않는다.

### 13.3 하나의 상자는 여러 scope에 겹쳐 속할 수 있다

scope 관계는 1:1 또는 1:N이 아니라 다대다로 해석해야 한다.

정확한 모델:

```text
하나의 scope
  -> 여러 key 상자를 소유할 수 있음

하나의 key 상자
  -> 여러 scope에 동시에 속할 수 있음
```

예시:

```text
key-box-10 = 사업자등록번호

scope: applicant_identity
  - key-box-10

scope: tax_review
  - key-box-10

scope: final_approval
  - key-box-10
```

위 상태에서 `key-box-10`은 세 scope에 동시에 속한다.
따라서 세 scope 중 하나라도 편집 권한을 가진 member는 정책에 따라 해당 상자 편집 후보가 될 수 있다.

DB 저장 해석:

```text
논리 scope = template_id + scope_key
물리 membership row = scope_registry row

하나의 key_frame_group_id가 여러 scope_key에 반복 등장할 수 있다.
```

예시:

```text
scope_registry
┌────┬─────────────┬────────────────────┬────────────────────┐
│ id │ template_id │ key_frame_group_id │ scope_key           │
├────┼─────────────┼────────────────────┼────────────────────┤
│ 1  │ template-1  │ key-box-10         │ applicant_identity │
│ 2  │ template-1  │ key-box-10         │ tax_review         │
│ 3  │ template-1  │ key-box-10         │ final_approval     │
└────┴─────────────┴────────────────────┴────────────────────┘
```

중요 제약:

- `template_id + key_frame_group_id`만으로 unique 제약을 걸면 안 된다.
- 중복 방지 기준은 최소한 `template_id + key_frame_group_id + scope_key` 또는 이에 준하는 membership identity여야 한다.
- value 상자는 직접 scope를 소유하지 않고 연결된 key 상자의 scope membership을 통해 해석한다.
- key/value가 함께 선택되어도 저장 기준은 key의 `key_frame_group_id`다.

권한 판정 규칙:

```text
member
  -> site_scope_assignments
  -> scope_registry rows
  -> key_frame_group_id
  -> 연결 value boxes
```

한 상자에 여러 scope가 겹치는 경우 기본 판정은 OR이다.

```text
member가 box의 scope 중 하나 이상에 배정됨
  -> 편집 가능

member가 box의 모든 scope에 미배정
  -> 편집 불가
```

AND 조건이나 단계별 승인 조건이 필요하면 별도 정책 필드로 확장한다.
이번 설계에서는 다중 scope membership 자체를 AND 조건으로 해석하지 않는다.

### 13.4 사진, 파일, 만료 설정은 scope membership과 분리된 request condition이다

필수 사진 등록, 필수 파일 등록, 만료 시간은 scope 자체의 정의가 아니라 요청 조건이다.

분리 이유:

- 같은 scope라도 요청 링크마다 필요한 사진/파일/만료 조건이 달라질 수 있다.
- scope는 "누가 어떤 상자를 편집할 수 있는가"의 범위다.
- 사진/파일/만료는 "이번 요청에서 어떤 증빙과 시간 제한이 필요한가"의 조건이다.

따라서 저장 모델은 다음처럼 분리한다.

```text
scope_registry
  - 템플릿 상자와 scope membership

site_scope_assignments
  - site별 member와 scope assignment

request scope conditions
  - request/link별 scope 대상 조건
  - required photo
  - required file
  - expires_at nullable
```

현재 DB에 request scope condition 전용 테이블 또는 컬럼이 없다면 구현 전에 확인해야 한다.
기존 `/documents`의 request task 구조를 그대로 사용하더라도, source가 member가 아니라 scope였음을 보존해야 한다.

최소 payload 계약:

```ts
type RequestScopeConditionDraft = {
  scopeKey: string;
  requiredPhotoTagKeys: string[];
  requiredFileTagKeys: string[];
  expiresAt?: string | null;
};
```

금지:

- `expiresAt: null` 또는 `expiresAt: undefined`를 빈 문자열로 변환하지 않는다.
- 사진/파일/만료 조건을 `scope_registry` row에 직접 저장하지 않는다.
- scope membership 저장과 request condition 저장을 하나의 DB row에 섞지 않는다.

### 13.5 역할 탭에서 필요한 draft 구조

역할 탭은 저장 전까지 모든 변경을 브라우저 메모리 draft로 유지한다.

권장 draft:

```ts
type CanvasScopeSetupDraft = {
  logicalScopes: Array<{
    scopeKey: string;
    displayName: string;
    description: string | null;
    status: 'active' | 'inactive';
    isNew: boolean;
  }>;
  memberships: Array<{
    scopeKey: string;
    keyFrameGroupId: string;
    valueKey: string | null;
    status: 'active' | 'inactive';
  }>;
  requestConditions: Array<{
    scopeKey: string;
    requiredPhotoTagKeys: string[];
    requiredFileTagKeys: string[];
    expiresAt?: string | null;
  }>;
};
```

이 draft는 다음을 보장해야 한다.

- 하나의 `keyFrameGroupId`가 여러 `scopeKey`에 등장할 수 있다.
- 하나의 `scopeKey`가 여러 `keyFrameGroupId`를 가질 수 있다.
- 만료 시간 없음은 `expiresAt: undefined` 또는 `expiresAt: null` 모두 허용하되 service boundary에서 `null`로 정규화한다.
- scope 삭제는 즉시 DB delete가 아니라 draft status 변경 또는 draft 제거다.
- 저장 전 탭 전환과 상자 선택은 draft만 읽는다.

### 13.6 SCOPES-02 구현 체크리스트

- [ ] 역할 탭의 첫 단계를 "상자에 scope 지정"으로 확정한다.
- [ ] 역할 탭에서 scope 신규 등록 UI를 제공한다.
- [ ] 역할 탭에서 scope 표시명/설명 수정 UI를 제공한다.
- [ ] 역할 탭에서 scope 비활성화 또는 삭제 command를 제공한다.
- [ ] 하나의 key 상자를 여러 scope에 편입할 수 있게 한다.
- [ ] 하나의 scope가 여러 key 상자를 소유할 수 있게 한다.
- [ ] `template_id + key_frame_group_id` 단독 unique 전제를 제거한다.
- [ ] 중복 membership 방지 기준을 `template_id + key_frame_group_id + scope_key`로 검토한다.
- [ ] 만료 시간 기본 상태를 "기한 제한 없음"으로 둔다.
- [ ] 만료 시간 `undefined`와 `null`을 모두 "기한 제한 없음"으로 표시한다.
- [ ] timestamp 값이 있을 때만 "기한 제한 있음"으로 저장한다.
- [ ] service boundary에서 `undefined/null` 만료 시간을 `null`로 정규화한다.
- [ ] 부분 수정의 "변경 없음"은 `undefined`가 아니라 별도 command 플래그로 표현한다.
- [ ] 사진/파일/만료 조건을 `scope_registry`와 분리된 request condition으로 유지한다.
- [ ] 상자 선택, 탭 전환, 날짜 입력 중 DB 요청 0회를 유지한다.
- [ ] 저장 버튼에서만 scope CRUD와 request condition 저장을 수행한다.

수정 전 백업:

- `docs/diff/2026-05-27_SCOPES-02_scopes.before.md`
- `docs/diff/2026-05-27_SCOPES-03_scopes.before.md`

## 14. 2026-05-27 SCOPES-04 구현 기록: 다중 scope membership과 project scope 배정

본 구현은 SCOPES-02/03 보완 설계를 코드에 반영한 기록이다.

수정 전 백업:

- `docs/diff/2026-05-27_SCOPES-04_canvasScopeDraftService.before.ts`
- `docs/diff/2026-05-27_SCOPES-04_templateScopeRegistryService.before.ts`
- `docs/diff/2026-05-27_SCOPES-04_canvasPermissionResolver.before.ts`
- `docs/diff/2026-05-27_SCOPES-04_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-05-27_SCOPES-04_project-page.before.tsx`
- `docs/diff/2026-05-27_SCOPES-04_scopes.before.md`

구현 요약:

- 역할 탭에서 `상자 타입`, `상자 역할` 수정 UI를 제거했다.
- 역할 탭의 `canvas-aside-상자-편집-패널`에 4단계 흐름을 반영했다.
  - `1. 상자에 scope 지정`
  - `2. 필수 사진 등록`
  - `3. 필수 파일 등록`
  - `4. 만료 시각 설정`
- 역할 탭 첫 단계에서 scope 신규 등록, 표시명 수정, 설명 수정, 비활성화, 선택 key 포함, 선택 key 해제를 지원하도록 draft command를 추가했다.
- 하나의 key 상자가 여러 scope에 동시에 속할 수 있도록 `scopeKeysByKeyFrameGroupId` 다중 index를 추가했다.
- 기존 단일 index `scopeKeyByKeyFrameGroupId`는 하위 호환용 primary scope index로만 유지한다.
- `TemplateScopeRegistryService` 저장 기준을 `key_frame_group_id` 단독에서 `key_frame_group_id + scope_key` membership으로 변경했다.
- 기존 scope row 비활성화 기준도 key 단독이 아니라 membership 조합 기준으로 변경했다.
- `CanvasPermissionResolver`는 여러 scope 중 하나라도 member에게 배정되어 있으면 편집 가능으로 판정한다.
- 만료 시간은 값이 있을 때만 제한으로 해석하고, `undefined/null`은 service boundary에서 제한 없음으로 정규화한다.
- `/project`의 구성원 문서 설정은 `보기/편집/서명` 버튼 대신 문서 템플릿의 scope 선택으로 변경했다.
- `/project`는 문서가 연결된 template의 scope context를 preload하고, scope 버튼 클릭 시 `site_scope_assignments`가 갱신되도록 `/api/scopes/template-scopes` 저장 계약을 사용한다.

검증 기록:

- `git diff --check` 통과.
- scope 서비스/API 단독 타입 검사 통과.
- `TemplateEditWorkspace.tsx`를 포함한 부분 타입 검사는 기존 컴포넌트 타입 오류 때문에 실패한다. SCOPES-04 신규 서비스/API 타입 오류는 확인되지 않았다.
- `supabase` MCP는 `Auth required`로 프로젝트 URL 확인이 실패했다. DB 직접 수정은 수행하지 않았다.
- `chrome-devtools` MCP로 `http://localhost:3001/canvas?page=templates&mode=template&templateId=dc080119-76a5-4785-a698-4dca1e1609f1` 확인:
  - 역할 탭 진입 후 `상자 타입` 편집 UI는 aside에 출력되지 않음.
  - `상자에 scope 지정`, `필수 사진 등록`, `필수 파일 등록`, `만료 시각 설정` 4단계 출력 확인.
  - 역할 탭 클릭 return은 약 `2.8ms`.
  - 4단계 내부 버튼 click return은 `0.1ms~0.5ms`, 다음 frame 반영은 `6.2ms~16.4ms` 범위.
  - 단계 전환 중 `/api/scopes/template-scopes` 추가 요청 없음.
- `chrome-devtools` MCP로 `http://localhost:3001/project?projectId=1b75a399-09c0-45b7-ab2a-c7cb4b7d791c` 확인:
  - 구성원 상세 패널에 `문서 scope` 영역 출력 확인.
  - 선택 현장의 template scope preload 요청 확인: `/api/scopes/template-scopes?templateId=...&siteId=...`.
  - 테스트 대상 template에는 등록된 scope가 없어 picker에는 `scope 없음`이 표시됨.

SCOPES-04 체크리스트:

- [x] 역할 탭에서 `상자 타입` 수정 UI 제거
- [x] 역할 탭에서 `상자 역할` 수정 UI 제거
- [x] 역할 탭 4단계 request setup UI 반영
- [x] scope 신규 등록 command 추가
- [x] scope 표시명/설명 수정 command 추가
- [x] scope 비활성화 command 추가
- [x] 선택 key를 scope에 포함하는 command 추가
- [x] 선택 key를 scope에서 해제하는 command 추가
- [x] 하나의 key 상자가 여러 scope에 속하는 draft 구조 반영
- [x] `scope_registry` 저장 기준을 membership 조합으로 변경
- [x] 권한 판정을 다중 scope OR 조건으로 변경
- [x] `/project` 구성원 문서 설정을 scope 선택 UI로 변경
- [x] 저장 전 탭/단계 전환 중 추가 DB 요청 없음 확인
- [ ] request scope condition의 영구 저장소 확정

## 15. 2026-05-27 SCOPES-05 설계 보완: scope picker 중심 재구성 및 shift key/value 묶음 선택 보존

본 섹션은 `상자에 scope 지정` 단계의 UI 순서와 선택 동작을 재정의한다.
후속 구현은 이 섹션을 SCOPES-04 구현보다 우선하는 상세 설계로 따른다.

### 15.1 UI 진입 순서

`상자에 scope 지정` 단계의 첫 화면은 상자 선택이 아니라 scope 선택이다.

필수 순서:

```text
1. scope 선택
2. scope 이름/설명 수정 또는 신규 scope 이름 입력
3. selected-box-field-picker 노출
4. canvas-container-container-18에서 scope membership 선택 활성화
5. 저장
```

`data-canvas-owner-item="canvas-role-settings-scope-picker-field"`는 이 흐름의 최상위 필드다.
`data-canvas-owner-item="canvas-role-settings-selected-box-field-picker"`는 scope가 선택되었거나 신규 scope 생성 모드에 들어간 뒤에만 노출한다.

금지:

- 상자 선택 UI를 scope 선택보다 먼저 보여주지 않는다.
- scope가 정해지지 않은 상태에서 membership 변경을 허용하지 않는다.
- 역할 탭에 `상자 타입`, `상자 역할` 수정 UI를 다시 넣지 않는다.

### 15.2 scope picker dropdown 구성

`data-canvas-owner-item="canvas-role-settings-scope-picker-control-dropdown"`의 맨 위 항목은 `선택 해제`가 아니라 `scope 추가`다.

필수 dropdown 구조:

```text
scope 추가
기존 scope A
기존 scope B
기존 scope C
```

`scope 추가` 클릭 시:

```text
mode = creating
activeScopeKey = null
displayName = ''
selectedKeyFrameGroupIds = []
```

기존 scope 클릭 시:

```text
mode = existing
activeScopeKey = selected scope key
displayName = selected scope display name
selectedKeyFrameGroupIds = selected scope membership
```

금지:

- dropdown 최상단에 `선택 해제`를 배치하지 않는다.
- `scope 추가` 클릭 즉시 DB row를 생성하지 않는다.
- 신규 scope 이름이 없는 상태를 기존 scope의 빈 선택 상태와 혼동하지 않는다.

### 15.3 기존 scope 선택 시 흐름

기존 scope를 선택하면 `data-canvas-owner-item="canvas-role-settings-scope-picker-field"` 하단에 scope 이름/설명 수정 UI를 표시한다.
그 아래에 `data-canvas-owner-item="canvas-role-settings-selected-box-field-picker"`를 표시한다.

기존 scope 선택 직후 반드시 수행할 동작:

```text
1. scope membership draft에서 해당 scope의 keyFrameGroupIds를 읽는다.
2. selected-box-field-picker 값을 해당 membership으로 채운다.
3. data-canvas-owner-item="canvas-container-container-18" 영역에서 해당 membership 상자를 활성 표시한다.
4. 사용자의 shift+click 변경은 해당 scope membership draft만 갱신한다.
```

저장 의미:

```text
저장 전:
scope A -> box-1, box-2

사용자 조작:
shift + box-3 클릭 -> box-3 추가
shift + box-1 클릭 -> box-1 제거

저장 후:
scope A -> box-2, box-3
```

이때 다른 scope의 membership은 절대 변경하지 않는다.

### 15.4 신규 scope 추가 시 흐름

`scope 추가`를 클릭하면 신규 scope 생성 모드가 된다.
이 모드에서는 `data-canvas-owner-item="canvas-role-settings-scope-picker-field"` 하단에 새 scope 이름 입력 UI와 상자 선택 요구를 표시한다.

필수 표시:

```text
새 scope 이름
상자를 1개 이상 선택하세요
selected-box-field-picker
저장
```

신규 scope 생성 규칙:

- 저장 전에는 DB에 scope를 만들지 않는다.
- scope 이름은 필수다.
- key/value 묶음 기준 선택 상자 1개 이상이 필수다.
- 저장 시 `scope_key`를 생성하고, 선택된 membership과 함께 저장한다.
- 신규 scope 저장 실패 시 draft 선택 상태를 유지한다.

### 15.5 shift 선택 규칙

shift 선택은 membership list를 토글하는 동작이다.

정확한 규칙:

```text
shift + 선택되지 않은 상자 선택
  -> 현재 scope membership draft에 해당 key/value 묶음을 추가한다.

shift + 이미 선택되어 있던 상자 선택
  -> 현재 scope membership draft에서 해당 key/value 묶음을 제거한다.
```

중요:

- shift 선택은 key/value 묶음을 절대 파괴하면 안 된다.
- key만 추가하고 value를 누락하거나, value만 제거하고 key를 남기는 방식은 금지한다.
- shift 선택 결과는 `/documents` 선택 방식과 동일한 key/value 묶음 단위여야 한다.
- 선택 토글의 단위는 화면에서 클릭한 DOM 조각이 아니라 `/documents` 방식으로 해석된 key/value 묶음이다.

허용되는 내부 처리:

```text
클릭 target
  -> /documents 방식 resolver로 key/value 묶음 resolve
  -> keyFrameGroupId 결정
  -> active scope membership draft에 add/remove
  -> selected-box-field-picker와 canvas 활성 표시 갱신
```

금지되는 내부 처리:

```text
클릭 target
  -> 클릭한 DOM id만 단독 추가/제거

클릭 target
  -> key와 value를 별도 independent selection으로 저장

shift + value 클릭
  -> value만 scope membership에서 제거

shift + key 클릭
  -> key만 추가되고 연결 value highlight 누락
```

### 15.6 key/value 묶음 선택 기준

key/value 묶음 선택 방식은 기존 `/documents` 선택 방식과 동일해야 한다.

이 문장에서 `/documents`는 다음 의미다.

```text
http://localhost:3001/documents
data-documents-owner-item="request-link-canvas-column-container-22"
```

구현 기준:

- value 상자를 클릭해도 연결 key 기준 membership으로 해석한다.
- key 상자를 클릭해도 연결 value highlight가 함께 유지된다.
- key/value 연결이 있는 경우 membership 저장 기준은 key의 `keyFrameGroupId`다.
- 독립 key가 없는 value는 `/documents` 선택 방식이 허용하는 fallback과 동일하게 처리한다.
- 선택 활성 표시와 selected-box-field-picker 값은 같은 membership draft에서 파생된다.

### 15.7 상태 소유권

scope membership 선택 상태의 단일 원천은 active scope membership draft다.

```text
active scope membership draft
  -> selected-box-field-picker values
  -> canvas-container-container-18 활성 표시
  -> 저장 payload
```

canvas 활성 표시나 picker 값이 별도 독립 상태로 유지되면 안 된다.
임시 UI 상태가 필요하더라도 저장 직전에는 반드시 active scope membership draft에서 payload를 생성한다.

### 15.8 성능 조건

scope 선택, shift 선택, selected-box-field-picker 변경은 브라우저 메모리 draft만 수정한다.

금지:

- shift 클릭마다 DB select
- shift 클릭마다 DB upsert
- selected-box-field-picker 변경마다 DB 요청
- scope dropdown 열기마다 scope 재조회
- 선택 토글마다 4개 view 전체 재계산

허용:

- 최초 역할 탭 진입 시 template scope preload 1회
- 저장 버튼 클릭 시 scope membership batch 저장
- 저장 성공 후 preload snapshot 갱신

### 15.9 SCOPES-05 구현 체크리스트

- [ ] `canvas-role-settings-scope-picker-field`를 `상자에 scope 지정` 단계의 첫 필드로 배치한다.
- [ ] `canvas-role-settings-scope-picker-control-dropdown` 맨 위에 `scope 추가`를 표시한다.
- [ ] dropdown 맨 위에 `선택 해제`가 나오지 않게 한다.
- [ ] 기존 scope 선택 시 scope 이름 수정 UI를 표시한다.
- [ ] 기존 scope 선택 시 scope 설명 수정 UI를 표시한다.
- [ ] 기존 scope 선택 후에만 `canvas-role-settings-selected-box-field-picker`를 표시한다.
- [ ] 신규 scope 추가 모드에서도 `canvas-role-settings-selected-box-field-picker`를 표시한다.
- [ ] 신규 scope 추가 모드에서 scope 이름 입력을 필수로 검증한다.
- [ ] 신규 scope 추가 모드에서 key/value 묶음 선택 1개 이상을 필수로 검증한다.
- [ ] 기존 scope 선택 시 해당 scope membership 상자를 `canvas-container-container-18`에서 즉시 활성 표시한다.
- [ ] shift + 선택되지 않은 상자 선택 시 `/documents` 방식 key/value 묶음을 membership에 추가한다.
- [ ] shift + 이미 선택된 상자 선택 시 `/documents` 방식 key/value 묶음을 membership에서 제거한다.
- [ ] shift 선택 시 key/value 묶음이 분리되지 않음을 브라우저에서 검증한다.
- [ ] value 클릭 시 연결 key 기준 membership이 변경되는지 검증한다.
- [ ] key 클릭 시 연결 value highlight가 유지되는지 검증한다.
- [ ] selected-box-field-picker 값과 canvas 활성 표시가 같은 membership draft에서 파생되는지 검증한다.
- [ ] 기존 scope 수정 저장 시 해당 scope membership만 변경한다.
- [ ] 기존 scope 수정 저장 시 다른 scope membership이 유지되는지 검증한다.
- [ ] 신규 scope는 저장 전 DB에 생성하지 않는다.
- [ ] shift 클릭 중 DB 요청 0회를 검증한다.
- [ ] dropdown 열기 중 DB 요청 0회를 검증한다.
- [ ] 저장 버튼 클릭 시에만 scope membership batch 저장이 발생하는지 검증한다.

수정 전 백업:

- `docs/diff/2026-05-27_SCOPES-05_scopes.before.md`
