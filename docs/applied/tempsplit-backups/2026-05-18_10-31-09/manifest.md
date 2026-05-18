# Tempsplit Backup Manifest

- run_at: 2026-05-18 10:31:09
- phase: P4 -> P7
- purpose: canvas observer/key shortcut hook, position/metadata overlay, canvas toolbar shell 분리
- editable_files:
  - docs/tempsplit.md
  - src/components/template/TemplateEditWorkspace.tsx
  - src/components/template/workspace/canvas/useCanvasEditorStateSync.ts
  - src/components/template/workspace/canvas/useCanvasKeyboardShortcuts.ts
  - src/components/template/workspace/position/PositionSpacingDeferredInput.tsx
  - src/components/template/workspace/position/PositionSpacingPanel.tsx
  - src/components/template/workspace/position/SelectionSummaryOverlay.tsx
  - src/components/template/workspace/metadata/MetadataCanvasOverlays.tsx
  - src/components/template/workspace/panels/TemplateEditCanvasToolbar.tsx
- browser_checks:
  - localhost:3001/templates 연결 시도
  - localhost:3001/templates/edit 연결 시도
  - sandbox dev server 기동 시도
