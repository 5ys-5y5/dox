# 대한민국 전자서명 효력 보강 검토

작성일: 2026-04-10 (KST)
최종 업데이트: 2026-04-11 (KST) - 본인확인 스키마/서비스 골격을 `src` 운영 경로로 정리하고 SQL 경로를 `docs/` 루트로 평탄화

이 문서는 현재 전자서명 구현의 무결성 수준을 점검하고, 확정된 본인확인/전자서명 연동안인 `BaroCert + PASS/휴대폰 본인확인` 기준으로 구현 보강 항목과 API 키 확보 절차를 정리한다. 법률 자문이 아니라 구현 설계 검토 문서이며, 실제 약관/계약서/금융성 거래에는 변호사 및 인증사업자 계약 검토가 필요하다.

## 1. 효력 판단 기준

대한민국 전자서명법상 전자서명은 전자문서에 첨부되거나 논리적으로 결합되어 서명자의 신원과 서명자가 해당 전자문서에 서명했다는 사실을 나타내는 전자적 형태의 정보로 이해해야 한다. 따라서 서비스 관점에서는 최소한 아래 4가지를 증거로 남겨야 한다.

| 항목 | 요구 수준 | 현재 상태 | 보강 방향 |
| --- | --- | --- | --- |
| 서명자 신원 | 이름/생년월일/휴대폰/CI/DI 등 본인확인기관 또는 인정 전자서명인증사업자 결과값 | 미구현 | `BaroCert` 인증 결과와 `PASS/휴대폰 본인확인` 결과 저장 |
| 서명 의사 | 특정 문서 해시와 약관/동의 문구에 대한 명시적 승인 | 부분 구현 | 인증 요청 원문에 `document_hash`, 약관 버전, 동의 문구 해시 포함 |
| 문서 무결성 | 최종 서명 대상 원문 바이트 또는 안정적 직렬화 값의 해시 저장/검증 | DB 보강 및 `src` 코드 반영 완료 | 본인확인 연동 후 auth gate 강화 필요 |
| 감사 추적 | 인증 요청/성공/실패, 서명 실행, IP, User-Agent, 타임스탬프, 인증기관 응답 식별자 보관 | 부분 구현 | provider/receiptId/transactionId/signedDataHash/CI/DI 해시 저장 |

근거 출처:

- [전자서명법, 국가법령정보센터](https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EC%A0%84%EC%9E%90%EC%84%9C%EB%AA%85%EB%B2%95)
- [KISA 디지털서명인증 제도 및 인정 현황](https://www.kisa.or.kr/1060203)
- [KISA 전자서명인증사업자 인정기관](https://trustesign.kisa.or.kr/intro/cert)

## 2. 현재 구현 점검

중요 경계:

- `docs/designCloning`은 템플릿 폴더이므로 현재 서비스에서 직접 사용하거나 운영 구현 근거로 삼으면 안 된다.
- `docs/designCloning`은 템플릿 reference 전용이다. 실제 구현 코드는 모두 `/Users/gy/Documents/dev/docs/src`에 존재해야 한다.
- 현재 이 작업에서 운영 DB에는 `docs/run-this-supabase-integrity.sql` 실행이 완료되었다.
- 운영 경로는 `/Users/gy/Documents/dev/docs/src`이며, 전자서명 앱 코드는 `src/lib/crypto.ts`, `src/lib/authProviders.ts`, `src/services/signService.ts`, `src/services/signAuthService.ts`, `src/app/api/sign/route.ts`에 작성한다.

따라서 현재 완료된 보강은 DB 레벨의 무결성 제약/트리거/컬럼 추가와 `src` 운영 경로의 해시 고정/재검증 로직 생성이다.

점검 결과:

| 항목 | 판단 | 보강 상태 |
| --- | --- | --- |
| 해시 알고리즘 | SHA-256 사용으로 기본 무결성 검증에는 적합 | 유지 |
| 저장값 | `signatures.document_hash` 저장은 적합하나, DB 레벨 불변성 제약이 없음 | `docs/run-this-supabase-integrity.sql` 실행 완료 |
| 검증 대상 | JSON/PDF/HTML 직렬화 방식이 바뀌면 같은 문서도 다른 해시가 될 수 있음 | `src/lib/crypto.ts`에 raw bytes/UTF-8/canonical JSON 해시 메타데이터 반영 |
| 본인확인 연계 | `signer_id`는 선택값이고, 외부 본인확인 결과값이 없음 | `sign_authentications` 추가로 보강 |
| 실행 조건 | `EXECUTE`가 `authenticated` 상태와 만료일을 강제 확인하지 않음 | 상태 전이와 만료 검증 필수 |
| 감사 로그 | IP/User-Agent/해시는 남기지만 인증기관, CI/DI, receiptId, transactionId, 동의 문구 버전, 원문 해시와 인증 응답의 결합 정보가 없음 | 메타데이터 확장 필요 |
| 시점확인 | Supabase `created_at`은 서버 시각 기록으로 충분한 내부 로그이나, 강한 증거력이 필요하면 외부 TSA 또는 인증사업자 응답 시각을 함께 보관해야 함 | 인증사업자 응답 시각 저장, 필요 시 TSA 검토 |

권장 보강 상태:

- 무결성 DB 보강은 `docs/run-this-supabase-integrity.sql` 실행으로 완료되었다. 신규 DB는 `docs/setup-db.sql` 전체를 실행한다.
- `be5f695b-e7a0-42d6-8628-06c3ccbd28b1` 검토 결과처럼 `sign_requests.document_hash`가 비어 있으면 요청 시점부터 서명 시점까지 동일 문서였음을 증명할 수 없으므로, 이후에는 `docs/run-this-supabase-integrity-tighten.sql`까지 적용해 `signed` 전환 전 요청 해시와 서명 해시 메타데이터 일치를 DB에서 강제한다.
- `bcc0304f-6d2a-4514-a74d-8edf568e7bb7` 검토 결과처럼 구 서비스 코드가 `signatures`를 먼저 INSERT하고 `signed` 상태 업데이트에서 실패하면 `pending` 요청에 서명 row가 남을 수 있다. 이후에는 `docs/run-this-supabase-integrity-signature-guard.sql`까지 적용해 `signatures` INSERT 시점부터 요청 해시와 서명 해시 메타데이터 일치를 DB에서 강제한다.
- `9854df9b-0eaf-44b1-9b82-da2156caec8a` 검토 결과처럼 signature guard는 불완전한 서명 row 저장을 막지만, 구 서비스 코드가 해시 없는 `pending` 요청을 만드는 것까지는 별도 차단이 필요하다. 이후에는 `docs/run-this-supabase-integrity-request-guard.sql`까지 적용해 활성 `sign_requests` row 생성 시점부터 문서 해시 메타데이터를 강제한다.
- 무결성 앱 코드는 `src/lib/crypto.ts`, `src/services/signService.ts`, `src/app/api/sign/route.ts`에 작성되었다. `docs/designCloning` 템플릿 코드는 운영 경로가 아니다.
- 2026-04-11 현재 앱 골격(`src/app`, `src/components`, `src/lib`, `src/services`)은 루트 `src` 아래로 정리되었고, `docs/designCloning`은 템플릿 reference로만 남긴다.
- BaroCert/PASS 본인확인 연동이 끝난 뒤 후속 변경이 필요한 지점은 `AUTH_GATE_POST_INTEGRATION_REQUIRED` 문자열로 코드와 SQL에 표식해 두었다. 이후 LLM이나 개발자가 이 문자열을 검색하면 `pending -> signed` 제거와 `authenticated` 강제 지점을 한 번에 찾을 수 있다.
- 본인확인은 `BaroCert`의 카카오/네이버/토스 인증서 기반 API와 별도 `PASS/휴대폰 본인확인` API를 함께 지원하는 것으로 확정한다.
- 전자서명 효력 증거의 핵심은 `sign_request_id`, `document_hash`, `provider`, `receipt_id`, `ci/di`, `signed_data_hash`, `consent_text_hash`를 하나의 감사 체인으로 묶는 것이다.
- 본인확인 연동 후 `EXECUTE`는 인증 완료 상태가 아니면 실패해야 하며, 서명 후 `document_hash`와 인증 결과 레코드는 append-only로 다룬다.
- 2026-04-11 현재 `docs/setup-db.sql`과 `docs/run-this-supabase-auth-bootstrap.sql`에 `sign_authentications` 테이블, 상태 전이 제약, authenticated 경로 DB guard를 반영했다.
- 2026-04-11 현재 `src/lib/authProviders.ts`, `src/lib/authEvidence.ts`, `src/services/signAuthService.ts`, `src/app/api/sign/route.ts`에 `AUTH_REQUEST`, `AUTH_STATUS`, `AUTH_CANCEL`, `AUTH_VERIFY`, `AUTH_CALLBACK` 흐름을 반영했다. 현재 `AUTH_VERIFY`, `AUTH_CALLBACK`은 DB 상태 전이와 감사 로그, CI/DI/동의문구/응답 해시 저장까지 처리하며, 외부 BaroCert/NICE 실연동 HTTP 호출 어댑터만 남아 있다.
- 2026-04-11 현재 `src/services/signService.ts`는 `authenticated` 상태에서 `sign_authentications.auth_status = 'verified'`와 `consent_text_hash` 일치 여부를 확인하도록 보강했다.

2026-04-10 무결성 우선 실행 항목:

1. `docs/run-this-supabase-integrity.sql` 실행 완료: `sign_requests` 문서 해시 컬럼, `signatures` 해시 메타데이터 컬럼, SHA-256 형식 체크, 요청당 단일 서명 unique index, 서명/감사 로그 append-only 트리거가 DB에 반영되었다.
2. `docs/setup-db.sql`에도 동일한 신규 DB용 스키마를 반영했다.
3. `src/lib/crypto.ts`에 `DOCUMENT_HASH_INTEGRITY` 표식과 안정적 JSON 정렬 직렬화, SHA-256 해시 메타데이터, 해시 형식 검증, 상수시간 비교를 추가했다.
4. `src/services/signService.ts`에 요청 시점 문서 해시 저장, 실행 시점 해시 재검증, 만료 요청 차단, 중복 서명 차단, 검증 응답의 저장/현재 해시 노출을 추가했다.
5. `src/app/api/sign/route.ts`에 `REQUEST`, `EXECUTE`, `VERIFY` 액션 라우트를 추가했다.
6. `pending -> signed` 전이는 본인확인 미구현 상태를 고려한 임시 허용이다. BaroCert/PASS 연동 후에는 `authenticated -> signed`만 허용하도록 좁혀야 한다. 이후에는 `AUTH_GATE_POST_INTEGRATION_REQUIRED`를 검색하면 해당 후속 조치 지점을 코드와 SQL에서 찾을 수 있다.
7. `be5f695b-e7a0-42d6-8628-06c3ccbd28b1` 서명 검토용 SQL은 `docs/verify-sign-integrity-be5f695b.sql`에 작성했다. Codex MCP 연결 프로젝트(`grfkmbrhbvcyahflqttl`)에는 `sign_requests` 테이블이 없어 실제 서명 데이터는 해당 서명이 존재하는 Supabase SQL Editor에서 확인해야 한다.
8. 위 서명 점검 결과 `sign_requests.document_hash`가 `null`이고 `signatures.document_byte_length`가 기본값 `0`으로 남은 것이 확인되었다. 해시 값은 테스트 문구 `Original Document Content for 00000000-0000-0000-0000-000000000001`와 일치하지만, 요청 시점 해시 고정 증거가 없고 byte length 메타데이터가 실제 원문 길이와 불일치하므로 완전한 무결성 통과로 보지 않는다.
9. 재발 방지를 위해 `src/services/signService.ts`에서 `REQUEST`의 `documentContent`를 필수화하고, 요청 해시가 없는 `EXECUTE`를 `SIGN_REJECTED_MISSING_REQUEST_HASH`로 거절하도록 보강했다.
10. `docs/run-this-supabase-integrity-tighten.sql`을 추가했다. 이 SQL은 임시 `pending -> signed` 전이는 유지하되, 요청 해시가 없거나 서명 해시 메타데이터와 맞지 않으면 `signed` 상태 전환을 DB에서 차단한다.
11. `bcc0304f-6d2a-4514-a74d-8edf568e7bb7` 점검 결과 `signed` 전환은 차단되었지만 `signatures` row가 먼저 저장된 부분 저장 상태가 확인되었다. 이는 실행 중인 서비스가 `/src`의 보강 코드가 아니거나 구 코드가 남아 있다는 신호다.
12. 재발 방지를 위해 `docs/run-this-supabase-integrity-signature-guard.sql`을 추가했다. 이 SQL은 `signatures` INSERT 자체를 요청 해시와 메타데이터가 완전히 일치할 때만 허용한다. BaroCert/PASS 연동 후에는 이 함수의 `TODO(auth-gate)` 조건도 `authenticated`만 허용하도록 좁힌다.
13. `9854df9b-0eaf-44b1-9b82-da2156caec8a` 점검 결과 signature guard가 `signatures` INSERT는 막았지만, 해시 없는 `sign_requests` 생성은 계속 허용되는 것이 확인되었다. 이는 여전히 실행 경로가 보강된 `/src` 코드가 아니라는 강한 증거다.
14. 재발 방지를 위해 `docs/run-this-supabase-integrity-request-guard.sql`을 추가했다. 이 SQL은 `pending`, `authenticating`, `authenticated`, `signed` 상태의 `sign_requests` row가 문서 해시 메타데이터 없이 생성 또는 유지되는 것을 DB에서 차단한다.
15. 초기 로컬 테스트 시 dev server가 템플릿 하위 복제본을 읽는 경로 혼선이 있었으나, 현재는 필요한 앱 파일을 모두 루트 `src`로 정리했다.
16. `543e0ed7-9205-4814-b026-2dc99e7e5bd4` 점검 결과 `auth_gate_temporary_pending_signed`를 제외한 모든 무결성 항목이 `PASS`로 확인되었다. 요청/서명 해시와 메타데이터가 모두 일치하고, `REQUEST_CREATED` 및 `SIGN_EXECUTED` 감사 로그의 `documentHash`, `byteLength`, `canonicalization`도 일치한다. 남은 `WARN`은 BaroCert/PASS 본인확인 연동 전 임시 `pending -> signed` 허용에 따른 예상 상태다.
17. 실행 규칙을 명확히 하기 위해 `docs/run-this-supabase-integrity.sql`에는 "기본 1회 실행 + 레거시 signatures 백필"이라는 주석과 append-only 트리거 감지 시 백필 `UPDATE signatures ...`를 건너뛰는 로직을 추가했다. 반면 `docs/run-this-supabase-integrity-signature-guard.sql`은 추가 가드 스크립트이므로 재실행 가능하다는 주석을 추가했다.
18. 2026-04-11 기준 본인확인 구현 시작 상태:
    - `docs/setup-db.sql`은 신규 DB용 전체 스키마에 `sign_authentications`와 authenticated 경로 guard를 포함한다.
    - `docs/run-this-supabase-auth-bootstrap.sql`은 기존 DB 증분 적용용이다.
    - `src/services/signAuthService.ts`는 `AUTH_REQUEST`, `AUTH_STATUS`, `AUTH_CANCEL`, `AUTH_VERIFY`, `AUTH_CALLBACK`을 처리한다.
    - `AUTH_VERIFY`는 `sign_requests.signer_info`와 인증 결과 이름 비교, `ci/di`, `signed_data`, raw response 해시 저장, `sign_requests.status = authenticated` 전환까지 수행한다.
    - `AUTH_CALLBACK`은 provider callback/redirect 결과를 `completed` 상태와 응답 해시로 반영하고, 필요 시 `autoVerify`로 즉시 검증까지 이어갈 수 있다.
    - 실제 BaroCert/NICE HTTP 요청/응답 매핑 어댑터와 운영용 비밀키 적용은 다음 단계다.

## 3. 확정 연동 구조

BaroCert 공식 개발자센터 기준으로 BaroCert는 카카오 인증, 네이버 인증, 토스 인증을 제공한다. 카카오는 본인인증/전자서명/출금동의, 네이버는 본인인증/전자서명/출금동의, 토스는 본인확인/본인인증/전자서명/출금동의를 제공한다. PASS/휴대폰 본인확인은 BaroCert 제품군에 직접 포함된 것으로 보지 않고, NICE아이디 등 휴대폰 본인확인 사업자를 별도 연동하는 구조로 둔다.

| 수단 | 연동 경로 | 역할 | 우선순위 |
| --- | --- | --- | --- |
| 카카오 인증서 | BaroCert 카카오 본인인증/전자서명 | 사용자 친화적인 인증서 기반 서명 수단 | 1 |
| 네이버 인증서 | BaroCert 네이버 본인인증/전자서명 | 카카오 미사용자를 위한 대체 인증서 수단 | 1 |
| 토스 인증 | BaroCert 토스 본인확인/전자서명 | CI/DI 및 signedData 확보가 쉬운 인증 수단 | 1 |
| PASS/휴대폰 본인확인 | NICE아이디 등 휴대폰 본인확인 API | 휴대폰 명의 기반 본인확인 및 PASS/문자인증 fallback | 1 |
| 문자 SMS OTP | SENS 등 메시징 API | 서명 링크 발송/알림/보조 인증 | 보조만 허용 |
| 카카오/네이버 로그인 OAuth | 각 소셜 로그인 API | 로그인 또는 계정 연결 | 전자서명 본인확인 수단으로 사용하지 않음 |

확정 구현 원칙:

1. 카카오/네이버/토스는 `BaroCert` 통합 인증으로 묶는다.
2. PASS/휴대폰 본인확인은 `NICE아이디`를 1차 후보로 두고, 계약/단가/심사 이슈가 있으면 KCB, SCI평가정보 등 본인확인 사업자로 대체할 수 있게 어댑터를 둔다.
3. 토스는 BaroCert에서 `본인확인 API`를 제공하므로, 토스 사용자는 별도 PASS 흐름 없이 토스 본인확인으로 CI/DI를 확보하는 경로를 우선 사용한다.
4. PASS/휴대폰 본인확인은 카카오/네이버 인증서로 CI 확보가 제한되거나, 사용자가 인증서 앱을 쓰지 않는 경우의 동등한 본인확인 fallback으로 제공한다.
5. 단순 SMS OTP는 본인확인기관 결과값이 아니므로 `authenticated` 상태를 만들 수 없다.

참고 출처:

- [BaroCert Developers](https://developers.barocert.com/)
- [BaroCert 토스 본인확인 API](https://developers.barocert.com/guide/toss/userIdentity/ruby/getting-started/toss-userIdentity)
- [NICE아이디 휴대폰본인확인](https://www.niceid.co.kr/prod_mobile.nc)
- [SCI평가정보 휴대폰본인확인(PASS) 개인정보처리방침](https://pcc.siren24.com/pcc_V3/utPrivacy.html)

## 4. 추천 구현 흐름

| 단계 | 처리 |
| --- | --- |
| 1 | `REQUEST` 생성 시 최종 서명 대상 원문을 확정하고 `document_hash`를 계산 |
| 2 | 사용자에게 카카오, 네이버, 토스, PASS/휴대폰 본인확인 선택지를 제공 |
| 3 | 카카오/네이버/토스 선택 시 BaroCert 요청 API를 호출하고 `receiptId`, `provider`, `request_token_hash`, `expires_at` 저장 |
| 4 | PASS/휴대폰 선택 시 NICE아이디 등 휴대폰 본인확인 요청을 생성하고 `request_seq`, `provider`, `return_url`, `expires_at` 저장 |
| 5 | 사용자가 앱 푸시, 앱투앱, PASS/QR, 문자인증 중 사업자가 제공하는 방식으로 인증 완료 |
| 6 | 서버가 검증 API를 호출해 CI/DI, 이름, 생년월일, 휴대폰번호, provider 응답 식별자, signedData 또는 응답 원문 해시를 저장 |
| 7 | 검증 결과의 사용자 정보와 `sign_requests.signer_info`를 비교하고, 요청 시 사용한 `document_hash` 또는 nonce/token과 일치할 때만 `authenticated`로 전환 |
| 8 | `EXECUTE`는 `authenticated` 상태, 만료 전 요청, 동일 문서 해시, 동일 인증 레코드 조건을 모두 만족할 때만 허용 |
| 9 | 최종 `signatures`와 `signature_audit_logs`를 append-only로 저장 |

전자서명 API를 선택할 수 있으면 본인인증 API보다 전자서명 API가 더 적합하다. 단순 본인인증은 “이 사용자가 누구인지”를 보강하고, 전자서명은 “이 사용자가 이 원문에 서명했는지”까지 결합하기 쉽기 때문이다. 다만 서비스 UX상 인증서 서명을 완료하지 못하는 사용자를 위해 PASS/휴대폰 본인확인을 fallback으로 제공한다.

## 5. API 키 확보 절차

확정 선택 항목:

- `BaroCert`: 카카오 인증서, 네이버 인증서, 토스 인증/본인확인/전자서명
- `PASS/휴대폰 본인확인`: NICE아이디 등 휴대폰 본인확인 API

### 5.1 공통 사전 준비

운영 전환 신청 전에 아래 정보를 준비한다.

| 구분 | 준비 항목 |
| --- | --- |
| 회사 정보 | 사업자번호, 사업자구분, 회사명, 대표자, 업태, 종목, 주소 |
| 담당자 정보 | 담당자명, 부서, 연락처, 이메일 |
| 서비스 정보 | 서비스명, 도메인, 앱 패키지명/스킴, 개인정보 처리방침 URL, 이용약관 URL |
| 인증 목적 | 계약/동의/전자문서 서명 등 사용 목적, 사용자에게 표시할 문구 |
| 개인정보 항목 | CI/DI, 이름, 생년월일, 성별, 내외국인 여부, 통신사, 휴대폰번호 등 수집 항목과 보관 기간 |
| 보안 정보 | 운영 서버 고정 IP, 방화벽 정책, 비밀키 보관 방식, 관리자 접근 통제 |
| UI 증빙 | 본인확인/전자서명 화면, 약관 동의 화면, 개인정보 수집 동의 화면 |

### 5.2 BaroCert 키 발급

1. [BaroCert Developers 연동신청](https://developers.barocert.com/) 또는 상단 `연동신청` 메뉴에서 사업자 정보로 신청한다.
2. 신청 후 파트너 관리자 접근 권한을 받는다.
3. `LinkID`와 `SecretKey`를 확인한다. BaroCert 문서는 SDK 설정값으로 `LinkID`, `SecretKey`, `IPRestrictOnOff`, `UseStaticIP`를 사용한다.
4. 테스트 환경에서 SDK 또는 REST 호출을 구성한다. BaroCert API 호출에는 인증서버가 발급하는 Bearer Token이 필요하며, SDK는 `LinkID`와 `SecretKey`를 이용해 토큰 발급 과정을 처리한다. 직접 REST를 붙일 경우에도 장기 보관 대상은 Bearer Token이 아니라 `LinkID`, `SecretKey`, 이용기관 코드이며, Bearer Token은 만료/재발급 가능한 단기 토큰으로 취급한다.
5. 카카오/네이버/토스 각각에 대해 필요한 상품을 신청한다. 기본 신청 항목은 `본인인증`, 가능하면 `전자서명`, 토스는 `본인확인`을 포함한다.
6. 카카오 CI 수집이 필요하면 BaroCert의 CI 수집 증빙자료 제출 안내에 따라 개인정보 처리방침 내 CI 수집 항목과 URL/스크린샷을 준비한다.
7. 운영 전환 신청 후 이용기관 코드와 운영 가능 상태를 확인한다. 카카오/네이버/토스는 인증기관 검수와 이용기관 심사가 필요할 수 있으므로 오픈 일정에 최소 1~2주 버퍼를 둔다.
8. 저장 위치는 서버 환경변수 또는 Secret Manager로 제한한다.

```env
BAROCERT_LINK_ID=...
BAROCERT_SECRET_KEY=...
BAROCERT_CLIENT_CODE=...
BAROCERT_ENABLED_PROVIDERS=kakao,naver,toss
BAROCERT_DEFAULT_PROVIDER=toss
BAROCERT_IP_RESTRICT_ON_OFF=true
BAROCERT_USE_STATIC_IP=false
```

주의: BaroCert 문서에 표시되는 `TESTER` 및 예시 비밀키는 SDK 예제용 값이다. 운영 또는 실제 테스트 환경 키를 저장소에 커밋하면 안 된다.

참고 출처:

- [BaroCert 토큰 기반 인증](https://developers.barocert.com/guide/kakao/sign/php/intersection/authentication)
- [BaroCert 카카오 본인인증 SDK 환경설정](https://developers.barocert.com/guide/kakao/identity/java/getting-started/sdk-configuration)
- [BaroCert 카카오 CI수집 증빙자료 제출](https://developers.barocert.com/guide/kakao/login/node/go-live/submit-evidence)
- [BaroCert 네이버 본인인증 연동환경 구성](https://developers.barocert.com/guide/naver/identity/java/getting-started/environment-set-up)
- [BaroCert 토스 본인확인 API](https://developers.barocert.com/reference/toss/php/userIdentity/api)
- [BaroCert 토스 전자서명 소개](https://developers.barocert.com/guide/toss/sign/dotnetcore/getting-started/toss-sign)

### 5.3 PASS/휴대폰 본인확인 키 발급

PASS/휴대폰 본인확인은 NICE아이디를 1차 후보로 둔다. NICE아이디 공식 설명 기준 휴대폰본인확인은 본인 명의 휴대폰 여부와 휴대폰 보유 여부를 동시에 확인하고, 인증 성공 시 회원사 선택에 따라 성명, 성별, 생년월일, 내외국인정보, 이통사정보, 휴대폰번호, CI/DI를 제공한다. 인증 방식은 PASS/QR, 간편인증, 문자인증을 포함한다.

발급 절차:

1. NICE아이디 휴대폰본인확인 서비스 상담/신청을 진행한다.
2. 사업자 정보, 서비스 도메인, 개인정보 처리방침, 이용약관, CI/DI 수집 목적과 보관 기간을 제출한다.
3. 테스트용 사이트 코드 또는 클라이언트 식별자, 비밀키/사이트 패스워드, 암호화 키 또는 모듈을 발급받는다.
4. 본인확인 팝업/리다이렉트 `return_url`, `error_url`, 허용 도메인, 운영 서버 IP를 등록한다.
5. 테스트 환경에서 요청 생성, 사용자 인증, 결과 복호화/검증, `request_seq` 재사용 방지, 위변조 검증을 확인한다.
6. 운영 심사 후 운영용 식별자와 키를 적용한다. 테스트 키와 운영 키가 분리되는지, 또는 운영 전환만 되는지는 계약한 사업자 안내에 따른다.
7. 키는 서버 환경변수 또는 Secret Manager에만 저장하고, 클라이언트 번들에 노출하지 않는다.

```env
MOBILE_IDENTITY_PROVIDER=niceid
MOBILE_IDENTITY_SITE_CODE=...
MOBILE_IDENTITY_SITE_PASSWORD=...
MOBILE_IDENTITY_CLIENT_ID=...
MOBILE_IDENTITY_CLIENT_SECRET=...
MOBILE_IDENTITY_RETURN_URL=https://example.com/api/sign/auth/pass/callback
MOBILE_IDENTITY_ERROR_URL=https://example.com/api/sign/auth/pass/error
MOBILE_IDENTITY_ALLOWED_HOST=example.com
```

주의: 위 환경변수 이름은 서비스 내부 표준명이다. 실제 NICE/KCB/SCI 계약에서 제공하는 필드명은 다를 수 있으므로 어댑터에서 외부 필드명을 내부 표준명으로 매핑한다.

참고 출처:

- [NICE아이디 휴대폰본인확인](https://www.niceid.co.kr/prod_mobile.nc)
- [SCI평가정보 휴대폰본인확인(PASS) 개인정보처리방침](https://pcc.siren24.com/pcc_V3/utPrivacy.html)

## 6. DB 및 API 보강안

### 6.1 테이블

`sign_authentications` 테이블을 추가한다.

| 컬럼 | 설명 |
| --- | --- |
| `id` | 인증 레코드 UUID |
| `request_id` | `sign_requests.id` 외래키 |
| `provider_group` | `barocert` 또는 `mobile_identity` |
| `provider` | `kakao`, `naver`, `toss`, `pass`, `niceid`, `kcb`, `sci` 등 |
| `provider_product` | `identity`, `user_identity`, `digital_signature`, `mobile_identity` 등 |
| `receipt_id` | BaroCert 접수 아이디 또는 휴대폰 본인확인 요청 식별자 |
| `transaction_id` | 사업자 응답 트랜잭션 식별자 |
| `request_nonce_hash` | 요청 nonce 또는 BaroCert token의 해시 |
| `document_hash` | 인증 요청 시점의 문서 해시 |
| `consent_text_hash` | 사용자에게 표시한 동의/서명 문구 해시 |
| `terms_version` | 약관/개인정보 처리방침 버전 |
| `ci_hash` | CI 원문 대신 암호화 값 또는 keyed hash/HMAC |
| `di_hash` | DI 원문 대신 암호화 값 또는 keyed hash/HMAC |
| `signer_name_enc` | 필요 시 암호화한 이름 |
| `birthdate_enc` | 필요 시 암호화한 생년월일 |
| `phone_enc` | 필요 시 암호화한 휴대폰번호 |
| `signed_data_hash` | signedData 또는 인증 응답 원문의 해시 |
| `auth_status` | `requested`, `completed`, `failed`, `expired`, `verified` |
| `requested_at` | 요청 시각 |
| `verified_at` | 검증 완료 시각 |
| `raw_response_hash` | 원문 응답을 저장하지 않을 경우 응답 해시 |

### 6.2 상태 전이

`sign_requests.status`는 아래 순서만 허용한다.

```text
pending -> authenticating -> authenticated -> signed
pending -> expired
authenticating -> failed
authenticating -> expired
authenticated -> expired
```

`EXECUTE` 허용 조건:

1. `sign_requests.status = 'authenticated'`
2. `expiration_date IS NULL OR expiration_date > now()`
3. `sign_authentications.auth_status = 'verified'`
4. `sign_authentications.request_id = sign_requests.id`
5. `sign_authentications.document_hash = current_document_hash`
6. `sign_authentications.consent_text_hash = current_consent_text_hash`
7. 동일 `request_id`에 이미 `signed` 상태의 `signatures`가 없어야 함

### 6.3 API 액션

현재 `POST /api/sign`의 `REQUEST`, `EXECUTE`, `VERIFY`에 아래 액션을 추가하거나 별도 라우트로 분리한다.

| 액션 | 설명 |
| --- | --- |
| `AUTH_REQUEST` | provider별 인증 요청 생성 |
| `AUTH_STATUS` | BaroCert 등 비동기 인증 상태 조회 |
| `AUTH_CALLBACK` | PASS/휴대폰 본인확인 리다이렉트 결과 수신 |
| `AUTH_VERIFY` | provider 검증 API 호출 및 내부 인증 완료 처리 |
| `AUTH_CANCEL` | 사용자 취소 또는 만료 처리 |

provider별 어댑터:

- `barocert/kakao`: 카카오 본인인증 또는 전자서명
- `barocert/naver`: 네이버 본인인증 또는 전자서명
- `barocert/toss`: 토스 본인확인 또는 전자서명
- `mobile-identity/pass`: NICE아이디 등 휴대폰 본인확인

## 7. 개인정보 및 보안 정책

필수 정책:

1. CI/DI, 이름, 생년월일, 휴대폰번호는 최소 수집하고, DB에는 암호화 값 또는 keyed hash/HMAC을 저장한다.
2. 원문 응답 전체 저장이 꼭 필요하면 KMS 기반 필드 암호화를 적용하고 접근 로그를 남긴다.
3. 인증 요청 nonce/token은 재사용할 수 없게 하고, 만료 시간을 짧게 둔다.
4. 인증 검증 API는 재시도 횟수를 제한한다. BaroCert 토스 본인확인 문서도 검증 API 호출 횟수와 만료 제약을 안내한다.
5. 인증 완료 후 `document_hash`가 달라지면 서명을 무효 처리하고 인증부터 다시 진행한다.
6. 개인정보 처리방침에는 BaroCert, 카카오, 네이버, 토스, PASS/휴대폰 본인확인 사업자, 이동통신사, 수집 항목, 보관 기간, 처리위탁/제3자 제공 항목을 반영한다.
7. 서버 로그에는 CI/DI 원문, 휴대폰번호, 생년월일, provider secret, Bearer Token을 출력하지 않는다.

## 8. 구현 작업 항목

우선순위 순서:

1. `sign_authentications` 테이블과 상태 전이 제약 추가. 현재 `docs/setup-db.sql`, `docs/run-this-supabase-auth-bootstrap.sql`에 반영 완료.
2. BaroCert 공통 클라이언트와 `kakao`, `naver`, `toss` provider 어댑터 추가. 현재 provider registry와 env 검증 골격만 구현됨.
3. PASS/휴대폰 본인확인 공통 인터페이스와 NICE아이디 어댑터 추가. 현재 provider registry와 env 검증 골격만 구현됨.
4. `AUTH_REQUEST`, `AUTH_STATUS`, `AUTH_VERIFY`, `AUTH_CALLBACK` API 추가. 현재 전부 `src/app/api/sign/route.ts`와 `src/services/signAuthService.ts`에 연결되어 있고, 외부 provider HTTP adapter만 남아 있다.
5. `EXECUTE`에서 인증 완료 상태, 만료일, 문서 해시 일치, 동의 문구 해시 일치, 중복 서명 방지를 모두 검증. 현재 `authenticated` 상태에서 `verified` auth row와 `consent_text_hash` 일치 검증까지 반영됨.
6. `signature_audit_logs.metadata`에 `provider_group`, `provider`, `provider_product`, `receipt_id`, `transaction_id`, `document_hash`, `consent_text_hash`, `terms_version`, `signed_data_hash`, `client_ip`, `user_agent` 저장. 현재 요청 단계와 검증 완료 단계 감사 로그까지 반영되었고, provider별 원문 필드 매핑만 남아 있다.
7. `signatures`와 인증 결과 레코드를 append-only로 보호하는 DB 권한/RLS/트리거 적용. `signatures`와 `signature_audit_logs`는 완료, `sign_authentications`는 상태 갱신이 필요하므로 완전 append-only 전환 전 단계다.
8. 운영 전환 전 개인정보 처리방침과 이용약관에 본인확인 제공자, 수집 항목, 보관 기간, 처리위탁/제3자 제공 항목을 반영.

## 9. 최종 판단

현재 구현은 문서 해시 기반의 기본 무결성 확인은 통과하지만, 전자서명 효력 보강에 필요한 본인확인과 서명 원문 결합 증거가 부족하다. 확정 보강안은 `BaroCert`로 카카오/네이버/토스 인증서 기반 본인인증 또는 전자서명을 제공하고, `PASS/휴대폰 본인확인`은 NICE아이디 등 별도 휴대폰 본인확인 API로 제공하는 구조다. 이 구조에서 인증 결과값을 문서 해시 및 감사 로그와 결합하고, `EXECUTE`의 선행 조건으로 강제하면 현행 서비스의 가장 큰 결함인 본인확인 미구현 상태를 해소할 수 있다.
