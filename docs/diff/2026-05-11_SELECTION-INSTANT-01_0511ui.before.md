# 0511 UI 설계: 텍스트 탭 일괄 서식 및 편집 캔버스 1열화

작성일: 2026-05-11  
대상 화면: `http://localhost:3001/templates/edit`  
대상 라우트: `src/app/templates/edit/page.tsx` -> `src/components/template/TemplateEditWorkspace.tsx`

## 1. 요청 이해 확정안

후속 구현자는 코드를 수정하기 전에 아래 이해 내용이 사용자 의도와 일치하는지 사용자에게 명시적으로 확인받는다. 확인 전에는 코드 수정, 리팩터링, 파일 삭제, 자동 포맷팅을 시작하지 않는다.

- `텍스트` 탭에서도 여러 상자를 일괄 선택한 뒤 글꼴, 글자 크기, 줄 높이, 여백, 글자 색, 굵게, 이탤릭, 밑줄, 삭선, 정렬을 한 번에 반영할 수 있게 한다.
- 현재 `텍스트` 탭 진입 또는 선택 상태 변경 시 선택이 해제되는 동작은 일괄 서식 반영을 막으므로 제거하거나 조건을 바꾼다.
- 상자 안 텍스트 직접 편집은 유지한다. 단일 상자를 클릭해 입력값을 수정하는 흐름과 다중 선택 후 서식을 적용하는 흐름이 충돌하지 않아야 한다.
- `/html/body/main/main/div/div/div[4]/div[2]`에 해당하는 오른쪽 `선택 상태` 패널 영역은 화면에서 제거한다.
- `/html/body/main/main/div/div/div[4]`의 `xl:grid-cols-[1.55fr_0.95fr]` 2열 구분은 제거한다.
- 기존 `/html/body/main/main/div/div/div[4]/div[1]`에 해당하는 `상자 편집 캔버스` 카드가 `/html/body/main/main/div/div/div[4]` 영역의 단일 1행 1열 콘텐츠로 출력되게 한다.
- 오른쪽 패널 제거로 `크기 및 위치 / 속성 / 텍스트` 탭 진입점이 사라지면 안 된다. 탭 컨트롤은 `상자 편집 캔버스` 카드 내부로 이전한다.
- `src/components` 폴더는 원칙적으로 수정하지 않지만, 현재 대상 UI의 실제 구현 위치가 `src/components/template/TemplateEditWorkspace.tsx`이므로 이 파일만 예외 수정 대상으로 둔다.
- DB 스키마 변경은 없다. Supabase는 변경 검증이 아니라 "DB 변경 없음" 확인 및 기존 저장 API 영향 없음 확인 범위로만 다룬다.

확정 문구 예시:

```text
위 이해 내용과 화이트리스트 범위대로 구현해도 됩니다.
```

## 2. 현재 코드 구조 확인

- `src/app/templates/edit/page.tsx`는 `TemplateEditWorkspace`를 렌더링하는 얇은 라우트 컴포넌트다. 페이지 레이아웃 변경의 실제 대상은 아니다.
- `src/components/template/TemplateEditWorkspace.tsx`에 선택 상태, 텍스트 탭, 캔버스 렌더링, 서식 반영 로직이 집중되어 있다.
- 현재 2열 레이아웃은 `TemplateEditWorkspace.tsx`의 `grid gap-6 xl:grid-cols-[1.55fr_0.95fr] min-w-0` 컨테이너다.
- 해당 컨테이너의 첫 번째 자식은 `상자 편집 캔버스` 카드다.
- 해당 컨테이너의 두 번째 자식은 `선택 상태` 카드와 `UnderlineTabs` 및 선택 요약/목록을 포함하는 오른쪽 패널이다.
- `renderTextCanvasActionControls()`는 이미 선택된 상자 수를 기준으로 텍스트 서식 컨트롤을 비활성/활성 처리한다.
- `applyStyleFieldOnBlur()`와 `applyStyleFieldImmediateValue()`는 `selectedFrameGroupIdsRef.current`를 기준으로 선택 대상 전체에 스타일 패치를 적용하는 구조다.
- 현재 `selectionPanelTab === 'text' && selectedFrameGroupIdsRef.current.length > 0` 조건에서 `clearFrameSelection()`을 호출하는 effect가 있어 텍스트 탭 다중 선택 상태가 유지되지 않는다.
- 텍스트 탭 클릭 처리에서는 일반 클릭 시 입력 필드 포커스를 우선하고, Shift 조합이나 마퀴 선택은 기존 선택 로직으로 내려갈 여지가 있다. 구현은 이 구조를 유지하면서 선택 해제 effect를 제거하고 충돌 조건만 정리한다.

## 3. 수정 허용 화이트리스트

아래 파일만 수정할 수 있다. 목록 외 파일 수정이 필요하면 즉시 중단하고 사용자 승인을 받은 뒤에만 추가한다. 폴더 단위 승인은 금지한다.

| 파일 | 상태 | 허용 목적 | 금지 사항 |
| --- | --- | --- | --- |
| `src/components/template/TemplateEditWorkspace.tsx` | 기존 파일 | 텍스트 탭 다중 선택 유지, 일괄 서식 적용 UX 정리, 오른쪽 선택 상태 패널 제거, 탭 컨트롤의 캔버스 카드 내부 이전, 1열 레이아웃 변경 | 템플릿 추출 로직, API 호출 계약, 저장 포맷, unrelated 리팩터링 |
| `src/lib/templateTextBulkFormattingDtos.ts` | 신규 허용 | 텍스트 일괄 서식 기능을 독립 서비스 계약으로 분리하기 위한 DTO 정의가 필요할 경우에만 추가 | 기존 DTO 파일 무관 변경, DB DTO 혼합 |
| `src/services/templateTextBulkFormattingService.ts` | 신규 허용 | 텍스트 일괄 서식 patch 정규화/검증을 React 비의존 순수 서비스로 분리할 경우에만 추가 | DOM 직접 조작, React state 직접 참조, 다른 서비스 내부 구현 의존 |
| `docs/0511ui.md` | 기존/신규 문서 | 구현 진행 상태, 체크리스트, 테스트 결과 기록 | 설계 범위를 벗어난 요구 추가 |
| `docs/diff/2026-05-11_UI-TEXT-BULK-01_TemplateEditWorkspace.before.tsx` | 신규 백업 | `TemplateEditWorkspace.tsx` 수정 직전 전체 파일 또는 수정 구간 백업 | 백업 외 설명 없는 임의 내용 |
| `docs/diff/2026-05-11_UI-TEXT-BULK-01_templateTextBulkFormattingDtos.before.ts` | 신규 백업 | 신규 DTO 파일을 만들 경우 "파일 없음" 상태와 생성 목적 기록 | 실제 코드 대체 문서로 사용 금지 |
| `docs/diff/2026-05-11_UI-TEXT-BULK-01_templateTextBulkFormattingService.before.ts` | 신규 백업 | 신규 서비스 파일을 만들 경우 "파일 없음" 상태와 생성 목적 기록 | 실제 코드 대체 문서로 사용 금지 |
| `docs/diff/2026-05-11_UI-TEXT-BULK-01_0511ui.before.md` | 신규 백업 | 구현 기록을 위해 이 문서를 수정하기 직전 상태 백업 | 체크리스트와 무관한 문서 변경 |

읽기 전용 참고 파일:

- `src/app/templates/edit/page.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Card.tsx`
- `src/components/design-system/tabs.tsx`
- `src/app/templates/page.tsx`
- `src/app/templates/extract/page.tsx`

## 4. 실행 정책

### 4.1 수정 전 이해확정 절차

- 구현자는 "요청 이해 확정안"을 사용자에게 먼저 제시한다.
- 사용자가 명시적으로 확정하기 전에는 코드 수정, 파일 삭제, 리네임, 포맷팅, 테스트용 임시 코드 추가를 하지 않는다.
- 확정 후에도 확정 범위를 벗어난 문제가 발견되면 즉시 중단하고 사용자에게 변경 범위 추가 승인을 받는다.

### 4.2 변경 기록 및 롤백 보장

- 코드 수정 전 반드시 `docs/diff`에 수정 직전 상태를 기록한다.
- 기존 파일은 전체 파일 백업을 원칙으로 한다. 파일이 커서 구간 백업을 선택할 경우 수정 구간 전후 맥락을 포함하고 롤백 가능한 형태로 남긴다.
- 신규 파일은 `파일 없음 -> 신규 생성` 상태를 diff 문서에 명시한다.
- 각 diff 문서에는 이 설계의 체크리스트 ID를 반드시 적는다.
- 백업 누락이 발견되면 구현을 중단하고 누락된 백업을 먼저 복구한다.

### 4.3 확정 범위 외 수정 금지

- 라우트, API, DB, 템플릿 저장 스키마, 추출 서비스는 변경하지 않는다.
- `src/components` 하위의 다른 공용 컴포넌트는 수정하지 않는다.
- UI 문구 추가는 최소화한다. 기능 설명성 문구를 새로 늘리지 않고, 기존 서비스와 같은 밀도와 톤의 컨트롤로 표현한다.
- 포맷터 실행으로 무관한 대량 변경이 생기면 해당 변경은 포함하지 않는다.

### 4.4 체크리스트와 diff 연결

