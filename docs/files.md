# 선택 문서 체크리스트 등록 기능 설계

작성일: 2026-05-21
대상 페이지: `/project`, `/project?projectId=...&documentId=...`

## 목적

`선택 문서 체크 리스트`의 각 리스트 안에서 바로 `등록`을 시작할 수 있게 한다.

- `서명 요청`: `서명 대기` 상태에서만 등록 가능
- `필수 사진`: 사진 태그 이름 기준으로 등록
- `필수 파일`: 파일 태그 이름 기준으로 등록
- `기록 값`: 문서 안의 지정 위치로 이동해 입력

리스트에서 등록하든 문서 안의 연결 위치에서 등록하든 같은 체크리스트 항목의 완료 상태로 집계되어야 한다.

## 사용자 언어

사용자 화면에는 아래 표현만 쓴다.

- `서명 위치`
- `문서 연결 위치`
- `사진 태그 이름`
- `파일 태그 이름`
- `등록`
- `완료`, `대기`, `확인 필요`, `누락`

아래 표현은 사용자 화면에 쓰지 않는다.

- `키 상자`
- `valueKey`
- `slotKey`
- `표시 상자`
- `파일명 조건`

## 화이트리스트

아래 파일만 수정할 수 있다. 구현 중 다른 파일 수정이 필요해지면 작업을 멈추고 이 문서를 먼저 갱신해야 한다.

| 파일 | 허용 목적 |
| --- | --- |
| `docs/files.md` | 설계, 체크리스트, 백업/복구 기준 기록 |
| `src/app/project/page.tsx` | 체크리스트 등록 버튼, 등록 상태, 문서 연결 위치 선택, 캔버스 연동 상태 관리 |
| `src/components/template/TemplateEditWorkspace.tsx` | 외부 체크리스트 대상 하이라이트, 서명 오버레이, 첨부/서명 클릭 이벤트 연결 |
| `src/components/template/workspace/types.ts` | 체크리스트 하이라이트/등록 이벤트용 props 타입 추가 |
| `src/app/canvas/ownerPolicy.tsx` | `CanvasOwnedWorkspace`가 새 props를 안전하게 전달해야 할 때만 수정 |
| `src/app/api/sign/route.ts` | 기존 서명 실행 API에 체크리스트 등록 흐름을 연결해야 할 때만 수정 |
| `src/app/api/member-access/documents/[documentId]/signatures/route.ts` | 구성원 서명 실행 흐름과 동일한 검증을 재사용해야 할 때만 수정 |
| `src/services/signService.ts` | 서명 완료 처리, 완료 상태 보호, 감사 로그 보존 |
| `src/services/documentService.ts` | 문서 상세 DTO에 체크리스트 등록 상태를 계산해 내려야 할 때만 수정 |
| `src/lib/documentDtos.ts` | 문서 상세/첨부/체크리스트 DTO 타입 확장 |

## 절대 수정 금지

- 패키지 설정, ESLint/TypeScript 설정, 빌드 설정
- `/canvas`, `/member-access` 화면의 독립 UI 흐름
- 데이터베이스 마이그레이션 SQL
- 디자인 시스템 공통 컴포넌트
- 애니메이션 라이브러리, `framer-motion`, transition 기반 효과
- 위 화이트리스트에 없는 서비스, API, 문서 파일

DB 스키마 변경이 필요하다고 판단되면 구현을 멈추고 별도 설계를 받아야 한다.

## 백업 기준

구현 전 현재 코드를 아래 파일로 백업했다. 복구는 체크리스트 ID 단위로 진행한다.

