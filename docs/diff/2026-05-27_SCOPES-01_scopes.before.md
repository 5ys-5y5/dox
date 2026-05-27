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

- [ ] `xniijnjihcjjyuwjjsrc.supabase.co` 기준 scope schema 재확인
- [ ] `TemplateScopeRegistryService` DTO 작성
- [ ] `SiteScopeAssignmentService` DTO 작성
- [ ] `CanvasScopeDraftService` pure reducer 작성
- [ ] `CanvasPermissionResolver` pure function 작성
- [ ] 역할 탭의 "담당자" 문구를 "scope 구성원" 문구로 변경
- [ ] 역할 탭에서 선택 key들을 scope draft에 편입
- [ ] `site_id` 없는 template context에서 사용자 배정 비활성 처리
- [ ] 저장 버튼에서만 scope DB 반영
- [ ] 탭 전환/상자 선택 중 DB 요청 0회 검증
- [ ] 브라우저에서 key/value linked selection 유지 검증
- [ ] Supabase REST 또는 API route로 저장 결과 검증

## 12. 결론

역할 탭의 올바른 모델은 "선택 상자에 담당자 배정"이 아니다.

올바른 모델은 다음이다.

```text
복수 key 상자 -> logical scope -> site별 member assignment -> 편집 권한
```

`scope_registry`는 템플릿 key 상자를 scope에 편입시키는 소유권 테이블이고, `site_scope_assignments`는 scope에 사람을 배정하는 현장별 권한 테이블이다.

따라서 후속 구현은 반드시 scope 서비스를 통해 상자와 사람을 연결해야 하며, 상자 DTO나 캔버스 DOM에 member id를 직접 붙이는 방식은 금지한다.
