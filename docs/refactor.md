# REFACTOR 설계 문서

## 문서 목적

이 문서는 `http://localhost:4000/templates/extract` 의 `초안 생성` 기능을 리팩토링하기 위한 실행 설계서다.

현재 마지막 요청 기준 목표는 아래와 같다.

1. 아래 세 참고 코드의 정밀도와 편집 가능성 개선 방향을 `초안 생성` 기능에 반영한다.
   - `/Users/gy/Documents/dev/docs/docs/[priority1]highperform_pdf_to_html_converter_type1(mbhj).py`
   - `/Users/gy/Documents/dev/docs/docs/[priority1]highperform_pdf_to_html_converter_type2(dragon7159).py`
   - `/Users/gy/Documents/dev/docs/docs/[priority1]highperform_pdf_to_html_converter_type3(edit, checkbox)(mbhj).py`
2. PDF를 업로드했을 때 원본과 높은 시각 유사도를 가지는 HTML 초안을 만든다.
3. 결과 HTML은 단순 요약본, 임의 재조립 양식, 기존 폐기 코드의 연장선이 아니어야 한다.
4. `초안 생성` 외의 기능은 유지한다.
5. 유지 대상 기능은 최근 초안 열기, 버전 선택, 초안 조회, 초안 승인, 로그 저장, 시각 유사도 측정, 측정 로그, 기존 버전 재현성이다.
6. 후속 구현자는 이 문서만 읽어도 수정 범위, 금지사항, 서비스 경계, 테스트 기준, 롤백 기준을 이해할 수 있어야 한다.

이 문서는 구현 문서이며 단순 아이디어 문서가 아니다. 후속 LLM 또는 개발자는 이 문서의 체크리스트와 화이트리스트를 기준으로만 구현해야 한다.

---

## 현재 요청 이해 내용

수정 전 이해 확정 절차를 위해 현재 요청을 아래처럼 이해한다.

1. 지금 당장 생성할 산출물은 `/Users/gy/Documents/dev/docs/docs/refactor.md` 하나다.
2. 실제 코드 리팩토링은 이 문서 작성 이후 별도 확정 절차를 거쳐 진행한다.
3. 리팩토링 대상은 `/templates/extract` 의 `초안 생성` 경로다.
4. `초안 생성` 경로는 PDF 업로드 후 HTML 초안과 필드 후보를 만드는 경로를 의미한다.
5. 기존 버전 선택 기능은 삭제하지 않는다.
6. 기존 `v5`부터 `v31`까지의 의미는 유지한다.
7. 새 구현은 기존 버전을 덮어쓰지 않고 새 버전으로 추가하는 것을 기본 원칙으로 한다.
8. 기존 최근 초안 열기 기능은 유지한다.
9. 기존 시각 유사도 측정 기능은 유지하되, 새 버전 검증에 반드시 사용한다.
10. 기존 초안 승인 및 템플릿 저장 흐름은 유지한다.
11. `/src/components` 폴더는 수정하지 않는다.
12. 프론트 변경이 필요한 경우 `src/app/templates/extract/page.tsx` 안에서 기존 UI 컴포넌트 사용 패턴을 유지한다.
13. DB 스키마 변경은 이번 설계의 기본 범위에 포함하지 않는다.
14. DB 스키마 변경이 필요해지는 순간 구현을 중단하고 SQL 문서와 사용자 승인을 별도로 받아야 한다.
15. 후속 코드 수정 전에는 이 이해 내용 또는 구현 범위를 사용자가 명시적으로 확정해야 한다.

---

## 현재 코드 판정

### 현재 초안 생성 흐름

현재 PDF 업로드 흐름은 아래 파일을 통과한다.

1. `src/app/templates/extract/page.tsx`
2. `src/app/api/templates/extract/route.ts`
3. `src/services/templateExtractVersionService.ts`
4. `src/services/templateExtractPdfService.ts`
5. `src/services/templateExtractService.ts`
6. `src/services/templateExtractCloneService.ts`
7. `src/services/templateExtractDomProjectionService.ts`
8. `src/services/templateExtractValueBindingService.ts`

현재 프론트 기본 버전은 `src/app/templates/extract/page.tsx` 에서 `19`로 고정되어 있다.

현재 DTO는 `src/lib/templateExtractDtos.ts` 에서 `TemplateExtractEngineVersion` 을 `5`부터 `31`까지 열거한다.

현재 버전 라우팅은 `TemplateExtractVersionService.resolveUploadSource()` 가 담당한다.

현재 최신 PDF 구현은 `TemplateExtractPdfService.extractPdfSource(..., '31')` 로 진입하며, `v31` 은 `buildPositionedCloneHtml()` 기반의 frame/text layer HTML을 만든다.

### 현재 구조적 한계

1. `TemplateExtractPdfService.ts` 가 버전 오케스트레이션, PDF layout 추출, fallback, trace 부착, quality report 생성을 모두 한 파일 안에 많이 보유한다.
2. `v31` 은 `PDFKit` layout, rule model, mask vector를 사용하지만 최종 목표가 세 참고 코드의 raster-first table/block detection 과 다르다.
3. `v31` 은 원문 이미지 전체를 쓰지는 않지만, 선과 텍스트를 다시 조합하는 경향이 강하다.
4. 참고 코드 세트는 `render_page_raster -> word extraction -> segment detection -> table reconstruction -> residual block crop -> div/grid renderer` 순서인데, 현재 TypeScript 경로는 이 파이프라인이 없다.
5. `TemplateExtractCloneService.analyzeSource()` 는 HTML에 `data-template-value` 가 충분히 없으면 생성 초안이 후보 추출과 약하게 결합된다.
6. 현재 `sourceContent` 와 `generatedDraftHtml` 의 역할이 혼재되어 있다. 시각 유사도 측정은 `sourceContent` 를 측정하지만, 사용자가 보는 초안 HTML은 `generatedDraftHtml` 이다.
7. `generatedDraftHtml` 이 source clone 과 달라지는 순간, 사용자는 측정된 output 과 실제 초안이 다를 수 있다.
8. 기존 기능이 많기 때문에 `초안 생성` 개선을 이유로 최근 초안, 버전, 측정, 승인 흐름을 직접 건드리면 회귀 위험이 크다.

---

## 참고 코드 세트 분석

후속 구현의 참고 코드는 아래 세 파일로 고정한다.

1. `/Users/gy/Documents/dev/docs/docs/[priority1]highperform_pdf_to_html_converter_type1(mbhj).py`
   - 역할: raster-first table/block crop 기반 고정밀 HTML 생성 기준
   - 핵심: `RectBox`, `Word`, `Segment`, `TableBlock`, `RasterBlock`, `TextLine`, `PageModel`
   - 후속 구현 반영점: 원문 시각 유사도 확보를 위한 table crop, residual block crop, hidden semantic line 구조

2. `/Users/gy/Documents/dev/docs/docs/[priority1]highperform_pdf_to_html_converter_type2(dragon7159).py`
   - 역할: vector/raster segment 혼합 table reconstruction 참고
   - 핵심: `Segment`, `WordBox`, `Cell`, `TableBlock`, `TextBlock`, `PageLayout`
   - 후속 구현 반영점: digital/scan page classification, vector segment 우선 추출, raster segment fallback, OCR crop rescue

