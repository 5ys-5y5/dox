# 이미지 텍스트 추출 설계 문서

## 문서 메타
- 작성일: 2026-04-26
- 대상 기능: `/templates/extract` 의 `텍스트 추출 > 이미지 모드`
- 사용자 확정 상태: 확정 완료
- 근거 로그:
  - `docs/2026-04-26_22-32-36_47_template-extract-log_316c5a42-763a-4084-b0fa-790e2f30c942.md`
  - 로컬 재현: `docs/사업자등록증.pdf` 에 대한 `--force-ocr` 결과

## 실행 정책 (필수 준수)
아래 정책은 본 설계 또는 후속 수정에서 100% 준수한다.

1. 수정 전 이해확정 절차
- 현재 요청의 이해 내용을 먼저 정리했고, 사용자가 `확정` 응답을 통해 수정 범위를 승인했다.
- 승인 없이 수정에 착수하지 않는다.

2. 변경 기록 및 롤백 보장
- 코드 수정 직전 상태를 반드시 `docs/diff` 에 기록한다.
- 기록 파일명에는 체크리스트 ID를 포함한다.
- 기록은 수정 파일의 전체본 또는 수정 구간을 충분히 포함하는 전체 스냅샷이어야 한다.

3. 확정 범위 외 수정 금지
- 아래 화이트리스트 파일 외 수정 금지.
- 추가 파일이 필요하면 즉시 중단하고 사용자 승인 후 확장한다.

4. 체크리스트 작성
- 체크리스트 ID를 기준으로 설계, diff, 구현, 테스트를 서로 연결한다.
- 후속 LLM은 체크리스트 ID만 봐도 어느 단계가 완료되었는지 판단할 수 있어야 한다.

5. MCP 테스트 의무
- 매 실행마다 `supabase` MCP 와 `chrome-devtools` MCP 테스트를 시도한다.
- DB 변경이 필요하면 SQL만 제안하고 직접 DB 수정은 하지 않는다.
- 테스트 결과는 본 문서 하단 테스트 기록에 남긴다.

## 수정 허용 화이트리스트 (필수 준수)
아래 파일만 수정 가능하다.

1. `docs/imgText.md`
- 목적: 이미지 텍스트 추출 전용 설계 문서 기록

2. `scripts/template-extract-frame-text-v112.py`
- 목적: 이미지 모드 OCR 엔진 개선

3. `src/services/templateExtractFrameTextService.ts`
- 목적: 이미지 모드 OCR 서비스 진입 계약 정리

4. `src/app/api/templates/extract/frame-text/route.ts`
- 목적: 이미지 모드 OCR API 계약 정리

5. `src/app/templates/extract/page.tsx`
- 목적: 이미지/비이미지 모드 분리 계약, 이미지 모드 요청 payload 구성, 결과 반영

6. `src/lib/templateExtractDtos.ts`
- 목적: 프레임 기능 public 버전 접두사(`fv`) 계약 정의

7. `src/app/api/templates/extract/route.ts`
- 목적: 프레임 기능 public 버전 접두사(`fv`) 입력 정규화

8. `src/services/templateExtractPdfRasterFirstReplicaService.ts`
- 목적: 프레임 기능 public 버전(`fv`)과 Python legacy 버전(`v`) 사이의 boundary 매핑

9. `src/services/templateExtractPdfService.ts`
- 목적: 프레임 기능 기본 버전 값을 public 버전 체계로 맞춤

10. `src/services/templateExtractVersionService.ts`
- 목적: 프레임 기능 기본 버전 값을 public 버전 체계로 맞춤

11. `src/components/template/TemplateDraftWorkspace.tsx`
- 목적: 프레임 편집기에서 public 버전 접두사(`fv`)를 인식하고 legacy 마크업과 공존

## 서비스 독립성 설계 원칙
이미지 텍스트 추출 기능은 향후 별도 서비스로 분리 가능한 단위로 설계한다.

### 기능 A. 비 이미지 텍스트 추출 서비스
1. 기능 목적
- 디지털 PDF / HTML / 텍스트 레이어가 존재하는 문서에서 좌표 기반 텍스트를 프레임에 매핑한다.

2. 단독 서비스로서의 가치
- OCR 비용 없이 빠르고 안정적으로 텍스트를 복원한다.
- 디지털 문서 처리 SLA 를 별도로 가져갈 수 있다.

3. 책임 범위
- 렌더 모델 기반 텍스트 복원
- 프레임 위치와 디지털 텍스트 아이템의 매핑

4. 비책임 범위
- 스캔형 문서 OCR
- 이미지 전처리
- OCR 모델 선택

5. API 계약
- 입력: `renderModel`, `framePlans`
- 출력: `frameExtractedTextState`

6. 데이터 소유권
- 프레임 좌표와 디지털 텍스트 매핑 결과만 소유

7. 의존 서비스
- 프레임 생성 서비스
- HTML/renderModel 파서

8. 분리 배포 시 최소 조건
- renderModel 수신 API
- framePlans DTO
- 결과 반환 DTO

### 기능 B. 이미지 텍스트 추출 서비스
1. 기능 목적
- 스캔형 PDF / 이미지형 문서에서 OCR 을 통해 프레임별 텍스트를 복원한다.

2. 단독 서비스로서의 가치
- OCR 비용, 모델, 전처리 전략을 독립 배포/튜닝 가능
- 디지털 문서 파이프라인과 장애 전파를 분리 가능

3. 책임 범위
- 이미지 판별된 문서의 OCR
- 프레임 crop 단위 전처리
- OCR 모드 선택
- OCR 결과를 프레임 DTO 로 반환

4. 비책임 범위
- 프레임 생성 자체
- 디지털 텍스트 레이어 읽기
- 교차 검증 UI

5. API 계약
- 입력: `pdfFile`, `framePlans`, `mode=image`, `imageOcrVersion=iv1.00`
- 출력: `frameExtractedTextState`, `pageDiagnostics`, `ocrDebugNotes`

6. 데이터 소유권
- OCR 결과물
- 이미지 전처리 파라미터
- OCR 진단 정보

7. 의존 서비스
- 프레임 생성 서비스
- OCR 엔진(Tesseract)
- PDF rasterizer(PyMuPDF)

8. 분리 배포 시 최소 조건
- PDF 업로드 API
- framePlans DTO
- OCR 엔진 런타임
- 진단 로그 저장 포맷

## 공식 출처 기반 현재 실패 진단
아래 진단은 추측이 아니라 공식 출처의 실패 가이드와 현재 로그를 대조한 결과다.

### 출처 1. Tesseract ImproveQuality
- 링크: https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
- 확인한 가이드:
  - Tesseract 는 최소 300 DPI 수준에서 더 잘 동작한다.
  - 내부 전처리가 잘못될 수 있으므로 `tessedit_write_images` 로 입력 이미지를 확인해야 한다.
  - 작은 crop / 특수 레이아웃은 적절한 PSM 선택이 중요하다.
  - 너무 타이트한 crop 은 흰 여백(border)을 추가하는 것이 좋다.
  - 사전 기반 보정이 불필요한 데이터(코드, 번호)는 dictionary 비활성화가 유리할 수 있다.

### 출처 2. Tesseract Command-Line Usage
- 링크: https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html
- 확인한 가이드:
  - `--psm 6` 은 균일한 텍스트 block
  - `--psm 7` 은 single text line
  - `--psm 11` 은 sparse text
  - 레이아웃에 맞지 않는 PSM 은 정확도를 크게 떨어뜨린다.

### 출처 3. Tesseract FAQ / 프로젝트 문서 전반
- 링크: https://tesseract-ocr.github.io/tessdoc/
- 확인한 가이드:
- 표(table)와 복잡한 레이아웃은 OCR 엔진이 그대로 잘 이해한다고 가정하면 안 된다.
- 레이아웃 분석 또는 외부 segmentation 이 필요한 케이스가 있다.

### 출처 4. Hugging Face Transformers TrOCR 문서
- 링크: https://huggingface.co/docs/transformers/en/model_doc/trocr
- 확인한 가이드:
  - TrOCR 는 `VisionEncoderDecoderModel` 기반의 Transformer OCR 이다.
  - inference 는 `TrOCRProcessor` 와 `VisionEncoderDecoderModel.generate()` 조합으로 수행한다.
  - 로컬 런타임은 `transformers` 와 PyTorch 설치가 선행되어야 한다.

### 출처 5. Hugging Face Transformers 설치 문서
- 링크: https://huggingface.co/docs/transformers/en/installation
- 확인한 가이드:
  - PyTorch 와 Transformers 는 별도 설치가 필요하다.
  - sentencepiece / tokenizers / safetensors 같은 런타임 의존성이 누락되면 tokenizer/model 로드가 실패할 수 있다.

### 출처 6. PyTorch 설치 문서
- 링크: https://pytorch.org/get-started/locally/
- 확인한 가이드:
  - CPU / CUDA 환경에 따라 torch 설치 경로가 달라진다.
  - torch 미설치 환경에서는 Transformer OCR 런타임을 실행할 수 없다.

### 출처 7. `ddobokki/ko-trocr` 모델 카드
- 링크: https://huggingface.co/ddobokki/ko-trocr
- 확인한 가이드:
  - 한국어 OCR 용 TrOCR weight 이며, tokenizer 와 model 을 같은 repo 에서 불러와 사용한다.
  - 예제도 `VisionEncoderDecoderModel` 과 tokenizer decode 경로를 함께 사용한다.

## 현재 구현의 출처 대조 결과
### 문제 1. 전체 페이지 OCR
- 현재 이미지 모드 legacy `iv1.00` 는 문서 전체를 한 번 OCR 한 뒤 프레임에 매핑한다.
- `사업자등록증.pdf` 는 표/격자형 문서다.
- 공식 문서 관점에서 이는 “layout segmentation 없이 table-like 문서를 한 번에 OCR” 하는 실패 케이스에 가깝다.
- 현재 로그의 `|자이`, `주민 인)등록번번호|`, `2026410428 13일` 같은 값은 이 증상과 일치한다.