- 모든 작업 단위는 `UI-TEXT-BULK-*` 체크리스트 ID를 사용한다.
- diff 문서 파일명 또는 본문에 체크리스트 ID를 포함한다.
- 구현 완료 후 이 문서 하단의 구현 상태와 테스트 기록을 갱신한다.

### 4.5 MCP 테스트 의무

- 구현 실행마다 `chrome-devtools` MCP로 `http://localhost:3001/templates/edit` 화면을 직접 확인한다.
- 구현 실행마다 `supabase` MCP로 DB 변경이 없음을 확인하거나, 저장 API가 기존 테이블 계약을 깨지 않는지 확인한다.
- DB 수정이 필요한 상황이 발견되면 직접 DB를 수정하지 않는다. 필요한 SQL을 문서로 제공하고 사용자가 직접 실행하게 한다.
- MCP 도구가 세션에 노출되지 않거나 연결 실패하면 실패 사유, 시각, 대체 확인 방법을 이 문서의 테스트 기록에 남긴다.

## 5. 서비스 독립성 설계

### 5.1 기능 A: 텍스트 일괄 서식 서비스

#### 기능 목적

`/templates/edit`의 `텍스트` 탭에서 복수의 템플릿 상자를 선택하고 동일한 텍스트 서식을 일괄 적용한다.

#### 단독 서비스로서의 가치

- 템플릿 편집 UI 밖에서도 "선택된 텍스트 프레임들에 서식 패치를 적용한다"는 기능을 API 상품처럼 재사용할 수 있다.
- 향후 대량 템플릿 편집, 단축키 기반 편집, 외부 자동화 API, 협업 편집 이벤트로 분리 가능하다.
- React 컴포넌트 상태가 아니라 `selectionIds`, `stylePatch`, `targetMode`, `result` 계약을 중심으로 동작한다.

#### 책임 범위

- 선택 대상 ID 목록 정규화.
- 빈 선택, 중복 ID, 비어 있는 style patch 검증.
- 텍스트 서식 patch DTO 정의.
- 혼합 값 표시와 실제 반영 값을 분리하는 정책 정의.
- 적용 결과로 성공/스킵/실패 대상 수와 메시지 키 반환.

#### 비책임 범위

- DOM 노드 탐색 방식.
- React state 업데이트.
- 캔버스 포인터 이벤트 처리.
- 템플릿 저장 API 호출.
- DB 스키마 변경.
- 텍스트 OCR, 템플릿 추출, PDF 렌더링.

#### API 계약

초기 구현은 React 내부에서 호출하더라도 아래 계약을 유지한다.

```ts
export type TemplateTextBulkFormattingField =
  | 'fontFamily'
  | 'fontSize'
  | 'lineHeight'
  | 'paddingX'
  | 'paddingY'
  | 'color'
  | 'fontWeight'
  | 'fontStyle'
  | 'textDecorationLine'
  | 'textAlign';

export type TemplateTextBulkFormattingPatch = Partial<
  Record<TemplateTextBulkFormattingField, string>
>;

export type TemplateTextBulkFormattingRequestDto = {
  templateId?: string;
  selectionIds: string[];
  patch: TemplateTextBulkFormattingPatch;
  source: 'text-tab-toolbar' | 'keyboard-command' | 'external-api';
};

export type TemplateTextBulkFormattingResultDto = {
  ok: boolean;
  normalizedSelectionIds: string[];
  appliedFieldNames: TemplateTextBulkFormattingField[];
  skippedSelectionIds: string[];
  message: string;
};
```

#### 데이터 소유권

- 이 기능은 DB 데이터를 소유하지 않는다.
- 편집 중 DOM과 draft HTML은 `TemplateEditWorkspace`가 소유한다.
- 서비스는 `selectionIds`와 `patch`의 계약만 소유한다.
- 저장 시점의 템플릿 레코드 소유권은 기존 `templateService`와 관련 API에 있다.

#### 의존 서비스

- 필수: 없음.
- UI 어댑터: `TemplateEditWorkspace`의 기존 `applySelectionStylePatch`, `syncDraftPreviewHtmlRef`, `requestPreviewTextFit`.
- 선택 상태: `selectedFrameGroupIdsRef`를 직접 서비스에 노출하지 않고 DTO로 변환해 전달한다.

#### 분리 배포 시 최소 조건

- DTO 파일이 React와 DOM 타입을 import하지 않아야 한다.
- 서비스 파일은 브라우저 DOM을 직접 조작하지 않고 순수 입력/출력만 처리해야 한다.
- UI는 서비스 결과를 받아 DOM 적용 어댑터를 실행해야 한다.
- 외부 API로 배포할 경우 `templateId`, `selectionIds`, `patch`, `actorId`, `idempotencyKey`를 추가 계약으로 승격한다.

### 5.2 기능 B: 편집 캔버스 1열 레이아웃 서비스

#### 기능 목적

`/templates/edit`의 편집 본문을 오른쪽 상태 패널 없는 단일 캔버스 중심 레이아웃으로 출력한다.

#### 단독 서비스로서의 가치

- 편집 화면 배치 정책을 독립된 "workspace layout contract"로 유지하면 향후 임베디드 편집기, 팝업 편집기, 모바일 편집기에서 같은 레이아웃 결정을 재사용할 수 있다.
- XPath 기반 DOM 위치가 아니라 `canvas`, `modeTabs`, `selectionStatus` 같은 슬롯 계약으로 분리 가능하다.

#### 책임 범위

- 캔버스 카드가 단일 열의 주 콘텐츠가 되도록 배치한다.
- 오른쪽 `선택 상태` 패널을 렌더링하지 않는다.
- 탭 컨트롤은 캔버스 카드 내부에 배치해 `크기 및 위치 / 속성 / 텍스트` 전환 기능을 유지한다.
- 텍스트 탭의 서식 컨트롤은 캔버스 카드 내부 기존 위치를 유지하거나 탭 바로 아래에 노출한다.

#### 비책임 범위

- 템플릿 데이터 조회/저장.
- 선택 로직의 도메인 규칙 변경.
- 템플릿 추출/렌더링 품질 개선.
- 공용 `Card`, `Button`, `UnderlineTabs` 컴포넌트 수정.

#### API 계약

초기 구현은 컴포넌트 구조로 표현하되 아래 슬롯 계약을 따른다.

```ts
export type TemplateEditWorkspaceLayoutMode = 'single-canvas';

export type TemplateEditWorkspaceLayoutSlots = {
  modeTabs: React.ReactNode;
  canvasToolbar: React.ReactNode;
  canvasSurface: React.ReactNode;
};
```

#### 데이터 소유권

- 레이아웃 기능은 데이터를 소유하지 않는다.
- `selectionPanelTab` 상태는 기존 `TemplateEditWorkspace`가 소유한다.
- 오른쪽 패널에 있던 상태 출력 데이터는 제거된 UI에만 쓰던 표시 데이터이며, 저장 데이터 소유권과 무관하다.

#### 의존 서비스

- `UnderlineTabs` 공용 컴포넌트: 수정하지 않고 사용한다.
- `Card` UI 컴포넌트: 수정하지 않고 사용한다.
- `TemplateEditPreviewSurface`: 그대로 캔버스 본문으로 유지한다.

#### 분리 배포 시 최소 조건

- `TemplateEditWorkspace`에서 레이아웃 슬롯을 별도 pure renderer로 분리할 수 있어야 한다.
- 상태 패널 제거가 저장 API, 선택 API, 캔버스 이벤트 API에 영향을 주지 않아야 한다.
- `selectionPanelTab` 전환 이벤트가 외부 컨테이너에서도 주입 가능해야 한다.

## 6. 구현 설계

### 6.1 텍스트 탭 다중 선택 유지

- `selectionPanelTab === 'text'`일 때 선택을 강제로 지우는 effect를 제거하거나, 입력 편집 완료 후 명시적 해제 상황에만 동작하도록 바꾼다.
- 텍스트 입력 필드를 직접 클릭하면 기존처럼 `focusFrameTextInputForEditingByFrameGroupId()`를 호출한다.
- Shift 클릭 또는 마퀴 드래그는 기존 `startMarqueeSelectionInteraction()`과 `applyFrameBoxSelection()` 흐름을 타게 한다.
- 다중 선택 상태에서 텍스트 입력 필드가 아닌 프레임 외곽을 클릭하면 선택이 유지되거나 갱신되어야 하며, 입력 포커스가 선택 상태를 즉시 해제하지 않아야 한다.
- 선택 시각화는 기존 `applyRuntimeSelectionUi()`와 `applyFrameSelectionUi()`를 재사용한다.

### 6.2 텍스트 서식 일괄 반영

