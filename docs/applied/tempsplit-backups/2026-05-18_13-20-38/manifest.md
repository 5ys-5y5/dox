# Tempsplit Backup Manifest

- run_at: 2026-05-18 13:20:38
- phase: P7/P8 stricter completion
- purpose: remove remaining large position/text/style overlay render blocks from `TemplateEditWorkspace`
- editable_files:
  - src/components/template/TemplateEditWorkspace.tsx
  - src/components/template/workspace/types.ts
  - src/components/template/workspace/constants.ts
  - src/components/template/workspace/panels/TemplatePositionSideOverlays.tsx
  - src/components/template/workspace/panels/TemplateSelectionAppearanceOverlay.tsx
  - docs/tempsplit.md
- verification:
  - `npx esbuild src/components/template/TemplateEditWorkspace.tsx --bundle --platform=browser --format=esm --outfile=/private/tmp/template-edit-workspace-check.js`
  - `rg -n "const render[A-Z]|function render[A-Z]" src/components/template/TemplateEditWorkspace.tsx`
- browser_checks:
  - blocked: `localhost:3001` not reachable in sandbox
  - blocked: browser/devtools transport unavailable