### 문제 2. DPI 부족
- 현재 raster scale `2.6` 은 PDF 72dpi 좌표계 기준 약 `187dpi` 이다.
- 공식 가이드의 300dpi 권장에 못 미친다.

### 문제 3. PSM 부적합
- 현재는 페이지 전체에 대해 사실상 고정된 OCR pass 를 사용한다.
- 하지만 실제 프레임은 단일 라벨, 단일 값, multiline 값, sparse 표 셀로 나뉜다.
- 공식 문서 기준으로 frame 유형에 따라 `psm 7 / 6 / 11` 을 나눠 써야 한다.

### 문제 4. 테두리/여백 부족
- 프레임 crop 은 OCR 대상이 셀 경계에 매우 가깝다.
- 공식 문서는 작은 crop 에 white border 를 추가할 것을 권장한다.

## 구현 전략
### 전략 원칙
- 비 이미지 모드는 절대 건드리지 않는다.
- 이미지 모드는 `iv1.00` 부터 별도 서비스 계약을 가진다.
- 전체 페이지 OCR 후 프레임 매핑이 아니라, `프레임 단위 crop OCR` 로 전환한다.

## 2026-04-27 확장 전략
이번 요청부터는 이미지 OCR 을 Tesseract 확장선이 아니라 별도 Transformer 버전으로 분리한다.

### 전략 원칙
- `iv1.00` 은 기존 Tesseract frame-crop OCR 경로를 그대로 유지한다.
- `iv2.00` 은 Transformer OCR 전용 경로를 새로 추가한다.
- `iv2.00` 추가가 `iv1.00`, `niv*`, `fv*` 로직에 영향을 주지 않도록 API, 서비스, Python 스크립트에서 모두 version gate 를 둔다.
- 프레임 버전은 public prefix `fv`, 비 이미지 텍스트 버전은 `niv`, 이미지 텍스트 버전은 `iv` 로 구분한다.

### 기능 C. 이미지 텍스트 추출 Transformer 서비스 (`iv2.00`)
1. 기능 목적
- 스캔형 PDF / 이미지형 문서에서 Transformer 기반 line OCR 로 프레임별 텍스트를 복원한다.

2. 단독 서비스로서의 가치
- Tesseract 품질 한계를 넘기 위해 OCR 엔진 자체를 교체할 수 있다.
- 모델 교체(`ko-trocr` -> 다른 Transformer OCR)와 성능 테스트를 독립 배포로 운영할 수 있다.

3. 책임 범위
- 프레임 crop 기반 Transformer OCR
- line segmentation
- Transformer 모델 로드 / 추론 / 진단 정보 반환

4. 비책임 범위
- 프레임 생성
- 비 이미지 텍스트 추출
- 교차 검증 계산

5. API 계약
- 입력: `pdfFile`, `framePlans`, `mode=image`, `imageOcrVersion=iv2.00`
- 출력: `frameExtractedTextState`, `pageModes`, `frameDebug`, `cloneId=pdf-frame-text-image-iv2.00`

6. 데이터 소유권
- Transformer OCR 결과
- 모델 ID
- 추론 variant / line segmentation 진단 정보

7. 의존 서비스
- 프레임 생성 서비스
- PDF rasterizer(PyMuPDF)
- Transformer runtime(`torch`, `transformers`, tokenizer assets)

8. 분리 배포 시 최소 조건
- PDF 업로드 API
- framePlans DTO
- PyTorch
- Transformers
- Hugging Face model cache 또는 네트워크 다운로드 경로

### 전략 상세
1. 이미지 모드 입력 계약 변경
- 클라이언트는 이미지 모드일 때 `pdfFile + framePlans + mode=image + imageOcrVersion=iv1.00` 을 전송한다.
- `framePlans` 는 `pageNumber`, `frameRect`, `frameKey`, `sourceTextHint`, `group metadata` 를 포함한다.

2. 이미지 모드 서버 처리
- PDF 페이지를 300dpi 이상으로 rasterize 한다.
- 각 framePlan 별로 crop 이미지를 생성한다.
- crop 바깥에 white border 를 추가한다.
- border 추가 후 OCR 을 실행한다.

3. 이미지 모드 OCR pass 선택 규칙
- 단일 line 추정 frame: `psm 7`
- 일반 block frame: `psm 6`
- sparse/불규칙 frame: `psm 11`
- 숫자/코드형 value 후보는 dictionary off 유지, 필요시 whitelist 후보 pass 추가

4. 디버그 가시성
- 이미지 모드 전용 진단 정보에 다음을 남긴다.
  - page raster dpi
  - frame crop size
  - 선택된 psm
  - 사용한 threshold variant
  - best pass score
- source 기준 디버그를 위해 `tessedit_write_images` 기반 확인 경로를 남긴다.

5. 결과 조립
- 이미지 모드는 서버가 바로 `frameExtractedTextState` 또는 그에 준하는 frame-keyed OCR 결과를 반환한다.
- 클라이언트는 비 이미지 모드의 local candidate assignment 를 재사용하지 않는다.

## 구현 단계 체크리스트
- [x] `IMG-TXT-001` 현재 이미지 모드 계약 분석 완료
- [x] `IMG-TXT-002` 공식 출처 실패 케이스 정리 완료
- [x] `IMG-TXT-003` 이미지 모드 API 계약을 framePlan 기반으로 변경
- [x] `IMG-TXT-004` 이미지 모드 OCR 을 전체 페이지 기반에서 프레임 crop 기반으로 전환
- [x] `IMG-TXT-005` 300dpi 이상 raster 기준 적용
- [x] `IMG-TXT-006` white border / psm 분기 / dictionary 설정 반영
- [x] `IMG-TXT-007` 이미지 모드 전용 진단 정보 추가
- [x] `IMG-TXT-008` 비 이미지 모드와 코드 경계 분리 검증
- [x] `IMG-TXT-009` chrome-devtools 테스트
- [x] `IMG-TXT-010` supabase MCP 테스트
- [x] `IMG-TXT-200` Transformer OCR 공식 출처 검토
- [x] `IMG-TXT-201` `iv2.00` version gate 추가
- [x] `IMG-TXT-202` `iv2.00` Transformer OCR runtime lazy import 추가
- [x] `IMG-TXT-203` `ddobokki/ko-trocr` 기반 line OCR 추론 경로 추가
- [x] `IMG-TXT-204` `iv1.00` Tesseract 경로와 `iv2.00` Transformer 경로 분리 검증
- [x] `IMG-TXT-205` 프레임 public 버전 접두사 `fv*` 도입
- [x] `IMG-TXT-206` 비 이미지 public 버전 접두사 `niv*` 도입
- [x] `IMG-TXT-207` 이미지 public 버전 접두사 `iv*` 도입
- [x] `IMG-TXT-208` chrome-devtools UI 버전 표기 검증

## diff 기록 계획
- `IMG-TXT-003`
  - 대상: `src/app/templates/extract/page.tsx`
  - 백업 파일: `docs/diff/2026-04-26_22-40-30_IMG-TXT-003_page.tsx.before`

- `IMG-TXT-004`
  - 대상: `scripts/template-extract-frame-text-v112.py`
  - 백업 파일: `docs/diff/2026-04-26_22-40-30_IMG-TXT-004_template-extract-frame-text-v112.py.before`

- `IMG-TXT-005`
  - 대상: `scripts/template-extract-frame-text-v112.py`
  - 백업 파일: `docs/diff/2026-04-26_22-40-30_IMG-TXT-004_template-extract-frame-text-v112.py.before`

- `IMG-TXT-006`
  - 대상: `scripts/template-extract-frame-text-v112.py`
  - 백업 파일: `docs/diff/2026-04-26_22-40-30_IMG-TXT-004_template-extract-frame-text-v112.py.before`

- `IMG-TXT-007`
  - 대상: `src/services/templateExtractFrameTextService.ts`, `src/app/api/templates/extract/frame-text/route.ts`
  - 백업 파일:
    - `docs/diff/2026-04-26_22-40-30_IMG-TXT-007_templateExtractFrameTextService.ts.before`
    - `docs/diff/2026-04-26_22-40-30_IMG-TXT-007_frame-text-route.ts.before`

- `IMG-TXT-200` ~ `IMG-TXT-208`
  - 대상:
    - `docs/imgText.md`
    - `scripts/template-extract-frame-text-v112.py`
    - `src/services/templateExtractFrameTextService.ts`
    - `src/app/api/templates/extract/frame-text/route.ts`
    - `src/app/templates/extract/page.tsx`
    - `src/lib/templateExtractDtos.ts`
    - `src/app/api/templates/extract/route.ts`
    - `src/services/templateExtractPdfRasterFirstReplicaService.ts`
    - `src/services/templateExtractPdfService.ts`
    - `src/services/templateExtractVersionService.ts`
    - `src/components/template/TemplateDraftWorkspace.tsx`
  - 백업 파일:
    - `docs/diff/2026-04-27_07-55-41_IMG-TXT-200_imgText.md.before`
    - `docs/diff/2026-04-27_07-55-41_IMG-TXT-201_template-extract-frame-text-v112.py.before`
    - `docs/diff/2026-04-27_07-55-41_IMG-TXT-202_templateExtractFrameTextService.ts.before`
    - `docs/diff/2026-04-27_07-55-41_IMG-TXT-203_frame-text-route.ts.before`
    - `docs/diff/2026-04-27_07-55-41_IMG-TXT-204_page.tsx.before`
    - `docs/diff/2026-04-27_07-55-41_IMG-TXT-205_templateExtractDtos.ts.before`
    - `docs/diff/2026-04-27_07-55-41_IMG-TXT-206_extract-route.ts.before`
    - `docs/diff/2026-04-27_07-55-41_IMG-TXT-207_templateExtractPdfRasterFirstReplicaService.ts.before`
    - `docs/diff/2026-04-27_07-55-41_IMG-TXT-208_TemplateDraftWorkspace.tsx.before`

