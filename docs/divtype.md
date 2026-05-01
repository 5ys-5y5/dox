# div box type / value-slot design

## 1. 목적

`/templates/edit` 의 div 박스는 값을 직접 저장하는 편집기가 아니라, 템플릿을 사용하는 각 문서가 나중에 어떤 값을 어떤 방식으로 채울지 정의하는 슬롯 편집기여야 한다.

이 문서는 아래 요구를 만족하는 기준 설계다.

- 박스는 `text`, `attachment`, `signature` 중 하나의 타입을 가진다.
- 박스는 `key`, `value`, `key_value` 관계를 가진다.
- 템플릿 편집 시점에는 실제 파일/서명 데이터를 저장하지 않는다.
- 실제 파일/서명은 템플릿을 사용하는 각 문서 인스턴스에 귀속된다.
- 같은 값 슬롯을 여러 div 가 서로 다른 방식으로 렌더할 수 있어야 한다.
  - 예: 서명 이미지
  - 예: 서명자 이름
  - 예: signed_at
  - 예: status-history

## 2. 핵심 원칙

1. 템플릿은 "값"이 아니라 "슬롯 정의"만 저장한다.
2. 문서는 템플릿 슬롯에 대응하는 실제 값을 저장한다.
3. 첨부파일과 서명은 텍스트처럼 `label_values` 안에 원본을 직접 넣지 않는다.
4. 첨부파일과 서명은 별도 정본 저장소를 갖고, div 는 그것을 참조해서 렌더한다.
5. 같은 `valueKey` 를 여러 div 가 공유할 수 있어야 한다.
6. 같은 `valueKey` 를 공유하는 div 들은 `runtimeMode` 만 다르게 가져 서로 다른 표현을 할 수 있어야 한다.

## 3. 용어

- `boxKind`
  - 박스의 값 종류
  - `text | attachment | signature`
- `role`
  - 박스의 구조 역할
  - `key | value | key_value`
- `valueKey`
  - 문서 값이 귀속되는 논리 키
  - 예: `attachment_list`
  - 예: `issuer_signature`
- `parentGroupId`
  - 어떤 key 박스의 하위 value 인지 연결하는 frame group id
- `runtimeMode`
  - 같은 슬롯을 어떤 방식으로 보여줄지 결정하는 렌더 모드

## 4. 템플릿 계층

### 4.1 템플릿에서 저장하는 것

`/templates/edit` 에서는 실제 값이 아니라 div 메타데이터만 `draftHtml` 안에 저장한다.

권장 `data-*` 속성:

- `data-template-box-kind`
  - `text | attachment | signature`
- `data-template-frame-role`
  - `key | value | key_value`
- `data-template-frame-value-key`
  - 예: `attachment_list`
  - 예: `issuer_signature`
- `data-template-frame-parent-group`
  - 예: `band-18-cell-1`
- `data-template-runtime-mode`
  - 아래 렌더 모드 참고

### 4.2 템플릿에서 저장하지 않는 것

아래 값은 템플릿에서 저장하면 안 된다.

- 실제 업로드 파일
- 실제 파일 경로
- 실제 `signatureId`
- 실제 `requestId`
- 실제 `authenticationId`
- 특정 문서의 서명자 이름
- 특정 문서의 signed 시각

템플릿은 여러 문서가 재사용하므로, 위 값들은 문서 인스턴스에 귀속되어야 한다.

## 5. 구조 역할

### 5.1 `key`

- 라벨 또는 상위 키 박스
- 보통 텍스트 박스
- 직접 값을 가지지 않는다
- 하위 `value` 박스를 설명한다

### 5.2 `value`

- 상위 `key` 박스에 종속되는 값 박스
- `parentGroupId` 로 부모 key 박스를 참조한다
- 실제 문서 값은 `valueKey` 기준으로 저장한다

### 5.3 `key_value`

- 독립적으로 값 1개를 대표하는 박스
- 상위 key 없이 단독 사용 가능
- 하위 value 박스가 없는 경우에 사용한다

## 6. 문서 계층

문서별 실제 값은 템플릿이 아니라 문서 인스턴스에 저장한다.

현재 문서 도메인의 기본 값 저장소는 `documents.document_versions.label_values` 이다.

### 6.1 텍스트 값

정본:

- `documents.document_versions.label_values[valueKey]`

예:

```json
{
  "work_scope": "철근 배근 공사",
  "manager_name": "홍길동"
}
```

### 6.2 첨부파일 값

첨부파일은 원본 파일과 메타데이터를 별도 정본 테이블에 저장해야 한다.

권장 신규 테이블:

- `documents.document_value_files`

권장 컬럼:

- `id uuid`
- `document_id uuid`
- `version_id uuid`
- `value_key text`
- `storage_bucket text`
- `storage_path text`
- `original_file_name text`
- `mime_type text`
- `file_size_bytes bigint`
- `sort_order integer`
- `uploaded_by text`
- `uploaded_at timestamptz`
- `metadata jsonb`

설명:

- 같은 문서의 같은 `valueKey` 아래에 여러 파일이 들어갈 수 있다.
- 파일 정본은 이 테이블과 스토리지에 있다.
- `label_values[valueKey]` 에는 빠른 렌더용 요약만 둘 수 있다.

예:

```json
{
  "attachment_list": [
    {
      "fileId": "a1b2c3",
      "fileName": "건축골조_시방서.pdf"
    }
  ]
}
```

### 6.3 서명 값

서명은 `signing` 스키마를 정본으로 사용한다.

기존 정본 테이블:

- `signing.sign_requests`
- `signing.sign_authentications`
- `signing.signatures`
- `signing.signature_audit_logs`

현재 구조상 서명 이미지와 메타는 분산되어 있다.

- 이미지 경로: `signing.signatures.signature_image_path`
- 실제 서명 시각: `signing.signatures.signed_at`
- 서명자 정보: `signing.sign_requests.signer_info`
- 인증 검증 시각: `signing.sign_authentications.verified_at`
- 인증 공급자 정보: `signing.sign_authentications.provider_*`

### 6.4 서명 슬롯 식별 보강

현재 `signing.sign_requests` 는 `document_id` 는 있지만, 문서 안의 어느 서명 슬롯을 위한 요청인지 식별하는 컬럼이 없다.

한 문서에 서명 슬롯이 여러 개일 수 있으므로 아래 보강이 필요하다.

권장안:

- `signing.sign_requests.signature_slot_key text`

의미:

- 예: `issuer_signature`
- 예: `receiver_signature`

이렇게 해야 `document_id + signature_slot_key` 로 어떤 div 슬롯이 어떤 서명 요청/서명 결과를 참조해야 하는지 식별할 수 있다.

대안:

- 별도 매핑 테이블 신설
- 예: `documents.document_signature_slots`

권장 방향은 단순성을 위해 `sign_requests` 에 `signature_slot_key` 를 추가하는 것이다.

## 7. 런타임 렌더 모드

같은 `valueKey` 를 서로 다른 div 가 서로 다른 방식으로 렌더할 수 있어야 한다.

권장 `runtimeMode`:

- `static_label`
  - 고정 라벨
- `editable_text`
  - 문서 화면에서 직접 편집 가능한 텍스트 값
- `file_slot`
  - 문서 화면에서 파일 업로드/열기용 슬롯
- `signature_image`
  - 서명 이미지 렌더
- `signature_history`
  - 서명 이력/status-history 렌더
- `signature_signer_name`
  - 서명자 이름 렌더
- `signature_signed_at`
  - 실제 signed 시각 렌더
- `signature_provider`
  - 인증 공급자 라벨 렌더
- `signature_status`
  - 요청/인증/서명 상태 렌더

## 8. 문서 화면 동작

### 8.1 텍스트 박스

- `runtimeMode=editable_text`
- 클릭 시 텍스트 편집
- 저장 시 `label_values[valueKey]` 갱신

### 8.2 파일 박스

- `runtimeMode=file_slot`
- 문서 화면에서만 업로드 가능
- 비어 있으면 클릭 시 파일 선택
- 값이 있으면 파일명을 텍스트로 렌더
- 다시 클릭하면 파일 열기
- 템플릿 편집 화면에서는 실제 업로드를 하지 않는다

### 8.3 서명 이미지 박스

- `runtimeMode=signature_image`
- 문서 화면에서만 서명 플로우 시작 가능
- 비어 있으면 클릭 시 본인확인 + 서명 입력
- 값이 있으면 서명 이미지 렌더
- 다시 클릭하면 확대 보기 또는 상세 정보 보기

### 8.4 서명 이력 박스

- `runtimeMode=signature_history`
- 같은 서명 슬롯을 참조하지만 이미지 대신 로그를 렌더
- 예:
  - 요청 생성 시각
  - 본인확인 요청 시각
  - 본인확인 verified 시각
  - 실제 signed 시각
  - provider label

## 9. 예시 1: 첨부파일

### 9.1 템플릿 박스 정의

`band-18-cell-1`

- text
- key
- `valueKey=attachment_list`
- 표시 텍스트: `8.첨부파일`
- `runtimeMode=static_label`

`band-18-cell-2`

- attachment
- value
- `parentGroupId=band-18-cell-1`
- `valueKey=attachment_list`
- `runtimeMode=file_slot`

### 9.2 의미

