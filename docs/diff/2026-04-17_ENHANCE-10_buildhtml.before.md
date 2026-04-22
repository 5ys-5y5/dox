# BUILDHTML 설계 문서

## 문서 목적
이 문서는 `원문(PDF/DOCX) 클로닝 + key-value 추출 + value 제거 템플릿화`를 동시에 달성하기 위한 설계 문서다.

현재 목표는 아래 두 가지를 동시에 만족하는 것이다.

1. 원문 복제
- PDF든 DOCX든 사용자가 봤을 때 원문과 거의 같은 구조의 HTML을 만든다.
- 표, 제목, 문단, 목록, 구획, 위치 관계를 최대한 그대로 유지한다.
- 결과 HTML은 “원문을 HTML로 클로닝한 결과”여야 한다.

2. key-value 추출
- 문서 안의 key와 value를 동시에 이해한다.
- key와 정적 문구는 유지한다.
- value는 템플릿용 placeholder로 치환한다.
- 결과 HTML은 “원문처럼 보이되 실제 입력값은 제거된 템플릿”이어야 한다.

이 문서는 후속 구현에서 어떤 LLM이 읽어도 현재 실패 원인, 목표, 구현 단계, 테스트 절차를 이해할 수 있도록 상세하게 작성한다.

---

## 현재 실패 상태 요약
현재 구현은 목표를 달성하지 못했다.

확인된 실패 유형:

1. PDF 원문 클로닝 실패
- `작업지시서_대구침산더샵.pdf`를 올리면 결과 HTML이 원문과 유사한 배치가 아니라 “구조화된 요약본” 수준으로 변한다.
- 원문 상단 영역, 메타데이터 표, 선택 상태, 서명 영역, 번호 섹션, 첨부파일 목록이 모두 강하게 단순화된다.
- 사용자가 원하는 “스캔본 수준의 HTML 클론”과 거리가 멀다.

2. key-value 추출 실패
- 일부 필드는 누락된다.
- 일부 필드는 잘못된 key에 매핑된다.
- 동일 value가 여러 문단에 반복 placeholder로 남아 의미를 잃는다.
- value 제거 이후 문장 구조나 표 구조가 유지되지 않는다.

3. 레이아웃과 추출이 분리되지 않음
- 지금 구현은 “먼저 요약형 HTML을 만들고 그 안에서 placeholder를 넣는 방식”에 가깝다.
- 이 방식은 원문 복제와 key-value 분리를 동시에 달성할 수 없다.

4. PDF 텍스트 재배치 방식의 구조 손실
- `page.string` 만 쓰는 방식은 이미 실패했다.
- 이후 도입한 `line absolute clone` 도 텍스트 줄을 다시 HTML로 배치하는 방식이라, 표 선, 셀 경계, 체크박스, 서명칸, 병합 셀을 잃는다.
- 즉 “텍스트를 다시 그리는 clone” 은 원문 복제를 달성할 수 없다.

5. rendered page + overlay mask 방식 실패
- 원문 페이지를 이미지로 깔고 value만 마스크로 덮는 방식은 “비슷하게 보이는 화면”은 만들 수 있지만, 실제 HTML 템플릿이 아니다.
- 사용자는 템플릿 자체가 HTML로 렌더링되길 요구했다.
- 따라서 배경 이미지 clone 은 폐기한다.

결론:
- 현재 문제는 단순 정규식 튜닝 문제가 아니다.
- `평탄화 추출기`를 고치는 것이 아니라, `클로닝 엔진`과 `value 치환 엔진`을 분리하는 설계 전환이 필요하다.
- PDF 는 이미지 배경 마스킹이 아니라, `의미 구조를 보존한 실제 HTML form clone + geometry 보정` 구조로 가야 한다.

---

## 목표 정의

### 1. 최종 산출물
최종 산출물은 아래 3개다.

1. clone HTML
- 원문 구조와 최대한 유사한 HTML

2. value binding map
- clone HTML 안에서 어떤 노드가 어떤 value였는지에 대한 구조화 매핑

3. template field candidates
- 템플릿 등록에 필요한 fieldKey, fieldLabel, fieldType, layoutBlockId, confidence 등을 담은 후보 목록

### 2. 성공 기준

`작업지시서_대구침산더샵.pdf` 기준 성공 조건:

1. 상단 메타데이터 표가 원문 표 구조를 유지한다.
2. `구분`, `신규/재발급`, `CE/PM`, `발급자 서명`, `전자서명 상태`가 원문 위치 관계를 유지한다.
3. `1. 공사 내용`, `1-1. 대표수량 및 단가` 등 번호 섹션이 별도 블록으로 유지된다.
4. `첨부파일`은 목록 구조를 유지한다.
5. value만 비워지며 key/정적 문구는 그대로 남는다.
6. field candidate는 HTML의 placeholder와 정확히 일치한다.
7. 사용자는 결과 HTML만 보고 원문이 무엇인지 쉽게 알 수 있어야 한다.

DOCX 기준 성공 조건:

1. 표와 문단 구조가 유지된다.
2. value 셀만 placeholder가 된다.
3. 문단 텍스트의 정적 부분은 남는다.
4. field candidate와 placeholder가 정확히 일치한다.