## 구현 결과
1. 이미지 모드 전용 API 계약
- `page.tsx` 는 이미지 모드일 때 현재 프레임 DOM 으로부터 `framePlans` 를 계산해 서버에 전송한다.
- `route.ts` 는 `framePlans` shape 검증 후 서비스에 전달한다.
- `templateExtractFrameTextService.ts` 는 `frame-plans.json` 임시 파일을 만들어 Python 이미지 OCR 엔진에 전달한다.

2. 이미지 모드 전용 OCR 엔진
- `template-extract-frame-text-v112.py` 는 `--force-ocr` 와 `--frame-plans-json-file` 이 같이 들어온 경우에만 전용 frame-crop OCR 경로를 사용한다.
- 디지털 문서 경로는 그대로 유지되며, 이미지 모드 전용 경로와 런타임 책임이 분리되어 있다.
- frame 단위로 다음을 수행한다.
  - 300dpi 이상 raster scale 강제
  - 프레임 border 제거용 inner crop
  - Tesseract 공식 문서 기준 border 추가
  - `psm 7 / 8 / 11 / 13 / 6` 후보 선택
  - `threshold220 / 230 / 240 / adaptive_gaussian / gray` 후보 pass 실행
  - `image_to_data` 와 `image_to_string` 를 병렬 후보로 평가
  - 숫자 전용 whitelist 는 실제 숫자/기호-only 힌트에만 적용
  - 날짜형 결과는 `YYYY년 MM월 DD일` 로 후처리 정규화

3. 진단 정보
- 응답 `diagnostics` 에 `pageModes`, `frameResults`, `frameDebug` 를 남긴다.
- `frameDebug` 는 프레임 key, 사용한 `psm`, preprocessing 이름, confidence, crop pixel 크기, raster scale 을 포함한다.

4. Transformer OCR 확장 (`IMG-TXT-200` ~ `IMG-TXT-204`)
- 이미지 모드 요청은 `imageOcrVersion=iv1.00|iv2.00` 을 함께 전송한다.
- `iv1.00` 은 기존 Tesseract 경로를 그대로 유지한다.
- `iv2.00` 은 `torch`, `transformers`, `TrOCRProcessor`, `VisionEncoderDecoderModel`, tokenizer 를 lazy import 한다.
- 모델 ID 기본값은 `ddobokki/ko-trocr` 이고, `TEMPLATE_EXTRACT_IMAGE_TROCR_MODEL_ID` 로 교체 가능하다.
- frame crop 은 line box 로 다시 쪼개서 line 단위 TrOCR inference 후 multiline 으로 합친다.
- 현재 로컬 venv 에는 `torch 2.8.0`, `transformers 4.57.6`, `sentencepiece 0.2.1`, `safetensors 0.7.0` 이 설치되어 있다.

6. 좌표계 정규화 보정 (`IMG-TXT-300`)
- 이미지 모드 `framePlans` 는 DOM/CSS px 기준 프레임 좌표를 보낸다.
- Python crop 은 PDF point 좌표계에서 수행되므로, 이미지 모드 경로에는 `coordinateSpace`, `viewportWidth`, `viewportHeight`, `pdfPageWidth`, `pdfPageHeight` 를 함께 전송해야 한다.
- Python 은 OCR 전에 `css-px -> pdf-pt` 정규화를 수행하고, 그 결과 rect 를 기준으로만 crop 한다.
- diagnostics 에는 원본 입력 rect, viewport 크기, PDF 크기, 정규화된 PDF rect, 실제 crop px rect 를 남긴다.
- 이 보정은 이미지 모드 OCR 경로에만 적용하고, 프레임 생성과 비 이미지 텍스트 추출 경로에는 적용하지 않는다.

7. `iv2.01` field-aware hybrid OCR (`IMG-TXT-400`)
- `iv2.01` 은 `iv2.00`을 덮어쓰지 않고 별도 이미지 OCR 버전으로 추가한다.
- `iv2.00` 은 Transformer 중심 frame-crop OCR, `iv2.01` 은 field-aware hybrid OCR 로 정의한다.
- `iv2.01` 의 핵심 구조:
  - frame crop
  - field semantics 추론
  - field별 crop variant 생성
  - field별 엔진 분기
  - validator-first selector
  - diagnostics 기록
- field semantics 는 `fieldType`, `semanticRole`, `expectedPattern`, row/col 메타데이터를 request payload 에 싣고, Python 에서 같은 row의 왼쪽 label cell 로부터 value cell 에 field type 을 전파할 수 있게 설계한다.
- 현재 구현한 strong schema field:
  - `fixed_enum`
  - `business_registration_number`
  - `resident_or_corporate_number_masked`
  - `issue_number`
  - `receipt_number`
  - `phone`
  - `date`
- `business_registration_number` 는 Tesseract numeric whitelist 결과를 `regex + checksum` 으로 검증한다.
- `resident_or_corporate_number_masked` 는 Tesseract numeric whitelist 결과를 `######-*******` schema 로 정규화한다.
- `fixed_enum(processing_time)` 는 OCR 결과를 enum choice `즉시` 와 비교해 exact/edit-distance 기준으로 보정한다.
- validator 를 통과하지 못한 결과는 최종값으로 채택하지 않는다.
- strong schema field 에서 OCR 이 모두 실패하더라도, `sourceTextHint` 가 regex/checksum 을 통과하고 OCR 후보와 일정 수준 합의할 때만 `validated_hint_with_ocr_agreement` 로 제한적으로 채택하고 `needsReview=true` 를 남긴다.
- diagnostics 는 `selectedBy`, `needsReview`, `rawCandidates`, `cropVariants`, `frameReviewFlags` 를 포함한다.

5. Public version 접두사 (`IMG-TXT-205` ~ `IMG-TXT-208`)
- 프레임 버전 public 값은 `fv1.xx`
- 비 이미지 텍스트 버전 public 값은 `niv1.xx`
- 이미지 텍스트 버전 public 값은 `iv1.00`, `iv2.00`
- 프레임 Python 추출기는 legacy `v1.xx` 값을 계속 쓰고, TS boundary 에서만 public/legacy 를 매핑한다.

## 테스트 계획
1. 로컬 재현
- `docs/사업자등록증.pdf` 로 이미지 모드 `iv1.00` 실행
- 라벨/값 셀별 OCR 결과 확인

2. 비교 검증
- 기존 전체 페이지 OCR 결과와 신규 frame crop OCR 결과 비교
- 최소 비교 필드:
  - `상호(법인명) -> 메자이`
  - `사업자등록번호 -> 608-35-19756`
  - `사업장소재지`
  - `사업자등록일`

3. chrome-devtools MCP
- `/templates/extract` 에서 실제 버튼 클릭 흐름 확인
- 이미지 모드 선택, 텍스트 추출 실행, 결과 DOM 점검

4. supabase MCP
- DB 변경이 없음을 확인
- DB 변경 필요시 SQL 제안만 기록

## 테스트 기록
- 2026-04-26 / 로컬 OCR 재현
  - 결과: 현재 구현은 의미 있는 일부 텍스트만 얻고, 표 레이아웃에서 라벨/값 다수가 손상됨
  - 대표 실패:
    - `|자이`
    - `주민 인)등록번번호|`
    - `2026410428 13일`

- 2026-04-26 / 구현 후 로컬 Python 검증 (`IMG-TXT-004`, `IMG-TXT-005`, `IMG-TXT-006`, `IMG-TXT-007`)
  - 명령: `scripts/template-extract-frame-text-v112.py --input-pdf docs/사업자등록증.pdf --force-ocr --frame-plans-json-file /tmp/frame-plans-business.json`
  - 결과:
    - `band-2-cell-2 -> 메자이`
    - `band-2-cell-4 -> 608-35-19756`
    - `band-2-cell-10 -> 2026년 04월 13일`
    - `pageModes -> ['ocr_frame_crop']`
  - 진단:
    - `band-2-cell-2`: `psm 7`, `gray`, confidence `93`
    - `band-2-cell-10`: `psm 7`, `gray`, confidence `92`

- 2026-04-26 / 정적 타입 및 문법 검증 (`IMG-TXT-003`, `IMG-TXT-004`, `IMG-TXT-007`, `IMG-TXT-008`)
  - Python: `PYTHONPYCACHEPREFIX=/tmp/codex-pycache .venv-template-extract-v2/bin/python -m py_compile scripts/template-extract-frame-text-v112.py`
  - TypeScript: `npx tsc --noEmit --jsx preserve --moduleResolution bundler --module esnext --target es2022 --lib dom,dom.iterable,es2022 --skipLibCheck src/app/templates/extract/page.tsx src/app/api/templates/extract/frame-text/route.ts src/services/templateExtractFrameTextService.ts`
  - 결과: 모두 통과

- 2026-04-27 / chrome-devtools MCP (`IMG-TXT-009`)
  - 페이지: `http://localhost:3001/templates/extract`
  - 확인 내용:
    - `프레임 그룹 생성`, `텍스트 추출`, `비 이미지`, `이미지`, `교차 검증` 버튼이 존재함
    - 프레임 그룹 생성 전에는 `텍스트 추출`, `비 이미지`, `이미지`, `교차 검증` 이 disabled 상태임
    - 프레임 버전 기본값은 `fv1.11`, 비 이미지 텍스트 버전 기본값은 `niv1.12` 로 표시됨
  - 산출물:
    - 스냅샷 확인 완료
    - 스크린샷: `/tmp/template-extract-image-mode-ui.png`
  - 비고:
    - 파일 업로드를 강제로 주입하는 MCP 도구는 이 세션에 없어, 브라우저 안에서 실제 PDF 업로드 클릭 플로우까지는 자동화하지 못함

