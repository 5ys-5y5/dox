# PDF/DOCX 추출기 개선 설계 문서

## 문서 목적

이 문서는 현재 템플릿 추출기의 성능이 기대에 못 미치는 원인을 정리하고, PDF/DOCX 원문을 **실제 HTML 템플릿**으로 복제하기 위해 어떤 개선이 필요한지 구현 관점에서 고정하는 설계 문서다.

이 문서는 다음 두 참조 문서를 기준으로 작성한다.

1. [ref]deep-research-report.md  
경로: `/Users/gy/Documents/dev/docs/docs/[ref]deep-research-report.md`

2. [ref]PDF 스캔본 HTML 변환 기술 및 한계.pdf  
경로: `/Users/gy/Documents/dev/docs/docs/[ref]PDF 스캔본 HTML 변환 기술 및 한계.pdf`

첫 번째 문서는 기술 비교와 파이프라인 분기 설계의 기준 문서로 사용한다.  
두 번째 문서는 스캔본/이미지형 PDF를 HTML로 바꿀 때의 현실적 한계를 보조 근거로 사용한다.

이 문서의 목표는 단순한 “품질 개선 아이디어 모음”이 아니다. 이후 어떤 LLM이 읽더라도 다음을 명확히 이해할 수 있어야 한다.

1. 현재 구현이 왜 실패하는지
2. 무엇을 먼저 고쳐야 하는지
3. 어떤 구현은 금지해야 하는지
4. 어떤 순서로 구현해야 하는지
5. 무엇을 성공으로 볼 것인지

---

## 현재 문제 정의

현재 추출기는 버전이 여러 번 올라갔지만, 사용자 기대를 만족시키지 못했다. 문제는 개별 정규식이나 특정 PDF 한 장의 예외처리가 아니라, **추출 파이프라인의 기본 전략**이 잘못 잡힌 데 있다.

현재 문제는 크게 다섯 가지다.

### 1. “원문 복제”보다 “비슷한 양식 재조립”에 치우쳐 있다

현재 `작업지시서` 계열 text-layer PDF는 어느 정도 유사한 HTML을 만들지만, 실질적으로는 다음을 하고 있다.

1. 문서 의미를 읽는다.
2. 메타/상태/본문 섹션을 나눈다.
3. 개발자가 만든 HTML 폼 구조로 다시 그린다.

이 접근은 아래 한계를 가진다.

1. 실제 셀 병합 구조가 사라진다.
2. 실제 행 높이와 열 비율이 무너진다.
3. 병렬 섹션의 실제 폭과 위치가 달라진다.
4. 체크박스, 서명칸, 날인 위치가 틀어진다.

즉, 지금 구현은 “원문 클론”이 아니라 “의미 기반 재조립 양식”이다.

### 2. 디지털 PDF와 스캔 PDF를 충분히 다르게 다루지 못한다

참조 문서 `[ref]deep-research-report.md`의 핵심 주장 중 하나는 명확하다.

1. 디지털 PDF는 텍스트 객체, 폰트, 좌표, 벡터를 이용해야 한다.
2. 스캔 PDF는 OCR과 레이아웃 검출이 지배한다.
3. 두 경로를 분기하지 않으면 품질 상한이 낮다.

현재 구현은 이 분기 자체는 일부 존재하지만, 스캔/이미지 PDF 경로가 아직 매우 약하다.

특히 `사업자등록증.pdf` 같은 문서는:

1. text layer가 부족하거나 불안정하다.
2. OCR 신뢰도도 일정하지 않다.
3. fallback 이 generic grid 나 certificate skeleton 수준에 머문다.

결국 “실제 문서와 같은 틀”이 아니라 “증명서처럼 보이는 틀”만 만든다.

### 3. key-value 추출이 레이아웃 복제보다 앞서 있다

사용자가 반복해서 지적한 핵심은 이것이다.

1. 먼저 문서 틀을 맞춰야 한다.
2. 그 다음에 key-value를 얹어야 한다.

현재 구현은 문서 의미를 읽는 과정에서 이미 레이아웃을 새로 조립한다.  
그래서 key-value 인식이 좋아져도, 문서 자체는 계속 다르게 보인다.

