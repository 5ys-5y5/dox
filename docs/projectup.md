# Project Page Evidence Upgrade Design

## 목적

`/project` 페이지의 `사진·서명` 영역을 독립 탭/섹션에서 제거하고, `선택한 문서 상세` 안에서 문서별 증빙 상태로 관리한다. 사용자는 문서를 선택한 뒤 문서 상세의 특정 행을 클릭해 해당 문서에 필요한 서명 요청과 필수 사진 등록 상태를 확인하고 추가할 수 있어야 한다.

핵심 원칙은 다음과 같다.

- 사진과 서명은 현장 전체 목록이 아니라 선택한 문서의 증빙 상태로 표시한다.
- `문서에 기록된 값` 행은 서명 요청/서명 상태 리스트를 연다.
- `사진 증빙 상태` 행은 문서별 필수 사진 리스트를 연다.
- `+` 버튼은 해당 행의 하위 리스트 안에서만 제공한다.
- 구성원 문서 권한은 `보기`, `편집`, `서명`을 모두 지원한다.
- 수정 범위는 아래 화이트리스트에 있는 파일과 API로 제한한다.

## 현재 확인된 상태

- `DocumentMemberAccessRole` 타입에는 이미 `signer`가 있다.
- `/project` UI에서는 문서 권한을 `보기`, `편집`만 노출하고 있다.
- `memberAccessService`는 `signer`를 `viewer`로 정규화하고 있다.
- `DocumentDetailResult`에는 `valueFiles`, `valueEntries`, `photoEvidence`가 있다.
- `DocumentDetailResult`에는 문서별 서명 요청/서명 완료 이력이 포함되어 있지 않다.
- 기존 `사진·서명` 섹션은 현장 사진 목록 중심이며, 선택 문서의 필수 사진/서명 상태와 직접 연결되어 있지 않다.
- 서명 도메인은 `signing.sign_requests`, `signing.sign_authentications`, `signing.signatures`, `signing.signature_audit_logs`를 사용한다.
- 사진 요구사항 도메인은 `photo_labels.site_photo_label_requirements`와 사진 라벨 assignment/suggestion을 사용한다.

## 목표 화면 구조

### 왼쪽 카드

카드 제목은 `현장 문서 · 구성원`으로 변경한다.

포함 항목:

- `현장 문서`
- `구성원`

제거 항목:

- `사진·서명`

### 오른쪽 카드

카드 제목은 기존처럼 `선택한 문서 상세`을 유지한다.

기본 리스트:

- 문서 기본 정보
- 문서 본문
- 문서 양식 연결
- 문서에 기록된 값
- 첨부 파일
- 사진 증빙 상태
- 버전 이력
- 출력본

행 클릭 동작:

- `문서에 기록된 값` 클릭: 아래에 `서명` 리스트 확장
- `사진 증빙 상태` 클릭: 아래에 `필수 사진` 리스트 확장
- 같은 행을 다시 클릭하면 접기
- 다른 확장 가능 행을 클릭하면 기존 확장을 닫고 새 리스트 열기

## 서명 요청 설계

### 표시 위치

`선택한 문서 상세 > 문서에 기록된 값` 행 아래에 출력한다.

### 표시 조건

문서에 서명 관련 값/영역이 있는 경우 출력한다.

판별 우선순위:

1. 연결 템플릿의 `signatureAreas`
2. 템플릿 schema snapshot의 `boxKind === signature`
3. `valueEntries` 또는 `labelValues`의 key/label에 `signature`, `sign`, `서명`이 포함된 항목

### 서명 리스트 컬럼

- 서명 항목
- 서명 대상
- 상태
- 요청 시각
- 완료 시각
- 만료 시각

상태 값:

- `요청 전`
- `요청 중`
- `본인확인 중`
- `서명 완료`
- `보류`
- `만료`
- `실패`

### `+ 서명 요청` 흐름

1. 서명 항목 선택
2. 서명할 사람 선택
3. 구성원에 없으면 구성원 추가
4. 문서 권한을 `서명`으로 부여
5. `sign_requests` 생성
6. 요청 링크 또는 문자 발송
7. 문서 상세를 다시 불러와 상태 갱신

### 구성원 추가 포함 흐름

구성원에 없는 사람을 선택할 수 있어야 한다.

필수 입력:

- 이름
- 휴대폰
- 현장 권한: 기본 `참여자`
- 문서 권한: 기본 `서명`

관리 권한:

- 현장 `소유자`, `관리자`만 서명 요청 생성/취소/재요청 가능
- 참여자는 본인에게 배정된 서명 요청만 처리 가능

## 필수 사진 설계

### 표시 위치

`선택한 문서 상세 > 사진 증빙 상태` 행 아래에 출력한다.

### 필수 사진 리스트 컬럼

- 사진 태그
- 필수 수량
- 등록 수량
- 검토 필요
- 누락
- 상태

상태 값:

- `충족`
- `검토 필요`
- `누락`
- `필수 아님`

### `+ 필수 사진` 흐름

1. 사진 태그 선택 또는 새 태그 생성
2. 필수 수량 입력
3. 적용 범위 선택
4. 저장
5. 문서 상세를 다시 불러와 `사진 증빙 상태` 갱신

적용 범위:

- 이 문서만
- 같은 문서 유형 전체
- 같은 현장 전체
- 전체 프로젝트 공통 태그

### 사진 태그 관리

프로젝트가 여러 개여도 같은 유형의 사진을 식별할 수 있어야 하므로 공통 태그 사전을 둔다.

예상 테이블:

```sql
photo_tags
- id
- tag_key
- name
- description
- active
- created_at
- updated_at
```

문서별 필수 사진 요구사항은 별도 테이블로 둔다.

```sql
document_photo_requirements
- id
- document_id
- tag_key
- required_count
- source_scope
- created_by
- created_at
- updated_at
```

`source_scope` 값:

- `document`
- `document_type`
- `site`
- `global`

## 구성원 권한 설계

### 현장 권한

- 소유자
- 관리자
- 참여자

### 문서 권한

- 보기
- 편집
- 서명

### 권한별 동작

`보기`:

- 문서 열람만 가능
- 전체 화면, 확대/축소만 가능
- 파일 업로드, 텍스트 편집, 서명 편집, 저장, 되돌리기, 다시 실행 불가

`편집`:

- 문서 값 편집 가능
- 첨부파일 등록 가능
- 저장 가능

`서명`:

- 문서 열람 가능
- 본인에게 배정된 서명 요청만 실행 가능
- 문서 값 편집과 일반 첨부파일 등록 불가
- 전체 화면, 확대/축소 가능

## API/DTO 설계

### DocumentDetailResult 추가 필드

```ts
type DocumentDetailResult = {
  // existing fields
  signatureEvidence: DocumentSignatureEvidenceDto[];
  photoRequirements: DocumentPhotoRequirementDto[];
};
```

### 서명 DTO

```ts
type DocumentSignatureEvidenceDto = {
  slotKey: string;
  label: string;
  signerRoleName: string;
  required: boolean;
  requestId: string | null;
  status:
    | 'not_requested'
    | 'pending'
    | 'authenticating'
    | 'completed'
    | 'expired'
    | 'failed';
  signerMemberId: string | null;
  signerName: string | null;
  requestedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
};
```

### 필수 사진 DTO

```ts
type DocumentPhotoRequirementDto = {
  requirementId: string;
  tagKey: string;
  tagName: string;
  sourceScope: 'document' | 'document_type' | 'site' | 'global';
  requiredCount: number;
  uploadedCount: number;
  reviewPendingCount: number;
  missingCount: number;
  status: 'covered' | 'review_needed' | 'missing' | 'not_required';
  matchedPhotoIds: string[];
  reviewPendingPhotoIds: string[];
};
```

### 신규/확장 API

- `GET /api/documents/[documentId]`
  - `signatureEvidence`
  - `photoRequirements`
  - 기존 응답 유지

- `POST /api/documents/[documentId]/signature-requests`
  - 서명 요청 생성
  - 구성원 추가가 필요한 경우 member invite와 함께 처리

- `POST /api/documents/[documentId]/photo-requirements`
  - 문서별 필수 사진 추가

- `GET /api/photo-tags`
  - 공통 사진 태그 목록

- `POST /api/photo-tags`
  - 공통 사진 태그 생성

## 구현 체크리스트

### 1. 구성원 권한