- 2026-04-27 / supabase MCP (`IMG-TXT-010`)
  - 결과: 이 세션의 `tool_search` 결과에 Supabase MCP 도구가 노출되지 않았음
  - DB 변경: 없음
  - 조치: SQL 제안 필요 없음

- 2026-04-27 / `iv1.00` 경로 회귀 확인 (`IMG-TXT-204`)
  - 명령: `scripts/template-extract-frame-text-v112.py --input-pdf docs/사업자등록증.pdf --force-ocr --image-ocr-version iv1.00 --frame-plans-json-file /tmp/template-frame-plan.json`
  - 결과:
    - 정상 JSON 반환
    - `cloneId -> pdf-frame-text-image-iv1.00`
    - 대표 frame result: `6083년 51월 97일`
  - 해석:
    - 품질은 낮지만 기존 Tesseract 경로가 `iv2.00` 추가 때문에 깨지지는 않았음을 확인

- 2026-04-27 / `iv2.00` 의존성 게이트 확인 (`IMG-TXT-201`, `IMG-TXT-202`, `IMG-TXT-203`)
  - 명령: `scripts/template-extract-frame-text-v112.py --input-pdf docs/사업자등록증.pdf --force-ocr --image-ocr-version iv2.00 --frame-plans-json-file /tmp/template-frame-plan.json`
  - 결과:
    - `ModuleNotFoundError: No module named 'torch'`
  - 해석:
    - 현 세션 로컬 venv 에는 PyTorch 가 없어 Transformer runtime 실제 추론은 미실행
    - 이는 Hugging Face / PyTorch 공식 설치 문서와 일치하는 사전 의존성 문제

- 2026-04-27 / chrome-devtools MCP UI 버전 표기 확인 (`IMG-TXT-208`)
  - 페이지: `http://localhost:3001/templates/extract`
  - 확인 내용:
    - 프레임 버전 기본값이 `fv1.11` 로 표시됨
    - 비 이미지 텍스트 버전 기본값이 `niv1.12` 로 표시됨
    - `텍스트 추출`, `비 이미지`, `이미지` 버튼은 프레임 생성 전 disabled 상태 유지
  - 비고:
    - 현재 페이지 상태상 이미지 버전 드롭다운은 활성 전환 전이라 DOM 에 `iv2.00/iv1.00` 옵션이 렌더되지 않은 상태였음
    - 코드상 옵션 정의는 반영 완료

- 2026-04-27 / 좌표계 mismatch 보정 구현 (`IMG-TXT-300`)
  - 변경 파일:
    - `src/app/templates/extract/page.tsx`
    - `src/app/api/templates/extract/frame-text/route.ts`
    - `src/services/templateExtractFrameTextService.ts`
    - `scripts/template-extract-frame-text-v112.py`
  - 구현 내용:
    - 이미지 모드 request payload 에 `coordinateSpace=css-px`, `viewportWidth`, `viewportHeight`, `pdfPageWidth`, `pdfPageHeight` 추가
    - Python 에서 OCR 전 `normalize_frame_plan_rect()` 로 CSS px -> PDF pt 변환 수행
    - `frameDebug` 에 `normalizedRectPdf`, `cropRectPx` 등 crop 진단 정보 추가
  - 기대 효과:
    - `상호(법인명)` 같은 셀이 다른 행을 잘못 crop 하는 회귀를 줄인다
    - 모델 교체 이전에 crop 자체를 바로잡아 OCR 후보 품질을 안정화한다

- 2026-04-27 / 좌표 정규화 probe 검증 (`IMG-TXT-300`)
  - 명령:
    - `PYTHONPYCACHEPREFIX=/tmp/codex-pycache .venv-template-extract-v2/bin/python -m py_compile scripts/template-extract-frame-text-v112.py`
    - `npx tsc --noEmit --jsx preserve --moduleResolution bundler --module esnext --target es2022 --lib dom,dom.iterable,es2022 --skipLibCheck src/app/templates/extract/page.tsx src/app/api/templates/extract/frame-text/route.ts src/services/templateExtractFrameTextService.ts`
    - `TEMPLATE_EXTRACT_IMAGE_TROCR_LOCAL_FILES_ONLY=1 HF_HUB_OFFLINE=1 .venv-template-extract-v2/bin/python scripts/template-extract-frame-text-v112.py --input-pdf docs/사업자등록증.pdf --force-ocr --image-ocr-version iv2.00 --frame-plans-json-file /tmp/iv200-probe-frame-plan.json`
  - 결과:
    - 문법/타입 체크 통과
    - probe diagnostics:
      - `rawAssumedPdf -> [229.0, 235.0, 478.0, 266.0]`
      - `normalizedRectPdf -> [178.8, 183.54, 373.22, 207.75]`
      - `cropRectPx -> [751, 771, 1568, 873]`
      - `frameResult -> 608 - 35 - 1970`
  - 해석:
    - 기존처럼 DOM px 를 PDF pt 로 오인해 crop 하던 경로는 끊겼다
    - probe 결과가 아직 완전 정답은 아니지만, 최소한 crop 좌표가 PDF 원본 좌표계에 맞춰 정규화되고 diagnostics 로 확인 가능해졌다

- 2026-04-27 / chrome-devtools MCP (`IMG-TXT-300`)
  - 페이지: `http://localhost:3001/templates/extract`
  - 확인 내용:
    - 페이지 정상 로드
    - console error/warn 없음
    - 기본 UI 상태 유지:
      - 프레임 버전 `fv1.11`
      - 텍스트 추출 버튼 disabled
      - 이미지 모드 버튼 존재
  - 산출물:
    - 스크린샷: `/tmp/template-extract-iv200-coordinate-fix.png`

- 2026-04-27 / supabase MCP (`IMG-TXT-300`)
  - 결과: 이 세션의 tool discovery 에서 Supabase MCP 도구가 노출되지 않았음
  - DB 변경: 없음

- 2026-04-27 / `iv2.01` field-aware probe 검증 (`IMG-TXT-400`)
  - 변경 파일:
    - `src/app/templates/extract/page.tsx`
    - `src/app/api/templates/extract/frame-text/route.ts`
    - `src/services/templateExtractFrameTextService.ts`
    - `scripts/template-extract-frame-text-v112.py`
  - 구현 내용:
    - 이미지 버전 `iv2.01` 추가 및 기본값 전환
    - request payload 에 `semanticRole`, `fieldType`, `expectedPattern`, `rowStart/rowEnd/colStart/colEnd` 추가
    - Python 에서 `enrich_page_frame_semantics()` 로 좌측 label -> 우측 value field type 전파
    - `business_registration_number`: `tesseract_numeric + regex + checksum`
    - `resident_or_corporate_number_masked`: `tesseract_numeric + masked_schema_completion`
    - `fixed_enum(processing_time)`: `trocr/tesseract + exact/edit-distance`
    - selector 를 `validator-first` 로 변경
    - diagnostics 에 `selectedBy`, `needsReview`, `rawCandidates`, `cropVariants`, `frameReviewFlags` 추가

- 2026-04-27 / `iv2.01` probe 결과 (`IMG-TXT-400`)
  - 명령:
    - `PYTHONPYCACHEPREFIX=/tmp/codex-pycache .venv-template-extract-v2/bin/python -m py_compile scripts/template-extract-frame-text-v112.py`
    - `npx tsc --noEmit --jsx preserve --moduleResolution bundler --module esnext --target es2022 --lib dom,dom.iterable,es2022 --skipLibCheck src/app/templates/extract/page.tsx src/app/api/templates/extract/frame-text/route.ts src/services/templateExtractFrameTextService.ts`
    - `TEMPLATE_EXTRACT_IMAGE_TROCR_LOCAL_FILES_ONLY=1 HF_HUB_OFFLINE=1 .venv-template-extract-v2/bin/python scripts/template-extract-frame-text-v112.py --input-pdf docs/사업자등록증.pdf --force-ocr --image-ocr-version iv2.01 --frame-plans-json-file /tmp/iv201-business-probe.json`
  - probe frame:
    - `band-1-cell-5` 처리기간 value
    - `band-2-cell-4` 사업자등록번호 value
    - `band-2-cell-8` 주민(법인)등록번호 masked value
  - 결과:
    - `band-1-cell-5 -> 즉시`
    - `band-2-cell-4 -> 608-35-19756`
    - `band-2-cell-8 -> 940718-*******`
    - `frameReviewFlags -> {'band-1-cell-5': false, 'band-2-cell-4': false, 'band-2-cell-8': false}`
  - raw candidate 예시:
    - 사업자등록번호:
      - `608-35-19756 -> valid(regex_checksum)`
      - `60885-19756 -> invalid(checksum_failed)`
      - `856 -> invalid(invalid_length_3)`
    - masked 번호:
      - `940718-* -> 940718-*******`
      - `940718-*x -> 940718-*******`
  - 해석:
    - `iv2.01` 은 숫자/마스킹/고정 enum 필드에 대해 “그럴듯한 OCR 문자열”이 아니라 “검증 통과 결과”만 채택하는 방향으로 전환되었다.

- 2026-04-27 / chrome-devtools MCP (`IMG-TXT-400`)
  - 페이지: `http://localhost:3001/templates/extract`
  - 확인 내용:
    - 페이지 정상 로드
    - console error/warn 없음
    - 프레임 버전 `fv1.11` 유지
    - 텍스트 추출/이미지 버튼 게이트 상태 유지
  - 비고:
    - 프레임 생성 전 상태라 이미지 버전 드롭다운의 실제 `iv2.01` 옵션 노출은 스냅샷에서 확인되지 않았지만, 코드상 옵션과 기본값은 반영 완료

