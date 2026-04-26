# FRAMEEDIT 설계 문서

## 문서 목적

이 문서는 `http://localhost:4000/templates/extract` 페이지의 `문서 미리보기` 영역에 출력되는 추출 프레임 div 박스를 사용자가 직접 보정할 수 있게 만들기 위한 실행 설계서다.

검증 기준 템플릿은 아래 ID로 고정한다.

1. 검증 페이지: `http://localhost:4000/templates/extract`
2. 검증 UI 항목: `등록된 정식 템플릿`
3. 검증 템플릿 ID: `b8c38c7c-8637-4af8-ab6d-1d7a1e88a0be`

이 ID는 후속 구현 검증용 fixture 이며, 코드 기본값으로 하드코딩하지 않는다. 후속 구현자는 브라우저에서 해당 정식 템플릿을 선택하고 `정식 템플릿 불러오기`를 실행한 뒤 출력된 `추출된 템플릿 초안`을 기준으로 동작을 확인한다.

이 문서는 단순 아이디어 문서가 아니다. 후속 LLM 또는 개발자는 이 문서의 이해 확정 절차, 화이트리스트, 서비스 경계, 체크리스트, diff 기록 규칙, MCP 테스트 기록 규칙을 기준으로만 구현해야 한다.

---

## 현재 요청 이해 내용

수정 전 이해 확정 절차를 위해 현재 요청을 아래처럼 이해한다.

1. 이번 턴의 직접 산출물은 `/Users/gy/Documents/dev/docs/docs/frameEdit.md` 설계 문서 하나다.
2. 이번 턴에서는 애플리케이션 코드를 수정하지 않는다.
3. 후속 코드 구현 전에는 아래 이해 내용과 화이트리스트를 사용자에게 다시 제시하고, 사용자가 명시적으로 확정한 뒤에만 수정한다.
4. 검증은 `/templates/extract` 페이지에서 `등록된 정식 템플릿`을 `b8c38c7c-8637-4af8-ab6d-1d7a1e88a0be`로 선택해 불러온 출력 상태를 기준으로 한다.
5. 대상 UI는 `문서 미리보기` 카드 안의 `추출된 템플릿 초안`이며, 그 안에 렌더되는 추출 프레임 div 박스다.
6. 프레임 div 박스는 마우스 드래그로 위치 이동이 가능해야 한다.
7. 프레임 div 박스는 마우스 드래그로 높이와 너비 조정이 가능해야 한다.
8. 이동과 리사이즈는 반드시 인접 프레임 div 박스의 경계선에 snap 가능해야 한다.
9. 2개 이상의 프레임을 선택했을 때, 선택된 프레임들이 한 개 이상의 면을 공유하는 인접 관계이면 선택 영역을 포함하는 하나의 직사각형으로 병합할 수 있어야 한다.
10. 선택된 프레임이 한 개일 때, 인접 프레임 경계선을 기준으로 나눌 수 있어야 한다.
11. 기존 프레임은 선택 후 노출되는 쓰레기통 아이콘으로 삭제할 수 있어야 한다.
12. 생성 모드를 켜면 사용자가 문서 미리보기 위에서 마우스 드래그로 새 직사각형 프레임을 만들 수 있어야 한다.
13. 새 프레임 생성 시 key/value 체인과 부모 관계를 수동 입력할 수 있어야 한다.
14. 기존 `src/components` 폴더는 수정하지 않는다.
15. UI는 현재 서비스와 같은 디자이너가 만든 것처럼 기존 `Card`, `Button`, `Input`, `EntityPicker` 등 사용 패턴을 유지한다.
16. DB 스키마 변경은 이번 설계의 기본 범위에 포함하지 않는다.
17. DB 수정이 필요해지면 코드 수정을 중단하고 SQL 문서를 사용자에게 제공하여 사용자가 직접 실행하도록 한다.

---

## 현재 코드 판정

현재 `/templates/extract` 페이지는 `src/app/templates/extract/page.tsx`에 구현되어 있다.

확인된 기존 흐름은 아래와 같다.

1. `등록된 정식 템플릿` 목록은 `GET /api/templates?limit=12`로 가져온다.
2. 사용자가 정식 템플릿을 선택하고 `정식 템플릿 불러오기`를 누르면 `GET /api/templates/{templateId}`로 템플릿 상세를 가져온다.
3. 가져온 `template.draftHtml`은 `TemplateExtractDetailResult` 형태로 변환되어 `draftDetail.draft.generatedDraftHtml`에 들어간다.
4. `문서 미리보기`에서 `추출된 템플릿 초안` 탭을 선택하면 `draftDetail.draft.generatedDraftHtml` 또는 v1.06 프레임용으로 flatten된 HTML을 렌더한다.
5. 정식 템플릿 편집 후 `현재 정식 템플릿 저장`을 누르면 `PATCH /api/templates/{templateId}`로 현재 미리보기 HTML을 `draftHtml`로 저장한다.

확인된 기존 프레임 편집 관련 구현은 아래와 같다.

1. `FrameNodeRect`, `FrameResizeDirection`, `FrameNodeSnapshot`, `FrameDragState`, `FrameResizeState` 타입이 이미 `page.tsx`에 존재한다.
2. `data-template-extraction-stage="frames"`와 `data-template-frame-group-version="v1.06"` 출력은 `flattenFramePreviewMarkup()`와 `normalizeFramePreviewForV106()`로 편집 레이어에 맞게 변환된다.
3. `data-v106-frame-node="true"` 프레임 노드는 8방향 리사이즈 핸들을 가진다.
4. `readFrameNodeRect()`, `writeFrameNodeRect()`, `clampFrameNodeRect()`가 px 기반 rect 읽기/쓰기를 담당한다.
5. `snapMovedFrameRect()`와 `snapResizedFrameRect()`가 주변 프레임의 좌/우/상/하 경계와 페이지 경계를 snap 후보로 사용한다.
6. `mergeSelectedFrameGroups()`가 선택 프레임을 bounding union rect로 합치는 기본 기능을 가지고 있다.
7. `splitSelectedFrameGroup()`가 선택 프레임을 세로/가로로 나누는 기본 기능을 가지고 있다.
8. `프레임 편집` 카드에는 `Value Key`, `Frame Role`, `Parent Frame Group`, `Width`, `Height`, 병합, 분할, 수동 snap 버튼이 이미 있다.

현재 구현에서 후속 수정이 필요한 지점은 아래와 같다.

