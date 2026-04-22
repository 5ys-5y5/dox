# ENHANCE 설계 문서

## 문서 목적

이 문서는 `/templates/extract` 의 PDF -> HTML 변환 경로를 "`스캔 한 것과 같은 수준`"이 아니라 실제로 **`99.9% 시각 유사성`을 검증 가능한 수준의 page-faithful HTML** 로 끌어올리기 위한 설계 문서다.

이 문서는 다음을 동시에 만족해야 한다.

1. 후속 LLM이 히스토리를 몰라도 현재 실패 원인과 다음 구현 순서를 이해할 수 있어야 한다.
2. 문서만 보고 어떤 파일을 왜 수정해야 하는지 추적 가능해야 한다.
3. 서비스 독립성 원칙에 따라 각 기능이 향후 별도 서비스/API 상품으로 분리 가능해야 한다.
4. 현재 `v19`, `v20` 의 의미를 깨지 않고, 새 고정 버전 `v21` 경로로 안전하게 실험/승격할 수 있어야 한다.
5. `docs/diff` 와 체크리스트 ID 기준으로 구현/롤백 이력을 직접 연결할 수 있어야 한다.

---

## 이번 턴에서 확인한 사실

### 1. 샘플 문서 성격

2026-04-17 기준 로컬 확인 결과:

| 샘플 | 페이지 수 | 텍스트 레이어 | 현재 성격 | 비고 |
|---|---:|---|---|---|
| `사업자등록증.pdf` | 1 | 없음 | 스캔형 증명서 | OCR/rule 기반 fallback 필요 |
| `작업지시서_대구침산더샵.pdf` | 1 | 있음 | 디지털 작업지시서 | text-layer 기반 |
| `작업지시서_부전마산2공구.pdf` | 1 | 없음 | 스캔형 작업지시서 | line/frame fallback 상태 |
| `작업지시서_사일동 주상복합.pdf` | 1 | 있음 | 디지털 작업지시서 | text-layer 기반 |

### 2. 현재 엔진 출력 상태

2026-04-17 기준 직접 추출 결과:

| 샘플 | 버전 | 현재 clone id | sourceMode | cloneBuilder | 핵심 문제 |
|---|---:|---|---|---|---|
| `사업자등록증.pdf` | `v20` | `pdf-certificate-v20` | `scanned` | `certificate_family_scanned` | 실제 증명서 좌표 복제가 아니라 표준 skeleton 기반 |
| `작업지시서_대구침산더샵.pdf` | `v20` | `pdf-form-v20` | `digital` | `work_order_family_legacy_digital` | semantic form 재조립이 우세 |
| `작업지시서_부전마산2공구.pdf` | `v20` | `pdf-frame-v20` | `scanned` | `work_order_family_frame_scanned` | 프레임 선만 남고 value marker 0개 |
| `작업지시서_사일동 주상복합.pdf` | `v20` | `pdf-form-v20` | `digital` | `work_order_family_legacy_digital` | synthetic form 성격이 강함 |

### 3. 결론

현재 경로는 `원문 page scene 복제`가 아니라 `family-aware semantic form builder` 중심이다.  
이 구조는 "어느 위치에 어떤 값이 있다"는 라벨링에는 유리하지만, 사용자가 요구한 `99.9% 시각 유사성`에는 구조적으로 불리하다.

특히 아래 한계가 명확하다.

1. 디지털 PDF도 실제 벡터 선, 박스, 체크박스, 자간, 폰트 메트릭이 아니라 합성 table/grid 로 재구성된다.
2. 스캔 PDF는 full page replica 가 아니라 `frame` 또는 `certificate skeleton` 으로 축약된다.
3. 현재 `topology` 는 `rowBands/columnEdges/textBlocks` 중심이라 page-faithful renderer 의 정본이 되기에 정보가 부족하다.
4. visual similarity 를 수치로 막는 품질 게이트가 없다.
5. value binding 이 아직도 layout fidelity 보다 앞선 우선순위를 갖는다.

---

## 외부 제안 코드 검토

### 검토 대상

1. `docs/templateExtractVersionService.ts`
2. `docs/templateExtractPdfHybridCloneService.ts`

### 전체 판단

두 제안은 `hybrid-first` 방향의 실험 아이디어로는 가치가 있다.  
하지만 제안 그대로 수용하면 다시 "`full-page background image + text overlay`" 구조로 회귀하게 된다.

이번 설계의 결정은 아래와 같다.

1. 제안의 **관측/보조 추출 아이디어는 수용**
2. 제안의 **최종 출력 구조는 거절**
3. 제안의 **버전 서비스 캡슐화 방식은 일부 수용**
4. 제안의 **`v19`/`v20` 의미 변경은 거절**

### 수용할 항목

| 제안 항목 | 판단 | 반영 방식 |
|---|---|---|
| 실험 경로를 `VersionService` 내부 전용 함수로 캡슐화한 점 | 수용 | `v21` 오케스트레이터 내부 branch 로만 사용 |
| hybrid 시도 후 legacy fallback 시 두 에러를 함께 보존하는 점 | 수용 | `v21 -> v20` fallback trace 규칙에 반영 |
| non-PDF 업로드와 PDF 업로드를 version service 에서 분리한 점 | 수용 | 기존 원칙 유지 |
| PDF.js 기반 link/annotation 추출 아이디어 | 수용 | `Digital PDF Scene Service` 또는 probe 단계의 보조 입력으로 사용 |
| page rasterization 을 OCR 입력으로 쓰는 점 | 수용 | `Scanned PDF Scene Service` 의 OCR 입력, quality probe, debug artifact 로만 사용 |
| OCR adapter interface 분리 | 수용 | `Hybrid Probe Adapter` 또는 `Scanned PDF Scene Service` 로 이동 |
| PDF token / OCR token overlap dedupe 아이디어 | 수용 | mixed/scanned page 의 보조 merge 규칙으로만 사용 |
| page별 `strategy` 메타데이터 생성 | 조건부 수용 | 최종 판정값이 아니라 debug/profile hint 로만 사용 |

### 거절할 항목

| 제안 항목 | 판단 | 거절 사유 |
|---|---|---|
| `backgroundDataUrl` full-page PNG 를 최종 HTML 배경으로 쓰는 구조 | 거절 | 사용자 요구와 문서 원칙상 최종 산출물은 실제 HTML clone 이어야 하며 full-page raster 의존은 금지 |
| `<img class=\"te-page__bg\"> + invisible text layer` 를 최종 clone 으로 채택하는 구조 | 거절 | 이는 searchable viewer 에 가깝고 `99.9% 시각 유사 HTML` 의 정답이 아님 |
| `TemplateExtractPdfHybridCloneService.extractPdfSource()` 가 완성형 HTML 전체를 직접 반환하는 구조 | 거절 | scene 추출, OCR, composer, quality gate 의 서비스 경계를 무너뜨림 |
| `v19`, `v20` 를 hybrid-first 로 재정의하는 점 | 거절 | 기존 버전 의미 고정 원칙 위반 |
| `charCount`/`coverageRatio` 만으로 `digital/mixed/scanned` 를 판정하는 규칙 | 거절 | 샘플 4건 기준으로도 안정적인 판정 근거가 부족 |
| `tesseract.js`, `canvas`, `pdfjs-dist` 를 하나의 monolithic service 안에서 즉시 로드하는 구조 | 거절 | 성능, cold start, 교체 용이성, 책임 분리 측면에서 불리 |
| background image 와 fixed font 로 유사도를 확보하는 접근 | 거절 | scene fidelity 를 측정하지 못하고 raster 의존을 숨김 |

### 갱신된 결론

이 제안들은 폐기 대상이 아니라 **역할 재배치 대상** 이다.

정확한 반영 원칙:

1. `templateExtractPdfHybridCloneService` 의 아이디어는 최종 clone 서비스가 아니라 `Hybrid Probe Adapter` 로 흡수한다.
2. `templateExtractVersionService` 제안은 버전 분기 캡슐화 방식만 수용하고, `v19`/`v20` 의미 변경은 하지 않는다.
3. hybrid raster/OCR 결과는 scene 추출 보조 자료와 quality 비교용 중간 산출물로만 사용한다.
4. 최종 HTML 은 여전히 `pdf-replica-v21` scene composer 가 생성해야 한다.