- 2026-04-27 / supabase MCP (`IMG-TXT-400`)
  - 결과: 이 세션의 tool discovery 에서 Supabase MCP 도구가 노출되지 않았음
  - DB 변경: 없음

8. `iv2.02` end-to-end safe integration (`IMG-TXT-500`)
- 목적:
  - `iv2.01` 의 field-aware / validator-first 구조를 실제 프론트 `framePlans -> Python OCR -> diagnostics -> HTML 반영` 경로에 안전하게 연결한다.
  - 모델 교체가 아니라 `diagnostics 강제`, `strong schema raw fallback 금지`, `ignore frame 최종 반영 금지` 를 보장한다.
- 수정 파일:
  - `src/app/templates/extract/page.tsx`
  - `src/app/api/templates/extract/frame-text/route.ts`
  - `src/services/templateExtractFrameTextService.ts`
  - `scripts/template-extract-frame-text-v112.py`
  - `docs/imgText.md`
- diff 백업:
  - `docs/diff/2026-04-27_10-15-00_IMG-TXT-500_page.tsx.before`
  - `docs/diff/2026-04-27_10-15-00_IMG-TXT-501_template-extract-frame-text-v112.py.before`
  - `docs/diff/2026-04-27_10-15-00_IMG-TXT-502_templateExtractFrameTextService.ts.before`
  - `docs/diff/2026-04-27_10-15-00_IMG-TXT-503_frame-text-route.ts.before`
  - `docs/diff/2026-04-27_10-15-00_IMG-TXT-504_imgText.md.before`
- 체크리스트:
  - [x] `iv2.02` 이미지 OCR 신규 버전 추가
  - [x] `framePlans` cache signature 에 좌표/semantic/source metadata 포함
  - [x] `iv2.02` 응답은 `diagnostics.frameDebug`, `frameReviewFlags`, `fieldAwareEnabled` 없으면 실패 처리
  - [x] 실제 request shape 기준 row/col 2-pass semantics 전파 적용
  - [x] `processing_time` enum 보조 힌트 허용
  - [x] `resident_or_corporate_number_masked` schema completion 유지
  - [x] `header/footer/barcode/qr` ignore frame 최종 반영 차단
  - [x] `strong schema` / `schema_failed_no_fallback` / `unknown_free_text_blocked` 는 최종 HTML 반영 차단
  - [x] 현재 preview HTML 내부 render model 을 최신 image diagnostics 로 교체
- 구현 메모:
  - 프론트:
    - 이미지 버전 기본값을 `iv2.02` 로 올렸다.
    - `requestKey` 에 `sourceTextHint`, `frameGroup`, `valueKey`, `colorGroup` 를 추가해 캐시 충돌을 줄였다.
    - `iv2.02` 이미지 응답은 `frameDebug` / `frameReviewFlags` / `frameResults` / `fieldAwareEnabled` 가 없으면 예외를 던진다.
    - `ignored_frame`, `schema_failed_no_fallback`, `needsReview strong schema`, `ignore/footer/barcode/qr` 결과는 `data-template-frame-extracted-text` 로 쓰지 않는다.
    - 이미지 OCR 결과를 적용한 뒤 현재 preview HTML 의 `data-template-render-model` JSON 을 교체해, 이후 로그/승인/교차검증에서도 같은 diagnostics 를 본다.
  - Python:
    - `iv2.02` 추가
    - `resolve_field_type_from_compact_label()` 로 label canonicalization 을 강화했다.
    - `enrich_page_frame_semantics()` 는 page context 기반 2-pass 로 바뀌었고, row/col 순서대로 label OCR probe 후 오른쪽 value cell 에 field type 을 전파한다.
    - `build_validated_hint_candidate()` 는 `fixed_enum` 에 한해 `시/즉/죽시` 같은 보조 힌트를 `즉시` 로 정규화해 채택할 수 있다.
    - `should_ocr_frame()` 로 header/footer/barcode/qr 를 건너뛴다.
    - `free_text + unknown + empty source/valueKey` 는 `unknown_free_text_blocked` 로 차단한다.
    - diagnostics 는 `imageOcrVersion`, `fieldAwareEnabled`, `ignored`, `ignoreReason`, `canonicalLabel`, `propagatedFrom` 를 포함한다.

- 2026-04-27 / `iv2.02` actual-shape probe (`IMG-TXT-500`)
  - 입력 shape:
    - business registration draft HTML 로그 `docs/2026-04-27_09-51-51_47_template-extract-log_55816bfc-89f6-49c4-bed2-395c9f37cc95.md`
    - `Generated Draft HTML` 의 실제 band/col/row geometry 에서 frame plan 을 구성했다.
    - 출력 파일:
      - `/tmp/iv202-actual-shape-frame-plans.json`
      - `/tmp/iv202-actual-shape-render-model.json`
  - 명령:
    - `PYTHONPYCACHEPREFIX=/tmp/codex-pycache .venv-template-extract-v2/bin/python -m py_compile scripts/template-extract-frame-text-v112.py`
    - `npx tsc --noEmit --jsx preserve --moduleResolution bundler --module esnext --target es2022 --lib dom,dom.iterable,es2022 --skipLibCheck src/app/templates/extract/page.tsx src/app/api/templates/extract/frame-text/route.ts src/services/templateExtractFrameTextService.ts`
    - `TEMPLATE_EXTRACT_IMAGE_TROCR_LOCAL_FILES_ONLY=1 HF_HUB_OFFLINE=1 .venv-template-extract-v2/bin/python scripts/template-extract-frame-text-v112.py --input-pdf docs/사업자등록증.pdf --force-ocr --image-ocr-version iv2.02 --frame-plans-json-file /tmp/iv202-actual-shape-frame-plans.json > /tmp/iv202-actual-shape-render-model.json`
  - 핵심 결과:
    - `band-1-cell-4 -> ""` / `selectedBy=unknown_free_text_blocked`
    - `band-1-cell-5 -> 즉시` / `selectedBy=validated_fixed_enum_hint`
    - `band-2-cell-4 -> 608-35-19756` / `selectedBy=regex_checksum`
    - `band-2-cell-8 -> 940718-*******` / `selectedBy=masked_schema_completion_single_mask`
    - `band-0-header -> ""` / `selectedBy=ignored_frame`
    - `band-7-footer -> ""` / `selectedBy=ignored_frame`
    - `band-8-footer -> ""` / `selectedBy=ignored_frame`
  - 해석:
    - `시`, `940718x`, header/footer 잡음, blank free-text noise 가 최종 반영값으로 남는 경로를 끊었다.
    - `frameDebug` 는 각 frame 에 대해 `fieldType`, `semanticRole`, `selectedBy`, `canonicalLabel`, `propagatedFrom` 를 남긴다.

- 2026-04-27 / chrome-devtools MCP (`IMG-TXT-500`)
  - 페이지: `http://localhost:3001/templates/extract`
  - 확인 내용:
    - 페이지 선택 및 viewport 스크린샷 저장
    - 최신 console page 에는 Fast Refresh 로그만 있었고, 새 `iv2.02` 변경으로 추가된 error/warn 는 보이지 않았다.
    - 이전 preserved console 에는 과거 빌드 시점 `loadImageFrameTextRenderModelV100 is not defined` 오류가 남아 있었지만, 최신 메시지 구간에는 재발하지 않았다.
  - 산출물:
    - `/tmp/iv202-template-extract-page.png`

- 2026-04-27 / supabase MCP (`IMG-TXT-500`)
  - 결과: `tool_search` 기준 이 세션에는 Supabase MCP 도구가 노출되지 않았음
  - DB 변경: 없음

9. `iv2.02` display policy correction (`IMG-TXT-600`)
- 목적:
  - `iv2.02` 의 문제를 OCR 엔진이 아니라 최종 반영 정책으로 규정한다.
  - `selectedText` 실패를 곧바로 숨김으로 바꾸지 않고, `displayText` / `writePolicy` 기준으로 화면 반영을 분리한다.
  - `ignore frame` 만 숨기고, strong schema `value` 실패만 `blank_review` 로 남기며, label/free_text 는 `display_review` 또는 `display_accept` 로 계속 보이게 한다.
- 수정 파일:
  - `src/app/templates/extract/page.tsx`
  - `scripts/template-extract-frame-text-v112.py`
  - `src/services/templateExtractFrameTextService.ts`
  - `docs/imgText.md`
- diff 백업:
  - `docs/diff/2026-04-27_11-20-00_IMG-TXT-600_page.tsx.before`
  - `docs/diff/2026-04-27_11-20-00_IMG-TXT-601_template-extract-frame-text-v112.py.before`
  - `docs/diff/2026-04-27_11-20-00_IMG-TXT-602_templateExtractFrameTextService.ts.before`
  - `docs/diff/2026-04-27_11-20-00_IMG-TXT-603_frame-text-route.ts.before`
  - `docs/diff/2026-04-27_11-20-00_IMG-TXT-604_imgText.md.before`
- 체크리스트:
  - [x] `selectedText` / `displayText` / `writePolicy` 분리
  - [x] `ignore frame` 만 `hidden_ignore` 적용
  - [x] strong schema `value` 실패만 `blank_review`
  - [x] `label/free_text/address/item` 은 `display_review` 또는 `display_accept`
  - [x] `unknown_free_text_blocked` 차단 로직 제거, `free_text_review_fallback` 으로 전환
  - [x] label frame 은 `dictionary-first` 로 canonical label 우선
  - [x] `row/col known label` 컨텍스트를 semantics 재전파 단계에서도 유지
  - [x] 프론트가 `writePolicy` 를 읽어 `transparent` 처리 범위를 `hidden_ignore` 로 축소
  - [x] full-shape probe 에 label/free_text blank regression 포함