1. 드래그/리사이즈 이동량이 preview scale을 고려하지 않는다. 현재 미리보기는 `.page-inner`에 CSS `transform: scale(...)`이 적용될 수 있으므로, pointer delta는 화면 px가 아니라 원본 page css px로 환산해야 한다.
2. `mergeSelectedFrameGroups()`는 선택 프레임들이 한 개 이상의 면을 공유하는지 검증하지 않는다. 현재는 떨어진 박스도 bounding union으로 병합될 수 있다.
3. `splitSelectedFrameGroup()`는 인접 경계 후보가 없으면 midpoint로 나누는 fallback이 있다. 요청은 "인접한 경계선을 기준"이므로 fallback midpoint 분할은 기본 동작에서 제거해야 한다.
4. 프레임 생성 모드가 없다.
5. 프레임 삭제용 쓰레기통 아이콘이 없다.
6. key/value 체인을 구성하는 `data-template-frame-chain-key`, `data-template-frame-chain-depth` 입력 UI가 없다.
7. 프레임 geometry, HTML 직렬화, metadata validation이 `page.tsx` 내부 DOM 조작에 강하게 결합되어 있다.
8. 독립 서비스로 분리 가능한 API/DTO 경계가 아직 없다.

---

## 실행 정책

아래 정책은 본 설계와 후속 수정에서 100% 준수한다.

### 0. 서비스 독립성 설계 원칙

아래 기능들은 처음부터 하나의 서비스로 분리 가능한 단위로 설계한다.

1. `Frame Geometry Edit Service`
2. `Frame HTML Serialization Service`
3. `Frame Metadata Binding Service`
4. `Frame Interaction Adapter`
5. `Frame Persistence Adapter`

각 기능은 단순 내부 모듈이 아니라 향후 별도 배포, 별도 운영, 별도 API 상품화가 가능해야 한다.

각 기능은 반드시 명확한 도메인 경계, 책임, 입력, 출력, 저장소 범위를 가진다.

다른 기능 구현 세부사항, DB 스키마, 내부 함수, 화면 상태에 직접 의존하지 않는다. 기능 간 연결은 계약된 API, 이벤트, DTO로만 한다.

공통 로직이 필요해도 먼저 독립 서비스로 유지 가능한지 검토한다. 특정 기능이 다른 기능 없이도 테스트, 운영, 교체, 확장 가능해야 한다.

구현안은 항상 아래 질문으로 검토한다.

1. 이 기능을 지금 당장 별도 서비스로 분리해도 입력과 출력이 성립하는가?
2. 화면 DOM이나 React state 없이 DTO만으로 같은 결과를 계산할 수 있는가?
3. templates DB 없이도 frame edit 결과 HTML을 반환할 수 있는가?
4. templates 저장소를 교체해도 frame geometry 연산은 그대로 유지되는가?
5. 임시 편의성을 위해 서비스 경계를 무너뜨린 부분이 없는가?

성립하지 않으면 구현보다 결합 지점 제거를 먼저 한다.

### 1. 코드 의도 기록

모든 코드는 히스토리를 모르는 LLM이 읽어도 의도와 목표를 이해할 수 있어야 한다.

1. 타입명은 `FrameEdit`, `TemplateFrame`, `FrameGeometry`, `FrameAdjacency`처럼 도메인 목적이 드러나야 한다.
2. snap, merge, split, create, delete의 validation 함수는 이름만 보고 금지 조건을 알 수 있어야 한다.
3. 복잡한 geometry 판정에는 짧은 주석을 남긴다.
4. 임의 fallback은 금지한다. fallback이 필요하면 요청 조건과 충돌하지 않는지 주석으로 명시한다.
5. 사용자 요청과 직접 관련 없는 리팩터링은 하지 않는다.

### 2. UI 변경 원칙

1. `/src/components` 폴더는 수정하지 않는다.
2. 기존 `Button`, `Input`, `Card`, `Badge`, `EntityPicker` 사용 패턴을 유지한다.
3. 쓰레기통 아이콘은 새 SVG를 직접 그리지 않고 `lucide-react`의 `Trash2`를 사용한다.
4. 생성 모드는 기존 카드/버튼 스타일과 같은 밀도와 색상 체계를 따른다.
5. `문서 미리보기` 안에 설명성 텍스트를 과하게 추가하지 않는다.
6. 프레임 위 오버레이 아이콘은 선택 상태에서만 노출한다.
7. 프레임 선택, 이동, 리사이즈, 생성 중 텍스트와 버튼이 서로 겹치지 않아야 한다.
8. 미리보기 scale이 달라져도 조작 좌표는 원본 page css px 좌표계로 일관되어야 한다.

### 3. 수정 전 이해확정 절차

코드 수정 전 반드시 아래 절차를 실행한다.

1. 현재 요청 이해 내용을 목록으로 다시 정리한다.
2. 이번 구현에서 건드릴 체크리스트 ID를 명시한다.
3. 이번 구현에서 수정할 파일 화이트리스트를 정확한 파일명 단위로 제시한다.
4. 사용자가 명시적으로 "확정" 또는 동등한 승인을 한 뒤에만 코드 수정한다.
5. 확정 없이 임의로 구현에 착수하지 않는다.
6. 진행 중 화이트리스트 밖 파일이 필요하면 즉시 중단하고 추가 파일명을 제안한다.

### 4. 변경 기록 및 롤백 보장

코드 수정이 있는 경우, 수정 직전의 파일 상태를 반드시 `docs/diff` 폴더에 기록한다.

1. 기록 대상은 변경 파일 전체 또는 수정 구간을 포함해야 한다.
2. 새 파일을 만들 경우에도 `파일 없음` 상태를 diff 문서에 기록한다.
3. diff 파일명은 날짜, 체크리스트 ID, 원본 파일명을 포함한다.
4. diff 파일 안에는 관련 체크리스트 ID를 반드시 적는다.
5. diff 파일 안에는 왜 이 수정이 필요한지 한 줄 이상 적는다.
6. diff 기록이 없으면 코드 수정하지 않는다.
7. 롤백은 diff 파일만 보고도 가능해야 한다.

예상 파일명 패턴은 아래와 같다.

1. `docs/diff/YYYY-MM-DD_FRAMEEDIT-02_templateFrameEditDtos.before.md`
2. `docs/diff/YYYY-MM-DD_FRAMEEDIT-03_templateFrameEditGeometryService.before.md`
3. `docs/diff/YYYY-MM-DD_FRAMEEDIT-04_templateFrameEditHtmlService.before.md`
4. `docs/diff/YYYY-MM-DD_FRAMEEDIT-07_extract-page.before.tsx`
5. `docs/diff/YYYY-MM-DD_FRAMEEDIT-09_template-frame-editor-route.before.md`

### 5. 확정 범위 외 수정 금지