---

## 최종 목표

### 제품 목표

최종 목표는 "`문서 내용을 잘 읽는 HTML`"이 아니다.  
최종 목표는 **`원문 PDF 페이지가 브라우저 안에서 HTML/CSS/SVG 레이어로 재구성되었을 때, 원본과 사실상 동일하게 보이는 것`** 이다.

### 성공 정의

`99.9% 시각 유사성`은 아래처럼 공학적으로 정의한다.

1. 최종 HTML은 페이지 단위 고정 레이아웃이어야 한다.
2. full-page raster image 를 깔아놓고 그 위를 덮는 방식은 최종 통과 산출물로 인정하지 않는다.
3. 텍스트, 선, 박스, 표, 이미지, 도장/서명 영역, 체크 상태, 셀 경계, 여백, 페이지 크기 관계가 원문과 거의 같아야 한다.
4. 시각 검증은 반드시 원본 PDF 렌더 이미지와 HTML 렌더 이미지를 비교하는 품질 리포트로 남겨야 한다.
5. value placeholder 는 layout 이 완성된 뒤에만 얹는다. layout 을 다시 바꾸면 실패로 본다.

### 수용 기준

아래 기준을 모두 만족해야 `v21` 승격 후보로 인정한다.

| 항목 | 수용 기준 |
|---|---|
| 페이지 크기 오차 | 페이지 width/height 오차 0 |
| 시각 diff | 페이지 단위 불일치 픽셀 비율 `<= 0.1%` |
| 주요 구조 누락 | 표, 박스, 선, 서명칸, 체크박스 누락 0건 |
| 텍스트 위치 | 주요 label/value anchor box 위치 오차 허용 범위 내 |
| fallback 빈도 | 샘플 4건 모두 `frame-only` fallback 금지 |
| value binding | layout 재조립 없이 placeholder 주입 가능 |

비고:

1. 위 수용 기준은 엔지니어링 acceptance threshold 이다.
2. exact OCR 문자인식률과 별개로, 최종 산출물이 원문과 얼마나 같아 보이는지를 먼저 평가한다.

---

## 현재 방식이 99.9%에 도달하지 못하는 이유

### 1. 구조적 원인

현재 코드는 크게 두 계열로 나뉜다.

1. 디지털 PDF: `pdf-form-v19/v20`
2. 스캔 PDF: `pdf-frame-v20`, `pdf-certificate-v19/v20`

문제는 둘 다 **"원문 page scene 을 재현하는 엔진"** 이 아니라 **"family 가정 하에 비슷한 폼을 다시 그리는 엔진"** 이라는 점이다.

즉 지금은 아래 순서다.

1. family 감지
2. 의미 해석
3. synthetic form 생성
4. placeholder 삽입

사용자가 요구하는 순서는 아래여야 한다.

1. page scene 정본 추출
2. scene 기반 page-faithful HTML 생성
3. scene/text anchor 기반 placeholder 삽입
4. visual diff 검증

### 2. 디지털 경로 한계

현재 디지털 작업지시서형 PDF는 `work_order_family_legacy_digital` 경로가 우세하다.

이 경로의 한계:

1. 실제 문서 선/칸/벡터를 그대로 옮기지 않는다.
2. `Malgun Gothic` 고정 CSS 와 synthetic colgroup 비율에 의존한다.
3. 원문 글자 폭과 자간, 줄바꿈, 병합 셀, 체크박스 모양이 원문과 달라진다.
4. topology summary 상 digital 샘플에서 `horizontalSegmentCount`, `verticalSegmentCount` 가 0인 경우가 있어 문서 선 정보가 page 정본으로 남지 않는다.

### 3. 스캔 경로 한계

현재 스캔 작업지시서형 PDF는 `work_order_family_frame_scanned` 로 후퇴하고, 스캔 증명서는 `certificate_family_scanned` skeleton 으로 후퇴한다.

이 경로의 한계:

1. 스캔형 full page 를 HTML 레이어로 복제하지 못한다.
2. OCR 이 약하면 text/value 가 사라진다.
3. line/frame 만 그리면 표 내부 정보가 사라진다.
4. 표준 증명서 skeleton 은 원문과 비슷한 문서일 수는 있어도, 원문을 1:1로 복제한 HTML 이 아니다.

### 4. 품질 게이트 부재

현재는 어떤 clone 이 나왔는지만 남고, 그 clone 이 원문과 얼마나 비슷한지 수치로 남지 않는다.

이 상태에서는 다음이 반복된다.

1. `더 좋아 보이는 builder` 를 추가한다.
2. 샘플 하나에는 좋아 보인다.
3. 다른 샘플에서는 더 멀어진다.
4. 정확한 regression gate 가 없어 다시 synthetic 분기가 늘어난다.

이 문서는 이 악순환을 끊기 위한 설계다.

---

## 목표 아키텍처

### 핵심 원칙

새 경로의 핵심은 **`family builder 중심 구조`에서 `page scene 중심 구조`로 주도권을 옮기는 것** 이다.

`family` 는 이제 구조를 만드는 주체가 아니라 다음 역할만 수행해야 한다.

1. placeholder 후보 우선순위 조정
2. low-confidence 영역 보조 추론
3. 문서별 visual QA 규칙 선택

최종 HTML 구조는 family 가 아니라 page scene 이 결정해야 한다.

### 새 page-faithful layer 모델

최종 HTML 페이지는 아래 4개 레이어를 가진다.

1. `vector layer`
2. `image fragment layer`
3. `text layer`
4. `placeholder/value layer`

예시 DOM:

```html
<section data-template-extract-draft="true" data-template-clone="pdf-replica-v21">
  <div class="template-clone template-clone--pdf-replica-v21">
    <div class="template-replica__page" data-page="1" style="width:595px;height:842px">
      <svg class="template-replica__vector-layer"></svg>
      <div class="template-replica__image-layer"></div>
      <div class="template-replica__text-layer"></div>
      <div class="template-replica__placeholder-layer"></div>
    </div>
  </div>
</section>
```

중요 규칙:

1. full-page background image 금지
2. 단, logo, 도장, 서명, 스캔에서 텍스트가 아닌 stamp 영역 등 **부분 이미지 fragment** 는 허용
3. vector/box/line 은 가능하면 SVG primitive 로 표현
4. 텍스트는 absolute-positioned text run 또는 word span 으로 표현
5. page rasterization 은 `OCR 입력`, `quality probe`, `debug artifact` 로만 허용한다.

---

## 실행 정책 (필수 준수)

아래 정책은 본 설계 또는 후속 수정에서 100% 준수한다. 요약하지 않고 실제 실행 기준으로 기록한다.

### 0. 서비스 독립성 설계 원칙 (필수 준수)

아래 기능들은 처음부터 "`하나의 서비스로 분리 가능한 단위`" 로 설계한다.

1. 각 기능은 명확한 도메인 경계, 책임, 입력, 출력, 저장소 범위를 가진다.
2. 다른 기능의 DB 스키마, 내부 함수, UI 상태에 직접 의존하지 않는다.
3. 연결은 계약된 API, 이벤트, DTO 로만 한다.
4. 공통 로직이 생겨도 우선 "`공통 유틸`" 이 아니라 "`독립 서비스로 유지 가능한가`" 를 먼저 검토한다.
5. 기능별 문서에는 반드시 아래 항목을 분리해 기록한다.
   - 기능 목적
   - 단독 서비스로서의 가치
   - 책임 범위 / 비책임 범위
   - API 계약
   - 데이터 소유권
   - 의존 서비스
   - 분리 배포 시 필요한 최소 조건
6. 구현안이 나오면 반드시 "`이 기능을 지금 당장 별도 서비스로 분리해도 성립하는가?`" 를 기준으로 검토한다.
7. 성립하지 않으면 결합 지점을 먼저 제거한다.
8. 임시 편의성보다 서비스 경계 보존을 우선한다.

