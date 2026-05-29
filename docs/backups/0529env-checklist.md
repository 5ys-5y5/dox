# 0529env-checklist 백업 및 복구 문서

작업 ID: `0529env-checklist`  
설계 문서: `docs/0529env.md`  
체크리스트: `docs/0529env-checklist.md`

## Checkpoint

| checkpoint | 용도 | 위치 |
| --- | --- | --- |
| `00-before-start` | 구현 시작 전 whitelist 대상 파일 복구 | `docs/backups/0529env-checklist/00-before-start/` |
| `11-runtime-toolbar-before` | runtime preview/toolbar 탭 상태 분리 구현 직전 복구 | `docs/backups/0529env-checklist/11-runtime-toolbar-before/` |

## 00-before-start 백업 파일

| 원본 경로 | 백업 경로 |
| --- | --- |
| `docs/0529env.md` | `docs/backups/0529env-checklist/00-before-start/docs__0529env.md.before` |
| `docs/0529env-checklist.md` | `docs/backups/0529env-checklist/00-before-start/docs__0529env-checklist.md.before` |
| `src/app/canvas/ownerSettings.ts` | `docs/backups/0529env-checklist/00-before-start/src__app__canvas__ownerSettings.ts.before` |
| `src/app/canvas/page.tsx` | `docs/backups/0529env-checklist/00-before-start/src__app__canvas__page.tsx.before` |
| `src/components/ui/SettingToggleRow.tsx` | `docs/backups/0529env-checklist/00-before-start/src__components__ui__SettingToggleRow.tsx.before` |

## 00-before-start 복구 명령

```sh
cp docs/backups/0529env-checklist/00-before-start/docs__0529env.md.before docs/0529env.md
cp docs/backups/0529env-checklist/00-before-start/docs__0529env-checklist.md.before docs/0529env-checklist.md
cp docs/backups/0529env-checklist/00-before-start/src__app__canvas__ownerSettings.ts.before src/app/canvas/ownerSettings.ts
cp docs/backups/0529env-checklist/00-before-start/src__app__canvas__page.tsx.before src/app/canvas/page.tsx
cp docs/backups/0529env-checklist/00-before-start/src__components__ui__SettingToggleRow.tsx.before src/components/ui/SettingToggleRow.tsx
```

## 11-runtime-toolbar-before 복구 명령

```sh
cp docs/backups/0529env-checklist/11-runtime-toolbar-before/docs__0529env.md.before docs/0529env.md
cp docs/backups/0529env-checklist/11-runtime-toolbar-before/docs__0529env-checklist.md.before docs/0529env-checklist.md
cp docs/backups/0529env-checklist/11-runtime-toolbar-before/docs__backups__0529env-checklist.md.before docs/backups/0529env-checklist.md
cp docs/backups/0529env-checklist/11-runtime-toolbar-before/src__app__canvas__ownerSettings.ts.before src/app/canvas/ownerSettings.ts
cp docs/backups/0529env-checklist/11-runtime-toolbar-before/src__app__canvas__page.tsx.before src/app/canvas/page.tsx
cp docs/backups/0529env-checklist/11-runtime-toolbar-before/src__components__ui__SettingToggleRow.tsx.before src/components/ui/SettingToggleRow.tsx
cp docs/backups/0529env-checklist/11-runtime-toolbar-before/src__components__template__TemplateEditWorkspace.tsx.before src/components/template/TemplateEditWorkspace.tsx
cp docs/backups/0529env-checklist/11-runtime-toolbar-before/src__components__template__workspace__panels__TemplateEditCanvasToolbar.tsx.before src/components/template/workspace/panels/TemplateEditCanvasToolbar.tsx
```

## 복구 후 확인

```sh
git diff --check
npm run check:no-shadow-app
```

브라우저 실행이 가능한 환경에서는 다음 페이지를 다시 확인한다.

- `http://localhost:3000/canvas?page=project&mode=template`
- 템플릿 편집 가능 owner 페이지

## 주의

이 복구 문서는 `git reset`이나 `git checkout`을 사용하지 않고 지정 파일만 백업 시점으로 복원하기 위한 것이다. 다른 사용자의 변경이 같은 파일에 들어간 뒤에는 즉시 덮어쓰기 전에 현재 diff를 확인해야 한다.