1. 사용자가 확정한 파일과 체크리스트 범위를 넘어서는 변경을 하지 않는다.
2. 인코딩, 전역 스타일, 기존 unrelated UI, 기존 API semantics를 바꾸지 않는다.
3. 기존 템플릿 저장 흐름을 교체하지 않는다.
4. 기존 `TemplateService.updateTemplate()` 계약은 필요 없으면 수정하지 않는다.
5. 기존 `TemplateExtractService`와 PDF 추출 파이프라인은 이번 요청 범위가 아니다.

### 6. 체크리스트 작성 정책

1. 모든 구현 항목은 `FRAMEEDIT-XX` 체크리스트 ID를 가진다.
2. diff 파일명과 diff 본문에 같은 체크리스트 ID를 기록한다.
3. 체크리스트 없이 코드 변경하지 않는다.
4. 체크리스트 완료 기준은 구현과 테스트 결과를 모두 포함한다.
5. 문서 하단 체크리스트에 실제 완료 상태를 계속 갱신한다.

### 7. MCP 테스트 의무

1. 매 실행마다 `supabase` MCP와 `chrome-devtools` MCP 확인을 수행한다.
2. `supabase` MCP가 세션에 노출되지 않으면 즉시 기록하고 사용자에게 연결 필요성을 알린다.
3. DB 수정은 MCP로 직접 수행하지 않는다.
4. DB 수정이 필요하면 SQL 쿼리를 문서로 제공하고 사용자가 직접 실행하도록 한다.
5. `chrome-devtools` MCP는 `/templates/extract` 화면 로드, 정식 템플릿 선택, 프레임 선택/드래그/리사이즈/병합/분할/생성/삭제/저장/재조회 확인에 사용한다.
6. MCP 실패 자체도 테스트 기록에 남긴다.
7. MCP 테스트 수행 여부와 결과는 문서 하단 테스트 기록에 남긴다.

---

## 수정 허용 화이트리스트

### 이번 문서 작성 화이트리스트

이번 턴에서 실제 수정 가능한 파일은 아래 하나로 한정한다.

1. `/Users/gy/Documents/dev/docs/docs/frameEdit.md`
   - 목적: 본 설계 문서 작성
   - 금지 변경: 애플리케이션 코드 변경, 기존 문서 임의 수정, 기존 diff 임의 수정

### 후속 구현 1차 제안 화이트리스트

아래 파일은 후속 구현에서 사용자 확정 후에만 수정 가능하다.

1. `/Users/gy/Documents/dev/docs/src/lib/templateFrameEditDtos.ts`
   - 목적: frame edit 독립 DTO, operation DTO, validation result DTO 정의
   - 변경 사유: geometry, HTML serialization, UI adapter가 공유할 계약 필요
   - 금지 변경: 기존 `templateExtractDtos.ts`, `templateDtos.ts`의 의미 변경

2. `/Users/gy/Documents/dev/docs/src/services/templateFrameEditGeometryService.ts`
   - 목적: snap, adjacency, merge, split, create rect validation을 DOM 없이 계산
   - 변경 사유: 프레임 편집의 핵심 도메인을 UI에서 분리
   - 금지 변경: templates DB 접근, React state 접근, HTML 문자열 직접 수정

3. `/Users/gy/Documents/dev/docs/src/services/templateFrameEditHtmlService.ts`
   - 목적: v1.06 frame HTML 파싱/직렬화, UI 핸들 제거, frame DTO 반영
   - 변경 사유: 저장 가능한 `draftHtml` 정규화 책임 분리
   - 금지 변경: geometry 정책 직접 결정, templates DB 접근

4. `/Users/gy/Documents/dev/docs/src/app/api/templates/frame-editor/route.ts`
   - 목적: frame edit operation을 HTML + DTO 입력으로 받아 결과 HTML과 warnings를 반환하는 API adapter
   - 변경 사유: 향후 frame editor를 별도 서비스/API로 분리 가능한 계약 확보
   - 금지 변경: templates DB 직접 수정, `TemplateService.updateTemplate()` 우회 저장

5. `/Users/gy/Documents/dev/docs/src/app/templates/extract/page.tsx`
   - 목적: 기존 문서 미리보기 UI에 frame edit adapter 연결, 생성/삭제 UI, chain 입력 UI, scale-aware pointer 처리 적용
   - 변경 사유: 사용자 조작 surface는 현재 이 파일에 있음
   - 금지 변경: PDF 추출 버전 의미 변경, `/src/components` 수정, unrelated page layout 변경

후속 구현 중 아래 파일이 필요하다고 판단되면 즉시 중단하고 사용자 승인을 받아야 한다.

1. `/Users/gy/Documents/dev/docs/src/services/templateService.ts`
2. `/Users/gy/Documents/dev/docs/src/lib/templateDtos.ts`
3. `/Users/gy/Documents/dev/docs/src/app/api/templates/[templateId]/route.ts`
4. `/src/components` 안의 어떤 파일이든 필요해지는 경우, 폴더 단위가 아니라 정확한 파일명을 하나씩 제안해야 한다.
5. DB SQL 파일 또는 `docs/applied` 안의 파일이 필요해지는 경우, 폴더 단위가 아니라 정확한 파일명을 하나씩 제안해야 한다.

폴더 단위 화이트리스트는 금지한다.

---

## 독립 서비스 설계

### 기능 A. Frame Geometry Edit Service

#### 1. 기능 목적

프레임 rect의 이동, 리사이즈, snap, adjacency 판정, 병합, 분할, 생성 가능 여부를 DOM 없이 계산한다.

#### 2. 단독 서비스로서의 가치

이 기능은 좌표와 프레임 목록만 있으면 동작한다. 브라우저 UI, React state, Supabase, templates DB 없이도 독립 테스트가 가능하다. 향후 문서 편집 API, CLI batch 보정, 외부 SaaS API로 분리해도 같은 DTO 계약을 사용할 수 있다.

#### 3. 책임 범위 / 비책임 범위

책임 범위:

1. page css px 좌표계의 rect 정규화
2. preview scale 보정에 필요한 좌표 변환
3. 인접 프레임 경계 snap 후보 계산
4. 이동/리사이즈 결과 rect 계산
5. 면 공유 adjacency graph 계산
6. 병합 가능 여부와 병합 rect 계산
7. 인접 경계 기반 분할 후보 계산
8. 생성 rect 최소 크기와 페이지 경계 validation

비책임 범위:

1. HTML DOM 직접 수정
2. React state 변경
3. DB 저장
4. 템플릿 필드 definition 생성
5. UI 메시지 렌더링

#### 4. API 계약

TypeScript 서비스 계약:

```ts
export type TemplateFrameRect = {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type TemplateFrameNodeDto = {
  frameGroupId: string;
  rect: TemplateFrameRect;
  metadata: TemplateFrameMetadataDto;
};

export type TemplateFrameSnapOptions = {
  thresholdPx: number;
  minSizePx: number;
  snapToPageBounds: boolean;
};

export type TemplateFrameGeometryResult<T> = {
  ok: boolean;
  value: T | null;
  warnings: TemplateFrameEditWarning[];
};
```