### 4. 배경 이미지 마스킹 방식은 폐기 대상이다

한때 시도했던 `rendered page + overlay mask` 접근은 현재 요구사항과 맞지 않는다.

이 방식의 문제:

1. 결과물이 실제 HTML 템플릿이 아니다.
2. 후속 편집/라벨 제어/입력 UI와 결합이 어렵다.
3. 구조 의미가 HTML에 남지 않는다.
4. 접근성, 검색, 수정 가능성이 급격히 떨어진다.

사용자 요구는 “이미지 위 마스킹”이 아니라 **실제 HTML로 클로닝된 템플릿**이다.

### 5. 현재 품질 측정 기준이 불명확했다

지금까지는 주로 clone id 와 일부 HTML 확인으로 버전을 올려 왔다. 그러나 실제 성공 기준은 다음이어야 한다.

1. 사람이 원문과 결과 HTML을 비교했을 때 같은 문서라고 인식하는가
2. key 와 value 자리가 실제 문서와 일치하는가
3. value 를 제거해도 문서 틀이 무너지지 않는가
4. 문서 패밀리가 달라도 같은 파이프라인 철학으로 작동하는가

이 문서 이후부터는 위 기준으로만 추출 품질을 평가한다.

---

## 방향 고정

이 문서에서 추출기 개선 방향을 아래와 같이 고정한다.

### 최상위 원칙

1. **1단계는 문서 틀 복제다.**
2. **2단계는 key-value 매칭과 value 제거다.**
3. 1단계가 부족하면 2단계가 좋아도 활성 버전으로 승격하지 않는다.

### 절대 금지

아래 구현은 다시 기본 경로로 채택하지 않는다.

1. 페이지 배경 이미지 + mask 기반 템플릿
2. text line 을 다시 absolute positioning 해서 “비슷하게 보이게” 만드는 경로
3. 특정 문서 한 장만 맞는 하드코딩
4. 의미를 먼저 해석하고 레이아웃을 새로 조립하는 synthetic form builder

### 반드시 유지

1. 결과물은 실제 HTML이어야 한다.
2. 버전은 고정 숫자만 사용한다.
3. 문서 패밀리별로 builder 가 달라도, 상위 파이프라인 계약은 같아야 한다.
4. 문서별 예외처리가 아니라 “문서 패밀리” 단위로 분기한다.

---

## 참조 문서에서 확정할 수 있는 설계 원칙

### [ref]deep-research-report.md 에서 가져올 핵심

이 문서는 현재 문제에 대해 이미 정확한 방향을 제시한다.

핵심 요약:

1. 디지털 PDF와 스캔 PDF는 별도 파이프라인이어야 한다.
2. 고정 레이아웃 페이지 단위 HTML 설계가 기본이다.
3. 시각 재현, 구조 보존, OCR 정확도는 별도 지표로 봐야 한다.
4. 하이브리드 방식은 가능하지만, 템플릿 결과물이 실제 HTML이어야 한다면 배경 의존을 최소화해야 한다.
5. 성공 기준은 “텍스트 추출 정확도”만이 아니라 “문서 구조 보존”이어야 한다.

이 문서의 방향은 현재 서비스의 요구와 직접 맞닿는다.  
즉, 우리 구현도 다음을 강제해야 한다.

1. 입력 판별
2. 문서 패밀리 분기
3. 문서 틀 복제
4. key-value/value 제거
5. 품질 검증

### [ref]PDF 스캔본 HTML 변환 기술 및 한계.pdf 에서 가져올 핵심

로컬 도구 한계 때문에 이 PDF 전문을 현재 CLI에서 직접 추출하지는 못했지만, 참조 문서 제목과 현재 구현 문제를 조합하면 설계상 중요한 포인트는 분명하다.

스캔본 HTML 변환에서 핵심은 다음이다.

1. OCR은 필요하지만 충분조건이 아니다.
2. OCR 텍스트만으로는 실제 양식을 복원할 수 없다.
3. 선, 박스, 구획, 인쇄물의 패턴, 셀 경계, 위치 비율을 따로 읽어야 한다.
4. 스캔본은 “텍스트 의미”보다 “레이아웃 topology” 복제가 먼저다.