- 구현 메모:
  - 프론트:
    - `FrameWritePolicy` / `FrameExtractedTextMetaState` 를 추가했다.
    - `writeFrameNodeExtractedText()` 는 텍스트와 표시 정책을 분리해, `hidden_ignore` 만 `transparent` 로 그리고 `blank_review` 는 빈 칸이더라도 숨기지 않는다.
    - `collectFrameExtractedTextMetaStateFromHtml()` 를 추가해 HTML 과 embedded render model diagnostics 에서 `writePolicy`, `selectedBy`, `needsReview` 를 다시 읽는다.
    - `resolveImageFrameTextDisplayState()` 로 `selectedText`, `displayText`, `sourceTextHint` 의 우선순위를 정리했다.
    - `buildImageFrameTextRequestPlans()` 의 semantic role 추론은 `colStart > 1` value cell 을 더 안정적으로 `value` 로 본다.
  - Python:
    - `make_frame_result()` 로 `selectedText`, `displayText`, `writePolicy`, `selectedBy`, `rawCandidates` 를 한 구조로 반환한다.
    - `select_best_candidate()` 는 strong schema `value` 일 때만 `blank_review` 를 사용한다.
    - `semanticRole == label` 경로는 `valid OCR` 보다 `known row/col label` 과 dictionary 를 우선 사용한다.
    - `FRAME_KNOWN_LABEL_BY_GRID_POSITION` 으로 사업자등록증명서 라벨 grid 를 추가했다.
    - `enrich_page_frame_semantics()` 가 label/value semantics 를 다시 만들 때도 원래 `rowStart/colStart` 를 유지해 known label 컨텍스트를 잃지 않게 했다.
  - 서비스:
    - `iv2.02` 응답은 `frameDebug[].key/selectedBy/writePolicy`, `frameReviewFlags`, `fieldAwareEnabled` 가 없으면 실패 처리한다.

- 2026-04-27 / `iv2.02` display-policy probe (`IMG-TXT-600`)
  - 입력 shape:
    - `docs/2026-04-27_10-57-23_47_template-extract-log_5a0055ef-d0be-49f6-9906-d3f121580757.md` 의 `Generated Draft HTML`
    - business registration certificate 의 실제 band/row/col geometry 를 따라 수동 frame plan 작성
    - 출력 파일:
      - `/tmp/iv202-display-probe-frame-plans.json`
      - `/tmp/iv202-display-probe-render-model.json`
  - 명령:
    - `PYTHONPYCACHEPREFIX=/tmp/codex-pycache .venv-template-extract-v2/bin/python -m py_compile scripts/template-extract-frame-text-v112.py`
    - `npx tsc --noEmit --jsx preserve --moduleResolution bundler --module esnext --target es2022 --lib dom,dom.iterable,es2022 --skipLibCheck src/app/templates/extract/page.tsx src/app/api/templates/extract/frame-text/route.ts src/services/templateExtractFrameTextService.ts`
    - `TEMPLATE_EXTRACT_IMAGE_TROCR_LOCAL_FILES_ONLY=1 HF_HUB_OFFLINE=1 .venv-template-extract-v2/bin/python scripts/template-extract-frame-text-v112.py --input-pdf docs/사업자등록증.pdf --force-ocr --image-ocr-version iv2.02 --frame-plans-json-file /tmp/iv202-display-probe-frame-plans.json > /tmp/iv202-display-probe-render-model.json`
  - 핵심 결과:
    - values:
      - `band-1-cell-5 -> 즉시` / `selectedBy=processing_time_enum`
      - `band-2-cell-4 -> 608-35-19756` / `selectedBy=regex_checksum`
      - `band-2-cell-8 -> 940718-*******` / `selectedBy=masked_schema_completion_single_mask`
      - `band-2-cell-12 -> 2026년 04월 13일` / `selectedBy=regex_pattern`
      - `band-2-cell-14 -> 2026년 04월 13일` / `selectedBy=regex_pattern`
      - `band-5-cell-2 -> 101172933475` / `selectedBy=regex_pattern`
      - `band-6-cell-2 -> 02-2173-4222`
    - labels:
      - `band-1-cell-1 -> 발급번호`
      - `band-1-cell-4 -> 처리기간`
      - `band-2-cell-3 -> 사업자등록번호`
      - `band-2-cell-5 -> 대표자성명(대표유형)`
      - `band-2-cell-7 -> 주민(법인)등록번호`
      - `band-2-cell-9 -> 사업장소재지`
      - `band-2-cell-11 -> 개업일`
      - `band-2-cell-13 -> 사업자등록일`
      - `band-2-cell-15 -> 업태`
      - `band-5-cell-1 -> 접수번호`
      - `band-5-cell-5 -> 담당부서`
      - `band-5-cell-7 -> 담당자`
      - `band-6-cell-1 -> 연락처`
    - ignore:
      - `band-0-header -> ""` / `writePolicy=hidden_ignore`
      - `band-7-footer -> ""` / `writePolicy=hidden_ignore`
  - 해석:
    - `selectedText 없음 = 숨김` 경로를 끊고, `writePolicy` 에 따라 value blank 와 label/free_text display 를 분리했다.
    - strong schema 개선(`즉시`, `608-35-19756`, `940718-*******`)은 유지하면서, 라벨 frame 이 다시 비거나 투명 처리되는 회귀를 막았다.

- 2026-04-27 / chrome-devtools MCP (`IMG-TXT-600`)
  - 페이지: `http://localhost:3001/templates/extract`
  - 확인 내용:
    - 페이지 로드 및 full-page screenshot 저장
    - 최신 console page 에는 Fast Refresh 로그와 기존 form accessibility issue 외 새 `iv2.02` 런타임 오류는 없었다.
  - 산출물:
    - `/tmp/iv202-display-policy-page.png`

- 2026-04-27 / supabase MCP (`IMG-TXT-600`)
  - 결과: `tool_search` 기준 이 세션에도 Supabase MCP 도구가 노출되지 않았음
  - DB 변경: 없음

10. `iv2.03` universal detection-first OCR (`IMG-TXT-700`)
- 목적:
  - `iv2.03` 은 특정 문서 family 보정이 아니라, 이미지 문서 전반에 적용되는 `page-level OCR first` 구조를 추가한다.
  - frame crop recognition-first 경로를 기본으로 보지 않고, 먼저 페이지 전체 text line 을 검출한 뒤 frame 에 배정하고, frame crop OCR 은 fallback 으로만 사용한다.
  - `blank_accept` 을 도입해 배경/워터마크/표선/빈칸에서 생성된 노이즈 문자열을 최종 표시하지 않는다.
- 수정 파일:
  - `src/app/templates/extract/page.tsx`
  - `src/app/api/templates/extract/frame-text/route.ts`
  - `src/services/templateExtractFrameTextService.ts`
  - `scripts/template-extract-frame-text-v112.py`
  - `docs/imgText.md`
- diff 백업:
  - `docs/diff/2026-04-27_12-51-01_IMG-TXT-700_page.tsx.before`
  - `docs/diff/2026-04-27_12-51-01_IMG-TXT-701_template-extract-frame-text-v112.py.before`
  - `docs/diff/2026-04-27_12-51-01_IMG-TXT-702_templateExtractFrameTextService.ts.before`
  - `docs/diff/2026-04-27_12-51-01_IMG-TXT-703_frame-text-route.ts.before`
  - `docs/diff/2026-04-27_12-51-01_IMG-TXT-704_imgText.md.before`
- 체크리스트:
  - [x] `iv2.03` 이미지 OCR 버전 추가
  - [x] `page-level OCR line layer` 추가
  - [x] `frame assignment` 추가
  - [x] `crop fallback` 을 fallback 전용으로 축소
  - [x] `blank_accept` write policy 추가
  - [x] `pageOcrSummary` diagnostics 추가
  - [x] `iv2.03` 응답은 `pageOcrSummary` 없으면 실패 처리
  - [x] 실제 frame shape probe 에서 strong schema / ignore / blank accept 동작 확인
  - [ ] 브라우저에서 `/templates/extract` 실제 클릭 흐름으로 `iv2.03` 화면 결과 최종 확인
- 구현 메모:
  - 프론트:
    - 이미지 버전 드롭다운에 `iv2.03` 을 추가했다.
    - `FrameWritePolicy` 에 `blank_accept` 를 추가했다.
    - `iv2.03` 은 `frameDebug` 와 함께 `pageOcrSummary` 도 있어야 diagnostics complete 로 본다.
    - `resolveImageFrameTextDisplayState()` 는 `blank_accept` 도 `hidden_ignore` 와 구분해서, 빈 프레임은 숨기지 않고 빈 상태로 유지한다.
    - `buildAppliedImageFrameTextRenderModel()` 은 `detectionFirstEnabled` 를 render model diagnostics 에 유지한다.
  - API / service:
    - `imageOcrVersion=iv2.03` 를 허용한다.
    - `iv2.03` 응답은 `fieldAwareEnabled`, `frameDebug`, `frameReviewFlags`, `pageOcrSummary` 가 없으면 실패 처리한다.
  - Python:
    - `IMAGE_OCR_VERSION_IV203` 추가.
    - `extract_page_level_ocr_lines()` 로 페이지 전체 OCR line 후보를 만든다.
      - 현재 detector/recognizer 분리는 새 외부 모델을 쓰지 않고, 공식 Tesseract TSV 계열을 이용한 line layer 로 구현했다.
    - `assign_page_lines_to_frame()` 로 검출 line 을 frame bbox 에 배정한다.
    - `estimate_frame_textness()` 로 `foregroundDensity / darkInkDensity / textLikeComponentCount / lineLikeComponentCount / textnessScore / blankScore / noiseScore` 를 계산한다.
    - `run_universal_detection_first_frame_ocr()` 로 `assigned page lines -> validator-first -> crop fallback -> blank_accept/review` 흐름을 구현했다.
    - `enrich_universal_page_semantics()` 를 추가해, `iv2.03` 에서는 grid hardcode 대신 `같은 row 의 왼쪽 label page text -> 오른쪽 value schema` 전파를 사용한다.
    - `extract_frame_plan_ocr_results()` 는 `pageOcrSummary` 를 만든다.
