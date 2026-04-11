# 2026-04-10 src 전자서명 무결성 구현 생성 기록

요청 정정: `docs/designCloning`는 템플릿 reference이며, 현재 서비스 구현은 `/Users/gy/Documents/dev/docs/src`에 작성해야 한다.

생성 파일:

- `src/lib/crypto.ts`
- `src/services/signService.ts`
- `src/app/api/sign/route.ts`

운영 흔적:

- `src/lib/crypto.ts`에 `DOCUMENT_HASH_INTEGRITY` 표식을 추가했다.
- `src/services/signService.ts`에 `TODO(auth-gate)` 표식을 추가했다.
- `docs/setup-db.sql`과 `docs/run-this-supabase-integrity.sql`에도 동일 표식을 남겼다.

검증:

- `src/lib/crypto.ts`는 TypeScript 단독 체크를 통과했다.
- `src/app/api/sign/route.ts`는 esbuild 번들 파싱으로 상대 import 및 문법을 확인했다.
- 루트 `/Users/gy/Documents/dev/docs`에는 `package.json`과 `node_modules`가 없어 전체 Next/TypeScript 프로젝트 검증은 수행할 수 없다.