| 원본 파일 | 백업 파일 | SHA-256 |
| --- | --- | --- |
| `src/app/project/page.tsx` | `docs/diff/2026-05-21_FILES-CHECKLIST-REGISTRATION-01_project-page.before.tsx` | `c894e2b54da7245c9596d1b7433cecd6ffcfde66591fddd8f3f9775bfb8e3219` |
| `src/components/template/TemplateEditWorkspace.tsx` | `docs/diff/2026-05-21_FILES-CHECKLIST-REGISTRATION-01_TemplateEditWorkspace.before.tsx` | `90e80511bc7fc37e367f4c5314cbbac3acabd0883785161d76c72eb34a9545c5` |
| `src/components/template/workspace/types.ts` | `docs/diff/2026-05-21_FILES-CHECKLIST-REGISTRATION-01_workspace-types.before.ts` | `a74324f9e5aa46ef65ec76881dbac9e8362951b009431779619b21862fcd7d7e` |
| `src/app/canvas/ownerPolicy.tsx` | `docs/diff/2026-05-21_FILES-CHECKLIST-REGISTRATION-01_canvas-ownerPolicy.before.tsx` | `8b4ba00e4f7a78b545dbe8e3fa1e37bf7d579acdecebefd3421fe77a13711892` |
| `src/app/api/sign/route.ts` | `docs/diff/2026-05-21_FILES-CHECKLIST-REGISTRATION-01_api-sign-route.before.ts` | `5fb3319acb2a4d44c58acb3b78c2ed7dfe80e64e121d7c6ff4a421f310cf376a` |
| `src/app/api/member-access/documents/[documentId]/signatures/route.ts` | `docs/diff/2026-05-21_FILES-CHECKLIST-REGISTRATION-01_member-access-signatures-route.before.ts` | `bcd3dac61d982d196dd2dffc6891c6967efee43f4ad6beee490c276fc7187435` |
| `src/services/signService.ts` | `docs/diff/2026-05-21_FILES-CHECKLIST-REGISTRATION-01_signService.before.ts` | `f0bf40ce2725dd87fc2f42479f1a0fb89ac086fbd4caa0699758aa97346406bc` |
| `src/services/documentService.ts` | `docs/diff/2026-05-21_FILES-CHECKLIST-REGISTRATION-01_documentService.before.ts` | `e469e76e47fd701c3e841e0820da65a243da32d649e85b7233f1c9e642399bdf` |
| `src/lib/documentDtos.ts` | `docs/diff/2026-05-21_FILES-CHECKLIST-REGISTRATION-01_documentDtos.before.ts` | `fdff40969fd7f8182303147ac801383a1ab44d403574689e501990031760e52c` |

## 복구 연결표

| 체크리스트 ID | 문제가 되는 증상 | 복구 대상 |
| --- | --- | --- |
| `FILES-01` | 체크리스트 리스트/버튼 UI가 깨짐 | `project-page.before.tsx` |
| `FILES-02` | 문서 연결 위치 선택값이 잘못 저장되거나 목록이 깨짐 | `project-page.before.tsx`, `documentDtos.before.ts` |
| `FILES-03` | 문서 화면 하이라이트가 남거나 다른 상자를 막음 | `project-page.before.tsx`, `TemplateEditWorkspace.before.tsx`, `workspace-types.before.ts`, `canvas-ownerPolicy.before.tsx` |
| `FILES-04` | 서명 오버레이가 뜨지 않거나 기존 서명 상자 저장을 망침 | `project-page.before.tsx`, `TemplateEditWorkspace.before.tsx`, `signService.before.ts`, `api-sign-route.before.ts`, `member-access-signatures-route.before.ts` |
| `FILES-05` | 필수 사진 등록이 태그 집계와 맞지 않음 | `project-page.before.tsx`, `documentService.before.ts`, `documentDtos.before.ts` |
| `FILES-06` | 필수 파일 등록이 첨부 저장과 맞지 않음 | `project-page.before.tsx`, `TemplateEditWorkspace.before.tsx`, `documentService.before.ts`, `documentDtos.before.ts` |
| `FILES-07` | 기존 문서 저장, 첨부파일, 서명 요청 생성/철회가 회귀 | 전체 백업 세트 |

## 데이터 설계

체크리스트 항목은 화면 내부에서 아래 구조로 다룬다.

```ts
type ProjectChecklistKind = 'signature' | 'photo' | 'file' | 'value';

type ProjectChecklistLinkedPosition = {
  label: string;
  valueKey?: string;
  slotKey?: string;
  frameGroupId?: string;
  boxKind: 'signature' | 'attachment' | 'text' | 'image';
};

type ProjectChecklistRegisterTarget = {
  kind: ProjectChecklistKind;
  id: string;
  label: string;
  linkedPosition?: ProjectChecklistLinkedPosition | null;
};
```

`valueKey`, `slotKey`, `frameGroupId`는 내부 식별자다. 화면에는 `문서 연결 위치`로만 표현한다.

## UI 설계

각 체크리스트 리스트에는 `등록` 컬럼을 둔다.

`등록` 버튼 동작:

- 등록 가능하면 버튼 활성화
- 등록 불가능하면 비활성화하고 상태 텍스트로 이유 표시
- 연결된 문서 위치가 있으면 문서 화면의 해당 위치로 스크롤하고 하이라이트
- 연결된 문서 위치가 없으면 리스트 안에서 바로 업로드/등록 흐름 실행

공통 리스트 컬럼:

- 항목
- 상태
- 상세
- 최근 등록
- 등록
- 삭제

삭제는 기존 권한 규칙을 따른다. 완료된 서명 요청은 삭제할 수 없다.

## 서명 요청 설계

등록 가능 조건:

- 상태가 정확히 `pending`
- 현재 사용자에게 등록 권한이 있음
- 요청 ID가 있음

등록 버튼 클릭:

1. 해당 `서명 위치`를 문서에서 하이라이트
2. 해당 위치로 스크롤
3. 사용자가 하이라이트 위치를 클릭하면 서명 오버레이 표시
4. 하이라이트 없이 같은 서명 위치를 직접 클릭해도 동일하게 서명 오버레이 표시

서명 오버레이:

- 문서 위에 회색 배경을 띄움
- 화면 너비와 높이의 약 `2/3` 크기 흰색 서명 패널을 중앙에 표시
- 패널 안에 서명 캔버스, 지우기, 취소, 등록 버튼 배치
- 애니메이션은 사용하지 않음
- 등록된 이미지는 기존 문서 서명 이미지 상자에 들어가는 방식과 동일하게 반영
- 한 서명 위치에 여러 표시 영역이 연결되어 있으면 동일 서명 이미지를 모두 반영
- 서명 완료 후 기존 서명 실행 API로 완료 상태와 감사 로그를 남김

## 필수 사진 설계

필수 사진 생성 입력:

- 사진 태그 이름
- 필수 수량
- 문서 연결 위치, 선택값

등록 흐름:

- 문서 연결 위치가 없으면 리스트에서 사진 업로드
- 문서 연결 위치가 있으면 해당 위치를 하이라이트하고 문서 위치에서 사진 업로드
- 두 흐름 모두 같은 사진 태그로 집계
- 등록 사진 수가 필수 수량 이상이면 완료
- 검토 필요 사진이 있으면 확인 필요
- 부족하면 누락

사진 태그 이름은 기존 태그를 불러와 검색/선택할 수 있고, 새 이름도 입력할 수 있다.

## 필수 파일 설계

필수 파일 생성 입력:

- 파일 태그 이름
- 필수 수량
- 문서 연결 위치, 선택값

등록 흐름:

- 문서 연결 위치가 없으면 리스트에서 파일 업로드
- 문서 연결 위치가 있으면 해당 위치를 하이라이트하고 문서 위치에서 파일 업로드
- 두 흐름 모두 같은 파일 태그로 집계
- `파일명 조건`은 사용하지 않음

파일 태그 이름은 기존 태그를 불러와 검색/선택할 수 있고, 새 이름도 입력할 수 있다.

## 기록 값 설계

등록 버튼 클릭:

- 지정된 입력 위치로 스크롤
- 입력 위치 하이라이트
- 입력 위치 클릭 시 기존 입력 방식 그대로 활성화
- 값 저장 후 완료로 집계

기록 값은 새 업로드 흐름을 만들지 않는다.

## 구현 체크리스트

- [x] `FILES-00` 구현 전 백업 생성
- [x] `FILES-00-A` 백업 해시 기록
- [x] `FILES-00-B` 화이트리스트 작성
- [x] `FILES-01` 체크리스트 리스트에 공통 `등록` 컬럼 추가
- [x] `FILES-01-A` 서명 요청은 `pending` 상태에서만 등록 버튼 활성화
- [x] `FILES-01-B` 완료된 서명 요청은 등록/삭제 모두 불가
- [x] `FILES-02` 필수 사진 생성 폼에 선택형 `문서 연결 위치` 추가
- [x] `FILES-02-A` 필수 파일 생성 폼에 선택형 `문서 연결 위치` 추가
- [x] `FILES-02-B` 문서 연결 위치는 사용자에게 `문서 연결 위치`로만 표시
- [x] `FILES-03` `TemplateEditWorkspace`에 외부 하이라이트 대상 props 추가
- [x] `FILES-03-A` 하이라이트 대상 스크롤 이동 구현
- [x] `FILES-03-B` 하이라이트 대상 클릭과 일반 직접 클릭이 같은 등록 동작을 호출
- [x] `FILES-04` 서명 오버레이 구현
- [x] `FILES-04-A` 오버레이는 회색 배경과 2/3 크기 흰색 패널로 출력
- [x] `FILES-04-B` 오버레이에 지우기, 취소, 등록 제공
- [x] `FILES-04-C` 등록 이미지를 기존 서명 이미지 상자에 동일하게 반영
- [x] `FILES-04-D` 서명 완료 후 기존 서명 요청 완료 상태와 감사 로그 유지
- [x] `FILES-05` 필수 사진 리스트 등록 흐름 구현
- [x] `FILES-05-A` 연결 위치가 있으면 문서 위치에서 등록 완료
- [x] `FILES-05-B` 연결 위치가 없으면 리스트에서 등록 완료
- [x] `FILES-06` 필수 파일 리스트 등록 흐름 구현
- [x] `FILES-06-A` 연결 위치가 있으면 문서 위치에서 등록 완료
- [x] `FILES-06-B` 연결 위치가 없으면 리스트에서 등록 완료
- [x] `FILES-07` 기록 값 등록 버튼은 지정 입력 위치로 이동 및 하이라이트
- [ ] `FILES-08` `/project?projectId=1b75a399-09c0-45b7-ab2a-c7cb4b7d791c&documentId=2f6d0be2-8ba5-4d69-aacf-845275a66908` 브라우저 검증
- [ ] `FILES-08-A` `표시 상자`, `키 상자`, `파일명 조건` 문구 미출력 확인
- [ ] `FILES-08-B` 콘솔 오류 없음 확인
- [ ] `FILES-08-C` 기존 문서 저장, 첨부, 서명 요청 생성/철회 회귀 없음 확인