이 원칙은 현재 `사업자등록증.pdf` 같은 실패 사례와 정확히 맞물린다.

---

## 목표 정의

이후 추출기가 달성해야 할 목표를 두 단계로 고정한다.

## 1단계 목표: 문서 틀 복제

### 정의

업로드한 문서의 **문서 틀(텍스트 값 제외)** 을 HTML로 동일한 수준까지 끌어오는 것.

여기서 문서 틀은 다음을 포함한다.

1. 표 구조
2. 셀 병합
3. 행 높이
4. 열 너비 비율
5. 입력칸 길이와 반복 수
6. 서명/날인/이미지 위치
7. 체크박스/표시 기호 위치
8. 제목/상태/본문/주석/첨부 위치 관계

### 1단계 성공 기준

1. 원문과 결과 HTML을 나란히 보면 같은 양식으로 보인다.
2. 메타/상태/본문/하단 안내문이 실제 문서와 같은 위치 계층을 가진다.
3. 특정 값이 빠져도 틀이 유지된다.
4. 문서별 특수 케이스가 아니라 패밀리 규칙으로 동작한다.

## 2단계 목표: key-value 매칭과 value 제거

### 정의

1단계에서 확보한 HTML 틀 위에 key 와 value 를 올바르게 대응시키고, value 만 비운다.

### 2단계 성공 기준

1. key 는 그대로 보인다.
2. value 는 실제 입력 위치에 placeholder 로 바뀐다.
3. placeholder 는 원문 입력칸 폭/높이/반복 수를 유지한다.
4. candidate 필드 정의와 HTML 위치가 일치한다.

---

## 문서 패밀리별 전략

현재 서비스는 하나의 PDF builder 로 모든 문서를 처리하려고 해서 실패했다.  
앞으로는 문서 패밀리별로 builder 를 분리한다.

## A. Work Order Family

대상 예시:

1. `작업지시서_대구침산더샵.pdf`
2. `작업지시서_부전마산2공구.pdf`
3. `작업지시서_사일동 주상복합.pdf`

공통 특징:

1. 메타 영역
2. 상태/결재/서명 영역
3. 번호 섹션 본문
4. 병렬 항목
5. 첨부/주의문

이 패밀리는 현재 구현에서 가장 진척도가 높다.  
하지만 아직 synthetic form builder 의 한계가 남아 있다.

개선 방향:

1. 의미 기반 form builder 폐기
2. 실제 page topology 를 먼저 추출
3. `master topology` 기반 single-form clone 생성
4. 그 위에 value binding 적용

## B. Certificate Family

대상 예시:

1. `사업자등록증.pdf`

공통 특징:

1. 상단 제목/발급번호/처리기간
2. label-value 행
3. 다중 행 확장 블록
4. 발급/담당/연락처/안내문

개선 방향:

1. image PDF 를 generic grid 로 보내지 않는다.
2. OCR 텍스트는 보조 수단이다.
3. rule/box/frame topology 를 먼저 추출한다.
4. certificate family 전용 builder 로 실제 표 구조를 만든다.
5. key-value 는 그 후에 얹는다.

## C. Generic Form Family

대상:

1. 위 두 패밀리 외의 일반적인 폼/표 문서

개선 방향:

1. 일단 layout topology 를 추출한다.
2. 패밀리 감지가 되지 않으면 generic topology clone 으로 간다.
3. 단, generic clone 이 기본 경로를 먹지 않게 한다.
4. family-specific builder 가 존재하면 항상 그 경로를 우선한다.

---

## 개선이 필요한 기술 항목

## 1. 입력 판별기 강화

현재 필요한 판별은 두 단계다.

### a. 디지털 PDF vs 스캔/이미지 PDF

판별 기준:

1. text object 존재 여부
2. line extraction 성공 여부
3. glyph/embedded font 존재 여부
4. page image 비중

### b. 문서 패밀리 판별

판별 기준:

1. 제목 패턴
2. 상단 메타 row 패턴
3. 본문 구획 패턴
4. OCR 텍스트 토큰 패턴
5. 박스/frame topology 패턴

이 판별기는 단순 문자열 매칭이 아니라 **문서 구조 힌트**를 같이 써야 한다.