- `renderTextCanvasActionControls()`의 `hasSelection` 기준은 유지한다.
- 각 컨트롤은 기존 `applyStyleFieldImmediateValue()` 또는 `applyStyleFieldOnBlur()`로 들어가게 유지하되, 내부에서 `TemplateTextBulkFormattingRequestDto`로 선택 ID와 patch를 정규화할 수 있게 한다.
- `applySelectionStylePatch()`는 현재처럼 선택 대상 전체에 `applyFrameStylePatch()`를 적용한다.
- 빈 문자열 patch는 사용자의 명시적 입력이 아닌 혼합 상태 표시값일 수 있으므로, 의도 없이 전체 선택 대상의 스타일을 비우지 않도록 필드별 검증을 둔다.
- 숫자 필드(`fontSize`, `lineHeight`, `paddingX`, `paddingY`)는 유효한 숫자 또는 빈 값의 정책을 명확히 한다. 빈 값 blur는 "적용 안 함"으로 처리하는 것이 기본값이다.
- 적용 후 `syncDraftPreviewHtmlRef()`, `schedulePreviewEditorState()`, `syncSelectionStyleDraft()`, `requestPreviewTextFit()` 흐름을 유지한다.
- 다중 선택 적용 완료 메시지는 기존 `선택한 N개 상자` 톤을 따른다.

### 6.3 탭 컨트롤 이전

- 오른쪽 `선택 상태` 패널 내부의 `UnderlineTabs`를 `상자 편집 캔버스` 카드 내부로 이전한다.
- 위치는 `CardHeader` 아래 또는 `CardContent` 상단으로 둔다.
- 탭 UI는 기존 `UnderlineTabs<SelectionPanelTab>` 컴포넌트를 그대로 사용한다.
- 새 공용 탭 컴포넌트나 새 버튼 스타일은 만들지 않는다.
- 탭 전환으로 기존 `selectionPanelTab` 상태만 갱신한다.

### 6.4 오른쪽 패널 제거 및 1열화

- 기존 2열 wrapper의 class에서 `xl:grid-cols-[1.55fr_0.95fr]`를 제거한다.
- 오른쪽 `<div className="space-y-6 min-w-0">` 전체를 렌더링하지 않는다.
- 첫 번째 자식 `Card className="border-slate-200 min-w-0 overflow-hidden"`이 단일 콘텐츠가 되도록 wrapper를 `div className="min-w-0"` 또는 같은 수준의 단일 컬럼 컨테이너로 정리한다.
- 사용자 XPath 기준으로는 기존 `/html/body/main/main/div/div/div[4]/div[2]`가 사라지고, 기존 `/html/body/main/main/div/div/div[4]/div[1]` 캔버스가 `/html/body/main/main/div/div/div[4]`의 유일한 주요 출력물이 되어야 한다.
- XPath 자체를 코드에 의존값으로 넣지 않는다. 구현은 React 구조와 의미 있는 컴포넌트 경계로 한다.

### 6.5 제거되는 오른쪽 패널 기능의 처리

- `선택 상태` 진행률 카드, 선택 요약, 그룹 목록은 화면에서 제거한다.
- 텍스트 탭의 선택 개수 표시는 `renderTextCanvasActionControls()`의 기존 badge를 유지한다.
- 위치/속성 탭에서 선택 상태 요약이 꼭 필요해지는 경우에는 이번 범위에 포함하지 않고 사용자 승인을 받아 별도 설계한다.
- 제거 후 미사용 함수/상태가 lint 오류를 만들면 같은 파일 안에서만 정리한다. 이때 동작 변경 없는 정리에 한정한다.

## 7. UI 기준

- 현재 서비스의 카드, 버튼, 입력, 탭 밀도를 따른다.
- 새 랜딩/설명 영역을 만들지 않는다.
- 아이콘이 이미 쓰이는 컨트롤은 `lucide-react` 기존 아이콘을 유지한다.
- 버튼 텍스트가 길어져 레이아웃을 밀지 않도록 기존 크기와 반응형 grid를 유지한다.
- `텍스트` 탭 컨트롤은 캔버스 위에서 작업 도구처럼 보이게 하며, 오른쪽 패널처럼 별도 카드화하지 않는다.
- 중첩 카드 구조를 만들지 않는다. 기존 `Card` 안의 컨트롤 영역은 `CardContent`와 border panel 정도로 유지한다.
- 새 설명 문구를 추가하지 않는다. 필요한 상태 표시는 선택 개수, 저장 중 아이콘, 비활성 상태만 사용한다.

## 8. 체크리스트