핵심 함수:

```ts
snapMovedRect(input): TemplateFrameGeometryResult<TemplateFrameRect>
snapResizedRect(input): TemplateFrameGeometryResult<TemplateFrameRect>
canMergeFrames(input): TemplateFrameGeometryResult<TemplateFrameMergePlan>
mergeFrames(input): TemplateFrameGeometryResult<TemplateFrameNodeDto>
listSplitCandidates(input): TemplateFrameGeometryResult<TemplateFrameSplitCandidate[]>
splitFrame(input): TemplateFrameGeometryResult<TemplateFrameNodeDto[]>
validateCreateRect(input): TemplateFrameGeometryResult<TemplateFrameRect>
```

#### 5. 데이터 소유권

이 서비스는 데이터를 소유하지 않는다. 입력 DTO를 계산하고 결과 DTO를 반환한다. 정본 저장소는 기존 template `draftHtml` 또는 향후 별도 frame edit 저장소가 맡는다.

#### 6. 의존 서비스

1. `templateFrameEditDtos.ts`
2. 표준 TypeScript/JavaScript 수학 연산

DB, React, DOM, Next API에는 의존하지 않는다.

#### 7. 분리 배포 시 필요한 최소 조건

1. DTO JSON schema
2. `POST /frame-geometry/snap`
3. `POST /frame-geometry/merge`
4. `POST /frame-geometry/split`
5. `POST /frame-geometry/validate-create`

입력은 frame 배열과 operation이며, 출력은 frame 배열 또는 validation warning이다.

### 기능 B. Frame HTML Serialization Service

#### 1. 기능 목적

`draftHtml` 안의 v1.06 프레임 HTML을 파싱해 `TemplateFrameNodeDto[]`로 만들고, 수정된 DTO를 다시 저장 가능한 HTML로 직렬화한다.

#### 2. 단독 서비스로서의 가치

HTML 문자열과 frame DTO만 있으면 동작한다. UI가 바뀌어도 저장 포맷 정규화가 유지되며, 별도 API 서버 또는 worker로 분리할 수 있다.

#### 3. 책임 범위 / 비책임 범위

책임 범위:

1. `data-template-extraction-stage="frames"` 섹션 탐색
2. `data-template-frame-group-version="v1.06"` 프레임 노드 탐색
3. `.v202-frame-group[data-template-frame-group]` raw frame 호환 파싱
4. `style.left/top/width/height`와 frame metadata attribute 읽기
5. 수정된 frame DTO를 DOM에 반영
6. resize handle, selection badge, trash overlay 같은 UI-only 노드 제거
7. 저장 가능한 normalized `draftHtml` 반환

비책임 범위:

1. snap/merge/split 정책 결정
2. templates DB 저장
3. 사용자 입력 validation 메시지 렌더링
4. PDF 추출 또는 OCR

#### 4. API 계약

```ts
export type TemplateFrameHtmlParseRequest = {
  html: string;
};

export type TemplateFrameHtmlParseResult = {
  frames: TemplateFrameNodeDto[];
  pageMetrics: TemplateFramePageMetricDto[];
  normalizedHtml: string;
  warnings: TemplateFrameEditWarning[];
};

export type TemplateFrameHtmlApplyRequest = {
  html: string;
  frames: TemplateFrameNodeDto[];
  removeFrameGroupIds?: string[];
};

export type TemplateFrameHtmlApplyResult = {
  html: string;
  frames: TemplateFrameNodeDto[];
  warnings: TemplateFrameEditWarning[];
};
```

#### 5. 데이터 소유권

이 서비스는 HTML을 영구 저장하지 않는다. HTML 문자열을 입력받아 normalized HTML 문자열을 반환한다.

#### 6. 의존 서비스

1. `templateFrameEditDtos.ts`
2. 브라우저 DOMParser 또는 서버 DOM 대체 구현

초기 구현은 클라이언트 DOM 기반으로 시작하되, 함수 경계는 서버 DOM 구현으로 교체 가능하게 유지한다.

#### 7. 분리 배포 시 필요한 최소 조건

1. HTML parser runtime
2. DTO JSON schema
3. `POST /frame-html/parse`
4. `POST /frame-html/apply`

### 기능 C. Frame Metadata Binding Service

#### 1. 기능 목적

프레임의 key/value 체인과 부모 관계를 수동 입력 가능한 metadata로 관리하고, 저장 가능한 data attribute로 변환한다.

#### 2. 단독 서비스로서의 가치

geometry와 분리된 의미 계층 서비스다. 향후 자동 field binding, 외부 검수 도구, schema validation API로 분리할 수 있다.

#### 3. 책임 범위 / 비책임 범위

책임 범위:

1. `data-template-frame-role` 값 검증
2. `data-template-frame-value-key` 정규화
3. `data-template-frame-parent-group` 존재 여부 검증
4. `data-template-frame-chain-key` 정규화
5. `data-template-frame-chain-depth` 숫자 정규화
6. 병합/분할/생성 시 metadata 승계 정책 결정

비책임 범위:

1. rect 계산
2. HTML DOM 직접 저장
3. templates field definition 생성
4. Supabase 저장

#### 4. API 계약

```ts
export type TemplateFrameRole = 'group' | 'key' | 'value';

export type TemplateFrameMetadataDto = {
  role: TemplateFrameRole;
  valueKey: string | null;
  parentGroupId: string | null;
  chainKey: string | null;
  chainDepth: number | null;
  sourceText: string | null;
};

export type TemplateFrameMetadataPatch = Partial<TemplateFrameMetadataDto>;
```

핵심 함수:

```ts
normalizeMetadata(input): TemplateFrameGeometryResult<TemplateFrameMetadataDto>
mergeMetadata(input): TemplateFrameGeometryResult<TemplateFrameMetadataDto>
splitMetadata(input): TemplateFrameGeometryResult<TemplateFrameMetadataDto[]>
validateParentReferences(input): TemplateFrameGeometryResult<TemplateFrameNodeDto[]>
```

#### 5. 데이터 소유권

metadata 정본은 저장된 `draftHtml`의 data attribute다. 이 서비스는 metadata DTO와 validation 결과만 소유한다.

#### 6. 의존 서비스

1. `templateFrameEditDtos.ts`
2. frame id 목록

#### 7. 분리 배포 시 필요한 최소 조건

1. frame metadata JSON schema
2. parent reference validation endpoint
3. metadata patch endpoint

### 기능 D. Frame Interaction Adapter

#### 1. 기능 목적