## 2. PDF topology extractor 도입

현재 가장 부족한 부분이다.

앞으로 필요한 출력:

1. horizontal line segments
2. vertical line segments
3. row band
4. column edge candidates
5. merged cell candidates
6. text block anchors
7. checkbox / stamp / signature zone candidates

이 topology extractor 는 디지털 PDF와 스캔 PDF 모두에서 동작해야 한다.  
단, 입력 소스는 다르다.

### 디지털 PDF

1. vector line
2. text block geometry
3. font bbox

### 스캔 PDF

1. bitmap rule detection
2. OCR line boxes
3. morphology 기반 cell boundary detection

## 3. HTML clone builder 전면 교체

현재의 “뜻을 읽고 다시 폼 그리기” builder는 품질 상한이 낮다.

새 builder 원칙:

1. `topology -> real HTML` 순서
2. 의미는 나중 단계
3. HTML은 실제 table/div grid 구조
4. CSS는 원문 비율 유지
5. 배경 이미지 의존 금지

즉 builder 는 아래 형태여야 한다.

1. `layout topology model`
2. `family-specific HTML builder`
3. `generic fallback builder`

## 4. value binding 을 레이아웃 이후로 이동

value binding 은 아래 입력만 받아야 한다.

1. cloneHtml
2. topology model
3. normalized text blocks

절대 금지:

1. value binding 단계에서 layout 을 다시 바꾸는 것
2. value binding 이 clone builder 를 호출하는 것
3. label 판단 때문에 table structure 를 재조립하는 것

## 5. OCR 경로 개선

스캔/이미지 PDF의 경우 OCR 은 필요하지만, 지금처럼 OCR 여부가 전체 품질을 좌우하게 두면 안 된다.

개선 방향:

1. OCR line box
2. OCR confidence
3. OCR paragraph grouping
4. OCR token normalization
5. low-confidence block fallback

중요:

OCR 값이 나빠도 1단계 문서 틀 복제는 유지되어야 한다.

---

## 구현 순서

이후 구현은 반드시 이 순서로 진행한다.

## EXTRACTOR-01. 문서 패밀리 판별기 정리

목표:

1. work-order family
2. certificate family
3. generic form family

분기 규칙을 명시적으로 고정한다.

완료 기준:

1. 입력 PDF가 어느 family로 갔는지 로그와 DTO에서 추적 가능하다.

## EXTRACTOR-02. topology model 정본 도입

목표:

1. text lines
2. rule segments
3. row bands
4. column edges
5. merged cell candidates

를 공통 DTO로 만든다.

완료 기준:

1. 디지털 PDF와 스캔 PDF 모두 공통 topology model 을 만든다.

## EXTRACTOR-03. work-order family 실제 폼 복제

목표:

1. `작업지시서_대구침산더샵.pdf`
2. `작업지시서_사일동 주상복합.pdf`
3. `작업지시서_부전마산2공구.pdf`

모두에서 같은 작업지시서 family builder 를 적용할 수 있게 한다.

완료 기준:

1. 여러 개의 synthetic table 이 아니라 실제 단일 form topology 와 유사한 HTML 이 나온다.

## EXTRACTOR-04. certificate family 실제 폼 복제

목표:

1. `사업자등록증.pdf`

에 대해 generic grid 가 아닌 실제 증명서 양식과 유사한 HTML 을 만든다.

완료 기준:

1. title / header / main rows / footer notes 가 실제 문서와 같은 구조 계층을 가진다.

## EXTRACTOR-05. placeholder projection 분리

목표:

1. clone HTML은 유지
2. value 만 제거
3. 입력칸 모양 유지

완료 기준:

1. placeholder 투영이 레이아웃을 바꾸지 않는다.

## EXTRACTOR-06. key-value binding 고도화

목표:

1. family-specific key dictionary
2. row/column-aware value range
3. multi-line value binding
4. repeated section binding

완료 기준:

1. 실제 입력 위치와 후보 필드가 일치한다.

## EXTRACTOR-07. 품질 검증 체계 도입

목표:

1. 시각 유사도
2. 구조 보존율
3. key-value 정확도
4. placeholder 위치 정확도