- [ ] `ManagedDocumentMemberAccessRole`에 `signer` 추가
- [ ] 문서 권한 옵션에 `서명` 추가
- [ ] `DOCUMENT_MEMBER_ROLE_LABELS.signer`를 `서명`으로 변경
- [ ] `getManagedDocumentMemberRole()`에서 `signer`를 유지
- [ ] `memberAccessService.normalizeDocumentMemberAccessRole()`에서 `signer -> viewer` 정규화 제거
- [ ] 구성원 초대 폼에서 문서 권한 `서명` 선택 가능
- [ ] 기존 구성원 문서 권한 수정 리스트에서 `서명` 선택 가능
- [ ] `서명` 권한자의 `/member-access/document/[documentId]` 접근은 read mode + 서명 요청만 허용하도록 후속 연결

### 2. `/project` 화면 구조

- [ ] 왼쪽 카드 제목을 `현장 문서 · 구성원`으로 변경
- [ ] 왼쪽 카드 설명에서 `사진·서명` 제거
- [ ] 왼쪽 `사진·서명` 섹션 제거
- [ ] `selectedDetailPanel === 'photo'` 흐름 제거 또는 선택 문서 상세 확장 흐름으로 대체
- [ ] `photoRows`가 더 이상 왼쪽 독립 리스트에 직접 쓰이지 않는지 확인

### 3. 선택 문서 상세 확장

- [ ] `selectedDocumentDetailExpandedRow` 상태 추가
- [ ] `문서에 기록된 값` 행 클릭 시 `signature` 확장
- [ ] `사진 증빙 상태` 행 클릭 시 `photoRequirements` 확장
- [ ] 확장 가능한 행에 시각적 표시 추가
- [ ] 확장 리스트는 기존 `ProjectInfoList` UI와 동일한 리스트 패턴 유지

### 4. 서명 리스트

- [ ] `selectedDocumentSignatureRows` 계산 추가
- [ ] 서명 슬롯 판별 로직 추가
- [ ] `DocumentDetailResult.signatureEvidence`가 없을 때도 템플릿/값 기준으로 `요청 전` 표시
- [ ] `+ 서명 요청` 버튼 추가
- [ ] 구성원 선택 모달/인라인 폼 추가
- [ ] 구성원에 없으면 구성원 추가 + 문서 권한 `서명` 부여
- [ ] 서명 요청 생성 후 문서 상세 재조회

### 5. 필수 사진 리스트

- [ ] `selectedDocumentPhotoRequirementRows` 계산 추가
- [ ] `photoEvidence.requirements`를 문서용 필수 사진 리스트로 변환
- [ ] 문서별 요구사항 DTO가 추가되면 `photoRequirements`를 우선 사용
- [ ] `+ 필수 사진` 버튼 추가
- [ ] 사진 태그 선택/생성 UI 추가
- [ ] 필수 수량 입력 추가
- [ ] 적용 범위 선택 추가
- [ ] 저장 후 문서 상세 재조회

### 6. DTO/API

- [ ] `src/lib/documentDtos.ts`에 `DocumentSignatureEvidenceDto` 추가
- [ ] `src/lib/documentDtos.ts`에 `DocumentPhotoRequirementDto` 추가
- [ ] `DocumentDetailResult`에 `signatureEvidence`, `photoRequirements` 추가
- [ ] `DocumentService.getDocumentDetail()`에서 서명 요청/서명 결과 조회
- [ ] `DocumentService.getDocumentDetail()`에서 문서별 필수 사진 요구사항 조회
- [ ] API 실패 시 `queryDebug.signatureEvidence`, `queryDebug.photoRequirements` 추가
- [ ] 기존 응답 필드와 호환 유지

### 7. 사진 태그

- [ ] 공통 사진 태그 DTO 추가
- [ ] 사진 태그 목록 API 추가
- [ ] 사진 태그 생성 API 추가
- [ ] 문서별 필수 사진 저장 API 추가
- [ ] `photo_labels` 스키마 노출 에러 처리 문구 유지

### 8. 검증

- [ ] `보기` 권한자는 문서 편집 불가
- [ ] `편집` 권한자는 기존 문서 편집 가능
- [ ] `서명` 권한자는 문서 편집 불가, 본인 서명 요청만 가능
- [ ] `사진 증빙 상태` 행 클릭 시 필수 사진 리스트 표시
- [ ] `+ 필수 사진`으로 요구사항 추가 후 리스트 갱신
- [ ] `문서에 기록된 값` 행 클릭 시 서명 리스트 표시
- [ ] `+ 서명 요청`으로 구성원 선택/추가 후 요청 생성
- [ ] 왼쪽 카드에 `사진·서명` 독립 섹션이 남아 있지 않음
- [ ] 기존 현장 문서/구성원 기능 회귀 없음