| ID | 작업 | diff 기록 | 구현 상태 |
| --- | --- | --- | --- |
| `UI-TEXT-BULK-01` | 사용자에게 요청 이해와 화이트리스트 확정을 받는다. | 해당 없음 | 완료: 사용자의 "구현 시작하세요" 지시를 확정으로 처리 |
| `UI-TEXT-BULK-02` | 수정 직전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_UI-TEXT-BULK-01_*.before.*` | 완료 |
| `UI-TEXT-BULK-03` | 텍스트 탭 진입/유지 시 선택이 강제 해제되는 effect를 제거 또는 조건 변경한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `UI-TEXT-BULK-04` | 텍스트 탭에서 마퀴/Shift 선택 후 서식 컨트롤이 선택 전체에 적용되게 한다. | `TemplateEditWorkspace.before.tsx` | 완료: 기존 선택/서식 patch 흐름 유지, 일반 클릭은 텍스트 직접 편집으로 유지 |
| `UI-TEXT-BULK-05` | 텍스트 일괄 서식 DTO/서비스 경계가 필요한 경우 신규 파일로 분리한다. | DTO/Service before 문서 | 해당 없음: 기존 `SelectionStyleDraft`/`FrameStylePatch` 계약으로 범위 충족 |
| `UI-TEXT-BULK-06` | `UnderlineTabs`를 캔버스 카드 내부로 이전한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `UI-TEXT-BULK-07` | 오른쪽 `선택 상태` 패널을 제거한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `UI-TEXT-BULK-08` | `xl:grid-cols-[1.55fr_0.95fr]` 2열 레이아웃을 제거하고 1열로 정리한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `UI-TEXT-BULK-09` | lint/build 또는 최소 TypeScript 검증을 수행한다. | 테스트 기록 | 부분 완료: esbuild/check-no-shadow/diff-check 통과, 기존 설정 문제로 lint/tsc 전체 검증 실패 |
| `UI-TEXT-BULK-10` | `chrome-devtools` MCP로 `/templates/edit` 동작을 확인한다. | 테스트 기록 | 차단됨: MCP safety guard가 로컬 URL navigation을 취소 |
| `UI-TEXT-BULK-11` | `supabase` MCP로 DB 변경 없음과 저장 계약 영향 없음을 확인한다. | 테스트 기록 | 차단됨: supabase MCP 도구가 현재 세션에 노출되지 않음 |
| `UI-TEXT-BULK-12` | 이 문서에 구현 결과, 테스트 결과, 남은 위험을 기록한다. | `0511ui.before.md` | 완료 |
| `SUMMARY-ICON-01` | 요약 오버레이 아이콘 기본 상태 변경 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SUMMARY-ICON-01_*.before.*` | 완료 |
| `SUMMARY-ICON-02` | 요약 플로팅 오버레이의 기본 상태를 50px 너비, 32px 높이의 접힌 아이콘으로 변경한다. 후속 `SUMMARY-FIT-02`에서 50px 고정 폭은 제거됐다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SUMMARY-ICON-03` | 요약 위치 이동 아이콘을 lucide `Move`에서 lucide 핸들 표시로 변경한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SUMMARY-ICON-04` | 접힌 아이콘과 펼친 요약 패널 모두 기존 네 귀퉁이 드래그 스냅 계약을 유지한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SUMMARY-ICON-05` | 정적 검증과 문서 테스트 기록을 갱신한다. | 테스트 기록 | 완료 |
| `SUMMARY-EXPAND-01` | 요약 버튼 표시 변경 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SUMMARY-EXPAND-01_*.before.*` | 완료 |
| `SUMMARY-EXPAND-02` | 접힌 요약 버튼에서 파일 아이콘 대신 `요약` 텍스트를 출력한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SUMMARY-EXPAND-03` | 요약 핸들을 90도 회전 출력하고, 접힌 버튼에 확장 가능 표시를 추가한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SUMMARY-FIT-01` | 요약 버튼 내용 폭 변경 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SUMMARY-FIT-01_*.before.*` | 완료 |
| `SUMMARY-FIT-02` | 접힌 요약 오버레이의 50px 고정 폭을 제거하고 내용 기준 폭으로 렌더링한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SUMMARY-FIT-03` | 정적 검증과 문서 테스트 기록을 갱신한다. | 테스트 기록 | 완료 |
| `SUMMARY-HANDLE-01` | 요약 핸들 위치 고정 변경 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SUMMARY-HANDLE-01_*.before.*` | 완료 |
| `SUMMARY-HANDLE-02` | 축소/확장 상태에서 요약 핸들을 동일한 좌측 위치에 출력한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SUMMARY-HANDLE-03` | 정적 검증과 문서 테스트 기록을 갱신한다. | 테스트 기록 | 완료 |
| `SELECTION-CYCLE-01` | 위치 탭 선택 순환/선택 표시 수정 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SELECTION-CYCLE-01_*.before.*` | 완료 |
| `SELECTION-CYCLE-02` | 상자를 명시적으로 클릭한 경우 순환 후보를 해당 상자의 그룹 계층과 상자 자체로 제한한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-CYCLE-03` | 위치 탭 순수 선택에서 delayed React state commit을 제거해 선택 요약/도구 상태를 즉시 반영한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-CYCLE-04` | 위치 탭 순수 선택 후 full editor rehydrate 예약과 pointer-up full repaint를 줄여 preview refresh 효과를 완화한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-CYCLE-05` | 정적 검증과 문서 테스트 기록을 갱신한다. | 테스트 기록 | 완료 |
| `SELECTION-CYCLE-06` | 추가 순환/지연 수정 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SELECTION-CYCLE-02_*.before.*` | 완료 |
| `SELECTION-CYCLE-07` | 위치 탭의 현재 선택 단계를 DOM 선택 속성 추론이 아니라 명시적 group/frame 엔티티 ref로 추적한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-CYCLE-08` | 클릭 직후 no-drag marquee와 full selection reapply 경로가 그룹 proxy를 잃지 않도록 복구한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-CYCLE-09` | 정적 검증, chrome-devtools 관찰 결과, MCP 제한 사항을 테스트 기록에 남긴다. | 테스트 기록 | 완료 |
| `SELECTION-CYCLE-10` | 대량 상자 선택 재수정 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SELECTION-CYCLE-03_*.before.*` | 완료 |
| `SELECTION-CYCLE-11` | 클릭 순환 후보에서 실제 그룹이 아닌 단일/영향 확장 후보를 제거한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-CYCLE-12` | 위치 탭의 박스 클릭 후 no-drag marquee가 선택을 덮어쓰지 못하도록 한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-CYCLE-13` | 브라우저 화면 클릭 방식 검증과 정적 검증 결과를 기록한다. | 테스트 기록 | 완료 |
| `SELECTION-FLICKER-01` | 상자 선택 깜빡임 수정 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SELECTION-FLICKER-01_*.before.*` | 완료 |
| `SELECTION-FLICKER-02` | 이미 일치하는 위치 탭 단일 상자 선택 chrome은 full editor UI 재생성 중 제거하지 않는다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-FLICKER-03` | 첫 선택 직후 HTML 정규화로 편집 UI가 교체되는 구간에서 빠른 선택 표시를 paint 전에 복구한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-FLICKER-04` | 브라우저 화면 클릭 방식 검증과 정적 검증 결과를 기록한다. | 테스트 기록 | 완료 |
| `SELECTION-DRAG-01` | 선택/드래그 재수정 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SELECTION-DRAG-01_*.before.*` | 완료 |
| `SELECTION-DRAG-02` | 클릭-only pointer 흐름과 실제 move drag를 4px 임계값으로 분리한다. | `docs/diff/2026-05-11_SELECTION-DRAG-02_*.before.*` | 완료 |
| `SELECTION-DRAG-03` | `dangerouslySetInnerHTML` markup 객체를 HTML 문자열 기준으로 memoize해 선택 state 변경만으로 preview innerHTML을 재작성하지 않는다. | `docs/diff/2026-05-11_SELECTION-DRAG-03_*.before.*` | 완료 |
| `SELECTION-DRAG-04` | 안정적인 위치 탭 선택 refresh에서는 idle edge button UI를 보존한다. | `docs/diff/2026-05-11_SELECTION-DRAG-04_*.before.*` | 완료 |
| `SELECTION-DRAG-05` | 브라우저 관찰, 정적 검증, MCP 제한 사항을 테스트 기록에 남긴다. | 테스트 기록 | 완료 |
| `GROUP-HIGHLIGHT-01` | 그룹 연관 강조 배경색 수정 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_GROUP-HIGHLIGHT-01_*.before.*` | 완료 |
| `GROUP-HIGHLIGHT-02` | 위치 탭 그룹 연관 강조가 실제 상자 `background-color`를 변경하지 않도록 outline/box-shadow 표시로 바꾼다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `GROUP-HIGHLIGHT-03` | 정적 검증과 MCP 제한 사항을 테스트 기록에 남긴다. | 테스트 기록 | 완료 |
| `GROUP-FOCUS-01` | 연관 그룹 opacity 표시 변경 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_GROUP-FOCUS-01_*.before.*` | 완료 |
| `GROUP-FOCUS-02` | 위치 탭 연관 그룹 표시에서 outline/box-shadow 강조를 제거하고, 선택/연관 항목 외 전체를 미선택 상태 기준 10% opacity로 낮춘다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `GROUP-FOCUS-03` | 일반/fast 선택 경로가 동일한 root filter 속성을 쓰는지 정적 검증하고 테스트 기록을 갱신한다. | 테스트 기록 | 완료 |
| `POSITION-METADATA-FOCUS-01` | 위치/속성 탭 선택 표시 재수정 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_POSITION-METADATA-FOCUS-01_*.before.*` | 완료 |
| `POSITION-METADATA-FOCUS-02` | 크기 및 위치 탭의 10% opacity 대상을 속성 탭처럼 선택 anchor의 active/inactive 속성 기반으로 변경한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `POSITION-METADATA-FOCUS-03` | 속성 탭의 순수 항목 선택에서 반복 rehydrate와 선택 UI strip/reapply를 줄인다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `POSITION-METADATA-FOCUS-04` | 정적 검증과 MCP 제한 사항을 테스트 기록에 남긴다. | 테스트 기록 | 완료 |
| `GROUP-NOSTYLE-01` | 그룹 무스타일 수정 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_GROUP-NOSTYLE-01_*.before.*` | 완료 |
| `GROUP-NOSTYLE-02` | 위치 그룹 wrapper와 그룹 선택 proxy overlay가 별도 윤곽선/배경/그림자를 출력하지 못하게 한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `GROUP-NOSTYLE-03` | 정적 검증과 MCP 제한 사항을 테스트 기록에 남긴다. | 테스트 기록 | 완료 |
| `SELECTION-STABLE-01` | 위치/속성 선택 반복 repaint 수정 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SELECTION-STABLE-01_*.before.*` | 완료 |
| `SELECTION-STABLE-02` | 그룹 선택 proxy marker를 안정 선택 상태로 인정해 위치 탭 그룹 선택 full repaint 반복을 막는다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-STABLE-03` | 선택 클릭 직후 남아 있는 예약 rehydrate와 다음 layout full reapply를 취소/스킵한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-STABLE-04` | 1차 정적 검증과 chrome-devtools 관찰 결과를 테스트 기록에 남긴다. | 테스트 기록 | 완료 |
| `SELECTION-STABLE-05` | 반복 repaint 추가 수정 전 원본을 `docs/diff`에 백업한다. | `docs/diff/2026-05-11_SELECTION-STABLE-05_*.before.*` | 완료 |
| `SELECTION-STABLE-06` | 선택 attrs와 위치/속성 focus attrs를 값 변경 시에만 쓰도록 바꿔 동일 선택 재쓰기 mutation을 막는다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-STABLE-07` | 안정 refresh에서 edge resize 버튼을 중복 append하지 않고 기존 버튼을 동기화한다. | `TemplateEditWorkspace.before.tsx` | 완료 |
| `SELECTION-STABLE-08` | 최종 정적 검증, chrome-devtools 관찰 결과, MCP 제한 사항을 테스트 기록에 남긴다. | 테스트 기록 | 완료 |

## 9. 테스트 계획

### 9.1 정적 검증

- `npm run lint`
- lint 시간이 과도하거나 기존 오류가 있으면, 실패 로그에서 이번 변경 파일과 관련된 오류만 분리해 기록한다.

### 9.2 브라우저 검증: chrome-devtools MCP

- `http://localhost:3001/templates/edit` 접속.
- 템플릿을 불러온다.
- `텍스트` 탭으로 전환한다.
- 빈 캔버스 영역에서 드래그 마퀴로 여러 상자를 선택한다.
- Shift 클릭으로 선택을 추가/제거한다.
- 글자 크기, 글자 색, 굵게, 정렬 중 최소 3개 서식을 적용한다.
- 선택된 모든 상자에 서식이 반영되는지 확인한다.
- 상자 안 텍스트 직접 클릭 편집이 여전히 가능한지 확인한다.
- 오른쪽 `선택 상태` 패널이 보이지 않는지 확인한다.
- 캔버스 영역이 1열로 전체 폭을 사용하는지 확인한다.

### 9.3 Supabase MCP 검증

- 이번 변경은 DB 스키마를 수정하지 않는다.
- Supabase MCP로 관련 템플릿 테이블 목록 또는 기존 템플릿 저장 API 의존 테이블 접근 가능 여부를 확인한다.
- DB 변경 SQL은 작성하지 않는다.
- DB 수정 필요성이 발견되면 구현을 중단하고 사용자 실행용 SQL만 문서에 추가한다.

### 9.4 회귀 확인

- `크기 및 위치` 탭 전환 가능.
- `속성` 탭 전환 가능.
- 선택 상태가 탭 전환 중 의도 없이 사라지지 않는지 확인.
- 캔버스 이동/선택 모드 버튼, undo/redo, 범례/아이콘 토글이 기존처럼 동작하는지 확인.

## 10. 테스트 기록

문서 작성 단계 기록:

- 2026-05-11: 설계 문서 신규 작성. 코드 구현 없음.
- 2026-05-11: DB 스키마 변경 없음. 사용자 실행 SQL 없음.
- 2026-05-11: 런타임 UI 변경이 아직 없으므로 chrome-devtools MCP 동작 검증은 후속 구현 단계에서 수행한다.
- 2026-05-11: Supabase 데이터 변경이 아직 없으므로 Supabase MCP 검증은 후속 구현 단계에서 수행한다.

구현 단계 기록:

- 2026-05-11: `UI-TEXT-BULK-02` 백업 완료.
  - `docs/diff/2026-05-11_UI-TEXT-BULK-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_UI-TEXT-BULK-01_0511ui.before.md`
- 2026-05-11: `UI-TEXT-BULK-03` 텍스트 탭 진입 시 선택을 강제 해제하던 effect를 제거했다.
- 2026-05-11: `UI-TEXT-BULK-04` 텍스트 탭 일반 클릭은 직접 입력 편집을 우선하고, Shift/드래그 선택은 공통 선택 흐름으로 내려가도록 의도 주석을 추가했다. 기존 `applyStyleFieldImmediateValue`, `applyStyleFieldOnBlur`, `applySelectionStylePatch`의 다중 선택 적용 계약은 유지했다.
- 2026-05-11: `UI-TEXT-BULK-06` `UnderlineTabs`를 오른쪽 패널에서 `상자 편집 캔버스` 카드 내부로 이전했다.
- 2026-05-11: `UI-TEXT-BULK-07`, `UI-TEXT-BULK-08` 오른쪽 `선택 상태` 패널을 제거하고, `xl:grid-cols-[1.55fr_0.95fr]` 2열 wrapper를 단일 `min-w-0` wrapper로 변경했다.
- 2026-05-11: `stylePanelRef`를 제거된 오른쪽 패널 대신 캔버스 `Card`에 연결했다. 기존 스타일 적용 함수가 현재 활성 탭의 컨트롤을 계속 읽을 수 있게 하기 위한 변경이다.
- 2026-05-11: `UI-TEXT-BULK-05` 신규 DTO/서비스 파일은 만들지 않았다. 이번 변경은 기존 프론트 편집 어댑터의 선택 유지와 레이아웃 조정만으로 충족되며, DB/API 계약 변경이 없다.

검증 기록:

- 2026-05-11: `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...` 통과. `/templates/edit` 진입 번들 문법 파싱 확인.
- 2026-05-11: `npm run check:no-shadow-app` 통과. `src/app` shadow 클래스 없음.
- 2026-05-11: `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md` 통과.
- 2026-05-11: `npx tsc --noEmit --pretty false` 실패. 원인은 이번 변경 파일이 아니라 기존 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 백업 파일의 TypeScript parse error다.
- 2026-05-11: `npx eslint src/components/template/TemplateEditWorkspace.tsx` 실패. 원인은 repo에 ESLint 9용 `eslint.config.*` 파일이 없어 ESLint가 실행 구성을 찾지 못한 것이다.
- 2026-05-11: `npm run dev -- --port 3002` 실패. sandbox가 `0.0.0.0:3002` listen을 `EPERM`으로 차단했다.
- 2026-05-11: 기존 `localhost:3001` listener는 `lsof`에서 확인됐지만 `curl` 연결은 실패했다. 기존 프로세스가 실제 HTTP 응답을 제공하지 않는 상태로 보인다.
- 2026-05-11: `chrome-devtools` MCP `new_page`/`navigate_page` 호출은 로컬 URL navigation이 safety guard에 의해 취소됐다. `list_pages`는 기존 chrome-devtools profile이 이미 실행 중이라는 오류를 반환했다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

속성 탭 활성 항목 시각화 추가 변경:

- 2026-05-11: `METADATA-ACTIVE-01` 백업 완료.
  - `docs/diff/2026-05-11_METADATA-ACTIVE-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_METADATA-ACTIVE-01_0511ui.before.md`
- 2026-05-11: 속성 탭에서 선택 항목과 연관 key/value 항목을 `data-template-metadata-focus="active"`로 표시하고, 나머지 항목을 `data-template-metadata-focus="inactive"`로 표시하도록 했다.
- 2026-05-11: 속성 탭에 활성 focus가 있을 때 root에 `data-template-metadata-active-filter="true"`를 부여하고, inactive 항목은 `opacity: .1`로 낮추도록 했다.
- 2026-05-11: active 항목은 기존 파란 선택 outline/badge 대신 선택되지 않은 상태의 역할 색과 관계 UI가 유지되도록 속성 탭 전용 CSS override를 추가했다.
- 2026-05-11: transient focus attribute는 저장 HTML에 남지 않도록 `stripSelectionAttrs()`에서 제거한다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx`를 실행했고 모두 통과했다.

요약 오버레이 추가 변경:

- 2026-05-11: `SUMMARY-OVERLAY-01` 백업 완료.
  - `docs/diff/2026-05-11_SUMMARY-OVERLAY-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SUMMARY-OVERLAY-01_0511ui.before.md`
- 2026-05-11: 오른쪽 패널 제거 전 사용하던 `renderSelectionSummaryBox()`를 preview surface 영역의 플로팅 오버레이로 다시 연결했다.
- 2026-05-11: 오버레이 초기 위치는 preview 영역 좌측 상단이며, 상단 핸들을 드래그하면 pointer 위치가 속한 사분면을 기준으로 좌상/우상/좌하/우하 중 가장 가까운 귀퉁이에 자동 스냅된다.
- 2026-05-11: 요약 오버레이는 `dangerouslySetInnerHTML`로 주입되는 템플릿 HTML 밖의 React sibling으로 렌더링되므로 저장 HTML에 포함되지 않는다.
- 2026-05-11: 기존 preview root의 `template-edit-preview`, pointer capture handler, `setPreviewNode` 연결은 내부 div에 유지하고, 바깥 `CardContent`는 오버레이 기준이 되는 `relative` 컨테이너로만 사용했다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx`를 실행했고 모두 통과했다.

요약 아이콘 기본 상태 추가 변경:

- 2026-05-11: `SUMMARY-ICON-01` 백업 완료.
  - `docs/diff/2026-05-11_SUMMARY-ICON-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SUMMARY-ICON-01_0511ui.before.md`
- 2026-05-11: 요약 플로팅 오버레이는 기본 렌더링 시 border를 포함한 `50px * 32px` 크기의 접힌 아이콘 상태로 표시했다. 이 고정 폭은 후속 `SUMMARY-FIT-02`에서 제거됐다.
- 2026-05-11: 접힌 아이콘을 클릭하면 요약 패널이 펼쳐지고, 펼쳐진 헤더를 클릭하면 다시 접힌 아이콘으로 돌아가도록 했다.
- 2026-05-11: 접힌 아이콘과 펼친 헤더 모두 같은 pointer drag 계약을 사용하며, 4px 이상 이동한 경우 클릭 토글이 아니라 기존 사분면 기준 네 귀퉁이 자동 스냅으로 처리한다.
- 2026-05-11: 요약 위치 이동 affordance는 lucide `Move`가 아니라 lucide `GripHorizontal` 핸들 표시를 사용한다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다. `esbuild` 최초 실행은 zsh glob 해석 때문에 실패했으며, `--external:*` 인자를 따옴표 처리한 동일 명령으로 재실행해 통과했다.
- 2026-05-11: `chrome-devtools` MCP는 `list_pages`와 `new_page` 모두 기존 chrome-devtools profile이 이미 실행 중이라는 오류를 반환해 `/templates/edit` 화면 검증을 수행하지 못했다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

요약 버튼 표시 추가 변경:

- 2026-05-11: `SUMMARY-EXPAND-01` 백업 완료.
  - `docs/diff/2026-05-11_SUMMARY-EXPAND-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SUMMARY-EXPAND-01_0511ui.before.md`
- 2026-05-11: 접힌 상태의 요약 버튼은 파일 모양 아이콘 대신 `요약` 텍스트를 출력한다.
- 2026-05-11: 접힌 상태와 펼친 상태의 위치 이동 핸들은 모두 lucide `GripHorizontal`을 90도 회전해 표시한다.
- 2026-05-11: 접힌 요약 버튼 오른쪽에는 `ChevronDown`을 배치해 확장 가능한 항목임을 암시하고, 펼친 헤더에는 `ChevronUp`을 배치해 다시 접을 수 있음을 표시한다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: `curl -I --max-time 3 http://localhost:3001/templates/edit`는 `Failed to connect to localhost port 3001`로 실패했다. 현재 세션에서는 로컬 3001 서버 응답을 확인하지 못했다.
- 2026-05-11: `chrome-devtools` MCP `list_pages`는 기존 chrome-devtools profile이 이미 실행 중이라는 오류를 반환해 화면 검증을 수행하지 못했다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

선택 순환 및 선택 표시 지연 수정:

- 2026-05-11: `SELECTION-CYCLE-01` 백업 완료.
  - `docs/diff/2026-05-11_SELECTION-CYCLE-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SELECTION-CYCLE-01_0511ui.before.md`