---

## 실행 정책 (필수 준수)
아래 정책은 본 설계 또는 후속 수정에서 100% 준수한다. 간결하게 요약하지 않고, 실제 실행 단계에서 누락이 없도록 상세하게 기록한다.

## EXTRACTOR 기반 1차 구현 고정

### 체크리스트 ID: `EXTRACTOR-01`

- 목적:
  PDF 입력을 `digital` / `scanned` 로 먼저 판별하고, 같은 단계에서 `work_order` / `certificate` / `generic_form` family 를 고정한다.
- 이번 1차 구현에서는 `v20`을 비교 버전으로 추가하고, 기존 `v19` 의미는 변경하지 않는다.
- 판별 결과는 DB 컬럼을 늘리지 않고 clone HTML root data attribute 에 기록한다.
- 기록 항목:
  - `data-template-engine-version`
  - `data-template-source-mode`
  - `data-template-document-family`
  - `data-template-family-confidence`
  - `data-template-family-reasons`
  - `data-template-clone-builder`

### 체크리스트 ID: `EXTRACTOR-02`

- 목적:
  digital layout model 과 scanned rule model 을 공통 topology DTO 로 정규화한다.
- 이번 1차 구현의 topology 정본은 아래를 포함한다.
  - `rowBands`
  - `columnEdges`
  - `horizontalSegments`
  - `verticalSegments`
  - `textBlocks`
  - `cellCandidates`
  - `summary`
- topology summary 역시 clone HTML root data attribute 로 추적한다.
- 이번 단계는 topology 를 정본화하는 단계이며, builder 전면 교체는 다음 단계에서 수행한다.

### 체크리스트 ID: `EXTRACTOR-03`

- 목적:
  `work_order` family 를 별도 builder service 로 분리하고, digital/scanned 양쪽 모두 같은 family builder 계열로 연결한다.
- 이번 단계의 최소 구현 원칙:
  - `TemplateExtractWorkOrderBuilderService` 가 work-order family HTML 생성의 진입점이 된다.
  - digital work-order 는 layout model 을 그대로 사용한다.
  - scanned work-order 는 OCR rule model 을 synthetic layout/rawText 로 정규화한 뒤 같은 builder 계열로 연결한다.
  - `pdfService` 는 work-order family 선택 시 layout/text-recovery 구현 세부를 직접 고르지 않는다.
- 이번 단계는 work-order family 진입점을 고정하는 단계이며, topology 기반 master form 정밀화는 후속 단계에서 계속 개선한다.
- 2차 전환 원칙:
  - `v20` work-order 는 더 이상 `rawText -> parseStructuredWorkOrder -> legacy grid html` 경로를 사용하지 않는다.
  - 새 경로는 `TemplateExtractPdfTopologyModel -> TemplateExtractWorkOrderTopologyBuilderService` 로 고정한다.
  - digital/scanned 모두 같은 `pdf-work-order-topology-v20` clone id 를 사용한다.
  - OCR/text 는 form 구조를 만드는 입력이 아니라, 이미 정해진 topology cell 안에 텍스트와 value marker 를 붙이는 보조 입력으로만 쓴다.
- 3차 안정화 원칙:
  - 실제 업로드 기준으로 topology builder 의 field coverage 가 legacy work-order renderer 보다 약하면 자동으로 legacy renderer 로 복귀한다.
  - scanned work-order 에서 `textBlockCount` 또는 `cellCandidateCount` 가 0 이면 빈 topology table 을 출력하지 않고 frame fallback 으로 복귀한다.
  - `pipelineTrace.cloneBuilder` 는 family 추정값이 아니라 실제로 선택된 builder 를 기록한다.

### 0. 서비스 독립성 설계 원칙 (필수 준수)
아래 기능들은 처음부터 “하나의 서비스로 분리 가능한 단위”로 설계한다.
각 기능은 단순 내부 모듈이 아니라, 향후 별도 배포/운영/API 상품화가 가능해야 한다.

1. 각 기능은 명확한 도메인 경계, 책임, 입력, 출력, 저장소 범위를 가진다.
2. 다른 기능 구현 세부사항(DB 스키마, 내부 함수, 화면 상태)에 직접 의존하지 않고, 오직 계약된 API / 이벤트 / DTO 로만 연결한다.
3. 공통 로직이 필요해도 우선 공통 유틸이 아니라 독립 서비스로 유지 가능한지 먼저 검토한다.
4. 특정 기능이 다른 기능 없이도 테스트, 운영, 교체, 확장 가능하도록 설계한다.
5. 설계 문서에는 반드시 다음을 기능별로 분리해 작성한다.
   - 기능 목적
   - 단독 서비스로서의 가치
   - 책임 범위 / 비책임 범위
   - API 계약
   - 데이터 소유권
   - 의존 서비스
   - 분리 배포 시 필요한 최소 조건
6. 구현안이 나오면 반드시 “이 기능을 지금 당장 별도 서비스로 분리해도 성립하는가?”를 기준으로 검토하고, 성립하지 않으면 결합 지점을 먼저 제거한다.
7. 임시 편의성보다 서비스 경계 보존을 우선한다.