## 수정 허용 화이트리스트

이 설계 구현 중 아래 범위만 수정한다.

### 페이지/UI

- `src/app/project/page.tsx`
- `src/app/member-access/document/[documentId]/page.tsx`

### DTO/도메인 타입

- `src/lib/documentDtos.ts`
- `src/lib/memberAccessDtos.ts`
- 신규 필요 시 `src/lib/photoTagDtos.ts`

### 서비스

- `src/services/documentService.ts`
- `src/services/memberAccessService.ts`
- `src/services/signService.ts`
- `src/services/signAuthService.ts`
- `src/services/photoLabelRequirementService.ts`
- 신규 필요 시 `src/services/photoTagService.ts`

### API 라우트

- `src/app/api/documents/[documentId]/route.ts`
- 신규 `src/app/api/documents/[documentId]/signature-requests/route.ts`
- 신규 `src/app/api/documents/[documentId]/photo-requirements/route.ts`
- 신규 `src/app/api/photo-tags/route.ts`
- 기존 member access 관련 API 중 문서 권한 `signer` 저장에 필요한 파일

### UI 컴포넌트

기존 리스트 UI 패턴을 유지해야 할 때만 수정한다.

- `src/components/ui/MultiEntityPicker.tsx`
- `src/components/ui/OptionButtonGroup.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Button.tsx`

가능하면 위 UI 컴포넌트는 수정하지 않고 `/project` 내부 조합으로 해결한다.

### DB/문서

- `docs/run-this-supabase-member-access-schema.sql`
- 신규 SQL 문서가 필요하면 `docs/projectup-schema.sql`

## 수정 금지/주의 항목

아래 파일은 이 설계 구현 중 직접 수정하지 않는다. 단, 기존 타입 오류 해결을 사용자가 별도 요청하면 별도 작업으로 분리한다.

- `src/components/template/TemplateEditWorkspace.tsx`
- `src/components/template/workspace/canvas/useCanvasPointerHandlers.ts`
- `src/components/template/workspace/constants.ts`
- `src/components/template/workspace/utils.ts`
- 템플릿 추출 서비스 전체
- `/canvas` 권한자별 접근 설계 파일

주의:

- 기존 사용자 변경을 되돌리지 않는다.
- `사진·서명` 독립 섹션 제거와 선택 문서 상세 확장은 한 커밋/작업 단위로 묶는다.
- 서명 권한 추가는 구성원 저장 로직과 `/member-access/document` 접근 로직까지 함께 검증한다.
- DB schema 추가가 필요한 항목은 UI만 먼저 만들지 말고 DTO/API/서비스 계약을 먼저 확정한다.

## 단계별 구현 순서

1. 구성원 문서 권한에 `서명`을 복구한다.
2. `/project` 왼쪽 카드에서 `사진·서명` 섹션을 제거한다.
3. `선택한 문서 상세`에 확장 행 상태를 추가한다.
4. 기존 데이터만으로 사진 증빙 하위 리스트를 먼저 표시한다.
5. 기존 데이터만으로 서명 슬롯 하위 리스트를 먼저 표시한다.
6. `DocumentDetailResult`에 `signatureEvidence`, `photoRequirements`를 추가한다.
7. `+ 필수 사진` 저장 흐름을 연결한다.
8. `+ 서명 요청` 저장 흐름을 연결한다.
9. 권한별 동작을 검증한다.
10. 전체 회귀 체크를 수행한다.

## 완료 기준

- `/project`에서 `사진·서명` 독립 섹션이 사라진다.
- `선택한 문서 상세`에서 사진과 서명을 문서별로 확인한다.
- 필수 사진은 사진 태그 기반으로 추가/관리된다.
- 서명 요청은 구성원 선택 또는 구성원 추가와 함께 생성된다.
- 구성원 문서 권한에 `서명`이 노출되고 저장된다.
- `보기`, `편집`, `서명` 권한이 `/canvas`에서 설계한 권한자별 접근 모델과 충돌하지 않는다.
