# 전자 서명 서비스 설계 (Electronic Signature Service)

이 문서는 전자문서 및 전자거래 기본법과 전자서명법을 준수하여, 본인 인증 및 문서의 무결성을 보장하는 전자 서명 API 기능을 설계한다.

## 0. 서비스 독립성 설계 원칙 (필수 준수)

### 1. 기능 목적
- 전자문서에 대한 서명자의 본인 확인, 서명 의사 확인, 위변조 방지 및 무결성을 보장하여 법적 효력을 부여한다.

### 2. 단독 서비스로서의 가치
- 본 서비스는 특정 비즈니스 로직에 종속되지 않는 범용 전자 서명 모듈이다.
- 어떤 형태의 전자문서(PDF, JSON 데이터 등)라도 해시화하여 서명하고 검증할 수 있는 독립적인 API 상품화가 가능하다.

### 3. 책임 범위 / 비책임 범위
- **책임 범위**:
    - 서명 요청 생성 및 상태 관리.
    - 본인 인증 연동 및 확인.
    - 문서 해시(Hash) 생성 및 타임스탬프 기록.
    - 무결성 검증 API 제공 및 감사 추적(Audit Trail) 로그 저장.
- **비책임 범위**:
    - 전자문서의 원본 내용 작성 및 편집 (외부 문서 도구의 영역).
    - 본인 인증 수단(SMS, PASS 등)의 직접적인 구현 (외부 인증 API 연동 필요).
    - 서명 완료 후의 비즈니스 후속 절차 (계약 완료 알림 등).

### 4. API 계약 (DTO)
- **`POST /api/sign/request`**: 서명 요청 생성
    - Input: `{ document_id, signer_info, expiration_date }`
    - Output: `{ request_id, sign_url }`
- **`POST /api/sign/authenticate`**: 본인 인증 확인
    - Input: `{ request_id, auth_token, provider }`
    - Output: `{ is_authenticated, temp_auth_key }`
- **`POST /api/sign/execute`**: 전자 서명 실행 (해시 생성 및 저장)
    - Input: `{ request_id, temp_auth_key, signature_image_data }`
    - Output: `{ signature_id, document_hash, timestamp, audit_log_id }`
- **`GET /api/sign/verify`**: 서명 및 무결성 검증
    - Input: `{ document_id or signature_id, target_hash }`
    - Output: `{ is_valid, signer_info, signed_at, integrity_status }`

### 5. 데이터 소유권
- **`sign_requests`**: 서명 프로세스 진행 상태 및 만료 정보.
- **`signatures`**: 최종 생성된 서명 값, 타임스탬프, 문서 해시값.
- **`signature_audit_logs`**: 접속 IP, 기기 정보, 인증 방식, 시점 등 법적 증거를 위한 모든 로그.
- **`signed_assets`**: 서명 이미지가 포함된 최종 문서 또는 서명 이미지 파일 (Supabase Storage).

### 6. 의존 서비스
- **Supabase Auth**: 서명자 계정 관리 및 인증 세션.
- **Supabase Database (PostgreSQL)**: 무결성 데이터 및 로그 저장.
- **Supabase Storage**: 서명 이미지 및 관련 자산 보관.
- **외부 타임스탬프 서버 (TSA)**: (필요 시) 공인된 시점 확인 서비스 연동.

### 7. 분리 배포 시 필요한 최소 조건
- `.env` 내 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 설정.
- 독립적인 `signatures` 관련 테이블 스키마 및 Storage Bucket 권한 설정.

---

## 1. 전자서명 법적 효력 및 기술 요건 구현 상세

### 본인 확인 (Authentication)
- Supabase Auth 및 외부 본인확인 서비스를 연동하여 서명자의 식별 정보를 기록한다.
- 서명 시점에 유효한 인증 토큰을 요구하여 권한 없는 서명을 차단한다.

### 위변조 방지 및 무결성 보장 (Integrity & Hashing)
- **SHA-256 Hash**: 서명 대상 문서의 원본 데이터를 SHA-256 알고리즘으로 해싱하여 저장한다.
- 검증 시 원본 데이터를 다시 해싱하여 저장된 값과 일치하는지 비교함으로써 1비트의 변경도 탐지한다.

### 시점 확인 (Timestamp)
- Supabase의 `created_at` 필드(서버 시각)를 사용하여 서명 완료 시점을 기록한다.
- 중요한 계약의 경우 외부 TSA(Time Stamping Authority) 연동을 고려한 필드를 설계에 포함한다.

### 감사 추적 (Audit Trail)
- 서명 프로세스의 모든 단계(요청, 인증, 서명, 완료)를 로그로 남긴다.
- 기록 항목: 서명자 ID, IP 주소, User-Agent, 인증 수단, 시점, 처리 결과.

---

## 2. 수정 허용 화이트리스트 (구현 단계용)
*실제 구현 시 다음 파일들에 대한 수정/생성이 예상됩니다.*

- `src/services/signService.ts`: 서명 관련 핵심 로직 (신규)
- `src/app/api/sign/route.ts`: API 엔드포인트 구현 (신규)
- `src/components/SignPad.tsx`: 서명 입력 UI (신규, 기존 UI 컴포넌트 활용)
- `docs/diff/`: 변경 이력 기록 폴더

---

## 3. 체크리스트 및 진행 현황

- [x] 전자 서명 서비스 독립 설계 (기능 목적, API 계약 등)
- [x] Supabase DB 스키마 설계 및 SQL 작성
- [x] 서명 요청 및 본인 인증 로직 구현
- [x] 문서 해싱 및 무결성 검증 로직 구현
- [x] 감사 추적 로그 시스템 구축
- [x] 프론트엔드 서명 입력 UI 구현 (기존 스타일 준수)
- [x] MCP 테스트 (Supabase DB 등록 확인)

## 4. 실행 정책 (필수 준수)
- 모든 수정은 `docs/diff`에 직전 코드를 기록한 후 진행한다.
- Supabase DB 수정 시 사용자가 직접 실행할 수 있는 SQL 쿼리를 제공한다.
- 서비스의 독립성을 위해 내부 구현 세부사항이 외부로 노출되지 않도록 인터페이스를 설계한다.
