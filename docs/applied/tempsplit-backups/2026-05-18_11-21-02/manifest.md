# Tempsplit Backup Manifest

- run_at: 2026-05-18 11:21:02
- phase: P4 -> P8
- purpose: pointer handler와 metadata action 블록 분리
- editable_files:
  - src/components/template/TemplateEditWorkspace.tsx
  - src/components/template/workspace/canvas/useCanvasPointerHandlers.ts
  - src/components/template/workspace/metadata/useMetadataConnectionActions.ts
  - docs/tempsplit.md
- browser_checks:
  - blocked: localhost:3001 connection failed
  - blocked: chrome devtools transport closed
- verification:
  - npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --platform=browser --format=esm --outfile=/private/tmp/template-edit-workspace-check.js
- notes:
  - main file line count reduced to 30,403
  - pointer engine and metadata action block moved out of main file
