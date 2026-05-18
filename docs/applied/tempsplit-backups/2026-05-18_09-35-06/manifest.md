# Tempsplit Backup Manifest

- run_at: 2026-05-18
- phase: P1
- purpose: selector/attribute 상수와 default/draft 상수 추가 분리
- editable_files:
  - docs/tempsplit.md
  - src/components/template/TemplateEditWorkspace.tsx
  - src/components/template/workspace/types.ts
  - src/components/template/workspace/utils.ts
  - src/components/template/workspace/constants.ts
- browser_checks:
  - /templates 진입
  - /templates/edit 진입
  - 템플릿 선택 가능 여부 확인