브라우저 pointer event를 frame edit DTO operation으로 변환하고, 결과를 현재 `문서 미리보기` DOM에 적용한다.

#### 2. 단독 서비스로서의 가치

Interaction adapter만 교체하면 같은 geometry service를 React, Canvas, iframe, 외부 desktop editor에서 재사용할 수 있다.

#### 3. 책임 범위 / 비책임 범위

책임 범위:

1. pointer down/move/up event 수집
2. preview scale을 반영한 screen px -> page css px 변환
3. selection state를 operation DTO로 변환
4. 생성 모드 drag ghost rect 표시
5. 삭제 아이콘 클릭을 delete operation으로 변환
6. operation 결과를 DOM에 반영하고 `draftPreviewHtmlRef` 동기화

비책임 범위:

1. merge 가능 여부 결정
2. split 후보 계산
3. templates DB 저장
4. HTML normalization 정책 결정

#### 4. API 계약

클라이언트 이벤트 계약:

```ts
export type TemplateFrameEditOperation =
  | { type: 'move'; frameGroupIds: string[]; delta: { x: number; y: number } }
  | { type: 'resize'; frameGroupId: string; direction: FrameResizeDirection; delta: { x: number; y: number } }
  | { type: 'merge'; frameGroupIds: string[]; primaryFrameGroupId: string }
  | { type: 'split'; frameGroupId: string; candidateId: string }
  | { type: 'create'; rect: TemplateFrameRect; metadata: TemplateFrameMetadataDto }
  | { type: 'delete'; frameGroupIds: string[] }
  | { type: 'metadata'; frameGroupIds: string[]; patch: TemplateFrameMetadataPatch };
```

#### 5. 데이터 소유권

React state는 임시 UI state만 소유한다. 저장 정본은 normalized HTML이다.

#### 6. 의존 서비스

1. Frame Geometry Edit Service
2. Frame HTML Serialization Service
3. Frame Metadata Binding Service
4. 기존 `page.tsx`의 preview ref

#### 7. 분리 배포 시 필요한 최소 조건

이 기능은 브라우저 runtime이 필요하다. 별도 배포 시 geometry/serialization API client와 pointer event adapter만 있으면 된다.

### 기능 E. Frame Persistence Adapter

#### 1. 기능 목적

편집된 frame HTML을 기존 정식 템플릿 저장 흐름에 연결한다.

#### 2. 단독 서비스로서의 가치

Frame editor는 templates 저장소를 직접 몰라도 된다. persistence adapter만 교체하면 Supabase templates, file storage, external API 저장소에 같은 HTML을 저장할 수 있다.

#### 3. 책임 범위 / 비책임 범위

책임 범위:

1. `getCurrentDraftPreviewHtml()`이 UI-only 노드를 제거한 HTML을 반환하게 보장
2. `PATCH /api/templates/{templateId}`에 기존 `draftHtml` 형태로 전달
3. 저장 성공 후 `registeredTemplates`와 메시지 state 갱신
4. 저장 후 재조회 검증 절차 정의

비책임 범위:

1. Supabase schema 변경
2. frame operation history 저장
3. 템플릿 필드 definition 자동 생성

#### 4. API 계약

기존 저장 계약을 유지한다.

```http
PATCH /api/templates/{templateId}
Content-Type: application/json

{
  "templateName": "string",
  "sourceDocumentName": "string | null",
  "draftHtml": "string",
  "layoutResizeMode": "fixed | grow_height | grow_width"
}
```

선택적 frame editor API adapter 계약은 아래와 같다.

```http
POST /api/templates/frame-editor
Content-Type: application/json

{
  "html": "string",
  "operation": { "type": "merge | split | create | delete | metadata | move | resize" },
  "options": {
    "snapThresholdPx": 12,
    "minSizePx": 12
  }
}
```

응답:

```json
{
  "success": true,
  "data": {
    "html": "string",
    "frames": [],
    "warnings": []
  }
}
```

#### 5. 데이터 소유권

이 adapter는 저장소를 소유하지 않는다. 기존 `templates.template_registry.draft_html`이 정식 템플릿 HTML 정본이다.

#### 6. 의존 서비스

1. 기존 `/api/templates/{templateId}` PATCH
2. Frame HTML Serialization Service

#### 7. 분리 배포 시 필요한 최소 조건

1. 저장소 adapter interface
2. 인증/권한 검증
3. templateId와 draftHtml update endpoint

---

## 상세 구현 설계

### 1. 위치/높이/너비 조정 및 snap

후속 구현은 아래 동작을 만족해야 한다.

1. 프레임을 클릭하면 선택된다.
2. 선택된 프레임을 드래그하면 위치가 이동한다.
3. 프레임의 8방향 핸들을 드래그하면 높이와 너비가 조정된다.
4. 이동/리사이즈 중에는 즉시 rect가 업데이트되어야 한다.
5. pointer up 시 가장 가까운 인접 프레임 경계 또는 페이지 경계로 snap한다.
6. snap 후보는 같은 페이지의 다른 프레임에서 계산한다.
7. 좌/우 경계 snap은 두 프레임의 세로 구간이 겹칠 때만 후보로 삼는다.
8. 상/하 경계 snap은 두 프레임의 가로 구간이 겹칠 때만 후보로 삼는다.
9. preview scale이 `0.5`이면 화면에서 10px 움직인 delta는 원본 좌표에서 20px로 환산한다.
10. snap threshold는 원본 page css px 기준으로 관리한다.
11. 최소 크기는 원본 page css px 기준 `12px` 이상으로 둔다.

현재 `snapMovedFrameRect()`와 `snapResizedFrameRect()`의 개념은 유지하되, 계산 위치는 `templateFrameEditGeometryService.ts`로 이동한다.

### 2. 프레임 병합

병합은 아래 조건을 모두 만족할 때만 가능하다.

1. 선택 프레임 수가 2개 이상이다.
2. 모든 선택 프레임이 같은 pageNumber에 있다.
3. 선택 프레임들의 face adjacency graph가 connected 상태다.
4. face adjacency는 아래 중 하나다.
   - A의 right와 B의 left가 tolerance 안에서 같고 세로 구간 overlap이 `minSharedEdgePx` 이상이다.
   - A의 left와 B의 right가 tolerance 안에서 같고 세로 구간 overlap이 `minSharedEdgePx` 이상이다.
   - A의 bottom과 B의 top이 tolerance 안에서 같고 가로 구간 overlap이 `minSharedEdgePx` 이상이다.
   - A의 top과 B의 bottom이 tolerance 안에서 같고 가로 구간 overlap이 `minSharedEdgePx` 이상이다.