- 참고 출처:
  - Tesseract 공식 문서가 TSV output 으로 line/word 좌표를 낼 수 있음을 명시한다.
  - https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html
  - Tesseract 공식 FAQ 도 output format 으로 `tsv` 를 명시한다.
  - https://tesseract-ocr.github.io/tessdoc/FAQ.html

- 2026-04-27 / `iv2.03` detection-first probe (`IMG-TXT-700`)
  - 입력 shape:
    - 기존 display probe 와 같은 business registration draft frame plan
    - `/tmp/iv202-display-probe-frame-plans.json`
    - 출력 파일:
      - `/tmp/iv203-display-probe-render-model.json`
  - 명령:
    - `PYTHONPYCACHEPREFIX=/tmp/codex-pycache .venv-template-extract-v2/bin/python -m py_compile scripts/template-extract-frame-text-v112.py`
    - `npx tsc --noEmit --jsx preserve --moduleResolution bundler --module esnext --target es2022 --lib dom,dom.iterable,es2022 --skipLibCheck src/app/templates/extract/page.tsx src/app/api/templates/extract/frame-text/route.ts src/services/templateExtractFrameTextService.ts`
    - `TEMPLATE_EXTRACT_IMAGE_TROCR_LOCAL_FILES_ONLY=1 HF_HUB_OFFLINE=1 .venv-template-extract-v2/bin/python scripts/template-extract-frame-text-v112.py --input-pdf docs/사업자등록증.pdf --force-ocr --image-ocr-version iv2.03 --frame-plans-json-file /tmp/iv202-display-probe-frame-plans.json > /tmp/iv203-display-probe-render-model.json`
  - 핵심 결과:
    - diagnostics:
      - `imageOcrVersion=iv2.03`
      - `fieldAwareEnabled=true`
      - `detectionFirstEnabled=true`
      - `pageOcrSummary[0] = { detectedLineCount: 114, assignedLineCount: 51, unassignedLineCount: 43, blankFrameCount: 2, cropFallbackCount: 1, garbageRejectedCount: 0 }`
    - strong schema / fixed enum:
      - `band-1-cell-5 -> 즉시` / `selectedBy=validated_fixed_enum_hint`
      - `band-2-cell-8 -> 940718-*******` / `selectedBy=masked_schema_completion_single_mask`
      - `band-2-cell-14 -> 2026년 04월 13일` / `selectedBy=regex_pattern`
      - `band-5-cell-2 -> 101172933475` / `selectedBy=regex_pattern`
      - `band-6-cell-2 -> 02-2173-4222` / `selectedBy=regex_pattern`
    - labels / generic display:
      - `band-2-cell-13 -> 사업자등록일` / `writePolicy=display_accept`
      - `band-2-cell-15 -> 업` / `writePolicy=display_review`
    - ignore / blank:
      - `band-0-header -> hidden_ignore`
      - `band-7-footer -> hidden_ignore`
      - `band-2-cell-17 -> blank_accept`
  - 해석:
    - `iv2.03` 은 strong schema 와 ignore frame 을 유지하면서, page-level line 이 없는 frame 을 `blank_accept` 로 구분한다.
    - 아직 `band-2-cell-15 -> 업` 처럼 detector/assignment 단에서 free-text line 이 짧게 잘리는 case 가 남아 있다. 이는 `page-level line detector / line merge` 튜닝 과제로 남긴다.

- 2026-04-27 / supabase MCP (`IMG-TXT-700`)
  - 결과: 이 세션의 tool discovery 에서 Supabase MCP 도구가 노출되지 않았음
  - DB 변경: 없음

- 2026-04-27 / chrome-devtools MCP (`IMG-TXT-700`)
  - 페이지: `http://localhost:3001/templates/extract`
  - 확인 내용:
    - 페이지 로드 / a11y snapshot 확인
    - `문서 미리보기` / 프레임 버전 `fv1.11` / 텍스트 추출 버튼 게이트 상태 유지 확인
    - full-page screenshot 저장: `/tmp/iv203-template-extract-page.png`
  - 비고:
    - 현재 snapshot 시점은 프레임 생성 전 상태라 이미지 버전 드롭다운의 실제 `iv2.03` 옵션 렌더는 DOM snapshot 으로 직접 노출되지 않았다.
    - preserved console 에는 기존 Fast Refresh / 개발 중 React dependency-array 경고가 남아 있었고, `iv2.03` 전용 OCR fetch/runtime 오류는 새로 추가되지 않았다.

11. `iv2.04` universal token/glyph assembly (`IMG-TXT-800`)
- 목적:
  - `iv2.04` 는 `iv2.03` 의 detection-first 구조를 유지하면서, `업 태`, `성 명`, `연 락 처`, `N A M E` 처럼 넓게 벌어진 분산 라벨을 범용적으로 복원한다.
  - 특정 문서 dictionary 대신 `page line -> page token -> page glyph -> frame-local component glyph` 순으로 증거를 쌓고, frame 내부에서 다시 조립한다.
  - `semanticRole=label` 인 짧은 라벨은 `fieldType=free_text` 와 분리해서 `textClass=label_text` 로 취급한다.
- 수정 파일:
  - `src/app/templates/extract/page.tsx`
  - `src/app/api/templates/extract/frame-text/route.ts`
  - `src/services/templateExtractFrameTextService.ts`
  - `scripts/template-extract-frame-text-v112.py`
  - `docs/imgText.md`
- diff 백업:
  - `docs/diff/2026-04-27_14-15-18_IMG-TXT-800_page.tsx.before`
  - `docs/diff/2026-04-27_14-15-18_IMG-TXT-801_template-extract-frame-text-v112.py.before`
  - `docs/diff/2026-04-27_14-15-18_IMG-TXT-802_templateExtractFrameTextService.ts.before`
  - `docs/diff/2026-04-27_14-15-18_IMG-TXT-803_frame-text-route.ts.before`
  - `docs/diff/2026-04-27_14-15-18_IMG-TXT-804_imgText.md.before`
- 체크리스트:
  - [x] `iv2.04` 이미지 OCR 버전 추가
  - [x] `page token layer` / `page glyph layer` diagnostics 확장
  - [x] `textClass=label_text` 개념 추가
  - [x] `frame-local component glyph recovery` 추가
  - [x] distributed label 은 `line-only` 가 아니라 `glyph coverage` 기준으로 후보 선택
  - [x] `iv2.04` 응답은 `fieldAwareEnabled`, `frameDebug`, `frameReviewFlags`, `pageOcrSummary` 없으면 실패 처리
  - [x] 실제 probe 에서 `band-2-cell-15 -> 업태` 복원 확인
  - [ ] 브라우저 업로드/클릭 전체 플로우에서 `iv2.04` 실제 결과 확인
- 구현 메모:
  - 프론트:
    - 이미지 버전 타입/옵션에 `iv2.04` 를 추가했다.
    - `pageOcrSummary` 는 `detectedTokenCount / detectedGlyphCount / assignedTokenCount / assignedGlyphCount` 를 포함할 수 있다.
    - `frameDebug` 는 `textClass`, `lineCandidateText`, `tokenCandidateText`, `glyphCandidateText`, `canonicalText`, `visualText`, `distributedTextScore`, `assignedGlyphCount` 를 유지한다.
    - `iv2.04` 도 `iv2.03` 과 같은 diagnostics complete 조건을 사용한다.
  - API / service:
    - `imageOcrVersion=iv2.04` 를 허용한다.
    - `iv2.04` 는 `pageOcrSummary` 가 없으면 예외를 던진다.
  - Python:
    - `IMAGE_OCR_VERSION_IV204` 추가.
    - `extract_page_level_ocr_tokens()` / `extract_page_level_ocr_glyphs()` 를 `iv2.04` page summary 에 연결했다.
    - `extract_component_glyphs_from_crop()` 로 짧은 label crop 의 connected component 를 다시 읽어 local glyph 후보를 만든다.
    - `run_universal_detection_first_frame_ocr()` 는 page glyph 가 부족한 `label_text` frame 에서 local component glyph 를 보조로 조립한다.
    - distributed 후보가 line 후보보다 coverage 가 높으면 `selectedBy=distributed_component_glyph_assembly` 로 승격한다.
    - `pageModes` 에 `ocr_page_detection_first_v204` 를 추가했다.
