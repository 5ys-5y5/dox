# 전자서명 본인확인 연동 TODO

작성일: 2026-04-11 (KST)

## 지금 상태

- 문서가 바뀌지 않았는지 확인하는 무결성 기능은 구현되어 있습니다.
- 본인확인 기록을 저장하는 DB 구조도 준비되어 있습니다.
- `AUTH_REQUEST`, `AUTH_STATUS`, `AUTH_CANCEL`, `AUTH_VERIFY`, `AUTH_CALLBACK` 내부 코드도 만들어져 있습니다.
- 아직 남은 것은 `BaroCert`와 `PASS/휴대폰 본인확인` 회사에서 받은 실제 키를 넣고, 그 회사의 실제 API와 연결하는 일입니다.
- 현재는 본인확인 서비스 신청에 필요한 사업자 번호가 발급 중이므로, 실제 외부 연동은 잠시 대기 상태입니다.
- 그동안은 다른 독립 기능을 먼저 구현해도 됩니다.

## 사용자가 할 일

### 1. BaroCert 신청

아래처럼 문의하면 됩니다.

```text
우리 웹서비스에서 카카오, 네이버, 토스 본인확인/전자서명 연동을 하려고 합니다.
테스트용 LinkID, SecretKey, ClientCode 발급과 연동 문서 제공 부탁드립니다.
```

받아야 하는 값:

- `BAROCERT_LINK_ID`
- `BAROCERT_SECRET_KEY`
- `BAROCERT_CLIENT_CODE`

### 2. PASS/휴대폰 본인확인 신청

처음에는 `NICE아이디`로 시작하는 것이 가장 무난합니다.

아래처럼 문의하면 됩니다.

```text
우리 웹서비스에서 PASS/휴대폰 본인확인을 붙이려고 합니다.
테스트용 Site Code, Site Password, 연동 문서, callback/return URL 등록 방법 안내 부탁드립니다.
```

받아야 하는 값:

- `MOBILE_IDENTITY_SITE_CODE`
- `MOBILE_IDENTITY_SITE_PASSWORD`

### 3. 받은 값 정리

받은 값을 저에게 보내거나, `.env` 파일에 넣을 수 있게 준비해 주세요.

필요한 항목:

```env
BAROCERT_LINK_ID=
BAROCERT_SECRET_KEY=
BAROCERT_CLIENT_CODE=

MOBILE_IDENTITY_PROVIDER=niceid
MOBILE_IDENTITY_SITE_CODE=
MOBILE_IDENTITY_SITE_PASSWORD=
MOBILE_IDENTITY_RETURN_URL=
MOBILE_IDENTITY_ERROR_URL=

AUTH_EVIDENCE_HMAC_SECRET=
```

### 4. 알아두면 좋은 점

- 지금은 DB를 더 만질 필요가 거의 없습니다.
- `docs/applied/run-this-supabase-auth-bootstrap.sql` 실행은 이미 완료된 상태입니다.
- 따라서 이제 중요한 것은 "회사에서 받은 실제 키"입니다.

## 제가 할 일

사용자가 위 값을 준비해 주시면, 저는 아래 작업을 이어서 합니다.

### 1. BaroCert 실제 연결

- 토스 본인확인부터 먼저 연결
- 그 다음 카카오, 네이버 연결
- 테스트용 응답이 아니라 실제 BaroCert 응답을 받아 저장하도록 수정

### 2. PASS/NICE 실제 연결

- NICE callback 처리 연결
- NICE 검증 결과를 `sign_authentications`에 저장
- 인증 성공 시 `sign_requests.status = authenticated`로 바꾸기

### 3. 최종 서명 잠금

- 본인확인이 끝나지 않으면 서명되지 않게 최종 제한
- 지금 남아 있는 임시 허용(`pending -> signed`) 제거
- 본인확인 완료 뒤에만 `authenticated -> signed`가 되도록 변경

### 4. 테스트 화면 마무리

- `/test-sign`에서 실제 본인확인 흐름을 확인할 수 있게 정리
- 성공/실패/취소 화면을 더 이해하기 쉽게 수정

## 가장 쉬운 진행 순서

1. 사업자 번호 발급 완료
2. `BaroCert 토스` 테스트 키 받기
3. `NICE PASS` 테스트 키 받기
4. 받은 값을 `.env`에 넣기
5. 저에게 "키 준비 완료"라고 알려주기
6. 제가 실제 연동 코드 연결하기

## 완료 기준

아래가 되면 이 작업은 완료입니다.

- 사용자가 토스 또는 PASS로 본인확인을 성공함
- 그 결과가 DB에 저장됨
- 본인확인 성공 후에만 서명 가능함
- 문서 해시와 본인확인 기록이 함께 남음
- 나중에 "누가, 어떤 문서에, 언제 동의하고 서명했는지" 확인 가능함