### 1. 코드 가독성 정책

1. 모든 정의명, DTO명, trace key, comment 는 다른 LLM이 바로 이해할 수 있게 작성한다.
2. 왜 이 경로가 있는지, 어떤 실패를 막기 위한 것인지 주석에 남긴다.
3. `temp`, `misc`, `helper2`, `current2` 같은 의미 없는 명칭을 금지한다.
4. family fallback, quality gate, scene ownership 은 이름만 보고도 의도가 드러나야 한다.

### 2. 프론트 UI 변경 정책

1. `/src/components` 는 수정하지 않는다.
2. `/src/app/templates/extract/page.tsx` 에 필요한 최소 변경만 허용한다.
3. 기존 `Card`, `Badge`, `Button`, `Input`, `EntityPicker` 같은 이미 사용 중인 UI만 재사용한다.
4. 새 UI가 필요해도 기존 디자인 시스템 밖으로 벗어나지 않는다.
5. UI 변경은 `v21` trace, quality score, fallback reason 표시처럼 진단 목적 최소 범위로 제한한다.

### 3. 수정 전 이해 확정 절차

1. 수정 전 이해 내용을 목록으로 정리한다.
2. 사용자가 명시적으로 `확정`하기 전에는 코드 수정에 착수하지 않는다.
3. 화이트리스트 밖 파일이 필요하면 즉시 중단하고 정확한 파일명을 제안한다.

### 4. 변경 기록 및 롤백 보장

1. 기존 파일 수정 전에는 반드시 `docs/diff` 에 수정 전 상태를 남긴다.
2. 신규 파일 생성 시에도 생성 전 상태가 "`없음`" 이었음을 기록한다.
3. diff 파일에는 체크리스트 ID를 반드시 적는다.
4. 롤백 방법은 diff 문서만 보고도 알 수 있어야 한다.

### 5. 확정 범위 외 수정 금지

1. 사용자가 확정한 범위를 넘는 수정 금지
2. 새로운 SQL/DB 변경이 필요하면 즉시 중단
3. 폴더 단위 승인 요청 금지
4. 파일 단위로만 추가 승인 요청

### 6. 체크리스트 작성

1. 설계의 모든 구현 단계는 체크리스트 ID를 가진다.
2. diff 파일명에도 같은 체크리스트 ID를 반영한다.
3. `어떤 구현 -> 어떤 diff -> 어떤 테스트` 인지 한 줄로 연결되어야 한다.

### 7. MCP 테스트 의무

1. 매 실행마다 `supabase` MCP와 `chrome-devtools` MCP를 시도한다.
2. DB 변경은 MCP로 직접 수행하지 않는다.
3. DB 변경이 필요하면 `/docs` 아래 실행 SQL 문서를 작성하고 사용자가 직접 실행한다.
4. MCP 실패 자체도 테스트 기록에 남긴다.

### 8. SQL 파일 위치 정책

1. 실행 전 SQL은 반드시 `/docs` 아래에 둔다.
2. `/docs/applied` 는 이미 실행 완료된 SQL 아카이브만 허용한다.
3. 실행 전 SQL을 `/docs/applied` 에 두는 행위 금지

---

## 수정 허용 화이트리스트 (초기 제안)

아래 파일만 후속 구현에서 수정 가능하다.  
목록 외 파일이 필요하면 반드시 중단 후 사용자 승인을 받는다.

### 문서

1. `docs/enhance.md`
   - 본 설계 문서 유지/보강
2. `docs/buildhtml.md`
   - `v21` 설계/진행 기록 반영
3. `docs/total-todo.md`
   - 체크리스트 및 테스트 이력 반영

### 기존 코드 파일

4. `src/lib/templateExtractDtos.ts`
   - `v21` DTO, trace key, quality report 계약 추가
5. `src/services/templateExtractPdfService.ts`
   - `v21` orchestration, quality gate, fallback policy
6. `src/services/templateExtractVersionService.ts`
   - `v21` 고정 버전 연결
7. `src/services/templateExtractService.ts`
   - draft 저장 전후 trace/quality report 전달 계약 유지
8. `src/services/templateExtractPdfFamilyService.ts`
   - family 는 scene builder 보조 규칙으로 축소
9. `src/services/templateExtractPdfLayoutService.ts`
   - legacy `pdf-form-*` 경로 snapshot 유지 및 `v21` fallback 연결
10. `src/services/templateExtractPdfTextRecoveryService.ts`
   - scanned scene 추출 보조, frame-only fallback 축소
11. `src/services/templateExtractValueBindingService.ts`
   - layout 이후 binding 으로 역할 고정
12. `src/services/templateExtractCloneService.ts`
   - placeholder/materialization 단계가 scene 이후에만 동작하도록 조정
13. `src/app/templates/extract/page.tsx`
   - `v21` 선택, quality score, trace 표시
14. `src/app/api/templates/extract/route.ts`
   - `v21` 업로드 경로 입력/출력 계약 유지

### 신규 추가 파일

15. `src/lib/templateExtractReplicaDtos.ts`
   - canonical page scene DTO
16. `src/services/templateExtractPdfDocumentProfileService.ts`
   - digital/scanned/family/profile 분리
17. `src/services/templateExtractPdfSceneService.ts`
   - digital PDF canonical scene 추출
18. `src/services/templateExtractPdfScannedSceneService.ts`
   - scanned PDF canonical scene 추출
19. `src/services/templateExtractPdfHybridProbeService.ts`
   - pdf.js/raster/OCR probe 보조 서비스
20. `src/services/templateExtractPdfReplicaComposerService.ts`
   - page-faithful HTML/CSS/SVG composer
21. `src/services/templateExtractReplicaQualityService.ts`
   - visual diff 및 acceptance gate
22. `src/services/templateExtractReplicaOfflineQualityService.ts`
   - 브라우저 비의존 유사도 평가
23. `src/services/templateExtractReplicaHtmlNormalizerService.ts`
   - replica HTML 정규화 및 scene 비교 입력 생성

비고:

1. 이번 설계는 DB 스키마 변경을 포함하지 않는다.
2. quality report 저장을 위해 DB 변경이 필요해지면 별도 승인 후 SQL 문서를 추가한다.

---

## 서비스 분리 설계

아래 기능들은 처음부터 독립 서비스 경계를 가진다.

### 기능 A. Document Profile Service

#### 1. 기능 목적

입력 PDF를 분석해 아래를 판별한다.

1. `sourceMode`: `digital` / `scanned` / `hybrid`
2. `documentFamily`: `work_order` / `certificate` / `generic_form`
3. 페이지 크기, 회전, text-layer 존재, 추출 난이도, 예상 fidelity risk

#### 2. 단독 서비스로서의 가치

이 기능은 향후 다른 문서 처리 제품에서도 재사용 가능하다.  
문서 분류만 API 상품화해도 충분한 가치가 있다.

#### 3. 책임 범위

책임:

1. 입력 문서 프로파일 판별
2. confidence 및 detection reason 생성
3. downstream extractor selection 힌트 제공

비책임:

1. HTML 생성
2. placeholder 삽입
3. DB 저장

#### 4. API 계약

입력:

```ts
type ReplicaProfileRequest = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};
```

출력:

```ts
type ReplicaDocumentProfile = {
  sourceMode: 'digital' | 'scanned' | 'hybrid';
  documentFamily: 'work_order' | 'certificate' | 'generic_form';
  confidenceScore: number;
  reasons: string[];
  pages: Array<{ pageNumber: number; width: number; height: number; hasTextLayer: boolean }>;
  risks: string[];
};
```

#### 5. 데이터 소유권

정본 데이터는 `ReplicaDocumentProfile` DTO 자체다.  
DB 소유권은 가지지 않는다.

#### 6. 의존 서비스

1. `TemplateExtractPdfFamilyService`
2. `TemplateExtractPdfLayoutService` 또는 low-level extractor

#### 7. 분리 배포 시 필요한 최소 조건