3. `/Users/gy/Documents/dev/docs/docs/[priority1]highperform_pdf_to_html_converter_type3(edit, checkbox)(mbhj).py`
   - 역할: editable div/grid HTML, checkbox reconstruction, OCR rescue 참고
   - 핵심: `ChoiceMark`, `InlineFragment`, `RichLine`, `Cell`, `Table`, `TextBlock`, `PageModel`
   - 후속 구현 반영점: `contenteditable` 기반 텍스트 편집 가능성, checkbox/choice mark 복원, table/text block의 rich line renderer

핵심 모델은 아래와 같다.

1. `RectBox`
2. `Word`
3. `Segment`
4. `TableCell`
5. `TableBlock`
6. `RasterBlock`
7. `TextLine`
8. `PageModel`
9. `AssetStore`

세 참고 코드에서 공통으로 가져올 핵심 처리 순서는 아래와 같다.

1. `render_page_raster()`
   PDF 페이지를 `PyMuPDF` 로 rasterize 하고 grayscale/binary mask를 만든다.

2. `extract_words()`
   PDF text layer 가 충분하면 `page.get_text("words")` 를 사용하고, 부족하면 `pytesseract.image_to_data()` OCR을 사용한다.

3. `detect_segments()`
   OpenCV morphology 로 horizontal/vertical line mask를 만들고 선분을 추출한다.

4. `build_tables()`
   선분 connected component, boundary map, cell discovery 로 표 구조를 복원한다.

5. `detect_residual_blocks()`
   표에 속하지 않는 잔여 ink 영역을 raster block 으로 묶는다.

6. `build_text_lines()`
   표 바깥 텍스트를 hidden semantic line 으로 남긴다.

7. `render_table()`
   table crop을 visual surface 로 쓰면서 내부에는 `display:grid` 기반 cell overlay 를 둔다.

8. `render_raster_block()`
   잔여 block crop을 absolute div로 배치한다.

9. `render_text_line()`
   검색/선택 가능한 semantic line 을 투명 텍스트로 남긴다.

10. `render_document()`
   페이지를 `section.page` 으로 렌더하고, 전체 문서를 HTML로 출력한다.

이 참고 코드 세트의 장점은 아래와 같다.

1. 원문에 가까운 시각 유사도를 얻기 위해 표/블록 단위 crop을 사용한다.
2. full-page background image 하나에 의존하지 않는다.
3. 표는 crop visual layer 와 grid semantic layer 를 동시에 가진다.
4. OCR/PDF text layer 차이를 `extract_words()` 에서 흡수한다.
5. 스캔형과 디지털 문서를 같은 raster-first page model 로 통합할 수 있다.
6. `type2` 는 vector segment 와 raster segment 를 함께 사용해 표 복원 안정성을 높인다.
7. `type3` 는 checkbox, editable text, rich line rendering 을 제공해 초안 편집 가능성까지 확장한다.

이 참고 코드 세트의 한계는 아래와 같다.

1. 표/블록 crop은 편집 가능한 순수 HTML 텍스트가 아니다.
2. 현재 참고 코드 세트는 앱의 `data-template-value` 기반 value placeholder projection 계약과 직접 연결되어 있지 않다.
3. 외부 asset mode를 그대로 쓰면 DB에 저장된 HTML에서 이미지 경로가 깨질 수 있다.
4. Python runtime, `PyMuPDF`, `OpenCV`, `Tesseract`, 한국어 OCR pack 의 운영 조건이 필요하다.
5. 참고 코드를 그대로 붙이면 서비스 경계와 기존 버전 체계를 깨기 쉽다.

따라서 후속 구현은 세 Python 참고 코드를 그대로 복사하는 것이 아니라, 공통 파이프라인을 독립 서비스 계약으로 감싸고 기존 앱에는 DTO/API 경계로 연결해야 한다.

---

## 리팩토링 목표

### 최종 목표

`초안 생성`은 PDF에서 값을 추출한 뒤 원본과 매우 유사한 HTML 초안을 만든다.

새 초안은 아래 조건을 만족해야 한다.

1. `data-template-extract-draft="true"` 를 유지한다.
2. `data-template-clone="pdf-raster-first-v2.01"` 같은 명시적 clone id를 가진다.
3. 페이지 크기, 주요 표 위치, 잔여 블록 위치, 텍스트 앵커 위치가 원본과 일치해야 한다.
4. full-page background image 하나로 전체 페이지를 덮지 않는다.
5. 표와 잔여 영역 crop은 허용하되, 반드시 semantic grid/text layer 와 짝을 이룬다.
6. value 후보는 `data-template-value` 또는 명시적 value-binding DTO 로 추적 가능해야 한다.
7. `generatedDraftHtml` 과 시각 유사도 측정 대상 `sourceContent` 의 차이를 최소화한다.
8. 시각 유사도 목표는 우선 `0.95` 이상이다.
9. `0.95` 미만이면 기본 경로 승격 금지다.
10. 기존 버전은 비교 및 롤백을 위해 보존한다.

### 비목표

아래는 이번 리팩토링의 목표가 아니다.

1. `/src/components` 디자인 시스템 수정
2. DB 스키마 변경
3. 기존 `v5`부터 `v31`의 의미 변경
4. 시각 유사도 측정 기능의 전면 재작성
5. 최근 초안 저장 방식 변경
6. 승인 후 템플릿 저장 스키마 변경
7. 참고 Python 코드 자체를 수정하는 것
8. full-page image viewer 를 최종 산출물로 채택하는 것

---

## 실행 정책

아래 정책은 본 설계와 후속 수정에서 100% 준수한다.

### 0. 서비스 독립성 설계 원칙

아래 기능들은 처음부터 하나의 서비스로 분리 가능한 단위로 설계한다.

1. `초안 생성 오케스트레이터`
2. `PDF raster-first replica engine`
3. `value binding projection`
4. `버전 registry`
5. `초안 저장소`
6. `시각 유사도 측정`
7. `최근 초안 클라이언트 상태`
8. `초안 승인 및 템플릿 생성`

각 기능은 단순 내부 모듈이 아니라 향후 별도 배포, 별도 운영, 별도 API 상품화가 가능해야 한다.

필수 원칙은 아래와 같다.

1. 각 기능은 명확한 도메인 경계, 책임, 입력, 출력, 저장소 범위를 가진다.
2. 다른 기능 구현 세부사항, DB 스키마, 내부 함수, 화면 상태에 직접 의존하지 않는다.
3. 기능 간 연결은 계약된 API, 이벤트, DTO 로만 수행한다.
4. 공통 로직이 필요해도 먼저 독립 서비스로 유지 가능한지 검토한다.
5. 특정 기능이 다른 기능 없이도 테스트, 운영, 교체, 확장 가능해야 한다.
6. 구현안이 나오면 반드시 `이 기능을 지금 당장 별도 서비스로 분리해도 성립하는가?` 를 기준으로 검토한다.
7. 성립하지 않으면 코드 작성보다 결합 지점 제거가 우선이다.
8. 임시 편의성보다 서비스 경계 보존을 우선한다.

### 1. 코드 이해 가능성

1. 모든 신규 정의명은 히스토리를 몰라도 의도를 알 수 있어야 한다.
2. 임시 이름, 모호한 fallback 이름, 버전 의미가 드러나지 않는 이름은 금지한다.
3. 새 서비스에는 책임 경계를 설명하는 짧은 주석을 둔다.
4. 주석은 코드가 자명하지 않은 지점에만 둔다.
5. `best`, `new`, `temp`, `final`, `fix2` 같은 이름은 금지한다.
6. 버전 이름은 고정 숫자와 clone id로만 표현한다.