5. 조건을 만족하지 않으면 병합 버튼은 disabled 또는 클릭 시 warning 메시지를 반환한다.
6. 병합 결과 rect는 선택 프레임 전체를 포함하는 bounding rectangle이다.
7. 병합 결과 frameGroupId는 새 ID를 생성한다.
8. valueKey, role, parentGroup, chainKey, chainDepth가 선택 프레임 간 모두 같으면 유지한다.
9. metadata가 서로 다르면 primary frame의 metadata를 우선하되 warning을 남기고 UI에서 수동 보정 가능하게 한다.
10. 병합 후 원본 프레임 DOM은 제거하고 병합 프레임 하나만 남긴다.

현재 `mergeSelectedFrameGroups()`는 adjacency validation 없이 union만 수행하므로 반드시 교체한다.

### 3. 프레임 분할

분할은 아래 조건을 모두 만족할 때만 가능하다.

1. 선택 프레임 수가 정확히 1개다.
2. 같은 페이지의 다른 프레임 경계선 중 선택 프레임 내부를 통과하는 경계가 있다.
3. 세로 분할 후보는 다른 프레임의 left 또는 right가 선택 프레임의 left/right 내부에 있고, 세로 구간 overlap이 충분해야 한다.
4. 가로 분할 후보는 다른 프레임의 top 또는 bottom이 선택 프레임의 top/bottom 내부에 있고, 가로 구간 overlap이 충분해야 한다.
5. 인접 경계 후보가 없으면 midpoint로 나누지 않는다.
6. 분할 후보가 여러 개이면 가장 가까운 후보를 기본 선택하되, 후속 UI에서 후보 선택 목록으로 확장 가능하게 DTO를 둔다.
7. 분할 후 두 프레임 모두 최소 크기 이상이어야 한다.
8. 분할된 두 프레임은 새 frameGroupId를 가진다.
9. metadata는 기본적으로 복제하되, chainDepth/valueKey가 중복되므로 warning을 남기고 수동 보정이 가능해야 한다.

현재 `splitSelectedFrameGroup()`의 midpoint fallback은 요청 조건과 충돌하므로 제거한다.

### 4. 프레임 삭제

삭제는 아래 동작을 만족해야 한다.

1. 프레임을 선택하면 프레임 우상단에 쓰레기통 아이콘 버튼을 노출한다.
2. 아이콘은 `lucide-react`의 `Trash2`를 사용한다.
3. 선택 프레임이 여러 개이면 각 프레임에 아이콘을 노출하거나, `프레임 편집` 카드에 `선택 삭제` 버튼을 함께 둔다.
4. 삭제 클릭 시 해당 frameGroupId를 가진 프레임 노드를 제거한다.
5. 삭제 후 parentGroup이 삭제된 frameGroupId를 참조하는 남은 프레임은 warning 상태로 표시한다.
6. 삭제 후 `draftPreviewHtmlRef`를 즉시 동기화한다.
7. 저장 전까지 삭제는 클라이언트 상태이며, `현재 정식 템플릿 저장`을 눌러야 정식 템플릿에 반영된다.

### 5. 프레임 생성

생성은 아래 동작을 만족해야 한다.

1. `프레임 편집` 카드에 `생성 모드` 토글 버튼을 추가한다.
2. 생성 모드가 켜진 상태에서 미리보기 빈 영역을 pointer down하고 drag하면 ghost rectangle을 표시한다.
3. drag 시작점과 종료점은 page css px 좌표로 변환한다.
4. drag 중 좌/우/상/하 경계는 인접 프레임 경계와 페이지 경계에 snap 가능해야 한다.
5. pointer up 시 최소 크기 이상이면 새 프레임 후보를 만든다.
6. 생성 직후 metadata 입력 폼을 열어 아래 값을 수동 입력하게 한다.
   - `Frame Role`: `group`, `key`, `value`
   - `Value Key`
   - `Chain Key`
   - `Chain Depth`
   - `Parent Frame Group`
7. 사용자가 metadata를 확정하면 새 frameGroupId를 생성하고 DOM에 반영한다.
8. 사용자가 취소하면 ghost rect와 pending frame을 제거한다.
9. 새 프레임은 `data-v106-frame-node="true"`와 기존 v1.06 frame class를 유지한다.
10. 새 프레임은 리사이즈 핸들, 선택 badge, 삭제 아이콘 등 같은 interaction을 지원한다.

### 6. 저장과 재조회

저장 흐름은 기존 `현재 정식 템플릿 저장`을 사용한다.

1. 사용자가 정식 템플릿을 불러온다.
2. 프레임 편집을 수행한다.
3. `getCurrentDraftPreviewHtml()`이 UI-only 노드를 제거한 normalized HTML을 반환한다.
4. `PATCH /api/templates/{templateId}`로 `draftHtml`을 저장한다.
5. 저장 성공 후 같은 templateId를 다시 `GET /api/templates/{templateId}`로 불러와 프레임 개수와 metadata가 유지되는지 확인한다.

DB schema 변경은 필요하지 않다. frame edit history 저장이 필요하다는 요구가 추가되면 별도 SQL 문서를 만들고 사용자 승인을 받아야 한다.

---

## DTO 초안

후속 구현에서 `src/lib/templateFrameEditDtos.ts`에 아래 타입을 둔다.

```ts
export type TemplateFrameRole = 'group' | 'key' | 'value';

export type TemplateFrameRectDto = {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type TemplateFrameMetadataDto = {
  role: TemplateFrameRole;
  valueKey: string | null;
  parentGroupId: string | null;
  chainKey: string | null;
  chainDepth: number | null;
  sourceText: string | null;
};

export type TemplateFrameNodeDto = {
  frameGroupId: string;
  rect: TemplateFrameRectDto;
  metadata: TemplateFrameMetadataDto;
};

export type TemplateFrameEditWarningCode =
  | 'frames_not_adjacent'
  | 'frames_cross_page'
  | 'split_boundary_missing'
  | 'frame_too_small'
  | 'parent_missing'
  | 'metadata_conflict'
  | 'html_parse_failed';

export type TemplateFrameEditWarning = {
  code: TemplateFrameEditWarningCode;
  message: string;
  frameGroupIds: string[];
};
```

---

## 구현 체크리스트

### `FRAMEEDIT-00` 설계 문서 작성

상태: 완료

완료 기준:

1. `docs/frameEdit.md` 작성
2. 요청 이해 내용 기록
3. 서비스 독립성 원칙 기록
4. 후속 구현 화이트리스트 제안
5. 체크리스트와 테스트 기록 섹션 작성

관련 diff:

1. 이번 문서는 새 파일 생성이므로 기존 코드 diff는 없다.

### `FRAMEEDIT-01` 수정 전 이해확정

상태: 대기

완료 기준:

1. 후속 구현 전 사용자에게 이해 내용 재제시
2. 수정 파일 화이트리스트 재제시
3. 사용자 명시 확정 수신

