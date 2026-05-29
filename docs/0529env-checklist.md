# 0529 Canvas Owner 환경설정 모드 진단 구현 체크리스트

작업 ID: `0529env-checklist`  
설계 문서: `docs/0529env.md`  
완료 기준: 체크리스트, 백업, whitelist, 검증 결과가 서로 일치해야 완료로 본다.

## 화이트리스트

아래 파일 외 수정 금지.

| 경로 | 허용 목적 |
| --- | --- |
| `docs/0529env.md` | 설계 문서 갱신이 필요할 때만 |
| `docs/0529env-checklist.md` | 구현 체크리스트 |
| `docs/backups/0529env-checklist.md` | 백업/복구 문서 |
| `docs/backups/0529env-checklist/**` | checkpoint 백업 |
| `src/app/canvas/ownerSettings.ts` | settings와 진단 resolver 분리 |
| `src/app/canvas/page.tsx` | 환경설정 화면 진단 표시 조정 |
| `src/components/ui/SettingToggleRow.tsx` | 진단 배지 표시 유지 또는 조정 |
| `src/components/template/TemplateEditWorkspace.tsx` | runtime preview 상태와 toolbar 탭 상태 분리 |
| `src/components/template/workspace/panels/TemplateEditCanvasToolbar.tsx` | 탭 active 판정과 편집 설정 disabled 조건 분리 |

## 수정 금지

- `src/components/template/workspace/types.ts`
- `src/components/template/workspace/canvas/**`
- `src/app/project/**`
- `src/app/templates/**`
- `src/app/request-links/**`
- `src/app/member-access/**`
- `src/app/api/**`
- `src/services/**`
- `src/lib/**`
- `package.json`
- lock 파일
- `tsconfig.json`
- lint/build 설정 파일

화이트리스트 밖 수정이 필요하면 구현을 중단하고 `docs/0529env.md`와 이 체크리스트부터 갱신한다.

## 백업 체크

- [x] `00-before-start`: whitelist 구현 대상 파일 전체를 `docs/backups/0529env-checklist/00-before-start/`에 백업한다.
- [x] `00-before-start/MANIFEST.md`에 원본 경로와 백업 경로를 기록한다.
- [x] `00-before-start/SHA256SUMS.txt`에 백업 파일 해시를 기록한다.
- [x] `docs/backups/0529env-checklist.md`에 복구 명령을 기록한다.
- [x] 백업 이후 구현 완료 전까지 백업 파일을 수정하지 않는다.
- [x] `11-runtime-toolbar-before`: runtime toolbar 수정 전 확장 whitelist 파일 전체를 `docs/backups/0529env-checklist/11-runtime-toolbar-before/`에 백업한다.

## 구현 체크

- [x] `01-diagnostic-model`: `supported/enabled/effectiveVisible` 차단 모델을 `visible/modeDiagnostic/actionAvailability` 진단 모델로 전환한다.
- [x] `02-visibility-decoupling`: `buildCanvasToolbarVisibility()`가 진단 결과 없이 settings만 따르도록 변경한다.
- [x] `03-persistence-decoupling`: `buildPersistenceVisibility()`가 진단 결과 없이 settings만 따르도록 변경한다.
- [x] `04-settings-ui-notice`: 환경설정 화면에서 `지원/미지원` 대신 `모드 진단/실행 조건` 알림만 표시한다.
- [x] `05-prop-diagnostic-section`: `전달 prop 전체`의 UI 기능 섹션에서 `supported/effectiveVisible/enabled` 대신 진단 상태를 출력한다.
- [x] `06-selection-tabs-guard`: `showSelectionPanelTabs=ON`이면 모드 진단 warning이어도 visibility가 true로 유지된다.
- [x] `07-preview-toggle-guard`: `showPreviewToggle=ON`이면 모드 진단 warning이어도 visibility가 true로 유지된다.
- [x] `08-interaction-tools-guard`: `showInteractionToolControls=ON`이면 모드 진단 warning이어도 visibility가 true로 유지된다.
- [x] `09-edit-settings-guard`: `showEditSettingsToggle=ON`이면 모드 진단 warning이어도 visibility가 true로 유지된다.
- [x] `10-whitelist-check`: `git diff --name-only` 결과가 whitelist 안에만 있는지 확인한다.
- [x] `11-runtime-toolbar-state`: 문서 저장 runtime preview와 toolbar preview 탭 active 상태를 분리한다.
- [x] `12-edit-settings-runtime-condition`: 편집 설정 버튼 disabled 조건을 실제 HTML 존재 여부 중심으로 축소한다.
- [x] `13-selection-tab-delay-guard`: `showSelectionPanelTabs` 탭 클릭 후 preview active 판정이 비미리보기 탭을 다시 덮지 않게 한다.

## 검증 체크

- [x] `git diff --check`
- [x] `/canvas/page.tsx` 번들 검사
- [x] `TemplateEditWorkspace.tsx` 번들 검사
- [x] `ownerSettings.ts`와 `SettingToggleRow.tsx` 대상 타입 검사
- [x] `npm run check:no-shadow-app`
- [x] 코드 레벨 검증: project 문서 모드에서도 `previewToggle`, `interactionTools`, `editSettingsToggle`, `selectionPanelTabs`의 visibility가 설정값 true를 유지한다.
- [x] 코드 레벨 검증: project 문서 모드에서 위 항목들은 mode diagnostic warning을 가진다.
- [ ] 브라우저에서 `/canvas?page=project&mode=template` 확인
- [ ] 브라우저에서 템플릿 편집 가능 페이지 확인
- [x] 코드 레벨 검증: document draft props에서 toolbar preview active가 false이면 `editSettingsPanelAvailable=true`가 될 수 있다.
- [x] 코드 레벨 검증: document draft props에서 non-preview tab active 판정이 `selectionPanelTab`을 따른다.

브라우저 검증 미완료 사유:

- `curl http://localhost:3000/canvas?page=project&mode=template` 결과 로컬 서버가 떠 있지 않음.
- `npm run dev -- --hostname 127.0.0.1 --port 3000` 결과 `listen EPERM: operation not permitted 127.0.0.1:3000`.

## 복구 체크

문제가 발생하면 아래 순서로 처리한다.

- [ ] 문제가 발생한 체크리스트 항목 ID를 확인한다.
- [ ] 원인 항목이 불명확하면 `00-before-start` checkpoint로 복구한다.
- [ ] `docs/backups/0529env-checklist.md`의 복구 명령을 실행한다.
- [ ] 복구 후 `git diff --check`를 실행한다.
- [ ] 복구한 checkpoint, 파일 목록, 검증 결과를 사용자에게 보고한다.