- 2026-05-11: 원인 1은 `resolvePositionSelectionClickChain()`이 상자를 직접 클릭한 경우에도 클릭 좌표에 걸린 모든 point-hit 상자/그룹을 순환 후보에 포함한 것이다. 겹침 영역에서는 클릭한 상자의 계층이 아닌 다른 그룹이나 상자가 후보에 섞일 수 있었다.
- 2026-05-11: 수정 후 명시적 `frameGroupId`가 있는 클릭은 source를 클릭한 상자 1개로 고정하고, 그룹 후보도 그 상자를 포함하는 그룹으로 제한한다. 따라서 `최상위 그룹 -> 하위 그룹 -> 최하위 상자 -> 최상위 그룹` 순환에서 무관한 point-hit 엔티티를 건너뛴다.
- 2026-05-11: 빈 그룹 영역처럼 명시적 상자 source가 없는 클릭은 기존처럼 좌표 기반 그룹/상자 후보를 사용한다.
- 2026-05-11: 원인 2는 위치 탭 선택 처리에서 `applyFastFrameBoxSelectionVisuals()`로 즉시 DOM 표시를 한 뒤, React state commit을 240ms 지연하고 360ms 뒤 full editor rehydrate를 예약한 것이다. 이 경로가 `/templates/edit` preview 내부 영역을 다시 칠하는 효과와 선택 요약/도구 상태 지연을 만들 수 있었다.
- 2026-05-11: 위치 탭의 순수 상자/그룹 선택은 React state를 즉시 commit하도록 변경했다. 선택 중 move/resize/create 같은 실제 편집 인터랙션의 editor state 동기화 경로는 유지한다.
- 2026-05-11: 위치 탭에서 edge selection이 없는 일반 선택 state 변화만으로는 `schedulePreviewEditorState()`를 다시 예약하지 않는다. edge token이 있는 선택은 기존 동기화 경로를 유지한다.
- 2026-05-11: 클릭 선택 직후 시작된 marquee 상태가 drag 없이 pointer-up 되는 경우, 위치 탭에서는 full `applyRuntimeSelectionUi()` 대신 fast selection repaint만 수행하도록 했다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: `chrome-devtools` MCP `list_pages`는 기존 chrome-devtools profile이 이미 실행 중이라는 오류를 반환해 화면 검증을 수행하지 못했다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

선택 순환 및 선택 지연 추가 수정:

- 2026-05-11: `SELECTION-CYCLE-06` 백업 완료.
  - `docs/diff/2026-05-11_SELECTION-CYCLE-02_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SELECTION-CYCLE-02_0511ui.before.md`
- 2026-05-11: chrome-devtools MCP로 `http://localhost:3001/templates/edit?templateId=d3a38b9c-2603-4bc4-88e6-6b15fcfd0c40`를 직접 reload했고, `B90467CA-12` 첫 클릭 후 여전히 7개 멤버 상자가 `data-template-selected="true"`로 표시되고 그룹 proxy overlay가 0개인 것을 확인했다.
- 2026-05-11: 남은 원인 1은 순환 현재 단계를 `selectedFrameGroupIds`와 proxy DOM 상태로 역추론하는 구조였다. no-drag marquee나 layout effect가 proxy를 비우면 다음 클릭이 현재 그룹 단계를 찾지 못하고 첫 그룹 단계로 되돌아갈 수 있었다.
- 2026-05-11: `positionActiveSelectionEntityRef`를 추가해 위치 탭의 일반 선택 단계는 `{ kind: 'group', groupId, frameGroupIds }` 또는 `{ kind: 'frame', frameGroupId }`로 명시 추적한다. 순환 인덱스 계산은 이 ref를 먼저 사용하고, 실패할 때만 기존 선택 ID/proxy 추론으로 fallback한다.
- 2026-05-11: 남은 원인 2는 클릭 선택 직후 시작되는 no-drag marquee와 이후 React layout/full reapply 경로가 그룹 proxy selection을 빈 배열로 재적용해, 그룹 선택을 다시 7개 개별 상자 선택처럼 칠하는 것이다.
- 2026-05-11: marquee 상태에 `baseProxySelections`를 보관하고, 이동/해제 시 현재 선택 ID에 완전히 포함되는 기존 그룹 proxy를 유지하도록 했다.
- 2026-05-11: `restoreActivePositionGroupProxySelections()`를 추가해 fast paint, runtime paint, scheduled editor rehydrate, layout effect, resize/position mode 후처리 등 모든 full selection reapply 경로에서 active group proxy가 비었으면 다시 합성한다.
- 2026-05-11: 정적 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: 최종 패치 후 추가 chrome-devtools 자동 클릭은 safety monitor가 로컬 앱 자동 클릭 위험으로 중단했다. 따라서 최종 패치의 브라우저 클릭 재검증은 완료하지 못했고, 앞선 MCP 관찰 결과와 코드 경로 검증을 기준으로 기록한다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

대량 선택 재수정:

- 2026-05-11: `SELECTION-CYCLE-10` 백업 완료.
  - `docs/diff/2026-05-11_SELECTION-CYCLE-03_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SELECTION-CYCLE-03_0511ui.before.md`
- 2026-05-11: 원인 1은 `resolvePositionSelectionClickChain()`이 `frameGroupIds.length <= 1`인 명시 그룹을 `collectPositionImpactGroupCandidateFrameGroupIds()`로 확장해 실제 그룹이 아닌 영향 후보를 순환 후보에 넣던 것이다. 이 경로가 화면에서 한 박스를 클릭했는데 7개 또는 22개처럼 주변 상자가 함께 선택되는 원인이 될 수 있었다.
- 2026-05-11: 클릭 순환 후보는 실제 그룹 멤버가 2개 이상인 `collectPositionBoxGroups()` 결과만 사용하도록 변경했다. 단일 명시 그룹이나 영향 관계 확장 결과는 더 이상 그룹 선택 후보로 취급하지 않는다.
- 2026-05-11: 원인 2는 위치 탭의 박스 클릭 직후 `startSelectionMarqueeAfterClickSelection()`이 pointer capture를 잡고, pointer-up에서 작은 좌표 차이를 드래그 선택처럼 처리하며 선택을 다시 덮어쓰는 것이다.
- 2026-05-11: 위치 탭에서는 박스 클릭 후 즉시 marquee를 시작하지 않도록 변경했다. 빈 캔버스에서 시작하는 marquee 선택은 기존 경로로 유지한다.
- 2026-05-11: chrome-devtools MCP에서 `div`를 직접 target하지 않고 접근성 스냅샷에 보이는 텍스트 입력 영역을 화면 클릭 방식으로 눌러 검증했다.
  - `B90467CA-12` 클릭 결과: `selectedCount=1`, 선택 ID `band-5-cell-2`, proxy overlay 0.
  - `건축골조공사지연에따른건축/소방설비돌관공사투입` 클릭 결과: `selectedCount=1`, 선택 ID `band-9-cell-2`, proxy overlay 0.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: `supabase` MCP는 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

상자 선택 깜빡임 수정:

- 2026-05-11: `SELECTION-FLICKER-01` 백업 완료.
  - `docs/diff/2026-05-11_SELECTION-FLICKER-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SELECTION-FLICKER-01_0511ui.before.md`
- 2026-05-11: 원인은 위치 탭에서 빠른 선택 UI가 먼저 적용된 뒤 `applyRuntimeSelectionVisuals()`와 `schedulePreviewEditorState()`가 같은 선택을 full editor UI로 재적용하면서 `stripSelectionAttrs()`로 선택 속성을 제거하고 다시 붙이던 것이다. 수정 전 화면 클릭 추적에서 `B90467CA-12` 선택은 최종 1개로 남았지만 selection 속성 mutation 27건 중 live 제거가 반복 관측됐다.
- 2026-05-11: 이미 DOM의 위치 탭 단일 상자 선택 chrome이 요청 선택 상태와 일치하면 `data-template-selected`, `data-template-primary-selected`, `data-template-selection-order`, 선택 fill, 삭제 버튼은 보존한다. edge 버튼과 기타 보조 editor UI만 재생성해 선택 해제처럼 보이는 중간 프레임을 없앴다.
- 2026-05-11: 첫 선택 직후 `renderedPreviewHtml` 정규화가 발생해 편집 UI 없는 HTML로 교체되는 경우가 있어, edge 버튼이 없는 새 preview root에 선택 상태가 이미 존재하면 layout effect에서 `applyFastFrameBoxSelectionVisuals()`를 먼저 실행하도록 보강했다.
- 2026-05-11: chrome-devtools MCP에서 `div`를 직접 target하지 않고 접근성 스냅샷에 보이는 `B90467CA-12` 텍스트 입력 영역을 화면 클릭 방식으로 눌러 검증했다.
  - 새로고침 직후 첫 클릭 결과: `selectedCount=1`, 선택 ID `band-5-cell-2`, `liveRemoveCount=0`, `edgeButtonCount=216`, `fillCount=1`, `deleteCount=1`.
  - 콘솔 오류/경고: 없음.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

선택 해제 후 재선택 및 드래그 재수정:

- 2026-05-11: `SELECTION-DRAG-01`부터 `SELECTION-DRAG-04`까지 단계별 백업 완료.
  - `docs/diff/2026-05-11_SELECTION-DRAG-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SELECTION-DRAG-02_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SELECTION-DRAG-03_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SELECTION-DRAG-04_TemplateEditWorkspace.before.tsx`
  - 각 단계의 `docs/0511ui.md` 백업도 동일한 ID로 기록했다.