관련 diff:

1. 없음

### `FRAMEEDIT-02` DTO 계약 추가

상태: 완료

완료 기준:

1. `src/lib/templateFrameEditDtos.ts` 추가
2. geometry/html/ui adapter가 공유할 DTO 정의
3. warning code 정의

관련 diff:

1. `docs/diff/2026-04-23_21-50-12_FRAMEEDIT-02_templateFrameEditDtos.before.md`

### `FRAMEEDIT-03` Geometry Service 추가

상태: 완료

완료 기준:

1. `src/services/templateFrameEditGeometryService.ts` 추가
2. scale-aware delta 변환 함수 추가
3. snap move/resize 함수 추가
4. face adjacency validation 추가
5. merge/split/create validation 추가
6. DOM/React/DB 의존 없음

관련 diff:

1. `docs/diff/2026-04-23_21-50-12_FRAMEEDIT-03_templateFrameEditGeometryService.before.md`

### `FRAMEEDIT-04` HTML Serialization Service 추가

상태: 완료

완료 기준:

1. `src/services/templateFrameEditHtmlService.ts` 추가
2. v1.06 frame HTML parse/apply 구현
3. selection badge, resize handle, trash overlay 제거
4. normalized HTML 반환

관련 diff:

1. `docs/diff/2026-04-23_21-50-12_FRAMEEDIT-04_templateFrameEditHtmlService.before.md`

### `FRAMEEDIT-05` 병합 validation 교체

상태: 완료

완료 기준:

1. 병합 전 face-sharing connected graph 검증
2. 같은 pageNumber 검증
3. metadata conflict warning
4. 떨어진 프레임 병합 차단

관련 diff:

1. `docs/diff/2026-04-23_21-50-12_FRAMEEDIT-07_extract-page.before.tsx`
2. `docs/diff/2026-04-23_21-50-12_FRAMEEDIT-03_templateFrameEditGeometryService.before.md`

### `FRAMEEDIT-06` 인접 경계 기반 분할

상태: 완료

완료 기준:

1. split candidate가 인접 프레임 경계에서만 생성
2. 후보가 없으면 midpoint fallback 금지
3. 세로/가로 분할 버튼 validation 반영
4. 분할 후 metadata warning 표시

관련 diff:

1. `docs/diff/2026-04-23_21-50-12_FRAMEEDIT-07_extract-page.before.tsx`
2. `docs/diff/2026-04-23_21-50-12_FRAMEEDIT-03_templateFrameEditGeometryService.before.md`

### `FRAMEEDIT-07` 생성/삭제 UI 추가

상태: 완료

완료 기준:

1. 생성 모드 토글 추가
2. drag ghost rect 추가
3. 생성 rect snap 지원
4. metadata 입력 폼 추가
5. 선택 프레임 쓰레기통 아이콘 추가
6. 삭제 후 parent warning 표시

관련 diff:

1. `docs/diff/2026-04-23_21-50-12_FRAMEEDIT-07_extract-page.before.tsx`

### `FRAMEEDIT-08` key/value 체인 입력 보강

상태: 완료

완료 기준:

1. `Chain Key` 입력 추가
2. `Chain Depth` 입력 추가
3. `Parent Frame Group` validation 표시
4. 기존 `Value Key`, `Frame Role` 적용 흐름 유지

관련 diff:

1. `docs/diff/2026-04-23_21-50-12_FRAMEEDIT-07_extract-page.before.tsx`

### `FRAMEEDIT-09` Frame Editor API Adapter

상태: 선택 대기

완료 기준:

1. 사용자 확정 시 `src/app/api/templates/frame-editor/route.ts` 추가
2. HTML + operation 입력을 받아 HTML + warnings 반환
3. templates DB 직접 수정 없음

관련 diff:

1. `docs/diff/YYYY-MM-DD_FRAMEEDIT-09_template-frame-editor-route.before.md`

### `FRAMEEDIT-10` 저장/재조회 검증

상태: 부분 완료

완료 기준:

1. 정식 템플릿 저장 후 같은 templateId 재조회
2. 프레임 개수 유지 확인
3. rect metadata 유지 확인
4. UI-only node가 저장 HTML에 남지 않는지 확인

관련 diff:

1. `docs/diff/2026-04-23_21-50-12_FRAMEEDIT-10_frameEdit.before.md`

비고:

1. UI-only node 제거 로직은 `TemplateFrameEditHtmlService.stripEditorUiState()`로 구현했다.
2. 실제 저장/재조회 브라우저 검증은 현재 sandbox의 localhost 접속 차단과 Chrome MCP navigation 미노출로 완료하지 못했다.

### `FRAMEEDIT-11` MCP 테스트

상태: 차단 일부 기록

완료 기준:

1. chrome-devtools MCP로 페이지 로드 및 조작 확인
2. supabase MCP로 정식 템플릿 row read-only 확인
3. DB 수정이 있으면 SQL만 제공
4. 결과를 이 문서 하단에 기록

관련 diff:

1. 구현 파일별 diff와 동일 체크리스트 ID에 연결

---

## 후속 구현 테스트 계획

### Chrome DevTools MCP 테스트

후속 구현 후 아래 절차를 실행한다.

1. `http://localhost:4000/templates/extract`를 연다.
2. `등록된 정식 템플릿`에서 `b8c38c7c-8637-4af8-ab6d-1d7a1e88a0be`를 선택한다.
3. `정식 템플릿 불러오기`를 클릭한다.
4. `문서 미리보기`에서 `추출된 템플릿 초안`이 표시되는지 확인한다.
5. 프레임 하나를 선택한다.
6. 프레임을 드래그해 인접 경계에 snap되는지 확인한다.
7. 프레임 리사이즈 핸들을 드래그해 인접 경계에 snap되는지 확인한다.
8. 면을 공유하는 프레임 2개 이상을 선택하고 병합한다.
9. 면을 공유하지 않는 프레임 2개 이상을 선택했을 때 병합이 차단되는지 확인한다.
10. 프레임 하나를 선택하고 인접 경계 기준 세로/가로 분할을 실행한다.
11. 인접 경계가 없는 경우 분할이 midpoint로 실행되지 않는지 확인한다.
12. 생성 모드를 켜고 드래그로 새 프레임을 만든다.
13. 새 프레임에 `Frame Role`, `Value Key`, `Chain Key`, `Chain Depth`, `Parent Frame Group`을 입력한다.
14. 선택 프레임의 쓰레기통 아이콘으로 삭제한다.
15. `현재 정식 템플릿 저장`을 누른다.
16. 같은 정식 템플릿을 다시 불러와 변경된 프레임이 유지되는지 확인한다.
17. console error와 failed network request가 없는지 확인한다.