### 1. 모든 코드는 그 어떤 LLM이 보더라도 히스토리와 의도, 목표가 이해될 수 있도록 작성해야 한다.
1. 정의명, 주석 등을 적극 활용한다.
2. 해당 코드를 읽은 LLM은 히스토리를 몰라도 구현 상태를 이해할 수 있어야 한다.
3. 이해 불가능한 임시 분기, 임시 네이밍, 임시 fallback 남발을 금지한다.

### 2. 프론트 UI 변경 시 준수 사항
1. 현재 서비스와 동일한 UI 디자이너가 기획한 것과 같은 UI를 구현해야 한다.
2. `/src/components` 폴더는 수정하지 말고 참고만 한다.
3. 이미 사용된 UI 컴포넌트를 적극적으로 재사용한다.
4. `/app` 내부의 다른 페이지를 적극적으로 참고한다.
5. 예외가 필요하면 최소 필수 파일만 명시적으로 허용한다.

### 3. 수정 전 이해 확정 절차
1. 수정 적용 전, 현재 요청에 대한 이해 내용을 목록으로 정리한다.
2. 정리된 이해 내용에 대해 사용자와 실행하고자 하는 바가 일치하는지 확인한다.
3. 사용자가 명시적으로 `확정`하기 전에는 수정하지 않는다.

### 4. 변경 기록 및 롤백 보장
1. 코드 수정이 있는 경우, 수정 직전 파일을 반드시 `/docs/diff`에 기록한다.
2. 기록 누락은 허용하지 않는다.
3. 기록은 수정 전 전체 파일 또는 수정 구간 복구가 가능한 형태여야 한다.

### 5. 확정 범위 외 수정 금지
1. 사용자가 확정한 범위를 넘어서는 변경을 임의로 수행하지 않는다.
2. 새로운 파일 수정이 필요하면 즉시 중단하고 화이트리스트를 제안한 뒤 승인을 받는다.

### 6. 체크리스트 작성
1. 설계의 각 항목은 체크리스트 ID를 가져야 한다.
2. 실제 구현 시 diff 문서와 체크리스트 ID가 직접 연결되어야 한다.
3. 어떤 diff가 어떤 체크리스트를 수행했는지 문서만 보고 추적 가능해야 한다.

### 7. MCP 테스트 의무
1. 매 실행마다 `supabase` MCP와 `chrome-devtools` MCP로 의도대로 동작하는지 확인한다.
2. DB 스키마 변경은 MCP로 직접 반영하지 않는다.
3. DB 변경이 필요한 경우 실행용 SQL 파일을 `/docs`에 작성하고, 사용자가 직접 실행하도록 한다.
4. 테스트 수행/결과는 문서 하단 체크리스트 및 테스트 기록에 남긴다.

### 8. SQL 파일 위치 정책
1. 새로 실행할 SQL 파일은 반드시 `/docs` 폴더에 둔다.
2. `/docs/applied` 폴더는 이미 실행한 SQL을 아카이빙하는 용도로만 사용한다.
3. 실행 전 SQL을 `/docs/applied`에 두는 행위는 금지한다.
4. 후속 구현에서도 이 규칙을 절대 반복 위반하지 않는다.

---

## 수정 허용 화이트리스트 (초기 제안)
아래는 본 설계를 실제 구현할 때 예상되는 1차 수정 허용 파일이다.
이 목록 외 파일 수정이 필요하면 즉시 중단하고 사용자 승인을 받은 뒤에만 추가한다.
폴더 단위 제안은 금지한다.

1. [templateExtractPdfLayoutService.ts](/Users/gy/Documents/dev/docs/src/services/templateExtractPdfLayoutService.ts)
- PDF clone HTML 생성 전용

2. [templateExtractDocxLayoutService.ts](/Users/gy/Documents/dev/docs/src/services/templateExtractDocxLayoutService.ts)
- DOCX clone HTML 생성 전용

3. [templateExtractFileService.ts](/Users/gy/Documents/dev/docs/src/services/templateExtractFileService.ts)
- 업로드 형식 판별과 소스별 분기

4. [templateExtractPdfService.ts](/Users/gy/Documents/dev/docs/src/services/templateExtractPdfService.ts)
- PDF 원문 추출 파이프라인 연결

5. [templateExtractService.ts](/Users/gy/Documents/dev/docs/src/services/templateExtractService.ts)
- clone HTML 기반 value binding, candidate 생성, placeholder projection

6. [templateExtractDtos.ts](/Users/gy/Documents/dev/docs/src/lib/templateExtractDtos.ts)
- clone model, binding map, candidate DTO 확장

7. [page.tsx](/Users/gy/Documents/dev/docs/src/app/templates/extract/page.tsx)
- clone HTML 보기, 후보 검토, raw HTML 복사

8. [page.tsx](/Users/gy/Documents/dev/docs/src/app/templates/page.tsx)
- clone 기반 템플릿 저장 UX

9. [buildhtml.md](/Users/gy/Documents/dev/docs/docs/buildhtml.md)
- 본 설계 정본

