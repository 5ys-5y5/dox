# 0529 환경 설정 UI 기능 일치 작업 백업

이 백업은 `docs/0529envsetting-checklist.md` 작업을 구현하기 전 현재 작업 파일 상태를 복구하기 위한 것이다.

백업 기준:
- 작업명: `0529envsetting-checklist`
- 백업 위치: `docs/backups/0529envsetting-checklist/`
- 목적: 구현 후 오류가 발생하거나 사용자가 문제를 확인 요청했을 때 즉시 이전 지점으로 복구

## 백업 파일

| 원본 경로 | 백업 경로 |
| --- | --- |
| `src/app/canvas/page.tsx` | `docs/backups/0529envsetting-checklist/src/app/canvas/page.tsx.before` |
| `src/app/canvas/ownerSettings.ts` | `docs/backups/0529envsetting-checklist/src/app/canvas/ownerSettings.ts.before` |
| `src/app/canvas/ownerPolicy.tsx` | `docs/backups/0529envsetting-checklist/src/app/canvas/ownerPolicy.tsx.before` |
| `src/components/template/TemplateEditWorkspace.tsx` | `docs/backups/0529envsetting-checklist/src/components/template/TemplateEditWorkspace.tsx.before` |
| `src/components/template/workspace/types.ts` | `docs/backups/0529envsetting-checklist/src/components/template/workspace/types.ts.before` |
| `src/components/template/workspace/panels/TemplateEditCanvasToolbar.tsx` | `docs/backups/0529envsetting-checklist/src/components/template/workspace/panels/TemplateEditCanvasToolbar.tsx.before` |
| `src/components/template/workspace/panels/TemplatePersistencePanel.tsx` | `docs/backups/0529envsetting-checklist/src/components/template/workspace/panels/TemplatePersistencePanel.tsx.before` |
| `src/components/template/workspace/canvas/TemplateEditPreviewSurface.tsx` | `docs/backups/0529envsetting-checklist/src/components/template/workspace/canvas/TemplateEditPreviewSurface.tsx.before` |
| `docs/0529envsetting.md` | `docs/backups/0529envsetting-checklist/docs/0529envsetting.md.before` |
| `docs/0529envsetting-checklist.md` | `docs/backups/0529envsetting-checklist/docs/0529envsetting-checklist.md.before` |

## 즉시 복구 명령

아래 명령은 이 작업의 구현 대상 파일을 백업 시점으로 되돌린다.

```sh
cp docs/backups/0529envsetting-checklist/src/app/canvas/page.tsx.before src/app/canvas/page.tsx
cp docs/backups/0529envsetting-checklist/src/app/canvas/ownerSettings.ts.before src/app/canvas/ownerSettings.ts
cp docs/backups/0529envsetting-checklist/src/app/canvas/ownerPolicy.tsx.before src/app/canvas/ownerPolicy.tsx
cp docs/backups/0529envsetting-checklist/src/components/template/TemplateEditWorkspace.tsx.before src/components/template/TemplateEditWorkspace.tsx
cp docs/backups/0529envsetting-checklist/src/components/template/workspace/types.ts.before src/components/template/workspace/types.ts
cp docs/backups/0529envsetting-checklist/src/components/template/workspace/panels/TemplateEditCanvasToolbar.tsx.before src/components/template/workspace/panels/TemplateEditCanvasToolbar.tsx
cp docs/backups/0529envsetting-checklist/src/components/template/workspace/panels/TemplatePersistencePanel.tsx.before src/components/template/workspace/panels/TemplatePersistencePanel.tsx
cp docs/backups/0529envsetting-checklist/src/components/template/workspace/canvas/TemplateEditPreviewSurface.tsx.before src/components/template/workspace/canvas/TemplateEditPreviewSurface.tsx
cp docs/backups/0529envsetting-checklist/docs/0529envsetting.md.before docs/0529envsetting.md
cp docs/backups/0529envsetting-checklist/docs/0529envsetting-checklist.md.before docs/0529envsetting-checklist.md
```

## 복구 후 확인

복구 후 최소 확인:

```sh
git diff --check
npm run check:no-shadow-app
```

브라우저 확인이 가능한 환경이면 다음 페이지도 확인한다.

- `http://localhost:3000/canvas?page=project&mode=template`
- 템플릿 편집 가능 owner 페이지

## 주의

이 백업은 git checkout이나 reset을 사용하지 않고, 지정 파일만 복사 복구하기 위한 것이다. 다른 사용자가 같은 파일을 수정한 뒤에는 즉시 덮어쓰기 전에 현재 diff를 확인해야 한다.