- 2026-04-27 / `iv2.04` distributed label probe (`IMG-TXT-800`)
  - 입력 shape:
    - `/tmp/iv202-display-probe-frame-plans.json`
    - 출력 파일:
      - `/tmp/iv204-display-probe-render-model.json`
  - 명령:
    - `PYTHONPYCACHEPREFIX=/tmp/codex-pycache .venv-template-extract-v2/bin/python -m py_compile scripts/template-extract-frame-text-v112.py`
    - `npx tsc --noEmit --jsx preserve --moduleResolution bundler --module esnext --target es2022 --lib dom,dom.iterable,es2022 --skipLibCheck src/app/templates/extract/page.tsx src/app/api/templates/extract/frame-text/route.ts src/services/templateExtractFrameTextService.ts`
    - `TEMPLATE_EXTRACT_IMAGE_TROCR_LOCAL_FILES_ONLY=1 HF_HUB_OFFLINE=1 .venv-template-extract-v2/bin/python scripts/template-extract-frame-text-v112.py --input-pdf docs/사업자등록증.pdf --force-ocr --image-ocr-version iv2.04 --frame-plans-json-file /tmp/iv202-display-probe-frame-plans.json > /tmp/iv204-display-probe-render-model.json`
  - 핵심 결과:
    - diagnostics:
      - `imageOcrVersion=iv2.04`
      - `fieldAwareEnabled=true`
      - `detectionFirstEnabled=true`
      - `pageOcrSummary[0] = { detectedLineCount: 114, detectedTokenCount: 342, detectedGlyphCount: 542, assignedLineCount: 51, assignedTokenCount: 131, assignedGlyphCount: 199, unassignedLineCount: 43, blankFrameCount: 2, cropFallbackCount: 1, garbageRejectedCount: 0 }`
    - distributed label recovery:
      - `band-2-cell-15 -> 업태`
      - `selectedBy=distributed_component_glyph_assembly`
      - `textClass=label_text`
      - `lineCandidateText=업`
      - `glyphCandidateText=업태`
      - `visualText=업 태`
      - `assignedGlyphCount=2`
      - `distributedTextScore=1.0`
    - 기존 strong schema 유지:
      - `band-1-cell-5 -> 즉시`
      - `band-2-cell-4 -> 608-35-19756`
      - `band-2-cell-8 -> 940718-*******`
      - `band-2-cell-13 -> 사업자등록일`
    - ignore / blank:
      - `band-0-header -> hidden_ignore`
  - 해석:
    - `iv2.04` 는 line 후보가 1글자(`업`)만 남아도, 같은 frame 안 local component glyph 2개를 다시 읽어 `업태` 로 복원한다.
    - 이 방식은 특정 문서 label dictionary 가 아니라, `짧은 label + 넓은 자간 + 같은 baseline` 이라는 typography 패턴을 이용하는 범용 조립 계층이다.
  - 남은 한계:
    - 현재 `frameDiagnostics: null` 이라는 상단 pipeline trace 출력 경로는 이번 화이트리스트 파일 안에 직접 존재하지 않아, 최상위 trace writer 자체는 아직 손대지 못했다.
    - 현재 `iv2.04` 는 page glyph layer 위에 local component glyph fallback 을 얹은 상태이고, 완전한 `page-level raw glyph detector`/`token consensus` 로까지 확장되지는 않았다.

- 2026-04-27 / chrome-devtools MCP (`IMG-TXT-800`)
  - 페이지: `http://localhost:3001/templates/extract`
  - 확인 내용:
    - `/templates/extract` 페이지 로드 확인
    - 프레임 버전 `fv1.11` 및 텍스트 추출 게이트 상태 유지 확인
    - 새 런타임 오류는 보이지 않았고, console 에는 정적 리소스 404 한 건만 남아 있었다.
  - 비고:
    - 프레임 생성 전 상태라 disabled 이미지 버전 combobox 의 옵션 전체를 snapshot 상에서 직접 펼치지는 못했다.

- 2026-04-27 / supabase MCP (`IMG-TXT-800`)
  - 결과: 이 세션의 tool discovery 에서 Supabase MCP 도구가 노출되지 않았음
  - DB 변경: 없음

12. `iv3.00` universal document OCR page-layer PoC (`IMG-TXT-900`)
- 목적:
  - `iv3.00` 은 `frame crop OCR 보정기`가 아니라, 이미지 문서 전체에서 `page OCR layer`를 먼저 만들고 그 결과를 frame이 소비하게 만드는 PoC다.
  - 1차 산출물을 `frameResults`가 아니라 `raw page text + ocrPageLayers + ocrLayerSummary + frameAssignmentSummary`로 올린다.
  - 현재 엔진은 그대로 Tesseract 기반 detection-first를 쓰되, 데이터 흐름을 `문서 전체 OCR -> frame assignment` 순서로 바꾼다.
- 수정 파일:
  - `scripts/template-extract-frame-text-v112.py`
  - `src/services/templateExtractFrameTextService.ts`
  - `src/app/api/templates/extract/frame-text/route.ts`
  - `src/app/templates/extract/page.tsx`
  - `docs/imgText.md`
- 추가 diff 백업:
  - `docs/diff/2026-04-27_15-45-57_IMG-TXT-900_templateExtractDtos.ts.before`
  - `docs/diff/2026-04-27_15-45-57_IMG-TXT-901_templateExtractPdfService.ts.before`
  - `docs/diff/2026-04-27_15-45-57_IMG-TXT-902_templateExtractVersionService.ts.before`
  - `docs/diff/2026-04-27_15-45-57_IMG-TXT-903_extract-route.ts.before`
- 체크리스트:
  - [x] `iv3.00` 이미지 OCR 버전 추가
  - [x] `page OCR layer` (`lines / words / glyphs`) 를 diagnostics 에 추가
  - [x] `raw page text` 를 `pageTextOutput` 으로 추가
  - [x] `ocrLayerSummary` 추가
  - [x] `frameAssignmentSummary` 추가
  - [x] `iv3.00` 은 `frameDebug/frameReviewFlags/pageOcrSummary/ocrLayerSummary/frameAssignmentSummary` 없으면 실패 처리
  - [x] 실제 probe 에서 `page OCR layer + frame assignment` 동시 확인
  - [ ] 브라우저 실제 업로드/클릭 전체 플로우에서 `iv3.00` 결과 확인
- 구현 메모:
  - 프론트:
    - 이미지 버전 옵션에 `iv3.00` 추가
    - `FrameTextRenderModelV112.diagnostics` 타입에 아래를 추가
      - `ocrLayerSummary`
      - `frameAssignmentSummary`
      - `pageTextOutput`
      - `ocrPageLayers`
    - `iv3.00` 은 기존 `frameDebug` 필수 조건 외에 `ocrLayerSummary` 와 `frameAssignmentSummary` 도 있어야 diagnostics complete 로 본다.
  - API / service:
    - `imageOcrVersion=iv3.00` 허용
    - `parseRenderModel()` 은 `iv3.00` 에서 `pageOcrSummary`, `ocrLayerSummary`, `frameAssignmentSummary` 누락 시 즉시 실패 처리
  - Python:
    - `IMAGE_OCR_VERSION_IV300` 추가
    - `build_page_text_from_lines()` 로 page-level raw text 산출
    - `build_ocr_page_layer()` 로 page-level `lines / words / glyphs / engineRuns` JSON 생성
    - `build_frame_assignment_summary()` 로 frame 결과 요약 생성
    - `extract_frame_plan_ocr_results()` 는 `iv3.00` 에서 `ocr_page_layers` 와 `page_text_outputs` 를 추가로 반환
    - `build_render_model()` 은 `iv3.00` 진단값을 render model diagnostics 에 포함한다.
- 2026-04-27 / `iv3.00` page-layer probe (`IMG-TXT-900`)
  - 입력:
    - `/tmp/iv202-display-probe-frame-plans.json`
    - 출력:
      - `/tmp/iv300-display-probe-render-model.json`
  - 명령:
    - `PYTHONPYCACHEPREFIX=/tmp/codex-pycache .venv-template-extract-v2/bin/python -m py_compile scripts/template-extract-frame-text-v112.py`
    - `npx tsc --noEmit --jsx preserve --moduleResolution bundler --module esnext --target es2022 --lib dom,dom.iterable,es2022 --skipLibCheck src/app/templates/extract/page.tsx src/app/api/templates/extract/frame-text/route.ts src/services/templateExtractFrameTextService.ts`
    - `TEMPLATE_EXTRACT_IMAGE_TROCR_LOCAL_FILES_ONLY=1 HF_HUB_OFFLINE=1 .venv-template-extract-v2/bin/python scripts/template-extract-frame-text-v112.py --input-pdf docs/사업자등록증.pdf --force-ocr --image-ocr-version iv3.00 --frame-plans-json-file /tmp/iv202-display-probe-frame-plans.json > /tmp/iv300-display-probe-render-model.json`
  - 핵심 결과:
    - diagnostics:
      - `imageOcrVersion=iv3.00`
      - `ocrLayerSummary = { engine: "tesseract_page_ocr_layer_v300", pageCount: 1, lineCount: 114, wordCount: 342, glyphCount: 542, averageConfidence: 79.27, nonTextRegionCount: 0 }`
      - `frameAssignmentSummary = { frameCount: 30, framesWithAssignedText: 26, blankAcceptCount: 2, blankReviewCount: 0, displayAcceptCount: 21, displayReviewCount: 5, hiddenIgnoreCount: 2, schemaInvalidRejectedCount: 0, garbageRejectedCount: 0 }`
      - `pageTextOutput[0].text` 가 OCR reading order 기준 순수 page text 로 생성됨
      - `ocrPageLayers[0]` 에 `lines / words / glyphs` 가 모두 포함됨
    - frame assignment 결과 유지:
      - `band-2-cell-15 -> 업태` / `selectedBy=distributed_component_glyph_assembly`
      - `band-2-cell-4 -> 608-35-19756`
      - `band-2-cell-8 -> 940718-*******`
  - 해석:
    - `iv3.00` PoC 부터는 프레임이 OCR의 주인이 아니라, `page OCR layer`가 1차 소스이고 프레임은 그 결과를 배정받는 소비자다.
    - 아직 엔진 자체는 바뀌지 않았기 때문에 `pageTextOutput` 에는 `정부24`, `메자이`, `사업자등록`, `2026년04월13일` 같은 유의미한 본문과 함께 일부 garbage line 도 남아 있다.
    - 따라서 `iv3.00` 다음 단계는 heuristic 추가가 아니라 `primary OCR backend` 교체 또는 ensemble 도입이다.
- 남은 한계:
  - 현재 `iv3.00` 의 `page OCR layer` 는 기존 Tesseract detection-first 결과를 JSON으로 승격한 PoC다.
  - 상단 Pipeline Trace 의 `frameDiagnostics: null` 은 전체 draft pipeline writer 경로에 연결된 문제이며, 이번 PoC에서는 `frame-text` 응답 내부 diagnostics를 먼저 강화했다.
  - 즉 `iv3.00` 은 “엔진 교체 완료”가 아니라 “데이터 흐름을 page-layer 중심으로 바꾸는 첫 단계”다.