10. [total-todo.md](/Users/gy/Documents/dev/docs/docs/total-todo.md)
- 체크리스트, diff 연계, 테스트 기록

후속 단계에서 필요할 수 있는 신규 파일 제안:

11. [templateExtractCloneService.ts](/Users/gy/Documents/dev/docs/src/services/templateExtractCloneService.ts)
- 포맷별 clone 엔진을 조정하는 상위 오케스트레이터

12. [templateExtractValueBindingService.ts](/Users/gy/Documents/dev/docs/src/services/templateExtractValueBindingService.ts)
- clone HTML 안의 value 노드 탐색과 key-value binding 전용

13. [templateExtractDomProjectionService.ts](/Users/gy/Documents/dev/docs/src/services/templateExtractDomProjectionService.ts)
- binding map을 기반으로 value를 placeholder로 치환하는 전용 서비스

---

## 기능별 독립 서비스 설계

### A. 문서 클로닝 서비스

#### 1. 기능 목적
원문 문서를 HTML로 최대한 유사하게 클로닝한다.

#### 2. 단독 서비스로서의 가치
템플릿 생성 외에도 문서 미리보기, 비교 검토, 변경 추적, PDF/DOCX HTML 렌더링 서비스로 독립 운영 가능하다.

#### 3. 책임 범위
- 입력 문서 파싱
- 구조 블록 추출
- clone HTML 생성
- clone model 생성

#### 4. 비책임 범위
- field candidate 결정
- 템플릿 승인
- DB 저장

#### 5. API 계약
- 입력:
  - `sourceType`
  - `sourceTitle`
  - `binary`
- 출력:
  - `cloneHtml`
  - `cloneModel`
  - `cloneWarnings`

#### 6. 데이터 소유권
- 원문 파싱 결과와 clone model은 이 서비스가 소유한다.
- 최종 draft 저장은 상위 템플릿 추출 서비스가 담당한다.

#### 7. 의존 서비스
- PDF raw extractor
- DOCX OOXML reader

#### 8. 분리 배포 시 필요한 최소 조건
- 파일 입력
- 포맷 판별
- cloneHtml 반환 API

### B. value binding 서비스

#### 1. 기능 목적
clone HTML 안에서 key와 value 관계를 찾고 value 영역을 바인딩한다.

#### 2. 단독 서비스로서의 가치
템플릿 생성 외에도 문서 구조 분석, 문서 비교, 자동 필드 추출 서비스로 분리 가능하다.

#### 3. 책임 범위
- value 노드 후보 탐색
- key-value 관계 판정
- binding map 생성
- field candidate seed 생성

#### 4. 비책임 범위
- clone HTML 생성
- 템플릿 저장

#### 5. API 계약
- 입력:
  - `cloneHtml`
  - `cloneModel`
  - `sourceType`
- 출력:
  - `bindingMap`
  - `fieldCandidates`

#### 6. 데이터 소유권
- bindingMap, fieldCandidates seed

#### 7. 의존 서비스
- 문서 클로닝 서비스

#### 8. 분리 배포 시 필요한 최소 조건
- cloneHtml 입력
- JSON 결과 반환

### C. placeholder projection 서비스

#### 1. 기능 목적
binding map을 기준으로 value만 제거하고 clone 구조를 유지한 draft HTML을 만든다.

#### 2. 단독 서비스로서의 가치
템플릿화, 민감정보 제거, 문서 익명화 등에 재사용 가능하다.

#### 3. 책임 범위
- value 제거
- placeholder 삽입
- 반복 value 처리
- 구조 유지 검증

#### 4. 비책임 범위
- 원문 파싱
- field 의미 추론

#### 5. API 계약
- 입력:
  - `cloneHtml`
  - `bindingMap`
  - `candidateMap`
- 출력:
  - `draftHtml`

#### 6. 데이터 소유권
- placeholder 치환 결과 HTML

#### 7. 의존 서비스
- 문서 클로닝 서비스
- value binding 서비스

#### 8. 분리 배포 시 필요한 최소 조건
- HTML 입력
- HTML 출력

### D. 템플릿 추출 오케스트레이션 서비스

#### 1. 기능 목적
업로드부터 clone, binding, projection, draft 저장, 후보 검토까지 한 흐름으로 묶는다.

#### 2. 단독 서비스로서의 가치
`템플릿 생성 API` 자체로 별도 배포 가능하다.

#### 3. 책임 범위
- 입력 형식 판별
- 서비스 호출 순서 조정
- draft/candidate 저장
- approve 시 템플릿 서비스 호출

#### 4. 비책임 범위
- 문서 파싱 세부 구현
- UI 렌더링

#### 5. API 계약
- `POST /api/templates/extract`
- `GET /api/templates/extract/:id`
- `POST /api/templates/extract/:id/approve`

#### 6. 데이터 소유권
- `template_extracts.extract_drafts`
- `template_extracts.extract_field_candidates`

#### 7. 의존 서비스
- 문서 클로닝 서비스
- value binding 서비스
- placeholder projection 서비스
- template 등록 서비스

#### 8. 분리 배포 시 필요한 최소 조건
- 업로드 API
- draft 저장소
- approve API