### Supabase MCP 테스트

후속 구현 후 Supabase MCP가 연결되어 있으면 read-only로 아래를 확인한다.

```sql
select
  id,
  template_name,
  length(draft_html) as draft_html_length,
  updated_at
from templates.template_registry
where id = 'b8c38c7c-8637-4af8-ab6d-1d7a1e88a0be';
```

저장 후에는 아래처럼 UI-only node가 저장되지 않았는지 확인한다.

```sql
select
  id,
  draft_html like '%data-v106-resize-handle%' as has_resize_handle,
  draft_html like '%v106-frame-selection-badge%' as has_selection_badge,
  draft_html like '%data-template-frame-group%' as has_frame_group
from templates.template_registry
where id = 'b8c38c7c-8637-4af8-ab6d-1d7a1e88a0be';
```

DB 변경은 MCP로 직접 수행하지 않는다. 별도 frame edit history table이 필요하다는 요구가 생기면 SQL을 문서로 제공하고 사용자가 직접 실행한다.

### 로컬 명령 테스트

후속 구현 후 아래 명령을 실행한다.

1. `npm run lint`
2. 필요한 경우 `npx tsc --noEmit --pretty false`

단, 기존 `docs/diff/*.before.ts` 파일 때문에 전체 타입 체크가 실패할 수 있으므로, 실패 시 이번 변경 파일과 무관한 기존 diff 문법 오류인지 구분해 기록한다.

---

## 이번 문서 작성 기준 테스트 기록

### 파일/코드 확인

실행일: 2026-04-23

확인 내용:

1. `src/app/templates/extract/page.tsx`에서 정식 템플릿 로드, 저장, 프레임 편집 UI, drag/resize/snap, merge/split 기존 구현을 확인했다.
2. `src/app/api/templates/[templateId]/route.ts`에서 정식 템플릿 `GET`, `PATCH`, `DELETE` 계약을 확인했다.
3. `src/services/templateService.ts`에서 `templates.template_registry.draft_html` 저장 계약을 확인했다.
4. `src/lib/templateDtos.ts`에서 `TemplateUpdateInput.draftHtml` 계약을 확인했다.
5. `docs/frameEdit.md`는 기존에 존재하지 않았다.

### Chrome DevTools MCP

실행일: 2026-04-23

결과:

1. `mcp__chrome_devtools__.list_pages` 실행 성공
2. 현재 선택 탭은 `about:blank`
3. 이번 세션에 Chrome DevTools MCP navigation 도구가 노출되어 있지 않아 `http://localhost:4000/templates/extract`로 직접 이동하지 못했다.
4. 따라서 실제 UI 조작 검증은 후속 구현 턴에서 navigation 가능한 Chrome MCP 환경 또는 사용자가 열린 페이지를 제공한 상태에서 다시 수행해야 한다.

### Supabase MCP

실행일: 2026-04-23

결과:

1. `tool_search`로 `supabase` 관련 MCP 도구를 검색했다.
2. 현재 세션에는 Supabase 전용 MCP 도구가 노출되지 않았다.
3. Render Postgres 도구는 검색되었지만 사용자 요구는 Supabase MCP이므로 대체 실행하지 않았다.
4. 후속 구현 전 Supabase MCP 연결 가능 여부를 다시 확인해야 한다.

### localhost 확인

실행일: 2026-04-23

결과:

1. `lsof` 기준 `node` 프로세스가 `*:4000`을 listen 중인 것은 확인했다.
2. 샌드박스 정책 때문에 `curl http://127.0.0.1:4000/...` 연결은 `Operation not permitted`로 차단됐다.
3. 이 때문에 이번 문서 작성 턴에서는 `b8c38c7c-8637-4af8-ab6d-1d7a1e88a0be` 템플릿의 실제 API 응답을 확인하지 못했다.

### 2026-04-23 구현 후 로컬 검증

실행일: 2026-04-23

결과:

1. `npx tsc --noEmit --pretty false --skipLibCheck --jsx react-jsx --module esnext --moduleResolution bundler --target es2020 --lib dom,dom.iterable,es2020 --allowSyntheticDefaultImports --esModuleInterop src/app/templates/extract/page.tsx src/lib/templateFrameEditDtos.ts src/services/templateFrameEditGeometryService.ts src/services/templateFrameEditHtmlService.ts`
   - 결과: 성공
   - 범위: 이번 변경 대상 TypeScript 파일
2. `node scripts/check-no-shadow-in-app.mjs`
   - 결과: 성공
3. `npx tsc --noEmit --pretty false`
   - 결과: 실패
   - 사유: 기존 `docs/diff/2026-04-17_ENHANCE-07_templateExtractReplicaHtmlNormalizerService.before.ts` 문법 오류가 먼저 발생함
4. `npm run lint`
   - 결과: 실패
   - 사유: ESLint 9가 `eslint.config.js`를 찾지 못함
   - 비고: `APP-NOSHADOW-02` 검사는 통과함
5. Chrome DevTools MCP
   - 결과: 추가 검증 불가
   - 사유: 현재 노출 도구가 `about:blank` 탭 조회까지만 가능하고 navigation 도구가 없음
6. Supabase MCP
   - 결과: 추가 검증 불가
   - 사유: 현재 세션에 Supabase 전용 MCP 도구가 노출되지 않음

---

## 현재 상태 요약

| 체크리스트 | 상태 | 비고 |
|---|---|---|
| `FRAMEEDIT-00` | 완료 | 본 설계 문서 작성 |
| `FRAMEEDIT-01` | 완료 | 사용자 "구현 시작하세요" 확정 후 진행 |
| `FRAMEEDIT-02` | 완료 | DTO 신규 파일 추가 |
| `FRAMEEDIT-03` | 완료 | Geometry service 신규 파일 추가 |
| `FRAMEEDIT-04` | 완료 | HTML UI-state strip service 신규 파일 추가 |
| `FRAMEEDIT-05` | 완료 | face-sharing connected 병합 validation 적용 |
| `FRAMEEDIT-06` | 완료 | midpoint fallback 제거, 인접 경계 후보 없으면 차단 |
| `FRAMEEDIT-07` | 완료 | 생성 모드, ghost rect, 선택 삭제 UI 추가 |
| `FRAMEEDIT-08` | 완료 | chain key/depth 입력 추가 |
| `FRAMEEDIT-09` | 선택 대기 | API adapter는 사용자 확정 후 추가 |
| `FRAMEEDIT-10` | 부분 완료 | UI-only node 제거 구현, 실제 저장/재조회는 MCP/localhost 차단 |
| `FRAMEEDIT-11` | 차단 일부 기록 | Chrome navigation 미노출, Supabase MCP 미노출 |