1. 파일 업로드 입력
2. PDF 파서 런타임
3. JSON 응답 API
4. health endpoint

---

### 기능 B. Digital PDF Scene Service

#### 1. 기능 목적

디지털 PDF에서 page-faithful HTML 생성에 필요한 **canonical page scene** 을 추출한다.

#### 2. 단독 서비스로서의 가치

디지털 PDF를 HTML/SVG/Canvas/JSON 으로 재게시하는 모든 제품에 재사용 가능하다.

#### 3. 책임 범위

책임:

1. text run / word box / glyph group 추출
2. vector line / rect / fill / checkbox / stroke 추출
3. embedded image fragment 추출
4. annotation/link box 추출

비책임:

1. OCR
2. family-specific placeholder 추론
3. visual diff

#### 4. API 계약

입력:

```ts
type DigitalSceneRequest = {
  fileName: string;
  bytes: Uint8Array;
  profile: ReplicaDocumentProfile;
};
```

출력:

```ts
type ReplicaPageScene = {
  pageNumber: number;
  width: number;
  height: number;
  textRuns: ReplicaTextRun[];
  vectorPrimitives: ReplicaVectorPrimitive[];
  imageFragments: ReplicaImageFragment[];
  annotationBoxes: ReplicaAnnotationBox[];
  qualityHints: string[];
};
```

#### 5. 데이터 소유권

정본 데이터는 `ReplicaPageScene` 이다.  
현재 `rowBands/columnEdges` 는 이 서비스의 정본이 아니라 파생 데이터로 취급한다.

#### 6. 의존 서비스

1. low-level PDF parser adapter
2. font metric normalizer

#### 7. 분리 배포 시 필요한 최소 조건

1. PDF 파싱 런타임
2. scene JSON 저장소 또는 response
3. deterministic extractor versioning

---

### 기능 B-1. Hybrid Probe Adapter

#### 1. 기능 목적

`pdf.js + raster + optional OCR` 기반의 보조 정보를 생성한다.  
이 기능은 제안된 `templateExtractPdfHybridCloneService.ts` 의 수용 가능한 부분만 떼어낸 보조 서비스다.

#### 2. 단독 서비스로서의 가치

최종 clone 생성기가 아니라, 다양한 추출기와 QA 서비스가 공통으로 사용할 수 있는 probe API 로 분리 가능하다.

#### 3. 책임 범위

책임:

1. page rasterization
2. pdf.js token/link/annotation probe
3. optional OCR word box probe
4. mixed page overlap merge 힌트 생성

비책임:

1. 최종 HTML 생성
2. 버전 승격 판단
3. final scene ownership

#### 4. API 계약

입력:

```ts
type HybridProbeRequest = {
  fileName: string;
  bytes: Uint8Array;
  renderScale: number;
  enableOcr: boolean;
  ocrLanguages: string[];
};
```

출력:

```ts
type HybridProbeArtifact = {
  pages: Array<{
    pageNumber: number;
    width: number;
    height: number;
    rasterDataUrl: string | null;
    pdfTokens: ReplicaTextRun[];
    ocrTokens: ReplicaTextRun[];
    links: ReplicaAnnotationBox[];
    pageHint: 'digital' | 'mixed' | 'scanned';
  }>;
};
```

#### 5. 데이터 소유권

정본 데이터는 아니다.  
`HybridProbeArtifact` 는 항상 scene service 또는 quality service 의 보조 입력이다.

#### 6. 의존 서비스

1. `pdf.js` adapter
2. OCR adapter
3. raster renderer

#### 7. 분리 배포 시 필요한 최소 조건

1. PDF bytes 입력
2. page별 probe JSON 응답
3. no-final-html 보장

---

### 기능 C. Scanned PDF Scene Service

#### 1. 기능 목적

스캔 PDF를 OCR 기반으로 해석하되, 최종 목표를 "`텍스트 추출`"이 아니라 "`page scene 복제`"에 둔다.

#### 2. 단독 서비스로서의 가치

OCR 업체/엔진 교체와 무관하게 scanned page scene API 로 독립 운영 가능하다.

#### 3. 책임 범위

책임:

1. page rasterization
2. rule line / box / cell / checkbox / stamp region 탐지
3. OCR word/line box 추출
4. low-confidence 영역 식별
5. image fragment 분할

비책임:

1. final HTML 조립
2. DB 저장
3. placeholder 삽입

#### 4. API 계약

입력:

```ts
type ScannedSceneRequest = {
  fileName: string;
  bytes: Uint8Array;
  profile: ReplicaDocumentProfile;
};
```

출력:

```ts
type ReplicaScannedScene = {
  pages: ReplicaPageScene[];
  ocrConfidenceSummary: {
    mean: number;
    lowConfidenceBlockCount: number;
  };
  recoveryWarnings: string[];
};
```

#### 5. 데이터 소유권

정본 데이터는 scanned canonical scene 이다.  
OCR raw line 자체는 보조 자료이며 최종 소유권은 page scene 으로 귀속된다.

#### 6. 의존 서비스

1. OCR adapter
2. bitmap line/box detector
3. image fragment cutter

#### 7. 분리 배포 시 필요한 최소 조건

1. OCR runtime
2. image processing runtime
3. page scene JSON response

---

### 기능 D. Replica Composer Service

#### 1. 기능 목적

canonical page scene 을 입력으로 받아 최종 `pdf-replica-v21` HTML/CSS/SVG 를 생성한다.

#### 2. 단독 서비스로서의 가치

scene JSON 만 있으면 웹, 미리보기, 비교 서비스 어디에나 붙일 수 있다.

#### 3. 책임 범위

책임:

1. page container 생성
2. vector/image/text layer 조립
3. CSS 변수 및 absolute positioning 계산
4. clone trace attribute 삽입

비책임:

1. family 판별
2. OCR
3. value binding 판단

#### 4. API 계약

입력:

```ts
type ReplicaComposerRequest = {
  version: '21';
  profile: ReplicaDocumentProfile;
  scenes: ReplicaPageScene[];
};
```

출력:

```ts
type ReplicaHtmlArtifact = {
  cloneId: 'pdf-replica-v21';
  html: string;
  pageCount: number;
  trace: {
    renderMode: 'scene_replica';
    sceneVersion: string;
    sourceMode: string;
    documentFamily: string;
  };
};
```

#### 5. 데이터 소유권

정본 데이터는 최종 HTML artifact 이다.  
이 서비스는 placeholder 나 candidate 를 소유하지 않는다.

#### 6. 의존 서비스

1. `Digital PDF Scene Service`
2. `Scanned PDF Scene Service`

#### 7. 분리 배포 시 필요한 최소 조건

1. scene DTO input
2. HTML/SVG serializer
3. deterministic output version

---

### 기능 E. Value Binding Service

#### 1. 기능 목적

이미 완성된 replica HTML 위에서 label/value placeholder 를 삽입하되 layout 을 절대 변경하지 않는다.

#### 2. 단독 서비스로서의 가치

시각 복제 시스템과 템플릿화 시스템을 분리함으로써 각자 독립 진화가 가능하다.

#### 3. 책임 범위

책임:

1. text anchor -> field candidate 매핑
2. placeholder DOM 주입
3. binding map 생성

비책임:

1. 표 구조 재조립
2. page scene 변경
3. visual diff

#### 4. API 계약

입력:

```ts
type ValueBindingRequest = {
  profile: ReplicaDocumentProfile;
  scenes: ReplicaPageScene[];
  replicaHtml: string;
};
```

출력:

```ts
type ReplicaBindingResult = {
  htmlWithPlaceholders: string;
  bindingMap: Array<{
    fieldKey: string;
    fieldLabel: string;
    pageNumber: number;
    anchorBox: { left: number; top: number; width: number; height: number };
    confidenceScore: number;
  }>;
};
```

#### 5. 데이터 소유권

정본 데이터는 `bindingMap` 이다.  
기존 `template_extracts.extract_field_candidates` 로 저장되는 후보는 이 결과의 downstream materialization 이다.

#### 6. 의존 서비스