### 2. 프론트 UI 변경 정책

1. UI 변경은 필요 최소로 제한한다.
2. `/src/components` 폴더는 수정하지 않는다.
3. 기존 `Button`, `Card`, `Input`, `EntityPicker`, `Badge` 등 사용 패턴을 유지한다.
4. `/app` 의 다른 페이지와 같은 spacing, card, badge, text tone 을 유지한다.
5. 새 UI 컴포넌트 파일은 만들지 않는다.
6. 버전 기본값 변경이 필요하면 `src/app/templates/extract/page.tsx` 안에서만 처리한다.
7. 최근 초안 UI, 승인 UI, 측정 UI의 위치와 행동은 유지한다.

### 3. 수정 전 이해 확정 절차

1. 코드 수정 전 현재 구현 범위를 목록으로 정리한다.
2. 수정할 파일을 파일 단위로 제시한다.
3. 각 파일의 수정 목적을 제시한다.
4. 사용자가 명시적으로 확정하기 전에는 코드 수정하지 않는다.
5. 확정 후에도 화이트리스트 외 파일 수정이 필요하면 즉시 중단한다.
6. 추가 파일이 필요하면 새 화이트리스트를 제안하고 승인을 받은 뒤 진행한다.

### 4. 변경 기록 및 롤백 보장

1. 코드 수정 직전의 파일은 반드시 `/docs/diff` 에 기록한다.
2. 기록 누락은 치명적 오류로 간주한다.
3. 기록 파일명에는 날짜, 체크리스트 ID, 원본 파일명을 포함한다.
4. 기록 대상은 전체 파일을 기본으로 한다.
5. 새 파일 추가의 경우에도 `파일 없음` 상태를 기록하는 `.before.md` 를 남긴다.
6. diff 문서에는 관련 체크리스트 ID를 반드시 적는다.
7. 롤백은 diff 파일만 보고도 가능해야 한다.

### 5. 확정 범위 외 수정 금지

1. 사용자가 확정한 범위 밖 수정은 금지한다.
2. 인코딩 변경, 포맷팅 일괄 변경, unrelated lint 수정은 금지한다.
3. 서비스 파괴 위험이 있으므로 `git reset --hard`, `git checkout --` 는 금지한다.
4. 이미 dirty worktree 인 상태를 전제로 작업한다.
5. 다른 사람이 만든 기존 변경은 되돌리지 않는다.

### 6. 체크리스트 작성 정책

1. 모든 구현 항목은 체크리스트 ID를 가진다.
2. 체크리스트 ID는 diff 문서와 직접 연결한다.
3. 구현 완료 여부를 문서 하단에 갱신한다.
4. 체크리스트 없이 코드 변경하지 않는다.
5. 체크리스트 완료 기준은 테스트 결과까지 포함한다.

### 7. MCP 테스트 의무

1. 후속 코드 실행마다 `supabase` MCP와 `chrome-devtools` MCP 확인을 수행한다.
2. `supabase` MCP가 세션에 노출되지 않으면 즉시 기록하고 사용자에게 연결 필요성을 알린다.
3. DB 스키마 수정은 MCP로 직접 수행하지 않는다.
4. DB 수정이 필요한 경우 SQL 파일을 `/docs` 에 작성하고 사용자가 직접 실행하도록 한다.
5. DB 스키마 변경 없는 일반 초안 생성 검증은 앱 동작으로 생성된 row를 조회하는 수준에 한정한다.
6. `chrome-devtools` MCP는 `/templates/extract` 화면 로드, 버전 선택, 업로드, 초안 생성, 측정 UI 유지 여부 확인에 사용한다.
7. MCP 테스트 수행 여부와 결과는 문서 하단 테스트 기록에 남긴다.

---

## 서비스별 독립성 설계

### 1. 초안 생성 오케스트레이터

기능 목적:

PDF, HTML, text 업로드 입력을 받아 초안 생성 서비스에 전달하고, 결과를 기존 `TemplateExtractDetailResult` 로 반환한다.

단독 서비스로서의 가치:

문서 변환 엔진이 Python, Swift, 외부 API 중 무엇이든 상관없이 동일한 초안 생성 API를 제공할 수 있다.

책임 범위:

1. 입력 파일 검증
2. engineVersion 선택
3. 변환 엔진 호출
4. 변환 결과를 `TemplateExtractResolvedSource` 로 정규화
5. 기존 저장 서비스 호출

비책임 범위:

1. PDF raster 분석 세부 구현
2. value 후보 판단 세부 구현
3. DB table 직접 변경
4. 프론트 상태 관리
5. 시각 유사도 계산

API 계약:

```ts
type ResolveUploadSource = (
  fileName: string,
  mimeType: string,
  bytes: Uint8Array,
  version: TemplateExtractEngineVersion
) => Promise<TemplateExtractResolvedSource>;
```

데이터 소유권:

오케스트레이터는 데이터를 소유하지 않는다. 요청 단위 transient data만 가진다.

의존 서비스:

1. `TemplateExtractVersionService`
2. `TemplateExtractPdfRasterFirstReplicaService`
3. `TemplateExtractFileService`
4. `TemplateExtractService`

분리 배포 시 필요한 최소 조건:

HTTP API 또는 queue worker 로 `ResolveUploadSource` 계약을 제공하고, 저장소 접근은 상위 앱에 위임한다.

### 2. PDF raster-first replica engine

기능 목적:

세 참고 Python 코드처럼 PDF를 raster-first로 분석해 page-faithful HTML과 semantic model을 생성한다.

단독 서비스로서의 가치:

이 기능은 독립적으로 PDF-to-HTML 변환 API 상품이 될 수 있다. 앱 DB나 프론트 없이도 입력 PDF와 옵션만 있으면 HTML을 반환할 수 있다.

책임 범위:

1. PDF 페이지 rasterize
2. PDF text layer 또는 OCR word 추출
3. OpenCV 기반 line segment 추출
4. table block reconstruction
5. residual raster block detection
6. text line semantic overlay 생성
7. HTML 렌더링
8. trace 및 diagnostics 생성

비책임 범위:

1. Supabase 저장
2. 템플릿 승인
3. 최근 초안 저장
4. 프론트 UI
5. 기존 `v5`부터 `v31` 구현 변경

API 계약:

```ts
type RasterFirstReplicaRequestDto = {
  fileName: string;
  pdfBytesBase64: string;
  engineVersion: '32';
  scale: number;
  rasterScale: number;
  ocrLang: string;
  assetMode: 'embed';
};

type RasterFirstReplicaResponseDto = {
  sourceTitle: string;
  html: string;
  pageCount: number;
  modelSummary: {
    tableCount: number;
    rasterBlockCount: number;
    textLineCount: number;
    wordCount: number;
    horizontalSegmentCount: number;
    verticalSegmentCount: number;
  };
  diagnostics: {
    fallbackApplied: boolean;
    fallbackReason: string | null;
    dependencyWarnings: string[];
  };
};
```

데이터 소유권:

엔진은 원본 PDF, crop asset, page model 을 요청 단위 임시 데이터로만 소유한다. 기본 구현에서는 `assetMode='embed'` 로 HTML 안에 data URL을 포함하고 별도 영구 저장소를 소유하지 않는다.

의존 서비스:

1. Python 3 runtime
2. `PyMuPDF`
3. `opencv-python`
4. `numpy`
5. `pytesseract`
6. system `tesseract`
7. Korean/English OCR language pack

분리 배포 시 필요한 최소 조건:

Docker image 또는 worker runtime 에 Python dependencies, Tesseract, `kor+eng` language data를 설치하고 `POST /pdf/raster-first-replica` API를 제공한다.

### 3. value binding projection

기능 목적:

replica HTML 또는 replica model 에서 label/value 후보를 찾고, layout을 깨지 않는 placeholder를 생성한다.

단독 서비스로서의 가치:

문서 변환 엔진과 별개로 HTML/DOM/model 입력을 받아 템플릿 필드 후보를 생성하는 API 상품이 될 수 있다.

책임 범위:

1. `data-template-value` marker 해석
2. table cell label/value 관계 판단
3. known label rule 적용
4. candidate DTO 생성
5. placeholder HTML projection
6. source clone layout 보존

비책임 범위:

1. PDF parsing
2. OCR
3. 시각 유사도 측정
4. DB 저장
5. UI 상태

API 계약:

```ts
type ProjectReplicaToDraft = (
  sourceHtml: string,
  options: {
    preserveReplicaLayout: true;
    sourceCloneId: string;
  }
) => TemplateExtractProjectionResult;
```

데이터 소유권:

projection service는 candidate seed와 generatedDraftHtml만 생성한다. 저장 권한은 없다.

의존 서비스:

1. `TemplateExtractValueBindingService`
2. `TemplateExtractDomProjectionService`

분리 배포 시 필요한 최소 조건:

HTML string 또는 structured model 을 입력으로 받고 `TemplateExtractProjectionResult` JSON을 반환하는 API를 제공한다.

### 4. 버전 registry

기능 목적:

사용자가 선택한 engineVersion 을 안정적으로 특정 변환 경로에 매핑한다.

단독 서비스로서의 가치:

버전별 변환 결과 재현성과 A/B 테스트를 보장하는 registry 서비스가 될 수 있다.

책임 범위:

1. engineVersion normalize
2. version option 목록 제공
3. PDF/non-PDF 라우팅
4. 새 버전 `32` 등록

비책임 범위:

1. 변환 알고리즘 구현
2. DB 저장
3. UI layout 변경

API 계약:

```ts
type NormalizeVersion = (value: unknown) => TemplateExtractEngineVersion;
type ResolveUploadSource = (
  fileName: string,
  mimeType: string,
  bytes: Uint8Array,
  version: TemplateExtractEngineVersion
) => Promise<TemplateExtractResolvedSource>;
```

데이터 소유권:

버전 registry는 영구 데이터를 소유하지 않는다.

의존 서비스:

1. `TemplateExtractFileService`
2. `TemplateExtractPdfService`
3. `TemplateExtractPdfRasterFirstReplicaService`

분리 배포 시 필요한 최소 조건:

버전 목록과 라우팅 설정을 config 또는 API로 제공한다.

### 5. 초안 저장소

기능 목적:

생성된 초안과 후보 필드를 `template_extracts` schema 에 저장하고 조회한다.

단독 서비스로서의 가치:

변환 엔진과 분리된 draft lifecycle API로 운영할 수 있다.

책임 범위:

1. `extract_drafts` insert/select/update
2. `extract_field_candidates` insert/select
3. 승인 시 `TemplateService` 계약 호출
4. `TemplateExtractDetailResult` 조립

비책임 범위:

1. PDF 변환
2. 시각 유사도 측정
3. 브라우저 UI
4. engineVersion 라우팅

API 계약:

```ts
type CreateDraftFromResolvedSource = (
  resolvedSource: TemplateExtractResolvedSource,
  similarTemplateIds: string[]
) => Promise<TemplateExtractDetailResult>;
```

데이터 소유권:

1. `template_extracts.extract_drafts`
2. `template_extracts.extract_field_candidates`

의존 서비스:

1. Supabase service role client
2. `TemplateExtractCloneService`
3. `TemplateExtractValueBindingService`
4. 승인 시 `TemplateService`

분리 배포 시 필요한 최소 조건:

`template_extracts` schema 접근 권한과 draft/candidate API를 제공한다.

### 6. 시각 유사도 측정

기능 목적:

원본 PDF 렌더 이미지와 HTML 렌더 이미지를 비교해 실제 visual similarity 를 계산한다.

단독 서비스로서의 가치:

PDF-to-HTML 변환 품질 평가 API로 분리 운영할 수 있다.

책임 범위:

1. PDF page image render
2. HTML page image render
3. frame/text/combined overlap 계산
4. 측정 로그 기록
5. pass/fail report 생성

비책임 범위:

1. 초안 생성 알고리즘
2. value binding
3. DB schema 변경
4. 버전 선택 UI

API 계약:

```ts
type MeasureVisualSimilarity = {
  pdfFile: File;
  html: string;
  tolerancePx: number;
  minimumPassScore: number;
};
```

데이터 소유권:

측정 서비스는 영구 DB를 소유하지 않는다. 로그 markdown 파일은 `/docs` 에 기록된다.

의존 서비스:

1. `TemplateExtractPdfRenderService`
2. `TemplateExtractHtmlRenderService`
3. `TemplateExtractReplicaRenderService`
4. `TemplateExtractMeasurementLogService`

분리 배포 시 필요한 최소 조건:

Headless Chrome, PDF renderer, comparison runtime, artifact log storage가 필요하다.

### 7. 최근 초안 클라이언트 상태

기능 목적:

브라우저 localStorage 기반 최근 초안 목록을 유지한다.

단독 서비스로서의 가치:

작은 기능이지만 draft browsing UX를 독립적으로 제공할 수 있다.

책임 범위:

1. 최근 draft id 저장
2. 최근 draft 선택
3. detail API 호출 트리거

비책임 범위:

1. 초안 생성
2. DB 저장
3. PDF 변환
4. 시각 측정

API 계약:

```ts
type RecentDraftOption = {
  id: string;
  label: string;
  meta: string;
};
```

데이터 소유권:

브라우저 `localStorage` 의 `template-extract-recent-drafts` key.

의존 서비스:

1. `/api/templates/extract/[draftId]`

분리 배포 시 필요한 최소 조건:

draft detail API와 browser storage 접근 권한이 필요하다.

### 8. 초안 승인 및 템플릿 생성

기능 목적:

검토된 candidate 를 정식 템플릿 필드로 변환한다.

단독 서비스로서의 가치:

extract draft 와 template registry 사이의 승인 gateway 서비스가 될 수 있다.

책임 범위:

1. 승인 입력 검증
2. candidate review state 반영
3. `TemplateService` 계약으로 템플릿 생성
4. draft status update

비책임 범위:

1. PDF 변환
2. visual similarity
3. 최근 초안
4. UI component 구현

API 계약:

```ts
type ApproveDraft = (
  draftId: string,
  input: TemplateExtractApproveInput
) => Promise<TemplateExtractApproveResult>;
```

데이터 소유권:

1. `template_extracts.extract_drafts.status`
2. `template_extracts.extract_field_candidates.review_status`