---

## 근본 해결 전략

### 1. 현재 방식을 버려야 하는 지점

현재 방식에서 폐기해야 하는 것:

1. PDF를 하나의 요약형 표/섹션 템플릿으로 단순화하는 접근
2. clone 구조를 만들기 전에 key-value 추론부터 하는 접근
3. 컨테이너 전체에 `data-template-value`를 달아 구조를 통째로 비우는 접근

### 2. 앞으로의 순서

반드시 아래 순서로 처리한다.

1. 원문 파싱
2. 구조 블록 모델 생성
3. clone HTML 생성
4. value node binding
5. placeholder projection
6. candidate 생성
7. draft 저장

이 순서를 뒤집지 않는다.

---

## 포맷별 구현 전략

### PDF 전략

#### 1. 1차 범위
- 텍스트 레이어가 있는 PDF만 우선 지원한다.
- 우선 대상은 `작업지시서형 PDF`다.

#### 2. 반드시 추가해야 할 정보
- 텍스트 내용
- 라인 단위 묶음
- 블록 단위 묶음
- 가능한 경우 좌표 정보

#### 3. 구현 전략
1. `PDFKit page.string`만으로는 불충분하다.
2. 다음 단계에서는 텍스트의 좌표/영역 정보를 포함하는 추출 경로가 필요하다.
3. 1차 work-order 전용 구현은 규칙 기반 구조 분해를 허용한다.
4. 2차 범용 구현은 absolute-position clone 또는 line box clone으로 확장한다.

#### 4. work-order PDF 전용 clone 규칙
1. 상단 메타 영역은 표로 유지한다.
2. 상태/서명 영역은 표 또는 그리드로 유지한다.
3. 번호 섹션은 섹션 블록으로 유지한다.
4. 첨부파일은 목록으로 유지한다.
5. footer 주의 문구는 그대로 유지한다.

### DOCX 전략

#### 1. 1차 범위
- 표 중심 문서
- 문단 중심 문서

#### 2. 구현 전략
1. `word/document.xml`에서 표/행/셀/문단/run 구조를 읽는다.
2. clone HTML은 표 구조를 그대로 유지한다.
3. 셀 안의 정적 텍스트와 value run을 구분한다.
4. value run만 placeholder로 바꾼다.

---

## value 추출 전략

### 1. key-value 추출은 clone 이후에 한다
key-value 추출은 원문 구조를 만든 뒤에 수행한다.

이유:
1. 구조를 먼저 잃으면 key-value 판정 근거가 사라진다.
2. 위치 정보와 표 관계가 value 판단에 중요하다.

### 2. value 판단 기준

1. 표 셀
- 왼쪽 셀이 key, 오른쪽 셀이 value

2. 제목 + 본문
- 제목은 key
- 뒤따르는 문단 블록은 value

3. 상태/서명 영역
- 라벨은 key
- 사람명/시각/상태는 value

4. 목록
- 섹션 제목은 key
- 목록 각 항목은 value element

### 3. value 제거 방식
1. value element 하나당 placeholder 하나를 기본으로 한다.
2. 같은 fieldKey를 같은 섹션 안 여러 문단에 반복 사용할 수 있다.
3. 단, 구조는 그대로 남겨야 한다.
4. 문단이 여러 개면 문단 수도 그대로 유지한다.
5. 목록이면 `<li>` 수를 유지한다.

---

## 왜 지금 출력이 나쁜가

현재 출력이 나쁜 이유를 구현 기준으로 정리한다.

1. clone HTML이 아직 원문 배치보다는 구조화 요약에 가깝다.
2. work-order 전용 스켈레톤도 원문의 전체 시각 구성을 충분히 복제하지 못한다.
3. `협력사승인일`처럼 빈 value는 candidate 생성과 projection이 어긋날 수 있다.
4. 장문 섹션은 원문 줄바꿈을 완전히 복구하지 못한다.
5. 현재는 “보이는 문서의 복제”보다 “템플릿 추출”에 더 치우쳐 있다.

즉, 다음 단계의 우선순위는 후보 필드 튜닝이 아니라 **clone fidelity 향상**이다.

---

## 단계별 구현 체크리스트

### BUILDHTML-01
목표:
- clone 엔진, binding 엔진, projection 엔진을 코드와 책임 기준으로 분리한다.

완료 기준:
- 서비스 파일이 역할별로 분리된다.
- 후속 LLM이 각 역할을 주석만 보고 이해할 수 있다.

### BUILDHTML-02
목표:
- `작업지시서형 PDF`에 대해 상단 메타 표, 상태 표, 번호 섹션, 첨부 목록을 원문에 가깝게 복제한다.

완료 기준:
- 현재처럼 “요약본”이 아니라 원문과 유사한 표/블록 구조가 유지된다.

### BUILDHTML-03
목표:
- value 제거 이후에도 표 구조와 문단/목록 구조가 유지된다.

완료 기준:
- placeholder 삽입 후에도 문서 뼈대가 무너지지 않는다.

### BUILDHTML-04
목표:
- 빈 value, 중복 value, 장문 value, 목록 value를 모두 처리한다.