1. `Document Profile Service`
2. `Replica Composer Service`
3. 기존 `TemplateExtractValueBindingService`

#### 7. 분리 배포 시 필요한 최소 조건

1. scene DTO
2. html DOM patcher
3. field candidate output contract

---

### 기능 F. Replica Quality Service

#### 1. 기능 목적

원본 PDF와 replica HTML의 유사성을 `브라우저 기반` 또는 `브라우저 비의존` 방식으로 평가해 `99.9% 시각 유사성`에 대한 승격/복귀를 제어한다.

#### 2. 단독 서비스로서의 가치

문서 변환 품질 보증 자체를 별도 서비스로 제공할 수 있다.

#### 3. 책임 범위

책임:

1. browser-assisted raster diff 실행
2. browser-free structural diff 실행
3. page diff, metric ensemble, bbox coverage 계산
4. acceptance pass/fail 판정

비책임:

1. HTML 생성
2. OCR
3. DB 저장

#### 4. API 계약

입력:

```ts
type ReplicaQualityRequest = {
  fileName: string;
  bytes: Uint8Array;
  replicaHtml: string;
  preferredMode: 'browser' | 'offline' | 'hybrid';
};
```

출력:

```ts
type ReplicaQualityReport = {
  passed: boolean;
  mode: 'browser' | 'offline' | 'hybrid';
  pageReports: Array<{
    pageNumber: number;
    mismatchPixelRatio: number;
    notes: string[];
  }>;
  offlineMetrics?: {
    pageContractScore: number;
    textAnchorScore: number;
    vectorTopologyScore: number;
    imageFragmentScore: number;
    textContentScore: number;
    placeholderIntegrityScore: number;
    overallScore: number;
  } | null;
  summary: {
    maxMismatchPixelRatio: number;
    pageCount: number;
  };
};
```

#### 5. 데이터 소유권

정본 데이터는 quality report 다.  
초기 단계에서는 DB 저장 없이 trace/data attribute 와 로그, UI 표시만 사용한다.

#### 6. 의존 서비스

1. PDF rasterizer
2. browser screenshot renderer
3. offline DOM/scene comparator

#### 7. 분리 배포 시 필요한 최소 조건

1. headless browser optional
2. PDF renderer
3. image diff library
4. offline comparator runtime

---

### 기능 F-1. Offline Similarity Evaluator

#### 1. 기능 목적

브라우저에 직접 접근하지 않고도 PDF와 replica HTML의 유사성을 평가한다.  
이 기능은 `chrome-devtools` 실패, CI 환경, 서버 배치 환경, 별도 품질 서비스 분리 상황을 모두 커버한다.

#### 2. 단독 서비스로서의 가치

브라우저 세션 상태와 무관하게 항상 실행 가능한 품질 검증 서비스로 분리 가능하다.

#### 3. 책임 범위

책임:

1. replica HTML 정적 파싱
2. absolute box / SVG primitive / image fragment / placeholder layer 정규화
3. PDF canonical scene 과 replica normalized scene 비교
4. metric ensemble 계산
5. browser-free pass/fail 판정

비책임:

1. 실제 브라우저 screenshot 생성
2. HTML 수정
3. placeholder 생성

#### 4. API 계약

입력:

```ts
type ReplicaOfflineQualityRequest = {
  profile: ReplicaDocumentProfile;
  sourceScenes: ReplicaPageScene[];
  replicaHtml: string;
  hybridProbeArtifact?: HybridProbeArtifact | null;
};
```

출력:

```ts
type ReplicaOfflineQualityReport = {
  passed: boolean;
  hardFailures: string[];
  metricScores: {
    pageContractScore: number;
    textAnchorScore: number;
    vectorTopologyScore: number;
    imageFragmentScore: number;
    textContentScore: number;
    placeholderIntegrityScore: number;
    annotationCoverageScore: number;
    overallScore: number;
  };
  pageReports: Array<{
    pageNumber: number;
    hardFailures: string[];
    notes: string[];
  }>;
};
```

#### 5. 데이터 소유권

정본 데이터는 `ReplicaOfflineQualityReport` 이다.  
초기 단계에서는 DB 저장 없이 trace, 로그, UI 표시 용도로만 사용한다.

#### 6. 의존 서비스

1. `Replica Composer Service`
2. `Digital PDF Scene Service`
3. `Scanned PDF Scene Service`
4. `Hybrid Probe Adapter`

#### 7. 분리 배포 시 필요한 최소 조건

1. HTML parser
2. CSS style extractor
3. scene comparator
4. deterministic metrics calculator

---

### 기능 G. Extract Orchestrator Service

#### 1. 기능 목적

위 서비스를 묶어 `v21` 엔진 전체를 오케스트레이션하고 fallback/rollback 을 통제한다.

#### 2. 단독 서비스로서의 가치

문서 변환 파이프라인 실행기 자체를 API 로 분리 가능하다.

#### 3. 책임 범위

책임:

1. profile -> scene -> composer -> binding -> quality 순서 강제
2. quality gate 실패 시 fallback 결정
3. pipeline trace 생성

비책임:

1. scene 추출 세부 구현
2. UI 렌더링
3. DB 직접 변경

#### 4. API 계약

입력:

```ts
type ExtractOrchestratorRequest = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  version: '21';
};
```

출력:

```ts
type ExtractOrchestratorResult = {
  resolvedSource: TemplateExtractResolvedSource;
  qualityReport: ReplicaQualityReport | null;
  pipelineTrace: Record<string, unknown>;
};
```

#### 5. 데이터 소유권

정본 데이터는 `resolvedSource`, `qualityReport`, `pipelineTrace` 조합이다.

#### 6. 의존 서비스

1. 기능 A~F-1 전체
2. 기존 `TemplateExtractService`

#### 7. 분리 배포 시 필요한 최소 조건

1. upload input
2. queue or request execution
3. JSON response + artifact trace

---

## 새 정본 DTO 설계

### 왜 새 DTO가 필요한가

현재 `rowBands/columnEdges/textBlocks/cellCandidates` 는 **form 재조립용 DTO** 로는 유용하지만, **page-faithful replica 의 정본** 으로는 부족하다.

`v21` 의 정본은 `ReplicaPageScene` 이어야 한다.

### DTO 초안

```ts
type ReplicaTextRun = {
  id: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontFamily: string | null;
  fontSize: number | null;
  fontWeight: number | null;
  letterSpacing: number | null;
  color: string | null;
  confidence: number | null;
};

type ReplicaVectorPrimitive =
  | {
      kind: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke: string;
      strokeWidth: number;
    }
  | {
      kind: 'rect';
      left: number;
      top: number;
      width: number;
      height: number;
      stroke: string | null;
      fill: string | null;
      strokeWidth: number | null;
    };

type ReplicaImageFragment = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  dataUrl: string;
  role: 'logo' | 'stamp' | 'signature' | 'unknown';
};

type ReplicaPageScene = {
  pageNumber: number;
  width: number;
  height: number;
  textRuns: ReplicaTextRun[];
  vectorPrimitives: ReplicaVectorPrimitive[];
  imageFragments: ReplicaImageFragment[];
  annotationBoxes: ReplicaAnnotationBox[];
  derivedTopology: TemplateExtractPdfTopologyModel | null;
};
```

원칙:

1. `derivedTopology` 는 파생 데이터다.
2. 최종 레이아웃은 `ReplicaPageScene` 이 결정한다.
3. family builder 는 이 scene 위에만 보조 개입한다.

---

## v21 처리 파이프라인

### 공통 원칙

1. `v19`, `v20` 의 의미는 그대로 둔다.
2. 새 고정 경로는 `v21` 로 추가한다.
3. `v21` 이 quality gate 를 통과하지 못하면 기존 `v20` 결과로 복귀하되, 복귀 사실과 이유를 trace 에 기록한다.

### 브라우저 비의존 유사도 평가 설계

브라우저 없이도 평가 가능하게 하려면, 유사도 판단의 기준을 screenshot 이 아니라 **정규화된 scene 계약** 으로 바꿔야 한다.

핵심 원칙:

1. 원본 PDF는 canonical `ReplicaPageScene` 으로 정규화한다.
2. replica HTML도 정적 파서로 다시 읽어 `ReplicaNormalizedHtmlScene` 으로 정규화한다.
3. 두 정규화 결과를 직접 비교한다.
4. browser-based raster diff 는 있으면 쓰되, 없어도 offline 평가만으로 pass/fail 이 가능해야 한다.

### offline 평가 입력물

브라우저 비의존 평가기는 아래 4개 입력만 있으면 동작해야 한다.

1. `ReplicaDocumentProfile`
2. `ReplicaPageScene[]`
3. `replicaHtml`
4. 선택 입력: `HybridProbeArtifact`

### offline 평가 방식

#### 방식 1. Page Contract Validation

목적:

1. 페이지 수
2. 페이지 크기
3. 필수 layer 존재
4. forbidden 구조 존재 여부

검사 규칙:

1. page count mismatch 즉시 hard fail
2. page width/height mismatch 즉시 hard fail
3. `pdf-replica-v21` root 부재 즉시 hard fail
4. full-page background image 발견 즉시 hard fail
5. 필수 layer(`vector`, `text`, `placeholder`) 누락 시 hard fail

#### 방식 2. Text Anchor Similarity

목적:

1. 원본 text run 과 replica text node 의 위치/크기/문자열 유사도 평가

평가 규칙:

1. page별 text run matching
2. `bbox IoU`, `center distance`, `font-size delta`, `normalized text equality` 계산
3. label/value anchor 는 일반 텍스트보다 높은 가중치 부여

#### 방식 3. Vector Topology Similarity

목적:

1. 선, 사각형, 박스, 셀 경계, 체크박스 구조가 유지되었는지 평가

평가 규칙:

1. source `vectorPrimitives` 와 replica SVG primitive 비교
2. line endpoint tolerance, stroke width tolerance, rect IoU 계산
3. work-order/certificate 의 표 topology 는 critical metric 으로 취급

#### 방식 4. Image Fragment Coverage Similarity

목적:

1. logo, 도장, 서명, stamp fragment 가 적절히 유지되었는지 평가

평가 규칙:

1. fragment count
2. fragment bbox overlap
3. fragment role 일치 여부
4. 필요 시 fragment pHash 비교

#### 방식 5. Text Content Similarity

목적:

1. absolute 위치는 같아도 텍스트가 누락되거나 잘못 합쳐지는 문제를 검출

평가 규칙:

1. page별 normalized text sequence 비교
2. token F1
3. critical label recall

#### 방식 6. Placeholder Integrity Similarity

목적:

1. placeholder 삽입 이후 layout 이 깨졌는지 평가

평가 규칙:

1. placeholder inserted node count
2. placeholder bbox drift
3. placeholder 주변 static label 보존 여부

### 권장 metric ensemble

offline 평가는 단일 수치가 아니라 아래 가중 조합으로 계산한다.

| metric | 가중치 | 비고 |
|---|---:|---|
| `pageContractScore` | 0.20 | hard fail 과 별도로 score 집계 |
| `textAnchorScore` | 0.20 | label/value anchor 중요 |
| `vectorTopologyScore` | 0.25 | work-order/certificate 에서 가장 중요 |
| `imageFragmentScore` | 0.10 | 도장/서명/로고 복제 |
| `textContentScore` | 0.10 | 텍스트 누락 방지 |
| `placeholderIntegrityScore` | 0.10 | 템플릿화 안정성 |
| `annotationCoverageScore` | 0.05 | 링크/annotation 보존 |

### offline pass 기준

브라우저 비의존 strong pass 기준:

1. hard failure 0건
2. `pageContractScore = 1.0`
3. `textAnchorScore >= 0.995`
4. `vectorTopologyScore >= 0.995`
5. `overallScore >= 0.995`

브라우저 비의존 conditional pass 기준:

1. hard failure 0건
2. `overallScore >= 0.985`
3. 단, 이 경우는 개발용 확인으로만 사용하고 기본 승격 기준으로 쓰지 않는다.

### 브라우저 기반 평가와의 관계

1. 브라우저 기반 raster diff 가 가능하면 `browser + offline` 둘 다 실행한다.
2. 둘 다 성공하면 strongest pass 로 기록한다.
3. 브라우저 평가가 불가능하지만 offline strong pass 이면 `fallback-less provisional pass` 로 기록할 수 있다.
4. 단, 정식 승격 전에는 샘플 4건 중 최소 1회 이상 browser-based 검증을 권장한다.

### 디지털 PDF

순서:

1. `Document Profile Service` 가 digital 여부 확정
2. 필요 시 `Hybrid Probe Adapter` 가 annotation/raster/debug artifact 를 제공
3. `Digital PDF Scene Service` 가 text/vector/image scene 추출
4. probe 결과는 link 보강, mixed page 경계 진단, quality baseline 생성에만 사용
5. `Replica Composer Service` 가 `pdf-replica-v21` 생성
6. `Value Binding Service` 가 placeholder 주입
7. `Replica Quality Service` 가 시각 diff 평가
8. pass 시 `v21` 채택, fail 시 `v20` 복귀

### 스캔 PDF

순서:

1. `Document Profile Service` 가 scanned 여부 확정
2. `Hybrid Probe Adapter` 가 raster/OCR/link probe 를 생성
3. `Scanned PDF Scene Service` 가 rule/OCR/image fragment scene 생성
4. probe 결과는 OCR word box, mixed page token merge, low-confidence 영역 식별에 사용
5. `Replica Composer Service` 가 `pdf-replica-v21` 생성
6. `Value Binding Service` 가 low-confidence block 을 피해 placeholder 주입
7. `Replica Quality Service` 가 시각 diff 평가
8. pass 시 `v21` 채택, fail 시 `v20` 복귀

### 추가 원칙

1. `Hybrid Probe Adapter` 는 최종 HTML 을 반환하지 않는다.
2. `Hybrid Probe Adapter` 의 `pageHint` 는 최종 sourceMode 판정값이 아니다.
3. `v21` 에서 hybrid probe 는 선택적 보조 단계이며, 오케스트레이터가 호출 여부를 결정한다.

### 금지 규칙

아래는 `v21`에서 금지한다.

1. family 가 최종 layout 구조를 새로 만들어내는 것
2. value binding 단계가 table/div 구조를 다시 짜는 것
3. scanned PDF가 full-page frame-only output 으로 끝나는 것
4. final acceptance output 이 full-page raster background 에 의존하는 것
5. `Hybrid Probe Adapter` 의 raster/text overlay 결과를 최종 산출물로 승격하는 것

---

## family별 구현 원칙

### 1. Work Order

`work_order` family 의 목표는 "`작업지시서처럼 보이는 새 폼`" 이 아니라 "`그 작업지시서 원본 페이지를 복제하는 것`" 이다.

원칙:

1. 기존 `pdf-form-v*` 경로는 fallback snapshot 으로 유지
2. `v21` 에서는 row band synthetic table 을 기본 경로로 삼지 않음
3. scene 기반으로 실제 선, 칸, 서명영역, 본문 block 위치를 복제
4. pair section 도 `4-cell semantic grid` 가 아니라 page scene 기반 절대 위치에서 시작

### 2. Certificate

`사업자등록증` 계열은 표준 skeleton 으로 대체하지 않는다.

원칙:

1. `pdf-certificate-v19/v20` 는 fallback 으로만 유지
2. `v21` 은 증명서 원본의 label 위치, 테이블 선, 도장/기관명 위치를 그대로 scene 기반 복제
3. OCR 이 약한 영역은 low-confidence text 대신 image fragment 로 유지 가능
4. full-page image 는 금지, 부분 image fragment 만 허용

### 3. Generic Form

원칙:

1. family 인식이 약해도 scene 기반 replica 는 동일하게 수행
2. family-specific placeholder 규칙만 약하게 적용
3. generic path 가 synthetic table renderer 로 후퇴하지 않게 한다

---

## 단계별 구현 체크리스트

### `ENHANCE-01`