의존 서비스:

1. `TemplateExtractService`
2. `TemplateService`

분리 배포 시 필요한 최소 조건:

draft storage API와 template registry API가 필요하다.

---

## 수정 허용 화이트리스트

### 이번 문서 생성 범위

이번 실행에서 수정 가능한 파일은 아래 하나뿐이다.

1. `/Users/gy/Documents/dev/docs/docs/refactor.md`
   - 목적: 본 리팩토링 설계 문서 작성
   - 허용 변경: 문서 신규 작성
   - 금지 변경: 코드 변경, 기존 문서 수정, 기존 diff 수정

### 후속 구현 1차 제안 화이트리스트

아래 목록은 실제 코드 리팩토링을 시작할 때 사용자 확정이 필요한 파일 단위 제안이다. 폴더 단위 승인은 허용하지 않는다.

1. `/Users/gy/Documents/dev/docs/src/lib/templateExtractDtos.ts`
   - 목적: `TemplateExtractEngineVersion` 에 내부 값 `32` 추가, `TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS` 에 표시 라벨 `v2.01` 추가, 기존 `v5~v31` 표시 라벨을 `v1.05~v1.31` 로 정리, raster-first trace/diagnostic DTO 최소 추가
   - 금지: 기존 DTO 의미 변경, 기존 버전 제거

2. `/Users/gy/Documents/dev/docs/src/services/templateExtractVersionService.ts`
   - 목적: `normalizeVersion()` 과 `resolveUploadSource()` 에 `32` 라우팅 추가
   - 금지: `v5`부터 `v31` 라우팅 의미 변경

3. `/Users/gy/Documents/dev/docs/src/services/templateExtractPdfService.ts`
   - 목적: `TemplateExtractPdfService.extractPdfSource()` 의 허용 버전에 내부 값 `32` 추가, `v2.01` 경로를 새 raster-first 서비스로 위임
   - 금지: 기존 `v19`부터 `v31` 구현 변경

4. `/Users/gy/Documents/dev/docs/src/services/templateExtractPdfRasterFirstReplicaService.ts`
   - 목적: 신규 TypeScript adapter service 작성, Python CLI 호출, stdout JSON 검증, `TemplateExtractResolvedSource` 조립
   - 금지: Supabase 직접 접근, 프론트 상태 접근, 기존 서비스 내부 함수 무단 호출

5. `/Users/gy/Documents/dev/docs/scripts/template-extract-raster-first-replica.py`
   - 목적: 세 참고 Python 코드의 raster-first table/block/html, vector/raster segment, checkbox/editable renderer 로직을 서비스 CLI 형태로 이식
   - 금지: 참고 코드 직접 수정, full-page background 기본 채택, 외부 assets path 기본 출력

6. `/Users/gy/Documents/dev/docs/src/services/templateExtractDomProjectionService.ts`
   - 목적: raster-first HTML 의 table/grid semantic layer 에서 `data-template-value` 또는 label/value marker를 안정적으로 placeholder projection
   - 금지: 기존 `data-template-value` projection 회귀

7. `/Users/gy/Documents/dev/docs/src/services/templateExtractCloneService.ts`
   - 목적: raster-first clone id에 대해 `sourceContent` 와 `generatedDraftHtml` 의 layout divergence 를 방지하는 분석 경로 고정
   - 금지: text/html 기존 fallback 회귀

8. `/Users/gy/Documents/dev/docs/src/app/templates/extract/page.tsx`
   - 목적: 검증 통과 후 기본 engineVersion 을 `32` 로 변경하고 version dropdown 에서 기존 UI 패턴 유지
   - 금지: 최근 초안, 승인, 측정 UI 삭제 또는 구조 변경

9. `/Users/gy/Documents/dev/docs/scripts/template-extract-terminal-measure-entry.ts`
   - 목적: 필요 시 `v2.01` 측정 로그에 raster-first diagnostics 를 더 명확히 남김
   - 금지: 기존 측정 출력 JSON 필드 제거

### 후속 구현 diff 기록 파일 제안

코드 수정 전 아래 diff 파일을 생성한다. 새 파일의 경우 `파일 없음` 상태를 기록한다.

1. `/Users/gy/Documents/dev/docs/docs/diff/2026-04-22_REFACTOR-02_templateExtractDtos.before.ts`
2. `/Users/gy/Documents/dev/docs/docs/diff/2026-04-22_REFACTOR-02_templateExtractVersionService.before.ts`
3. `/Users/gy/Documents/dev/docs/docs/diff/2026-04-22_REFACTOR-02_templateExtractPdfService.before.ts`
4. `/Users/gy/Documents/dev/docs/docs/diff/2026-04-22_REFACTOR-03_templateExtractPdfRasterFirstReplicaService.before.md`
5. `/Users/gy/Documents/dev/docs/docs/diff/2026-04-22_REFACTOR-03_template-extract-raster-first-replica.before.md`
6. `/Users/gy/Documents/dev/docs/docs/diff/2026-04-22_REFACTOR-04_templateExtractDomProjectionService.before.ts`
7. `/Users/gy/Documents/dev/docs/docs/diff/2026-04-22_REFACTOR-04_templateExtractCloneService.before.ts`
8. `/Users/gy/Documents/dev/docs/docs/diff/2026-04-22_REFACTOR-05_extract-page.before.tsx`
9. `/Users/gy/Documents/dev/docs/docs/diff/2026-04-22_REFACTOR-06_template-extract-terminal-measure-entry.before.ts`

---

## 구현 설계

### 새 버전

새 구현은 내부 값 `32`, 표시 버전 `v2.01` 로 추가한다.

이유는 아래와 같다.

1. 기존 버전 의미를 보존해야 한다.
2. 시각 유사도 측정에서 `v31` 대비 비교가 가능해야 한다.
3. 실패 시 사용자가 기존 버전을 직접 선택해 회귀를 우회할 수 있어야 한다.
4. `current` 같은 가변 이름은 재현성을 깨뜨린다.
5. 기존 `v5~v31` 은 사용자 화면에서 `v1.05~v1.31` 로 표시하고 내부 값은 그대로 유지한다.
6. `v2.n` 계열은 이번 리팩토링 계열에만 사용한다.

### 새 clone id

새 clone id는 아래로 고정한다.

```html
data-template-clone="pdf-raster-first-v2.01"
```

새 clone builder trace는 아래로 고정한다.

```ts
cloneBuilder: 'pdf_raster_first_editable_checkbox_v2_01'
```

### 신규 서비스 구조

후속 구현은 아래 구조를 따른다.

```txt
src/app/api/templates/extract/route.ts
  -> TemplateExtractVersionService.resolveUploadSource()
    -> TemplateExtractPdfService.extractPdfSource(version='32')
      -> TemplateExtractPdfRasterFirstReplicaService.extractPdfSource()
        -> scripts/template-extract-raster-first-replica.py
          -> RasterFirstReplicaResponseDto
      -> TemplateExtractResolvedSource
  -> TemplateExtractService.createDraftFromResolvedSource()
    -> TemplateExtractCloneService.analyzeSource()
      -> TemplateExtractDomProjectionService.projectCloneHtml()
```

### Python CLI 입출력

Python CLI 는 파일 경로를 직접 받아 stdout 으로 JSON을 반환한다.