를 버전 승격 전에 측정한다.

완료 기준:

1. “기분상 좋아 보인다”가 아니라 지표로 버전 승격을 막을 수 있다.

---

## 코드 레벨 개선 제안

현재 코드베이스 기준으로 실제 개선이 필요한 파일은 아래 범주다.

## 1. 분기와 family 판별

대상:

1. `src/services/templateExtractPdfService.ts`
2. `src/services/templateExtractPdfTextRecoveryService.ts`
3. `src/services/templateExtractVersionService.ts`

해야 할 일:

1. 디지털/스캔 분기 명확화
2. family detection 을 별도 서비스로 분리
3. clone builder 선택을 명시적 계약으로 고정

## 2. topology 추출

대상:

1. `src/services/templateExtractPdfGeometryService.ts`
2. 신규 `src/services/templateExtractPdfTopologyService.ts`

해야 할 일:

1. rule/segment/cell candidate 추출
2. merged cell inference
3. row/column band 정리

## 3. HTML builder

대상:

1. `src/services/templateExtractPdfLayoutService.ts`
2. 신규 `src/services/templateExtractWorkOrderBuilderService.ts`
3. 신규 `src/services/templateExtractCertificateBuilderService.ts`

해야 할 일:

1. family 별 builder 분리
2. synthetic form builder 제거
3. topology 기반 real HTML clone 생성

## 4. value binding / placeholder projection

대상:

1. `src/services/templateExtractValueBindingService.ts`
2. `src/services/templateExtractDomProjectionService.ts`

해야 할 일:

1. 레이아웃 변경 금지
2. binding 과 projection 분리
3. family-specific value resolution

## 5. DTO와 테스트/문서

대상:

1. `src/lib/templateExtractDtos.ts`
2. `docs/buildhtml.md`
3. `docs/total-todo.md`

해야 할 일:

1. topology DTO 정본화
2. family / clone id / quality metric 기록
3. 버전별 테스트 결과 누적

---

## 성공 기준

이 문서 이후 추출기 성공 기준은 아래로 고정한다.

## 1단계 성공

1. 원문과 결과 HTML이 같은 문서로 보인다.
2. 표 구조와 비율이 유지된다.
3. 서명/이미지/체크/주석 위치가 유지된다.
4. 디지털 PDF와 스캔 PDF 모두 family builder 가 존재한다.

## 2단계 성공

1. key 는 정확한 위치에 남는다.
2. value 는 정확한 위치에서 제거된다.
3. placeholder 모양이 입력칸과 일치한다.
4. 추출 후보가 실제 입력 영역과 대응한다.

## 실패 판정

아래 중 하나라도 해당하면 실패다.

1. 결과가 다른 문서처럼 보인다.
2. 문서 전체가 다시 그린 synthetic form 으로 보인다.
3. value 제거 때문에 레이아웃이 무너진다.
4. 특정 샘플 하나만 맞는 hardcoded 결과다.

---

## 테스트와 운영 원칙

1. 매 단계에서 `supabase` MCP와 `chrome-devtools` MCP를 시도한다.
2. DB 수정이 필요한 경우 SQL은 `/docs` 에 작성한다.
3. `/docs/applied` 는 실행 후 아카이브 전용이다.
4. 기존 버전은 snapshot 으로 남기고 의미를 바꾸지 않는다.
5. 새 버전은 문서 틀 복제 품질이 실제로 좋아질 때만 활성 기본값으로 승격한다.

---

## 최종 결론

현재 추출기가 기대에 못 미치는 이유는 다음 한 줄로 정리된다.

**문서의 실제 topology 를 복제하지 않고, 문서 의미를 해석해 비슷한 양식을 다시 그리고 있기 때문이다.**

따라서 개선 방향은 명확하다.

1. 디지털 PDF와 스캔 PDF를 분기한다.
2. 문서 패밀리를 먼저 판별한다.
3. topology 를 먼저 추출한다.
4. topology 기반 real HTML clone 을 만든다.
5. 그 위에 key-value 와 value 제거를 얹는다.

이 순서를 지키지 않으면, 앞으로 버전을 더 올려도 지금과 같은 실패가 반복된다.