## 구현 기록

- `src/app/project/page.tsx`: 체크리스트 공통 `등록` 컬럼, 서명/사진/파일/기록 값 등록 액션, 사진/파일 `문서 연결 위치` 선택, 체크리스트 등록용 숨김 파일 입력, 서명 실행 API 연결을 구현했다.
- `src/components/template/TemplateEditWorkspace.tsx`: 외부 체크리스트 대상 하이라이트, 스크롤 이동, 서명 오버레이, 서명 이미지 반영, 사진/파일 대상 클릭 이벤트를 구현했다.
- `src/components/template/workspace/types.ts`: 체크리스트 등록 대상, 서명 상태, 서명 제출 props 타입을 추가했다.
- `src/lib/documentDtos.ts`, `src/services/documentService.ts`: 문서 상세 서명 증빙에 서명 이미지 값을 포함하도록 확장했다.

## 검증 기록

- `npx esbuild src/app/project/page.tsx --bundle --platform=browser --format=esm --external:next '--external:next/*' --outfile=/tmp/project-page.js`: 통과
- `npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --platform=browser --format=esm --external:next '--external:next/*' --outfile=/tmp/template-workspace.js`: 통과
- `npx esbuild src/services/signService.ts --bundle --platform=node --format=esm --external:@supabase/supabase-js --outfile=/tmp/sign-service.js`: 통과
- `git diff --check -- ...`: 통과
- `npm run check:no-shadow-app`: 통과
- `npx tsc --noEmit --pretty false --incremental false`: 기본 힙에서는 OOM, `NODE_OPTIONS=--max-old-space-size=8192`에서는 기존 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 문법 오류로 중단
- `npm run build`: 기존 `.venv-template-extract-v2/bin/python` 심볼릭 링크가 프로젝트 루트 밖을 가리켜 Turbopack이 중단
- `npm run dev -- --hostname 127.0.0.1 --port 3001`: 현재 샌드박스에서 포트 바인딩이 `EPERM`으로 차단되어 브라우저 검증 미완료

## 검증 계획

필수 명령:

```bash
npx esbuild src/app/project/page.tsx --bundle --platform=browser --format=esm --external:next '--external:next/*' --outfile=/tmp/project-page.js
npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --platform=browser --format=esm --external:next '--external:next/*' --outfile=/tmp/template-workspace.js
npx esbuild src/services/signService.ts --bundle --platform=node --format=esm --external:@supabase/supabase-js --outfile=/tmp/sign-service.js
git diff --check -- src/app/project/page.tsx src/components/template/TemplateEditWorkspace.tsx src/components/template/workspace/types.ts src/app/canvas/ownerPolicy.tsx src/app/api/sign/route.ts 'src/app/api/member-access/documents/[documentId]/signatures/route.ts' src/services/signService.ts src/services/documentService.ts src/lib/documentDtos.ts docs/files.md
```

브라우저 검증:

- 체크리스트 각 탭에 `등록` 버튼 표시
- 서명 완료 항목은 등록/삭제 불가
- 서명 대기 항목 등록 클릭 시 서명 위치 하이라이트
- 서명 위치 클릭 시 회색 배경과 흰색 서명 패널 표시
- 사진/파일은 연결 위치가 있으면 문서 위치 하이라이트
- 사진/파일은 연결 위치가 없으면 리스트 등록 흐름으로 완료 처리
- 콘솔 오류 없음
- 네트워크 4xx/5xx 없음

## 중단 기준

아래 상황이 발생하면 구현을 중단한다.

- 화이트리스트 밖 파일 수정이 필요함
- DB 마이그레이션이 필요함
- 기존 문서 저장 API 계약을 깨야 함
- 기존 서명 요청 완료/감사 로그 구조를 바꿔야 함
- 애니메이션 효과를 추가해야만 구현 가능한 구조가 됨
