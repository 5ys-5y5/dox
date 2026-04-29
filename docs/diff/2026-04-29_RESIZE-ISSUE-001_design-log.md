# RESIZE-ISSUE-001 Design Log

- 작성 일시: 2026-04-29
- 사용자 확정: 완료 (`확정`)
- 현재 턴 목적: `docs/resizeissue.md` 설계 문서 작성
- 현재 턴 runtime 코드 수정: 없음

## 체크리스트 매핑

- `CHK-PLAN-001`
  - 내용: 이슈 1, 2의 재현 절차와 브라우저 확인 근거를 문서화한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/resizeissue.md`

- `CHK-PLAN-002`
  - 내용: 서비스 독립성 원칙에 따라 기능 경계를 분리하고, 기능별 API/책임/데이터 소유권을 문서화한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/resizeissue.md`

- `CHK-PLAN-003`
  - 내용: 수정 허용 화이트리스트, 롤백 규칙, diff 기록 규칙을 문서화한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/resizeissue.md`

- `CHK-PLAN-004`
  - 내용: 구현 단계에서 생성해야 할 `docs/diff` 백업 파일명을 사전 정의한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/resizeissue.md`

- `CHK-PLAN-005`
  - 내용: MCP 테스트 수행 결과와 후속 테스트 절차를 문서화한다.
  - 현재 상태: 완료
  - 반영 문서: `docs/resizeissue.md`

## 후속 구현 승인 시 생성해야 할 백업 파일

- `docs/diff/2026-04-29_RESIZE-ISSUE-101_TemplateEditWorkspace.before.tsx`
- `docs/diff/2026-04-29_RESIZE-ISSUE-102_templateFrameEditGeometryService.before.ts`
- `docs/diff/2026-04-29_RESIZE-ISSUE-103_templateFrameEditDtos.before.ts`

## 비고

- 이번 턴은 설계 문서만 작성한다.
- `src/components/template/TemplateEditWorkspace.tsx` 는 기존 작업 트리 변경이 존재하지만, 이번 턴 신규 설계 요청 범위에서는 수정하지 않는다.