- 템플릿은 "첨부파일 슬롯"만 정의한다
- 각 문서는 자신의 `attachment_list` 에 파일을 저장한다
- 파일 박스에는 그 문서에 연결된 파일명만 표시된다
- 클릭 시 그 문서의 파일을 열어본다

## 10. 예시 2: 서명 + status-history

### 10.1 템플릿 박스 정의

`issuer-signature-label`

- text
- key
- `valueKey=issuer_signature`
- 표시 텍스트: `발급자 서명`
- `runtimeMode=static_label`

`issuer-signature-image`

- signature
- value
- `parentGroupId=issuer-signature-label`
- `valueKey=issuer_signature`
- `runtimeMode=signature_image`

`status-history-1`

- signature
- value
- `valueKey=issuer_signature`
- `runtimeMode=signature_history`

### 10.2 의미

- `issuer-signature-image` 와 `status-history-1` 은 같은 문서의 같은 서명 슬롯 `issuer_signature` 를 참조한다
- 하나는 서명 이미지, 다른 하나는 이력 텍스트를 출력한다
- 같은 원천 데이터를 서로 다른 view 로 보여주는 구조다

## 11. 구현 경계

### 11.1 `/templates/edit`

책임:

- div 박스 생성/선택/크기조정
- `boxKind`, `role`, `valueKey`, `parentGroupId`, `runtimeMode` 편집
- 템플릿 `draftHtml` 저장

비책임:

- 실제 파일 업로드
- 실제 서명 입력
- 특정 문서의 파일 열기
- 특정 문서의 서명 상태 갱신

### 11.2 문서 화면

책임:

- 템플릿 기반 문서 렌더
- 텍스트 입력
- 파일 업로드/열기
- 서명 요청/본인확인/서명 입력
- 문서 값 저장

## 12. 필수 보강 사항

### 12.1 템플릿 메타데이터

`draftHtml` 에 아래 속성을 보존해야 한다.

- `data-template-box-kind`
- `data-template-frame-role`
- `data-template-frame-value-key`
- `data-template-frame-parent-group`
- `data-template-runtime-mode`

### 12.2 문서 파일 정본 테이블

신규:

- `documents.document_value_files`

### 12.3 서명 슬롯 식별

신규 권장:

- `signing.sign_requests.signature_slot_key`

### 12.4 렌더용 조회 서비스

문서 렌더 시 아래를 하나의 컨텍스트로 합쳐주는 서비스가 필요하다.

```ts
type SignatureContext = {
  valueKey: string;
  documentId: string;
  requestId: string | null;
  signatureId: string | null;
  authenticationId: string | null;
  signerName: string | null;
  signerId: string | null;
  providerLabel: string | null;
  signStatus: string | null;
  signedAt: string | null;
  verifiedAt: string | null;
  signatureImagePath: string | null;
  history: Array<{
    type: 'request_created' | 'auth_requested' | 'auth_verified' | 'signed' | 'audit';
    at: string;
    actor: string | null;
    message: string;
  }>;
};
```

## 13. 결론

이 설계의 핵심은 다음 한 줄이다.

템플릿은 슬롯을 정의하고, 문서는 값을 소유하며, 같은 문서 값 슬롯을 여러 div 가 서로 다른 렌더 모드로 표현한다.

이 기준을 따르면:

- `/templates/edit` 는 템플릿 구조 편집기로 남는다
- 파일 업로드는 문서 인스턴스에 귀속된다
- 서명도 문서 인스턴스와 `signing` 정본에 귀속된다
- `status-history-1` 같은 div 는 서명 이미지와 같은 원천 데이터를 다른 방식으로 렌더할 수 있다

## 14. 현재 구현 범위

현재 코드/SQL 기준 1차 반영 범위는 아래와 같다.

- `/templates/edit`
  - 박스 메타데이터 편집 UI 추가
  - `boxKind`, `role`, `valueKey`, `parentGroupId`, `runtimeMode` 를 `draftHtml` 에 저장
  - 부모 key 검증, 순환 참조 방지, boxKind/runtimeMode 호환 검증 추가
- documents 도메인
  - `documents.document_value_files` 정본 테이블 계약 추가
  - `DocumentService.createDocument/createVersion/getDocumentDetail` 에 value-file 스냅샷 반영
- signing 도메인
  - `signing.sign_requests.signature_slot_key` 계약 추가
  - `SignService.createRequest` 와 `SignAuthService` 요약 모델에 슬롯 키 반영

아직 구현되지 않은 것은 실제 문서 화면의 파일 업로드 UI, 서명 입력 UI, 그리고 같은 슬롯을 `runtimeMode` 별로 렌더하는 문서 런타임 화면이다.