```bash
python3 scripts/template-extract-raster-first-replica.py \
  --input-pdf /tmp/input.pdf \
  --engine-version 32 \
  --scale 1.28 \
  --raster-scale 2.8 \
  --ocr-lang kor+eng \
  --asset-mode embed
```

stdout JSON 예시는 아래와 같다.

```json
{
  "sourceTitle": "작업지시서_사일동 주상복합",
  "html": "<section data-template-extract-draft=\"true\" data-template-clone=\"pdf-raster-first-v2.01\">...</section>",
  "pageCount": 1,
  "modelSummary": {
    "tableCount": 4,
    "rasterBlockCount": 6,
    "textLineCount": 18,
    "wordCount": 240,
    "horizontalSegmentCount": 72,
    "verticalSegmentCount": 49
  },
  "diagnostics": {
    "fallbackApplied": false,
    "fallbackReason": null,
    "dependencyWarnings": []
  }
}
```

stderr 는 debug 로그 전용으로 사용한다. JSON 파싱 가능한 데이터는 stdout 하나만 허용한다.

### asset 정책

1. 최초 구현은 `assetMode='embed'` 만 허용한다.
2. 이유는 `extract_drafts.source_content` 가 HTML string 하나만 저장하기 때문이다.
3. 외부 asset path를 쓰면 최근 초안 조회나 DB 저장 이후 이미지가 깨질 수 있다.
4. data URL 크기가 문제가 되면 DB 스키마 변경 없이 해결하지 않는다.
5. asset 영구 저장이 필요해지는 순간 구현을 중단하고 별도 storage 설계를 사용자에게 승인받는다.

### HTML 정책

1. full-page background image는 기본 경로로 금지한다.
2. table block crop은 허용한다.
3. residual block crop은 허용한다.
4. crop visual layer는 반드시 semantic layer와 함께 생성한다.
5. table block은 `display:grid` 로 cell overlay 를 생성한다.
6. value 후보는 cell 단위 또는 line 단위 marker로 추적한다.
7. hidden text는 선택/검색 가능성을 위한 semantic layer 이며, value binding 정본으로 사용할 수 있다.
8. placeholder projection 은 layout box를 변경하지 않는다.
9. page 크기와 block 좌표는 PDF point scale 기준으로 고정한다.

### fallback 정책

`v2.01` 은 높은 유사도 목표 버전이므로 조용히 `v1.31` 로 fallback 하지 않는다.

허용 fallback 은 아래뿐이다.

1. Python dependency 누락이면 명시적 오류를 반환한다.
2. PDF가 열리지 않으면 명시적 오류를 반환한다.
3. table/block이 전혀 없으면 page-level fallback을 만들 수 있지만 `fallbackApplied=true` 를 trace에 기록한다.
4. `v2.01` 실패 시 사용자는 기존 version dropdown 에서 `v1.31` 이하를 직접 선택할 수 있다.
5. 자동 fallback 으로 나쁜 품질의 HTML을 성공처럼 저장하지 않는다.

---

## 구현 체크리스트

### `REFACTOR-00` 이해 확정

목표:

코드 수정 전 사용자와 범위가 일치하는지 확정한다.

완료 조건:

1. 수정할 파일 목록을 사용자에게 제시한다.
2. 새 버전 `v2.01` 추가 방식과 내부 값 `32` 매핑을 사용자에게 제시한다.
3. Python runtime 의존성을 사용자에게 제시한다.
4. 사용자가 명시적으로 확정한다.

관련 diff:

없음.

상태:

완료.

2026-04-22 사용자가 `docs/refactor.md 구현을 시작합시다` 라고 명시해 후속 코드 수정 범위를 확정했다.

### `REFACTOR-01` 사전 백업

목표:

수정 직전 모든 대상 파일을 `/docs/diff` 에 기록한다.

완료 조건:

1. 기존 파일은 전체 파일을 `.before` 로 기록한다.
2. 새 파일은 `파일 없음` 상태를 `.before.md` 로 기록한다.
3. 각 diff 파일에 체크리스트 ID를 적는다.

관련 diff:

후속 구현 diff 기록 파일 제안 목록 참조.

상태:

완료.

2026-04-22 코드 수정 직전 대상 파일별 `.before` 기록을 `docs/diff` 에 남겼다.

### `REFACTOR-02` 버전 및 DTO 등록

목표:

`v2.01` 을 기존 버전 체계에 추가한다.

완료 조건:

1. `TemplateExtractEngineVersion` 에 `32` 추가
2. `TEMPLATE_EXTRACT_ENGINE_VERSION_OPTIONS` 에 `v2.01` 표시 라벨 추가
3. `normalizeVersion()` 에 `32` 추가
4. `resolveUploadSource()` 에 `32` branch 추가
5. `TemplateExtractPdfService.extractPdfSource()` 에 `32` 허용
6. 기존 버전 snapshot 의미 미변경

관련 diff:

1. `2026-04-22_REFACTOR-02_templateExtractDtos.before.ts`
2. `2026-04-22_REFACTOR-02_templateExtractVersionService.before.ts`
3. `2026-04-22_REFACTOR-02_templateExtractPdfService.before.ts`

상태:

완료.

내부 값 `32`, 사용자 표시 라벨 `v2.01`, 기존 `v5~v31` 의 `v1.05~v1.31` 표시 라벨을 등록했다.

### `REFACTOR-03` raster-first engine adapter

목표:

세 참고 Python 코드의 공통 파이프라인을 서비스 가능한 CLI와 TypeScript adapter 로 연결한다.

완료 조건:

1. `scripts/template-extract-raster-first-replica.py` 추가
2. `src/services/templateExtractPdfRasterFirstReplicaService.ts` 추가
3. PDF bytes를 temp file로 안전하게 기록
4. Python CLI stdout JSON 파싱
5. stderr/debug log 보존
6. temp file cleanup 보장
7. `asset-mode embed` 강제
8. dependency error를 명확한 사용자 메시지로 반환

관련 diff:

1. `2026-04-22_REFACTOR-03_templateExtractPdfRasterFirstReplicaService.before.md`
2. `2026-04-22_REFACTOR-03_template-extract-raster-first-replica.before.md`

상태:

부분 완료.

TypeScript adapter 와 Python wrapper 는 추가했다. 현재 로컬 Python runtime 의 `cv2`, `fitz`, `numpy`, `pytesseract` 누락 때문에 실변환과 0.95 측정은 차단되어 있다.

### `REFACTOR-04` value binding projection 정합화

목표:

raster-first HTML을 요약본으로 바꾸지 않고, 원본 layout을 유지한 채 후보 필드와 placeholder를 만든다.

완료 조건:

1. raster-first clone id 감지
2. table/grid semantic cell에서 label/value pair 추출
3. `data-template-value` marker 보존 또는 생성
4. `generatedDraftHtml` 이 source layout을 유지
5. 후보 필드가 기존 `TemplateExtractCandidateDto` 로 저장
6. 기존 HTML/text fallback 회귀 없음

관련 diff:

1. `2026-04-22_REFACTOR-04_templateExtractDomProjectionService.before.ts`
2. `2026-04-22_REFACTOR-04_templateExtractCloneService.before.ts`

상태:

부분 완료.

`pdf-raster-first-v2.01` clone id를 감지하고 `.editable-text` 인접 라벨/값 후보에 `data-template-value` 를 추가한다. placeholder 치환은 하지 않아 시각 레이아웃을 보존한다. table/grid cell 전용 정밀 projection 은 후속 보강 대상이다.