- 2026-05-11: chrome-devtools MCP로 접근성 스냅샷의 `B90467CA-12` 텍스트 상자를 직접 클릭해 확인했다. `div` selector를 직접 타겟하지 않았다.
- 2026-05-11: 원인 1은 위치 탭에서 일반 클릭 직후에도 `dragStateRef`가 즉시 생성되고, 실제 이동이 없어도 pointer-up에서 `syncDraftPreviewHtmlRef()`가 실행되어 preview HTML을 저장/재렌더하던 것이다.
- 2026-05-11: `DragState.active`와 `FRAME_MOVE_DRAG_THRESHOLD_PX=4`를 추가했다. pointer 이동이 임계값을 넘기 전에는 geometry 이동, draft HTML 저장, preview re-render, deferred editor state 재스케줄을 수행하지 않는다.
- 2026-05-11: 원인 2는 `dangerouslySetInnerHTML={{ __html: renderedPreviewHtml }}` 객체가 렌더마다 새로 만들어져, HTML 문자열이 같아도 React가 preview root `innerHTML`을 재작성하던 것이다. 브라우저 스택에서 `commitHostUpdate -> setProp -> innerHTML setter`가 선택된 노드와 216개 edge button이 있는 preview root를 재작성하는 것을 확인했다.
- 2026-05-11: `renderedPreviewMarkup`을 `React.useMemo()`로 고정해 `renderedPreviewHtml` 문자열이 바뀌지 않는 선택 state 변경은 preview `innerHTML`을 다시 쓰지 않도록 했다.
- 2026-05-11: 원인 3은 이미 안정적인 위치 탭 선택 상태에서도 `stripEditorUiForStablePositionSelectionRefresh()`가 idle edge button을 보조 editor UI로 보고 제거한 뒤 다시 생성하던 것이다. 안정 선택 refresh에서는 edge button, 선택 fill, 삭제 버튼을 보존하도록 했다.
- 2026-05-11: 브라우저 관찰 결과, 수정 전 반복 클릭에서는 `selected=[]`, `edgeButtons=0` 중간 상태가 약 0.13초 관측됐고, `innerHTML` 재작성 스택이 3회 기록됐다. 최종 패치 후 추가 chrome-devtools 자동 클릭은 safety guard가 중단해 최종 브라우저 재클릭은 완료하지 못했다.
- 2026-05-11: chrome-devtools MCP 콘솔 확인 결과 error/warn 메시지는 없었다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: `npx tsc --noEmit`은 기존 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 백업 파일 parse error로 실패했다. 이번 변경 파일의 esbuild 문법 검증은 통과했다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

그룹 연관 강조 배경색 수정:

- 2026-05-11: `GROUP-HIGHLIGHT-01` 백업 완료.
  - `docs/diff/2026-05-11_GROUP-HIGHLIGHT-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_GROUP-HIGHLIGHT-01_0511ui.before.md`
- 2026-05-11: 원인은 위치 탭 그룹 연관 표시용 `data-template-frame-position-impact-group` CSS가 실제 상자 노드에 `background-color: rgba(251, 191, 36, .28) !important`를 적용한 것이다. 이 값이 편집용 강조가 아니라 실제 출력 배경색으로 읽힐 수 있었다.
- 2026-05-11: 해당 CSS에서 `background-color`를 제거하고 `outline`/`box-shadow` 기반의 편집용 시각화로 변경했다. 그룹 소속 항목은 계속 노란 계열로 식별되지만, 상자의 computed `background-color`는 이 강조 때문에 바뀌지 않는다.
- 2026-05-11: 정적 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했다.
- 2026-05-11: `chrome-devtools` MCP 콘솔 확인 결과 error/warn 메시지는 없었다. 추가 클릭 검증은 현재 세션에서 safety guard가 로컬 앱 자동 클릭을 차단할 수 있어 수행하지 않았다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

연관 그룹 opacity 표시 변경:

- 2026-05-11: `GROUP-FOCUS-01` 백업 완료.
  - `docs/diff/2026-05-11_GROUP-FOCUS-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_GROUP-FOCUS-01_0511ui.before.md`
- 2026-05-11: 이전 `GROUP-HIGHLIGHT-02`의 outline/box-shadow 방식은 후속 요구에 의해 사용하지 않는다. 위치 탭 연관 그룹 표시는 `속성` 탭의 active filter와 같은 구조로 유지한다.
- 2026-05-11: 일반 경로와 fast 경로 모두 preview root에 `data-template-position-impact-active-filter="true"`를 설정하고, 선택된 상자/그룹 및 같은 위치 그룹에 속한 상자에만 `data-template-frame-position-impact-group`을 부여한다.
- 2026-05-11: CSS는 `data-template-position-impact-active-filter="true"` 상태에서 `RAW_FRAME_NODE_SELECTOR` 중 `data-template-frame-position-impact-group`이 없는 항목을 `opacity: .1 !important`로 낮추고, 활성 항목은 `opacity: 1 !important`로 유지한다. 배경색, outline, box-shadow는 연관 그룹 표시 목적으로 더 이상 변경하지 않는다.
- 2026-05-11: 단일 상자가 위치 그룹에 속하지 않거나 위치 그룹 목록이 비어 있어도 선택 항목 자체는 active로 남도록 `selectedFrameGroupIds`와 `positionRelationAnchorFrameGroupId`를 active frame set에 먼저 포함한다. 이는 선택한 상자까지 10% opacity로 낮아지는 역효과를 막기 위한 계약이다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: `chrome-devtools` MCP `list_pages`와 `list_console_messages`는 기존 chrome-devtools profile이 이미 실행 중이라는 오류를 반환해 화면/콘솔 검증을 수행하지 못했다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

위치/속성 선택 표시 재수정:

- 2026-05-11: `POSITION-METADATA-FOCUS-01` 백업 완료.
  - `docs/diff/2026-05-11_POSITION-METADATA-FOCUS-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_POSITION-METADATA-FOCUS-01_0511ui.before.md`
- 2026-05-11: 크기 및 위치 탭의 10% opacity 구현이 속성 탭과 달랐던 원인은 opacity CSS가 raw frame selector와 `:not([data-template-frame-position-impact-group])`에 의존한 것이다. 선택 anchor가 `td`, `th`, band shell 등으로 해석되는 경우 속성 탭의 `data-template-metadata-focus="active|inactive"` 방식과 적용 대상이 달라질 수 있었다.
- 2026-05-11: 후속 구현은 `data-template-position-impact-focus="active|inactive"`를 모든 frame selection anchor에 부여한다. CSS도 속성 탭처럼 `inactive`는 `opacity: .1 !important`, `active`는 `opacity: 1 !important`를 직접 적용한다.
- 2026-05-11: 속성 탭에서 항목 선택 시 선택/해제가 반복되어 보이는 원인은 순수 선택 변경에도 editor rehydrate 예약이 유지되고, 이미 안정적인 선택 UI에도 `applyFrameSelectionUi()`가 `stripSelectionAttrs()`와 editor UI 제거를 다시 수행할 수 있었던 것이다.
- 2026-05-11: 속성 탭 순수 선택에서는 edge selection이 없으면 deferred editor rehydrate를 예약하지 않는다. 또한 이미 DOM의 선택 상태와 fill이 요청 선택 상태와 일치하면 선택 attrs와 fill을 보존해 중간 해제 프레임을 줄인다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: `chrome-devtools` MCP로 `http://localhost:3001/templates/edit`를 열고 스타일시트에 `data-template-position-impact-focus` 기반 CSS가 반영된 것을 확인했다. 다만 로컬 shell의 `curl`은 3001 연결 실패를 반환했고, `npm run dev -- -p 3001`과 `npx next dev -H 127.0.0.1 -p 3001`은 현재 샌드박스에서 `listen EPERM`으로 실패했다. 브라우저 콘솔에는 404 resource error 1건이 있었다.
- 2026-05-11: `supabase` MCP는 현재 세션에 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

그룹 무스타일 수정:

- 2026-05-11: `GROUP-NOSTYLE-01` 백업 완료.
  - `docs/diff/2026-05-11_GROUP-NOSTYLE-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_GROUP-NOSTYLE-01_0511ui.before.md`
- 2026-05-11: 그룹은 위치 기준점을 만들기 위한 참조 단위이며, 상자처럼 독립된 style surface가 될 수 없다. 따라서 그룹 wrapper는 배경, border, outline, box-shadow, filter를 항상 비워야 한다.
- 2026-05-11: `template-position-group-wrapper`와 `data-template-position-group-node="true"`에는 CSS와 inline style 양쪽에서 `background: transparent`, `border: 0`, `outline: none`, `box-shadow: none`, `filter: none`을 강제한다.
- 2026-05-11: 그룹 선택 상태를 내부 로직이 추적하기 위해 쓰던 `data-v106-position-group-proxy-overlay`는 화면에 보이지 않는 상태 marker로만 유지한다. 기존 proxy overlay의 bounding box outline, halo, fill, badge, 그룹 삭제 버튼은 출력하지 않는다.
- 2026-05-11: 속성 적용 경로에서 그룹 wrapper를 style target으로 삼던 `group` appearance mode를 제거했다. 후속 기준은 그룹을 선택해도 서식 패치가 실제 상자에만 적용되는 것이다.
- 2026-05-11: UI에서도 `그룹 출력 형식` 전환 버튼을 제거하고 `상자 출력 형식`만 남겼다. 그룹은 위치 기준점이며 별도 배경, 외곽선, 크기, padding, radius를 소유하지 않는다.
- 2026-05-11: 그룹을 선택해도 별도 그룹 박스 윤곽선은 생기지 않는다. 화면에서 구분되어야 하는 대상은 실제 상자와 위치 기준 active/inactive opacity뿐이다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: `chrome-devtools` MCP에서 `http://localhost:3001/templates/edit`의 스타일시트를 검사해 `template-position-group-wrapper` 무스타일 규칙과 `data-v106-position-group-proxy-overlay { display: none }` 규칙이 반영된 것을 확인했다. 또한 페이지 본문에 `그룹 출력 형식` 문구가 남아 있지 않음을 확인했다. 콘솔 error/warn 메시지는 없었다.
- 2026-05-11: `supabase` MCP는 현재 세션에 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