완료 기준:
- `협력사승인일`, `첨부파일`, `특기사항`, `공사 내용`이 모두 의미 있게 남는다.

### BUILDHTML-05
목표:
- 특정 문서형 재조립이 아니라, 일반 PDF에도 적용 가능한 `geometry -> real HTML clone` 경로를 도입한다.

완료 기준:
- PDF 결과가 이미지 배경이 아니라 실제 HTML table/div 구조로 나온다.
- `line absolute clone` 이 아니라 행/열 geometry 로부터 재구성된 clone 이어야 한다.
- value 영역은 HTML 안의 `data-template-value` 로 남고, projection 단계에서 placeholder 로 비워진다.
- work-order 류가 아닌 다른 PDF도 최소한 “행/열 기반 HTML clone + value placeholder” 구조로 표시된다.

### BUILDHTML-PDF-10
목표:
- `v5`의 구조적 form clone 방식을 현재 경로의 베이스로 되돌리고, geometry 는 열 폭/병렬 섹션/값 칸 시작점 보정에만 제한적으로 사용한다.

완료 기준:
- `current` 결과가 다시 `pdf-work-order` 계열의 실제 HTML form 구조를 사용한다.
- `1-1 / 1-2`, `2 / 2-1`, `3 / 3-1`, `4 / 4-1` 같은 병렬 섹션이 좌우 배치된다.
- 메타/상태/본문은 `v5` 수준의 의미 구조를 유지하고, 위치는 geometry 힌트로 `v5`보다 더 맞는다.
- structured form parsing 이 실패한 일반 PDF만 generic `pdf-html-grid` fallback 으로 내려간다.

### BUILDHTML-PDF-11
목표:
- 버전 비교 기준을 `current` 같은 가변 이름이 아니라 고정 버전 번호로 관리한다.
- `v10` 결과를 snapshot 으로 보존하고, 활성 개발 경로는 `v11`로 이어 간다.
- `v11`은 `v10`의 form clone을 유지하면서 section table 첫 줄 inline placeholder 문제와 병렬 섹션 반복 문제를 줄인다.

완료 기준:
- `/templates/extract` 버전 선택에 `v10`, `v11`이 명시적으로 보인다.
- `v10`은 2026-04-15 시점 결과를 그대로 재생성할 수 있다.
- `v11`은 같은 PDF에서 `1. 공사 내용` 첫 줄도 line placeholder 구조를 유지한다.
- `v11`은 `1-2`, `2-1`, `3-1`, `4-1` 같은 짧은 오른쪽 섹션을 불필요하게 여러 줄로 반복하지 않는다.

### BUILDHTML-PDF-12
목표:
- `v11` form clone을 유지하면서 status actor 를 `CE/PM` 고정이 아니라 일반 role 집합으로 확장한다.
- `작업지시서_사일동 주상복합.pdf` 처럼 `CAE / CE / CAM / PM` 이 모두 존재하는 양식도 같은 경로로 처리한다.

완료 기준:
- 버전 선택에 `v12`가 명시적으로 보인다.
- `v12`는 `v11` 결과를 깨지 않고, status table 에 2개 role 이상이 동적으로 렌더링된다.
- `v12` 결과는 snapshot 으로 보존된다.

### BUILDHTML-PDF-13
목표:
- `v12` snapshot 을 보존한 상태에서 active 경로를 `v13`으로 올린다.
- `v5`의 form clone 방향을 유지하되, 병렬 섹션에서 짧은 값 칸이 실제 양식처럼 한 블록으로 유지되게 한다.

완료 기준:
- 버전 선택에 `v13`이 명시적으로 보이고 기본 선택값이 된다.
- `v12`는 비교 기준으로 그대로 재생성된다.
- `v13`의 병렬 섹션(`1-1/1-2`, `2/2-1`, `3/3-1`, `4/4-1`)은 짧은 값 칸을 `rowspan` 처리해 전체 블록 높이를 유지한다.
- active 결과의 clone id 는 `pdf-form-v13` 이다.

### BUILDHTML-PDF-14
목표:
- `v13` snapshot 을 보존한 상태에서 active 경로를 `v14`로 올린다.
- text layer 가 있는 PDF 는 `pdf-form-v14` form clone 경로를 유지한다.
- text layer 가 없는 이미지 PDF 는 실패로 끝내지 않고, 페이지 규칙선(row/column rule) 검출로 `pdf-grid-v14` HTML skeleton 을 생성한다.
- 이 단계의 승격 기준은 key-value 정밀도보다 **문서 틀 복제 유지** 다.

완료 기준:
- 버전 선택에 `v14`가 명시적으로 보이고 기본 선택값이 된다.
- `v13`은 비교 기준으로 그대로 재생성된다.
- `docs/작업지시서_대구침산더샵.pdf`, `docs/작업지시서_사일동 주상복합.pdf` 는 `pdf-form-v14` 로 생성된다.
- `docs/작업지시서_부전마산2공구.pdf` 는 더 이상 즉시 실패하지 않고 `pdf-grid-v14` HTML skeleton 을 생성한다.
- 이 경로에서도 배경 이미지 마스킹은 사용하지 않는다.