### `REFACTOR-05` UI 기본값 및 유지 검증

목표:

검증 통과 후 사용자가 별도 선택 없이 새 엔진으로 초안을 만들 수 있게 한다.

완료 조건:

1. 기본 engineVersion 을 `32` 로 변경
2. 기존 version dropdown 유지
3. 최근 초안 선택 UI 유지
4. 초안 승인 UI 유지
5. 시각 유사도 측정 버튼 유지
6. `/src/components` 수정 없음

관련 diff:

1. `2026-04-22_REFACTOR-05_extract-page.before.tsx`

상태:

부분 완료.

기본 engineVersion 을 내부 값 `32` 로 변경하고 화면 표시는 `v2.01` 로 맞췄다. `chrome-devtools` MCP 검증은 기존 Chrome profile 충돌로 아직 완료하지 못했다.

### `REFACTOR-06` 터미널 측정 및 로그

목표:

새 버전을 기존 측정 체계로 반복 검증한다.

완료 조건:

1. `npm run template-extract:measure -- --file <pdf> --version v2.01 --minimumPassScore 0.95` 실행 가능
2. 측정 로그가 `/docs/*_template-extract-measurement_*.md` 에 남음
3. draft summary log가 `/docs/*_template-extract-log_*.md` 에 남음
4. `overallScore`, `frameScore`, `textScore`, `combinedScore` 를 기록
5. `0.95` 미만이면 기본값 승격 금지

관련 diff:

1. `2026-04-22_REFACTOR-06_template-extract-terminal-measure-entry.before.ts`

상태:

부분 완료.

터미널 측정 진입점은 `v2.01` 라벨을 출력하도록 갱신했고 번들링은 통과했다. 실제 측정은 Python dependency 누락으로 변환 전에 실패했다.

### `REFACTOR-07` MCP 검증

목표:

실제 브라우저와 DB 계약을 MCP로 확인한다.

완료 조건:

1. `chrome-devtools` MCP로 `/templates/extract` 화면 확인
2. `chrome-devtools` MCP로 초안 생성 후 UI 기능 유지 확인
3. `supabase` MCP로 `template_extracts.extract_drafts` 최신 row의 clone id 확인
4. DB schema 변경 없음 확인
5. MCP 결과를 문서 하단 테스트 기록에 남김

관련 diff:

없음.

상태:

차단.

`chrome-devtools` MCP는 profile 충돌로 `list_pages` 단계에서 실패했다. `supabase` 전용 MCP는 현재 세션 도구 검색에 노출되지 않았다.

---

## 테스트 계획

### 로컬 정적 검증

아래 명령을 실행한다.

```bash
npm run lint
```

실패하면 구현 범위 안에서만 수정한다. unrelated lint 오류는 별도 기록 후 중단한다.

### 터미널 시각 유사도 측정

우선 샘플은 아래 파일을 사용한다.

```txt
/Users/gy/Documents/dev/docs/docs/작업지시서_사일동 주상복합.pdf
/Users/gy/Documents/dev/docs/docs/작업지시서_대구침산더샵.pdf
/Users/gy/Documents/dev/docs/docs/작업지시서_부전마산2공구.pdf
```

명령은 아래 형식을 사용한다.

```bash
npm run template-extract:measure -- --file "/Users/gy/Documents/dev/docs/docs/작업지시서_사일동 주상복합.pdf" --version v2.01 --minimumPassScore 0.95
```

통과 기준:

1. `passed=true`
2. `overallScore >= 0.95`
3. 가능하면 `frameScore >= 0.95`
4. `sourceKind='html'`
5. `cloneBuilder='pdf_raster_first_editable_checkbox_v2_01'`
6. 로그 파일 생성

### 브라우저 검증

`chrome-devtools` MCP로 아래를 확인한다.

1. `http://localhost:4000/templates/extract` 접속
2. 페이지 렌더 오류 없음
3. version dropdown 에 `v2.01` 표시
4. 기존 버전 선택 가능
5. PDF 업로드 가능
6. 초안 생성 progress 표시
7. 초안 preview 렌더
8. 최근 초안에 생성 초안 추가
9. 최근 초안 재열기 가능
10. 시각 유사도 측정 버튼 동작
11. 로그 복사 버튼 동작
12. 승인 버튼 기존 동작 유지

### Supabase MCP 검증

DB schema 변경은 하지 않는다.

초안 생성 후 read-only 조회로 아래를 확인한다.

```sql
select
  id,
  source_title,
  source_kind,
  status,
  created_at,
  left(source_content, 200) as source_content_head,
  left(generated_draft_html, 200) as generated_draft_html_head
from template_extracts.extract_drafts
order by created_at desc
limit 1;
```

확인 기준:

1. `source_kind='html'`
2. `source_content_head` 에 `data-template-clone="pdf-raster-first-v2.01"` 포함
3. `generated_draft_html_head` 에 `data-template-extract-draft="true"` 포함
4. schema 변경 SQL 필요 없음

DB schema 변경이 필요해지는 경우:

1. 구현 중단
2. `/docs/run-this-supabase-*.sql` 작성
3. 사용자가 직접 실행
4. 실행 후 `/docs/applied` 로 이동할지 별도 승인

---

## 수용 기준

아래 조건을 모두 만족해야 새 초안 생성 경로를 기본값으로 승격할 수 있다.

1. `v2.01` 이 기존 기능을 삭제하지 않는다.
2. `v5`부터 `v31`이 그대로 선택 가능하다.
3. `npm run lint` 가 통과한다.
4. 기준 PDF 중 최소 1개 이상에서 `overallScore >= 0.95` 를 기록한다.
5. 나머지 기준 PDF에서 실패하면 실패 원인을 로그에 남기고 기본값 승격을 보류한다.
6. `/templates/extract` UI가 기존과 같은 흐름으로 동작한다.
7. 최근 초안 열기가 동작한다.
8. 초안 승인 기능이 동작한다.
9. 시각 유사도 측정 기능이 동작한다.
10. `docs/diff` 기록과 체크리스트 ID 연결이 누락되지 않는다.
11. `supabase` MCP 또는 연결 불가 기록이 남아 있다.
12. `chrome-devtools` MCP 또는 실행 불가 기록이 남아 있다.

---

## 금지 사항

1. 기존 버전 의미 변경 금지
2. 기존 버전 삭제 금지
3. `/src/components` 수정 금지
4. full-page background image를 성공 경로로 채택 금지
5. 측정 없이 기본값 `v2.01` 승격 금지
6. DB schema를 임의 변경 금지
7. diff 기록 없이 코드 수정 금지
8. 사용자 확정 없이 코드 수정 금지
9. Python dependency 누락을 조용히 fallback 처리 금지
10. `sourceContent` 는 고품질인데 `generatedDraftHtml` 은 낮은 품질인 상태를 성공으로 기록 금지
11. 시각 유사도 측정 대상과 사용자가 보는 초안이 다른 상태를 성공으로 기록 금지

---

## 현재 도구 및 테스트 기록

작성일: 2026-04-22

### 파일 조사

확인한 주요 파일:

1. `src/app/templates/extract/page.tsx`
2. `src/app/api/templates/extract/route.ts`
3. `src/app/api/templates/extract/measure/route.ts`
4. `src/services/templateExtractService.ts`
5. `src/services/templateExtractVersionService.ts`
6. `src/services/templateExtractPdfService.ts`
7. `src/services/templateExtractPdfHtmlCloneService.ts`
8. `src/services/templateExtractCloneService.ts`
9. `src/services/templateExtractDomProjectionService.ts`
10. `src/lib/templateExtractDtos.ts`
11. `scripts/template-extract-terminal-measure-entry.ts`
12. `docs/[priority1]highperform_pdf_to_html_converter_type1(mbhj).py`
13. `docs/[priority1]highperform_pdf_to_html_converter_type2(dragon7159).py`
14. `docs/[priority1]highperform_pdf_to_html_converter_type3(edit, checkbox)(mbhj).py`

### 현재 worktree 상태

현재 작업 트리에는 이미 다수의 수정 및 미추적 파일이 있다.

이번 문서 작성은 기존 변경을 되돌리지 않는다.

### MCP 가용성 확인

`chrome-devtools` MCP:

1. 도구 검색 결과 `chrome-devtools` 도구는 노출되어 있다.
2. `list_pages` 호출을 시도했다.
3. 결과는 기존 Chrome profile 이 이미 실행 중이라는 오류였다.
4. 후속 구현 검증 전에는 Chrome MCP profile 충돌을 해소해야 한다.

`supabase` MCP:

1. 도구 검색에서 `supabase` 전용 MCP는 현재 세션에 노출되지 않았다.
2. 검색 결과에는 Render Postgres, GitHub, Context7, apiNavi, Adobe Acrobat 도구만 표시됐다.
3. 후속 구현에서 사용자 요구를 100% 충족하려면 Supabase MCP 연결 여부를 먼저 확인해야 한다.
4. Supabase MCP가 계속 없으면 코드 실행 전 사용자에게 차단 사유를 알리고 진행 여부를 재확정해야 한다.

### 이번 구현 테스트

이번 작업은 `v2.01` 초안 생성 경로의 1차 구현까지 수행했다.

수행한 검증은 아래와 같다.

1. `python3 scripts/template-extract-raster-first-replica.py --help` 성공
2. `npx esbuild src/app/templates/extract/page.tsx ...` 성공
3. `npx esbuild scripts/template-extract-terminal-measure-entry.ts ...` 성공
4. `TemplateExtractDomProjectionService.projectCloneHtml()` v2.01 sample projection 성공
5. `npm run template-extract:measure -- --file "docs/작업지시서_사일동 주상복합.pdf" --version v2.01 --minimumPassScore 0.95` 실패
6. 실패 원인: 현재 `python3` 는 `/Library/Developer/CommandLineTools/usr/bin/python3` 로 해석되며 `cv2`, `fitz`, `numpy`, `pytesseract` 가 설치되어 있지 않다.
7. `npm run lint` 는 `scripts/check-no-shadow-in-app.mjs` 통과 후 ESLint 9 설정 파일 부재로 실패했다.
8. `npx tsc --noEmit` 은 기존 `docs/diff/*before.ts` 문법 오류 파일을 포함해 실패해 이번 변경만의 타입 오류 여부를 판정하지 못했다.

MCP 검증 상태는 아래와 같다.

1. `chrome-devtools` MCP `list_pages` 는 기존 Chrome profile 충돌로 실패했다.
2. `supabase` 전용 MCP는 현재 세션 도구 검색에 노출되지 않았다.
3. DB schema 변경은 없으므로 사용자가 실행해야 하는 SQL 변경문은 없다.
4. Supabase read-only 확인은 MCP 연결 후 테스트 계획의 SQL로 수행해야 한다.

---

## 진행 상태 요약

| 체크리스트 | 상태 | 비고 |
|---|---|---|
| `REFACTOR-00` | 완료 | 2026-04-22 사용자 구현 시작 지시로 범위 확정 |
| `REFACTOR-01` | 완료 | 코드 수정 직전 diff 기록 완료 |
| `REFACTOR-02` | 완료 | 내부 값 `32`, 표시 라벨 `v2.01`, 기존 라벨 `v1.05~v1.31` 등록 |
| `REFACTOR-03` | 부분 완료 | Python wrapper 및 TypeScript adapter 추가, 현재 Python dependency 누락으로 실변환 차단 |
| `REFACTOR-04` | 부분 완료 | v2.01 editable text 인접 라벨/값 후보 추출 및 `data-template-value` 속성 보강 |
| `REFACTOR-05` | 부분 완료 | UI 기본값 `v2.01` 적용, 기존 버전 선택 유지, 브라우저 MCP 검증 차단 |
| `REFACTOR-06` | 부분 완료 | 터미널 측정 진입점은 번들링 통과, Python dependency 누락으로 측정 전 변환 실패 |
| `REFACTOR-07` | 차단 | Chrome profile 충돌 및 Supabase MCP 미노출 |

### 2026-04-22 구현 기록

적용 파일:

1. `src/lib/templateExtractDtos.ts`
2. `src/services/templateExtractVersionService.ts`
3. `src/services/templateExtractPdfService.ts`
4. `src/services/templateExtractPdfRasterFirstReplicaService.ts`
5. `scripts/template-extract-raster-first-replica.py`
6. `src/app/templates/extract/page.tsx`
7. `scripts/template-extract-terminal-measure-entry.ts`
8. `src/services/templateExtractDomProjectionService.ts`

기록된 diff:

1. `docs/diff/2026-04-22_REFACTOR-02_templateExtractDtos.before.ts`
2. `docs/diff/2026-04-22_REFACTOR-02_templateExtractVersionService.before.ts`
3. `docs/diff/2026-04-22_REFACTOR-02_templateExtractPdfService.before.ts`
4. `docs/diff/2026-04-22_REFACTOR-03_templateExtractPdfRasterFirstReplicaService.before.md`
5. `docs/diff/2026-04-22_REFACTOR-03_template-extract-raster-first-replica.before.md`
6. `docs/diff/2026-04-22_REFACTOR-05_extract-page.before.tsx`
7. `docs/diff/2026-04-22_REFACTOR-06_template-extract-terminal-measure-entry.before.ts`
8. `docs/diff/2026-04-22_REFACTOR-04_templateExtractDomProjectionService.before.ts`

검증 결과:

1. `python3 scripts/template-extract-raster-first-replica.py --help` 성공
2. `npx esbuild src/app/templates/extract/page.tsx ...` 성공
3. `npx esbuild scripts/template-extract-terminal-measure-entry.ts ...` 성공
4. `TemplateExtractDomProjectionService.projectCloneHtml()` v2.01 sample projection 성공
5. `npm run template-extract:measure -- --file "docs/작업지시서_사일동 주상복합.pdf" --version v2.01 --minimumPassScore 0.95` 실패
6. 실패 원인: 현재 `python3` 는 `/Library/Developer/CommandLineTools/usr/bin/python3` 로 해석되며 `cv2`, `fitz`, `numpy`, `pytesseract` 가 설치되어 있지 않음
7. `npm run lint` 는 `scripts/check-no-shadow-in-app.mjs` 통과 후 ESLint 9 설정 파일 부재로 실패
8. `npx tsc --noEmit` 은 기존 `docs/diff/*before.ts` 문법 오류 파일을 포함해 실패하며 이번 변경만의 타입 오류 여부를 판정하지 못함