목표:

1. `v21` 버전 추가
2. `ReplicaDocumentProfile`, `ReplicaPageScene`, `ReplicaQualityReport` DTO 도입
3. `HybridProbeArtifact` DTO 도입
4. 기존 `v19/v20` 의미 고정

대상 파일:

1. `src/lib/templateExtractDtos.ts`
2. `src/lib/templateExtractReplicaDtos.ts`
3. `src/services/templateExtractVersionService.ts`

완료 기준:

1. 업로드 요청에서 `v21` 선택 가능
2. `v21` 전용 trace key 정의 완료
3. `Hybrid Probe Adapter` 입력/출력 계약 정의 완료
4. 기존 버전 동작 의미 변화 없음

예상 diff 파일:

1. `docs/diff/YYYY-MM-DD_ENHANCE-01_templateExtractDtos.before.ts`
2. `docs/diff/YYYY-MM-DD_ENHANCE-01_templateExtractVersionService.before.ts`

### `ENHANCE-02`

목표:

1. `Document Profile Service` 추가
2. digital/scanned/hybrid 판별 고정
3. `Hybrid Probe Adapter` 도입
4. family 는 scene 보조 정보로만 축소

대상 파일:

1. `src/services/templateExtractPdfDocumentProfileService.ts`
2. `src/services/templateExtractPdfFamilyService.ts`
3. `src/services/templateExtractPdfService.ts`
4. `src/services/templateExtractPdfHybridProbeService.ts`

완료 기준:

1. 샘플 4건 profile JSON 이 안정적으로 나온다.
2. detection reasons 가 trace 로 기록된다.
3. hybrid probe 결과가 profile/scene 의 보조 자료로만 연결된다.

예상 diff 파일:

1. `docs/diff/YYYY-MM-DD_ENHANCE-02_templateExtractPdfFamilyService.before.ts`
2. `docs/diff/YYYY-MM-DD_ENHANCE-02_templateExtractPdfService.before.ts`

### `ENHANCE-03`

목표:

1. digital canonical scene 추출기 도입
2. text, vector, image fragment, annotation box 를 추출
3. probe 기반 link/annotation 힌트를 흡수
4. 기존 topology 는 파생값으로만 유지

대상 파일:

1. `src/services/templateExtractPdfSceneService.ts`
2. `src/services/templateExtractPdfLayoutService.ts`

완료 기준:

1. `대구침산더샵`, `사일동 주상복합` 에서 vector/text/image scene 이 생성된다.
2. scene 기반으로 page size 1:1 유지 가능

예상 diff 파일:

1. `docs/diff/YYYY-MM-DD_ENHANCE-03_templateExtractPdfLayoutService.before.ts`

### `ENHANCE-04`

목표:

1. scanned canonical scene 추출기 도입
2. frame-only fallback 의존도 제거
3. probe OCR 결과를 보조 자료로 연결
4. low-confidence OCR 영역을 image fragment 로 전환 가능하게 함

대상 파일:

1. `src/services/templateExtractPdfScannedSceneService.ts`
2. `src/services/templateExtractPdfTextRecoveryService.ts`

완료 기준:

1. `부전마산2공구`, `사업자등록증` 이 frame-only/skeleton-only 가 아니라 scene 기반 replica 입력으로 전환된다.

예상 diff 파일:

1. `docs/diff/YYYY-MM-DD_ENHANCE-04_templateExtractPdfTextRecoveryService.before.ts`

### `ENHANCE-05`

목표:

1. `Replica Composer Service` 추가
2. final clone id 를 `pdf-replica-v21` 로 고정
3. full-page background image 없이 vector/image/text layer 조합
4. hybrid overlay HTML 직접 반환 구조 제거

대상 파일:

1. `src/services/templateExtractPdfReplicaComposerService.ts`
2. `src/services/templateExtractPdfService.ts`

완료 기준:

1. 샘플 4건 모두 `pdf-replica-v21` 출력 가능
2. trace 에 render mode, fallback reason 기록

예상 diff 파일:

1. `docs/diff/YYYY-MM-DD_ENHANCE-05_templateExtractPdfService.before.ts`

### `ENHANCE-06`

목표:

1. value binding 을 layout 이후 단계로 강제
2. binding 이 scene/html 을 재구성하지 못하게 고정

대상 파일:

1. `src/services/templateExtractValueBindingService.ts`
2. `src/services/templateExtractCloneService.ts`
3. `src/services/templateExtractService.ts`

완료 기준:

1. placeholder 주입 후 DOM layout 구조가 변하지 않는다.
2. binding map 과 candidate 가 anchor box 를 가진다.

예상 diff 파일:

1. `docs/diff/YYYY-MM-DD_ENHANCE-06_templateExtractValueBindingService.before.ts`
2. `docs/diff/YYYY-MM-DD_ENHANCE-06_templateExtractCloneService.before.ts`

### `ENHANCE-07`

목표:

1. `Replica Quality Service` 추가
2. browser-based visual similarity gate 도입
3. browser-free similarity gate 도입
4. pass/fail 시 fallback 정책 명시

대상 파일:

1. `src/services/templateExtractReplicaQualityService.ts`
2. `src/services/templateExtractPdfService.ts`
3. `src/services/templateExtractReplicaOfflineQualityService.ts`
4. `src/services/templateExtractReplicaHtmlNormalizerService.ts`

완료 기준:

1. 샘플 4건에 대해 browser mode 와 offline mode 중 가능한 평가가 수행된다.
2. browser unavailable 상황에서도 offline metric ensemble 이 계산된다.
3. threshold 미달 시 `v20` fallback 과 reason 이 trace 에 남는다.

예상 diff 파일:

1. `docs/diff/YYYY-MM-DD_ENHANCE-07_templateExtractPdfService.before.ts`
2. `docs/diff/YYYY-MM-DD_ENHANCE-07_templateExtractReplicaQualityService.before.ts`

### `ENHANCE-08`

목표:

1. `/templates/extract` UI 에 `v21` trace 와 quality score 를 노출
2. 기존 컴포넌트만 사용
3. 사용자 비교가 쉬운 상태로 유지

대상 파일:

1. `src/app/templates/extract/page.tsx`
2. `src/app/api/templates/extract/route.ts`

완료 기준:

1. 사용자가 `cloneId`, `sourceMode`, `quality pass/fail`, `fallback reason` 을 UI에서 확인 가능
2. `/src/components` 수정 없음

예상 diff 파일:

1. `docs/diff/YYYY-MM-DD_ENHANCE-08_extract-page.before.tsx`
2. `docs/diff/YYYY-MM-DD_ENHANCE-08_extract-route.before.ts`

---

## fallback/rollback 정책

### `v21` acceptance 정책

`v21` 은 아래 조건을 모두 만족할 때만 primary output 으로 채택한다.

1. HTML 생성 성공
2. quality report 생성 성공
3. 아래 둘 중 하나를 만족
   - browser mode: mismatch pixel ratio 기준 통과
   - offline mode: hard failure 0건 + offline strong pass 기준 통과
4. required scene layer 누락 없음
5. 최종 artifact 가 full-page raster image fallback 이 아님

### fallback 정책

통과 실패 시 아래 우선순위로 복귀한다.

1. digital work_order -> 기존 `v20` 결과
2. scanned work_order -> 기존 `v20` 결과
3. certificate -> 기존 `v20` 결과
4. 모든 fallback 은 trace 에 반드시 남긴다.

trace 예시:

```html
<section
  data-template-engine-version="21"
  data-template-clone="pdf-replica-v21"
  data-template-render-mode="scene_replica"
  data-template-quality-pass="false"
  data-template-fallback-engine-version="20"
  data-template-fallback-reason="mismatch-pixel-ratio-exceeded"
>
```

중요:

1. fallback 이 있더라도 `v21` 이 실패했다는 사실을 숨기지 않는다.
2. fallback 경로를 성공으로 오해하게 만드는 UI/trace 금지

---

## DB 및 저장소 정책

### 현재 결정

이번 설계 범위에서는 DB 스키마를 바꾸지 않는다.

