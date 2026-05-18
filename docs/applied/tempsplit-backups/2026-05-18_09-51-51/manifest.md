# Tempsplit Backup Manifest

- run_at: 2026-05-18 09:51:51
- phase: P2 -> P3
- purpose: template persistence 상태 전이와 preview surface, metadata UI 경계 분리
- editable_files:
  - docs/tempsplit.md
  - src/components/template/TemplateEditWorkspace.tsx
  - src/components/template/workspace/types.ts
  - src/components/template/workspace/canvas/TemplateEditPreviewSurface.tsx
  - src/components/template/workspace/persistence/templateWorkspaceState.ts
  - src/components/template/workspace/metadata/metadataUi.tsx
- browser_checks:
  - http://localhost:3001/templates reload
  - http://localhost:3001/templates/edit reload
  - 템플릿 리스트 클릭 후 templateId query 반영 확인
  - 템플릿 편집 캔버스 실제 렌더 확인
  - console runtime error 제거 확인