위치/속성 선택 반복 repaint 수정:

- 2026-05-11: `SELECTION-STABLE-01` 백업 완료.
  - `docs/diff/2026-05-11_SELECTION-STABLE-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SELECTION-STABLE-01_0511ui.before.md`
- 2026-05-11: 위치 탭 그룹 선택이 계속 full repaint를 타던 원인은 안정 선택 판정이 `positionGroupProxySelections.length > 0` 또는 `data-v106-position-group-proxy-overlay` 존재만으로 실패하던 것이다. 이제 proxy marker의 group id가 요청 proxy selection과 일치하면 안정 상태로 인정한다.
- 2026-05-11: 상자/그룹 선택 직후 이전에 예약된 `schedulePreviewEditorState()`가 뒤늦게 실행되어 선택 UI를 다시 strip/reapply하지 못하도록 `applyFrameBoxSelection()` 시작 시 예약 frame, retry count, deferred flag를 취소한다.
- 2026-05-11: 선택 클릭으로 이미 즉시 paint한 다음 React state commit이 발생할 때 바로 이어지는 layout effect가 동일 선택을 다시 full reapply하지 않도록 `suppressNextSelectionLayoutReapplyRef`를 추가했다. 이 skip은 같은 탭, 같은 선택 ID, edge selection 없음 조건에서만 1회 동작한다.
- 2026-05-11: `SELECTION-STABLE-05` 추가 백업 완료.
  - `docs/diff/2026-05-11_SELECTION-STABLE-05_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SELECTION-STABLE-05_0511ui.before.md`
- 2026-05-11: 1차 chrome-devtools 관찰에서 `B90467CA-12` 클릭 시 선택 해제 값으로 내려가지는 않았지만 같은 `data-template-selected="true"` 재쓰기와 `data-template-position-impact-focus` 재계산이 3개 배치로 반복되는 것을 확인했다.
- 2026-05-11: 선택 attrs(`data-template-selected`, `data-template-primary-selected`, `data-template-selection-order`)는 값이 달라질 때만 `setAttribute`를 호출하도록 공통 helper를 추가했다. 같은 선택을 다시 칠하는 경로가 남아도 동일 값 재쓰기 mutation을 만들지 않는다.
- 2026-05-11: 위치 탭의 `data-template-position-impact-focus`와 속성 탭의 `data-template-metadata-focus`는 전체 제거 후 재부여하지 않고 active/inactive 목표값만 비교해 갱신한다. 공통 selection strip 단계도 파생 선택 표시를 먼저 지우지 않도록 바꿔 opacity가 중간에 풀리는 프레임을 줄인다.
- 2026-05-11: 안정 refresh에서 기존 edge resize 버튼을 보존한 상태로 새 버튼을 계속 append하던 경로를 수정했다. 이제 `data-edge-id` 기준으로 기존 버튼을 동기화하고 중복 버튼을 제거한다.
- 2026-05-11: chrome-devtools MCP로 `http://localhost:3001/templates/edit?templateId=d3a38b9c-2603-4bc4-88e6-6b15fcfd0c40`에서 접근성 스냅샷의 텍스트 상자를 클릭해 확인했다.
  - 위치 탭 `B90467CA-12` 클릭: `recordCount=54`, `data-template-position-impact-focus=54`, 선택 attrs 재쓰기 0건, timeline 1개 배치.
  - 위치 탭 순환 두 번째 클릭: `selectedCount=1`, `proxyMarkerCount=0`, 선택 attrs 3건, `data-template-position-impact-focus=108`, timeline 1개 배치.
  - 속성 탭 `발 급 일` 클릭: `selectedCount=1`, metadata/relation/selection mutation이 timeline 1개 배치로 기록됨.
  - edge resize 버튼: `edgeButtonCount=216`, `uniqueEdgeIdCount=216`, `duplicatedEdgeIds=[]`.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic --log-level=warning --outfile=/tmp/template-edit-page-check.js`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: 마지막 추가 chrome-devtools click 1건은 안전 모니터가 중단했다. 중단 전 최신 snapshot과 mutation 관찰 결과를 기준으로 기록하며, DB 변경은 없다.
- 2026-05-11: `supabase` MCP는 현재 세션에 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

요약 핸들 위치 고정 추가 변경:

- 2026-05-11: `SUMMARY-HANDLE-01` 백업 완료.
  - `docs/diff/2026-05-11_SUMMARY-HANDLE-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SUMMARY-HANDLE-01_0511ui.before.md`
- 2026-05-11: 축소 상태와 확장 상태 모두 버튼 내부 순서를 `핸들 -> 요약 -> 접기/펼치기 표시`로 통일했다.
- 2026-05-11: 축소/확장 버튼의 좌측 padding을 동일하게 유지해 lucide `GripHorizontal` 핸들의 좌측 기준 위치가 상태 전환 중 바뀌지 않도록 했다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: `chrome-devtools` MCP `list_pages`는 기존 chrome-devtools profile이 이미 실행 중이라는 오류를 반환해 화면 검증을 수행하지 못했다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

요약 버튼 내용 폭 추가 변경:

- 2026-05-11: `SUMMARY-FIT-01` 백업 완료.
  - `docs/diff/2026-05-11_SUMMARY-FIT-01_TemplateEditWorkspace.before.tsx`
  - `docs/diff/2026-05-11_SUMMARY-FIT-01_0511ui.before.md`
- 2026-05-11: 접힌 요약 오버레이에서 50px 고정 폭 상수와 inline width 지정을 제거했다. 후속 구현 기준은 `50px * 32px` 고정 아이콘이 아니라 `요약` 텍스트, 회전 핸들, 확장 표시가 차지하는 실제 내용 폭이다.
- 2026-05-11: 접힌 오버레이 outer는 `w-max`와 preview 폭 기준 `max-width`만 사용한다. 버튼 내부는 absolute 배치로 구겨 넣지 않고 flex gap으로 배치해 내용 길이가 폭을 결정한다.
- 2026-05-11: 접힌 상태 높이 `32px`와 네 귀퉁이 스냅 계약은 유지한다. 드래그 중 폭은 현재 렌더링된 실제 overlay rect width를 기준으로 계산한다.
- 2026-05-11: 추가 검증으로 `npx esbuild src/app/templates/edit/page.tsx --bundle --platform=browser --format=esm --jsx=automatic ...`, `npm run check:no-shadow-app`, `git diff --check -- src/components/template/TemplateEditWorkspace.tsx docs/0511ui.md`를 실행했고 모두 통과했다.
- 2026-05-11: `chrome-devtools` MCP `list_pages`는 기존 chrome-devtools profile이 이미 실행 중이라는 오류를 반환해 화면 검증을 수행하지 못했다.
- 2026-05-11: `supabase` MCP는 `tool_search`에서 노출되지 않았다. 이번 변경은 DB 스키마/데이터 변경이 없으므로 사용자 실행 SQL도 없다.

후속 구현자는 아래 양식을 채운다.

```text
일시:
체크리스트 ID:
수정 파일:
diff 백업:
정적 검증:
chrome-devtools MCP:
supabase MCP:
결과:
남은 위험:
```

## 11. 롤백 절차

- `UI-TEXT-BULK-02`에서 남긴 `docs/diff` 백업 파일을 기준으로 수정 파일을 되돌린다.
- 신규 DTO/서비스 파일을 만들었고 롤백이 필요하면 해당 신규 파일을 삭제하기 전에 사용자 승인을 받는다.
- `TemplateEditWorkspace.tsx`만 되돌릴 경우에도 `docs/0511ui.md` 테스트 기록에는 롤백 사유와 되돌린 diff 파일명을 남긴다.
- 롤백 후 `npm run lint`와 `chrome-devtools` MCP 확인을 다시 수행한다.

## 12. 구현 가능성 검토

현재 구조는 텍스트 탭 서식 컨트롤이 이미 선택 목록 기반으로 동작하도록 만들어져 있어, 핵심 위험은 서식 적용 함수가 아니라 텍스트 탭에서 선택 상태를 강제로 해제하는 effect와 오른쪽 패널 제거 후 탭 진입점을 잃는 문제다.

이 기능을 지금 당장 별도 서비스로 분리해도 성립하는지 기준으로 보면, 텍스트 일괄 서식은 `selectionIds + stylePatch -> normalizedPatch/result` 계약으로 분리 가능하다. DOM 적용은 UI 어댑터 책임으로 남겨야 하며, 서비스가 React state나 DOM selector를 직접 소유하면 분리 배포 기준을 만족하지 못한다.

캔버스 1열화는 데이터 서비스가 아니라 레이아웃 슬롯 계약이다. `selectionPanelTab`과 탭 전환 이벤트만 외부 주입 가능하게 유지하면 별도 편집기 컨테이너로 분리해도 성립한다.