이유:

1. 현재 `template_extracts` 스키마는 실제 실행 DB와 MCP 연결 대상 불일치 가능성이 있다.
2. 우선은 `v21` scene/quality/report 를 메모리/응답/trace attribute 수준에서 검증하는 편이 안전하다.
3. 저장 구조를 성급히 DB에 박으면 서비스 분리 전에 결합이 생긴다.

### 데이터 소유권

1. `template_extracts.extract_drafts` 는 최종 draft HTML 정본
2. `extract_field_candidates` 는 placeholder 후보 정본
3. `ReplicaPageScene`, `ReplicaQualityReport` 는 초기 단계에서 request-scope artifact 로만 유지

### 향후 DB 변경이 필요해질 경우

1. 즉시 중단
2. `/docs` 아래 SQL 문서 작성
3. 사용자 승인 후 실행
4. 실행 완료 후 `/docs/applied` 로 이동

---

## 테스트 및 검증 설계

### 필수 샘플

매 구현 단계마다 아래 4건으로 회귀 테스트한다.

1. `docs/사업자등록증.pdf`
2. `docs/작업지시서_대구침산더샵.pdf`
3. `docs/작업지시서_부전마산2공구.pdf`
4. `docs/작업지시서_사일동 주상복합.pdf`

### 필수 검증 항목

1. `cloneId`
2. `sourceMode`
3. `documentFamily`
4. `cloneBuilder`
5. `quality pass/fail`
6. `quality mode`
7. `mismatchPixelRatio`
8. `offline overallScore`
9. `offline hardFailures`
10. `value marker count`
11. DOM layer 구성 여부

### 브라우저 비의존 검증 절차

브라우저 접근이 불가능한 턴에서는 아래 순서로 평가한다.

1. PDF -> `ReplicaPageScene` 생성
2. replica HTML -> `ReplicaNormalizedHtmlScene` 생성
3. `pageContractScore` 계산
4. `textAnchorScore` 계산
5. `vectorTopologyScore` 계산
6. `imageFragmentScore` 계산
7. `textContentScore` 계산
8. `placeholderIntegrityScore` 계산
9. weighted `overallScore` 계산
10. strong pass / conditional pass / fail 판정

기록 규칙:

1. `chrome-devtools` 가 실패해도 평가 자체를 생략하지 않는다.
2. 이 경우 `quality mode = offline` 으로 기록한다.
3. browser-based 결과가 없다는 사실도 함께 기록한다.

### MCP 테스트 의무 기록 방식

각 구현 턴마다 문서 하단 또는 `docs/total-todo.md` 에 아래 형식으로 남긴다.

```md
- 날짜: YYYY-MM-DD
  - 체크리스트 ID: ENHANCE-XX
  - Supabase MCP:
    - 시도 내용
    - 성공/실패
    - 실패 이유 또는 반환값
  - Chrome DevTools MCP:
    - 시도 내용
    - 성공/실패
    - 실패 이유 또는 반환값
  - CLI/번들 테스트:
    - 실행 명령
    - 결과
```

---

## 2026-04-17 실제 확인 기록

### 이해 확정

1. 사용자 요청 이해 정리 후 확인 요청 수행
2. 사용자 응답: `확정`

### 샘플 PDF 확인 결과

1. `사업자등록증.pdf` -> text layer 없음
2. `작업지시서_대구침산더샵.pdf` -> text layer 있음
3. `작업지시서_부전마산2공구.pdf` -> text layer 없음
4. `작업지시서_사일동 주상복합.pdf` -> text layer 있음

### 추출 엔진 직접 확인 결과

1. `작업지시서_대구침산더샵.pdf` `v20` -> `pdf-form-v20`, `work_order_family_legacy_digital`
2. `작업지시서_사일동 주상복합.pdf` `v20` -> `pdf-form-v20`, `work_order_family_legacy_digital`
3. `작업지시서_부전마산2공구.pdf` `v20` -> `pdf-frame-v20`, `work_order_family_frame_scanned`
4. `사업자등록증.pdf` `v20` -> `pdf-certificate-v20`, `certificate_family_scanned`

### 외부 제안 코드 검토 결과

검토 대상:

1. `docs/templateExtractVersionService.ts`
2. `docs/templateExtractPdfHybridCloneService.ts`

결론:

1. `VersionService` 의 실험 경로 캡슐화 방식은 수용
2. `pdf.js + raster + OCR probe` 방식은 수용
3. `full-page background image + invisible text layer final clone` 은 거절
4. `v19/v20 hybrid-first 재정의` 는 거절
5. `TemplateExtractPdfHybridCloneService` 는 최종 clone service 가 아니라 `Hybrid Probe Adapter` 역할로 축소

### Supabase MCP

시도:

1. `list_tables(schemas=['template_extracts'])`
2. `list_tables(schemas=['public'])`

결과:

1. `template_extracts` -> 빈 결과
2. `public` -> 테이블 목록 반환

판단:

1. 현재 MCP 연결 대상과 실제 앱 실행 DB가 다를 가능성이 높다.
2. 이번 설계 범위에서 DB 변경은 수행하지 않는다.

### Chrome DevTools MCP

시도:

1. `/templates/extract` 새 페이지 연결
2. 기존 페이지 목록 확인

결과:

1. 기존 Chrome profile lock 으로 실패
2. 오류 메시지: browser already running / profile lock

판단:

1. 이번 턴은 Chrome MCP 성공 검증을 완료하지 못했다.
2. 후속 구현 턴마다 재시도하고, 실패 시 실패 자체를 기록한다.

### 이번 업데이트 턴 재시도 기록

시도:

1. `supabase.list_tables(schemas=['template_extracts'])`
2. `chrome-devtools.list_pages()`

결과:

1. Supabase MCP -> `Auth required`
2. Chrome DevTools MCP -> 기존 Chrome profile lock 지속

판단:

1. 현재 MCP 상태는 문서/구현 검토에는 참고 수준으로만 사용한다.
2. 후속 구현 턴에서는 이 상태를 먼저 해소하거나, 실패 자체를 테스트 기록으로 남긴다.

### 이번 브라우저 비의존 평가 설계 턴 재시도 기록

시도:

1. `supabase.list_tables(schemas=['template_extracts'])`
2. `chrome-devtools.list_pages()`

결과:

1. Supabase MCP -> `Auth required`
2. Chrome DevTools MCP -> 기존 Chrome profile lock 지속

판단:

1. 이번 턴 설계의 핵심은 browser-free evaluation 이므로, Chrome 미접근 상태에서도 평가 설계를 수행할 수 있어야 한다.
2. 따라서 offline quality gate 는 MCP/브라우저 접근 실패를 전제로도 성립해야 한다.

### 로컬 CLI 확인

실행 방식:

1. `Swift + PDFKit` 로 text layer 존재 여부 확인
2. `esbuild` 로 임시 inspection script bundle
3. `TemplateExtractPdfService.extractPdfSource()` 직접 호출

결과:

1. 샘플 4건의 sourceMode/family/cloneBuilder 상태를 직접 확인했다.
2. 현재 경로가 page-faithful replica 가 아니라 family-aware synthetic builder 중심이라는 근거를 확보했다.

---

## 최종 설계 결론

이 문제는 정규식, OCR 튜닝, section alias 추가로 해결되지 않는다.

`99.9% 시각 유사성`을 만족하려면 반드시 아래 방향으로 구조를 바꿔야 한다.

1. `family builder` 중심에서 `canonical page scene` 중심으로 전환
2. `v21` 고정 버전으로 실험 경로 분리
3. full-page image fallback 금지
4. value binding 을 layout 이후 단계로 강제
5. visual diff 품질 게이트 도입
6. 모든 변경을 체크리스트 + `docs/diff` 기준으로 관리

이 문서의 목적은 "`어떤 문서를 어떤 builder 로 흉내 낼까`" 를 늘리는 것이 아니라,  
**"원문 페이지를 HTML/CSS/SVG 레이어로 복제하는 독립 서비스 구조"** 를 고정하는 데 있다.