### BUILDHTML-PDF-15
목표:
- `v14` snapshot 을 보존한 상태에서 active 경로를 `v15`로 올린다.
- 이 단계의 평가는 속도가 아니라 **문서 틀 복제 품질** 만으로 한다.
- image PDF fallback 은 `grid table` 이 아니라, 실제 규칙선을 HTML line/frame element 로 그리는 `pdf-frame-v15` 로 바꾼다.

완료 기준:
- 버전 선택에 `v15`가 명시적으로 보이고 기본 선택값이 된다.
- `v14`는 비교 기준으로 그대로 재생성된다.
- `docs/작업지시서_대구침산더샵.pdf`, `docs/작업지시서_사일동 주상복합.pdf` 는 `pdf-form-v15` 로 생성된다.
- `docs/작업지시서_부전마산2공구.pdf` 는 `pdf-frame-v15` 로 생성된다.
- image PDF fallback 은 배경 이미지 없이 실제 HTML line/frame 요소로만 구성된다.

### BUILDHTML-PDF-16
목표:
- `v15` snapshot 을 보존한 상태에서 active 경로를 `v16`으로 올린다.
- `작업지시서_사일동 주상복합.pdf` 기준으로 본문 구획과 footer 분리를 원문에 더 가깝게 맞춘다.
- 이 단계의 평가는 여전히 **문서 틀 복제 품질** 이며, 속도는 승격 기준이 아니다.

완료 기준:
- 버전 선택에 `v16`이 명시적으로 보이고 기본 선택값이 된다.
- `v15`는 비교 기준으로 그대로 재생성된다.
- `1. 공사 내용` 과 `1-1. 대표수량, 단가 등` 이 섞이지 않는다.
- `7. 기타`, `8. 하도급 대금 연동에 관한 사항`, `9. 첨부파일` 이 각각 독립 section 으로 유지된다.
- 첨부파일 아래 `○ ...` 주의문은 footer table 로 분리되고 첨부 목록에 섞이지 않는다.

### BUILDHTML-PDF-17
목표:
- `v16` snapshot 을 보존한 상태에서 active 경로를 `v17`으로 올린다.
- `작업지시서_사일동 주상복합.pdf` 기준으로 메타/상태/제목/본문을 여러 표로 재조립하지 않고, 한 장의 통합 master table 로 연결한다.

완료 기준:
- 버전 선택에 `v17`이 명시적으로 보이고 기본 선택값이 된다.
- `v16`은 비교 기준으로 그대로 재생성된다.
- text-layer 작업지시서형 PDF 는 `pdf-form-v17` 로 생성된다.
- 메타/상태/제목/본문이 separate tables 묶음이 아니라 하나의 master table 안에 순서대로 배치된다.
- `사일동` 기준으로 `1 / 1-1 / 1-2 / 2 / 2-1 / ... / 9` 구획이 통합 표 안에서 원문 순서대로 남는다.

### BUILDHTML-PDF-18
목표:
- `v17` snapshot 을 보존한 상태에서 active 경로를 `v18`로 올린다.
- `작업지시서_사일동 주상복합.pdf` 기준으로 text-layer 작업지시서형 PDF 의 `top/status/meta/sign/title/body` 를 의미 기반 8열 table 이 아니라 **실제 row band 를 따르는 grid-form clone** 으로 바꾼다.
- key-value 분해보다 먼저, 실제 문서에 보이는 inline phrasing 과 행 분리를 HTML 에 그대로 남긴다.

완료 기준:
- 버전 선택에 `v18`이 명시적으로 보이고 기본 선택값이 된다.
- `v17`은 비교 기준으로 그대로 재생성된다.
- text-layer 작업지시서형 PDF 는 `pdf-form-v18` 로 생성된다.
- `사일동` 기준으로 다음 row band 가 분리된다.
  - `양식명(코드) / 문서번호`
  - `구분 / 옵션 / CAE~PM`
  - `작성자`
  - `문서번호 / 발급일 / 협력사승인일`
  - `프로젝트 / 발급자`
  - `계약 / 접수자`
  - `발급자 서명 / 접수자 서명`
  - `제목`
- body pair section 은 `left heading / left value / right heading / right value` 의 4-cell grid 로 유지된다.

### BUILDHTML-PDF-19
목표:
- `v18` snapshot 을 보존한 상태에서 active 경로를 `v19`로 올린다.
- text-layer 작업지시서형 PDF 경로는 유지하되, image PDF fallback 에 `증명서형 PDF family` 를 추가한다.
- `사업자등록증.pdf` 같은 문서는 더 이상 `pdf-frame-v15` 프레임만 그리는 fallback 이 아니라, 실제 증명서 양식 표를 닮은 `pdf-certificate-v19` 로 생성한다.

완료 기준:
- 버전 선택에 `v19`가 명시적으로 보이고 기본 선택값이 된다.
- `v18`은 비교 기준으로 그대로 재생성된다.
- image PDF 에서 OCR 텍스트를 안정적으로 얻지 못하더라도, family detector 가 `사업자등록증`류 증명서를 인식하면 표준 증명서 form clone 을 생성한다.
- `사업자등록증.pdf` 는 `pdf-certificate-v19` 로 생성된다.
- 결과 HTML 은 아래 블록을 가진다.
  - 상단 `발급번호 / 사업자등록증명 / 처리기간`
  - 본문 label-value 표
  - 공동사업자 표
  - 발급/접수/담당부서/연락처 표
  - 하단 안내문
- 이 단계는 1단계 문서 틀 복제 우선에 해당하며, 값 매칭 정확도보다 양식 구조 유사도를 우선한다.

### BUILDHTML-06
목표:
- PDF geometry clone 의 value grouping 과 candidate 추출 정확도를 일반 PDF 기준으로 높인다.

완료 기준:
- 병렬 섹션, 같은 줄 다중 value, 빈 value, 서명칸이 geometry parser 오차 없이 HTML 구조 안에 남는다.

### BUILDHTML-07
목표:
- DOCX table/paragraph clone 품질을 PDF 수준으로 끌어올린다.

완료 기준:
- DOCX 결과도 “원문처럼 보이는 HTML”이어야 한다.

### BUILDHTML-08
목표:
- `/templates/extract`에서 clone HTML과 후보 검토 UI를 사용자가 직관적으로 이해하게 만든다.

완료 기준:
- JSON 없이도 추출 결과를 검토하고 저장할 수 있다.

### BUILDHTML-09
목표:
- 테스트 corpus를 고정한다.

테스트 대상:
- `docs/작업지시서_대구침산더샵.pdf`
- `docs/[별첨 1] MEJAI 사업계획서.pdf`
- `docs/[별첨 1] MEJAI 사업계획서.docx`

완료 기준:
- 세 파일 모두 결과 HTML을 raw code 기준으로 비교 가능하다.

---

## 구현 순서 제안

### 1차 구현
1. `BUILDHTML-01`
2. `BUILDHTML-02`
3. `BUILDHTML-03`

### 2차 구현
1. `BUILDHTML-04`
2. `BUILDHTML-05`
3. `BUILDHTML-06`

### 3차 구현
1. `BUILDHTML-07`
2. `BUILDHTML-08`
3. `BUILDHTML-09`

---

## 각 단계의 diff 기록 규칙
실제 구현 시 `/docs/diff`에 아래 형식으로 남긴다.

예시:
- `2026-04-14_BUILDHTML-02_templateExtractPdfLayoutService.before.ts`
- `2026-04-14_BUILDHTML-03_templateExtractService.before.ts`
- `2026-04-14_BUILDHTML-06_templates-extract-page.before.tsx`

`total-todo.md`에는 아래를 같이 적는다.

1. 날짜
2. 체크리스트 ID
3. 목표
4. 수정 내용
5. 테스트 결과
6. Supabase MCP 결과
7. Chrome DevTools MCP 결과
8. 남은 위험

---

## MCP 테스트 기준

### 1. Supabase MCP
DB 스키마 변경이 있는 경우:
1. 직접 적용하지 않는다.
2. `/docs`에 실행용 SQL을 만든다.
3. 사용자가 직접 실행한다.
4. 이후 조회성 MCP로 상태 확인을 시도한다.

### 2. Chrome DevTools MCP
매 단계에서 아래를 확인한다.

1. `/templates/extract` 업로드 성공
2. 생성된 clone HTML 렌더링 확인
3. `생성된 HTML 코드 보기` 원문 확인
4. 승인/저장 흐름 확인

브라우저 프로필 잠금 등으로 실패하면:
1. 실패 원인을 기록한다.
2. 대체 로컬 스모크 테스트를 수행한다.
3. 그 결과도 문서에 기록한다.

---

## 현재 시점의 최종 판단
### 2026-04-17 `ENHANCE-09`

1. `v21` 에 `hybrid bitmap/text-layer` 후보를 추가했다.
2. `hybrid` 후보는 heuristic 점수가 아니라 PDF raster 와 HTML raster 배경의 page별 일치율로 판단한다.
3. `pixel similarity < 0.95` 인 `hybrid` 후보는 즉시 폐기하고 fallback 경로로 넘긴다.
4. `작업지시서_사일동 주상복합.pdf`, `사업자등록증.pdf` 는 회귀 우선 샘플로 고정한다.
5. 현재 구현은 `hybrid` 후보에 대해서만 pixel gate 를 적용하고, non-hybrid 후보는 기존 heuristic gate 를 유지한다.

현재 서비스는 아직 `원문 클로닝 기반 템플릿 생성기`가 아니다.

현재는 다음 중간 상태다.

1. PDF/DOCX에서 일부 구조를 읽는다.
2. 일부 key-value 후보를 만든다.
3. value를 placeholder로 비운다.

하지만 아직 아래는 아니다.

1. 원문과 거의 같은 HTML 클론
2. key/value가 완전히 정합적인 템플릿

따라서 후속 구현은 후보 개수 조정이나 label 튜닝보다, 반드시 `BUILDHTML-05`의 geometry 기반 real HTML clone 을 먼저 성립시켜야 한다.

이 문서는 그 구현의 기준 문서다.
