# `/templates/extract` 저장 흐름과 peer edge 파괴 원인 정리

## 목적

이 문서는 `/templates/extract` 페이지에서

- `전체 추출`
- `템플릿 관리로 1차 저장`
- 저장 후 `/templates/edit` 로드

까지 어떤 단계가 실행되는지, 각 단계의 보정기가 무슨 역할을 하는지, 그리고 왜 `peer edge` 파괴 버그가 반복되는지 시각적으로 정리한 문서다.

---

## 한 줄 결론

현재 문제의 핵심은 **원본 추출 HTML을 바로 저장하지 않고, 화면에 렌더된 preview DOM을 다시 읽어서 여러 번 보정한 뒤 저장**한다는 점이다.

즉, 같은 템플릿이 아래 5개 형태를 계속 오가고 있다.

```text
1) 추출 원본 HTML
   -> 2) extract preview clone HTML
   -> 3) 저장 직전 snap 적용 HTML
   -> 4) 저장 직전 materialize 적용 HTML
   -> 5) edit 로드 후 normalize 적용 HTML
```

이 구조 때문에 한 단계에서 맞춘 `peer edge` 가 다음 단계에서 다시 흔들린다.

---

## 전체 흐름 요약도

```text
[전체 추출]
PDF
  -> /api/templates/extract (full)
  -> generatedDraftHtml 수신
  -> preview clone 생성
  -> 텍스트 상태 재적용
  -> preview text fit
  -> 화면 표시

[템플릿 관리로 1차 저장]
현재 preview DOM
  -> snapFrameNodeEdgesInPage()
  -> 저장용 HTML 직렬화
  -> materializeExtractFrameBandTableGeometryInHtml()
  -> /approve 저장 요청
  -> DB 저장

[/templates/edit 로드]
저장된 HTML
  -> ensurePreviewFrameBandNormalization()
  -> shell 분해 / edge snap / pixel snap / border normalize
  -> 편집 화면 표시
```

---

## 1. `전체 추출` 버튼에서 실제로 일어나는 일

### 1-1. 서버 추출 요청

`POST /api/templates/extract` 로 `extractionStage='full'` 요청을 보낸다.

주요 코드:

- `src/app/templates/extract/page.tsx`
  - `createDraftWithFileUpload(...)`
  - `handleCreateDraft('full')`

### 1-2. 추출 원본 HTML 수신

서버는 `draft.generatedDraftHtml` 을 내려준다.

이 시점의 HTML이 **추출 엔진이 만든 원본 결과물**이다.

### 1-3. preview clone 변환

원본 HTML을 그대로 화면에 쓰지 않고, `flattenFramePreviewMarkup()` 으로 preview용 구조를 다시 만든다.

역할:

- preview에서 다루기 쉬운 DOM으로 펼친다
- 편집용 표시 상태를 넣기 쉬운 구조로 바꾼다

주의:

- 이 단계는 이미 **원본 HTML과 preview DOM이 달라지기 시작하는 첫 지점**이다

### 1-4. 텍스트 상태 재적용

preview용 HTML에 추출 텍스트 상태를 다시 적용해 `renderedDraftHtml` 을 만든다.

역할:

- readonly field
- contenteditable
- 추출 텍스트 표시 상태

를 preview에 다시 넣는다.

### 1-5. preview text fit

폰트 로드 뒤 `applyTemplateExtractEditableTextFit(root)` 가 실행된다.

역할:

- 텍스트를 현재 상자 안에 맞춰 보이게 조정
- 줄바꿈/overflow 시각화를 preview 기준으로 안정화

중요:

- 이 단계는 **텍스트 표시 보정**에 가깝다
- 아직 저장용 geometry 고정 단계는 아니다

---

## 2. `템플릿 관리로 1차 저장` 버튼에서 실제로 일어나는 일

### 핵심

이 버튼은 **`전체 추출` 때 받은 원본 HTML을 저장하지 않는다.**

대신 **현재 브라우저에 렌더된 preview DOM**을 다시 읽는다.

---

### 2-1. preview DOM 재수집

`handleApprove()` 에서 `getCurrentDraftPreviewHtml()` 을 호출한다.

이 함수는 `draftPreviewRef.current.innerHTML` 기준으로 저장용 HTML을 다시 만든다.

즉 저장 기준은:

```text
원본 추출 HTML
X

현재 화면에 보이는 preview DOM
O
```

---

### 2-2. 1차 보정: `snapFrameNodeEdgesInPage(pageInner)`

`getCurrentDraftPreviewHtml()` 내부에서 먼저 실행된다.

역할:

- 현재 preview DOM의 frame node edge 를 다시 맞춤
- 화면에 렌더된 상태 기준으로 edge 좌표를 재정렬

이 단계에서 같이 하는 일:

- preview UI state 제거
- extracted text state 다시 삽입
- render model / script 복원
- position group attrs 복원

즉, 이 단계는 **현재 화면 DOM을 저장 가능한 HTML로 다시 직렬화하기 위한 준비 단계**다.

---

### 2-3. 2차 보정: `materializeExtractFrameBandTableGeometryInHtml(...)`

`getCurrentDraftPreviewHtml()` 결과에 한 번 더 실행된다.

역할:

- `.v102-frame-band-table` 기반 geometry를 px 기준으로 고정
- table 기반 경계를 명시값으로 다시 써 넣음

구체적으로 하는 일:

- `.v102-frame-band` 의 `left/top` 을 정수 px로 반올림
- `<col>` width 재계산
- `<tr>` height 재계산
- shell / table width, height 재기록

즉, 이 단계는 **표 구조의 경계를 “지금 이 값으로 저장하겠다” 하고 굳히는 단계**다.

---

### 2-4. 서버 승인 저장

그 다음 `/api/templates/extract/[draftId]/approve` 로 전송한다.

서버에서 하는 일은 생각보다 단순하다.

주요 처리:

- `generatedDraftHtml` 사용
- `stripExtractRelativePositionAttrs(...)`
- `normalizeExtractOutputInkColors(...)`

중요:

- 서버는 현재 peer edge를 다시 정밀 보정하는 주체가 아니다
- 현재 문제의 직접 원인은 서버보다 **클라이언트 저장 직전 경로**에 있다

---

## 3. `/templates/edit` 에서 다시 열 때 일어나는 일

저장된 HTML은 edit 페이지에서 다시 자체 정규화를 탄다.

핵심 함수:

- `ensurePreviewFrameBandNormalization(root)`

이 안에서 실행되는 것:

### 3-1. `normalizeFrameBandTableLayout(shell)`

역할:

- raw table 구조를 edit에서 다루는 shell 구조로 분해
- 편집용 box shell 표현으로 바꾼다

### 3-2. `snapFrameBandShellEdgesInPage(pageInner)`

역할:

- shell 기준 edge 를 서로 맞춘다

### 3-3. `snapFrameBandShellEdgesToPixelGridInPage(pageInner)`

역할:

- pixel grid에 다시 맞춤

### 3-4. `normalizeFrameBorderAppearanceLayersInPage(pageInner)`

역할:

- border / outline / appearance layer 를 edit 캔버스 기준으로 정리

### 3-5. `updatePageInnerMinHeight(pageInner)`

역할:

- page inner 높이 보정

즉 edit 페이지는 저장된 HTML을 **또 다른 규칙으로 다시 해석**한다.

---

## 4. 사용자 이해를 기준으로 다시 정리한 “보정기 3단계”

사용자 관점에서 단순화하면 아래처럼 이해하면 된다.

### A. `전체 추출` 직후

정확히는 “저장용 geometry 보정”은 아니다.  
하지만 이미 preview clone, 텍스트 재적용, text fit 이 들어간다.

```text
원본 추출 HTML
-> preview용 구조 변환
-> 텍스트 표시 보정
```

즉 이 단계는 **보여주기 위한 preview 재구성 단계**다.

### B. `템플릿 관리로 1차 저장` 직전/직후

여기서 실제 geometry 보정이 2번 들어간다.

```text
1차 보정: snapFrameNodeEdgesInPage()
2차 보정: materializeExtractFrameBandTableGeometryInHtml()
```

즉 저장 직전에는:

```text
preview DOM
-> edge snap
-> table geometry materialize
-> 저장
```

### C. `/templates/edit` 로드 시

여기서 다시 편집 화면용 정규화가 들어간다.

```text
3차 보정: ensurePreviewFrameBandNormalization()
```

즉 사용자의 이해대로 정리하면:

```text
전체 추출 이후 preview 재구성 1회
-> 1차 저장 직전 geometry 보정 2회
-> edit 로드 시 geometry 보정 1회
```

다만 엄밀히 말하면 `전체 추출` 단계의 것은 `peer edge 저장 보정`이라기보다 **preview 렌더링 재구성**이다.

---

## 5. 왜 이 버그가 계속 반복되는가

## 문제의 본질

문제는 `peer edge 계산식 하나`가 틀린 게 아니다.

문제는 **같은 레이아웃을 서로 다른 표현으로 여러 번 변환**하고 있다는 점이다.

```text
추출 엔진 원본
!= preview clone
!= 저장 직전 DOM
!= materialize 저장본
!= edit normalize 결과
```

그래서 어떤 수정이 한 단계에서는 맞아도:

- 다음 단계가 다시 좌표를 반올림하고
- 다음 단계가 table을 shell로 분해하고
- 다음 단계가 pixel snap을 다시 걸면서

결국 공유 경계가 다시 어긋난다.

---

## 6. 현재 버그의 직접 원인

### 직접 원인 1

`템플릿 관리로 1차 저장`은 **원본 추출 HTML을 저장하지 않는다.**

저장 기준이 원본이 아니라:

```text
현재 preview에 렌더된 DOM
```

이다.

### 직접 원인 2

그 preview DOM에 저장 직전 보정이 2번 들어간다.

```text
snapFrameNodeEdgesInPage()
-> materializeExtractFrameBandTableGeometryInHtml()
```

### 직접 원인 3

저장 후 edit 페이지가 또 다른 규칙으로 다시 정규화한다.

```text
ensurePreviewFrameBandNormalization()
```

### 결과

한 번 맞춰진 `peer edge` 가 다음 단계에서 다시 틀어진다.

---

## 7. 실제로 관측된 증거

브라우저에서 같은 요소를 저장 전후로 비교했을 때 크기가 달랐다.

### extract preview 상태

```text
band-3-cell-1   83.5 x 50.5
band-3-cell-2   168.8 x 50.5
status-history-1 377 x 93.6
```

### 저장 후 edit 로드 상태

```text
band-3-cell-1   91 x 55
band-3-cell-2   184 x 55
status-history-1 413 x 102
```

이 말은:

- 서버가 그대로 저장한 것이 아니라
- 저장 전 클라이언트 보정 + edit 로드 보정이 합쳐져 geometry가 달라졌다는 뜻이다.

---

## 8. 단계별 기능 표

| 단계 | 함수 | 위치 | 역할 | peer edge 영향 |
|---|---|---|---|---|
| 전체 추출 | `flattenFramePreviewMarkup` | extract | 원본 HTML을 preview clone으로 변환 | 간접 영향 |
| 전체 추출 | 텍스트 상태 재적용 | extract | preview에 추출 텍스트 다시 삽입 | 간접 영향 |
| 전체 추출 | `applyTemplateExtractEditableTextFit` | extract | 텍스트 표시 맞춤 | 간접 영향 |
| 1차 저장 직전 | `snapFrameNodeEdgesInPage` | extract | 현재 preview DOM edge 정렬 | 직접 영향 |
| 1차 저장 직전 | `materializeExtractFrameBandTableGeometryInHtml` | extract | table geometry를 px 값으로 고정 | 직접 영향 |
| 서버 저장 | `stripExtractRelativePositionAttrs` | server | 상대 위치 attr 제거 | 낮음 |
| 서버 저장 | `normalizeExtractOutputInkColors` | server | 검정 계열 색상 정규화 | 없음 |
| edit 로드 | `normalizeFrameBandTableLayout` | edit | table -> shell 구조 분해 | 직접 영향 |
| edit 로드 | `snapFrameBandShellEdgesInPage` | edit | shell edge 정렬 | 직접 영향 |
| edit 로드 | `snapFrameBandShellEdgesToPixelGridInPage` | edit | pixel grid 재정렬 | 직접 영향 |
| edit 로드 | `normalizeFrameBorderAppearanceLayersInPage` | edit | border 표현 정리 | 간접 영향 |

---

## 9. 지금 상태를 가장 짧게 말하면

```text
문제는 "저장 버튼이 원본을 저장하지 않고,
현재 화면 DOM을 다시 읽어서 두 번 보정한 뒤 저장하고,
edit 페이지가 그 결과를 또 한 번 다른 규칙으로 보정한다"는 구조다.
```

즉:

- `전체 추출` 자체가 항상 문제의 시작은 아니다
- 하지만 `전체 추출` 결과를 **preview clone DOM** 으로 바꾸는 순간부터
  저장 기준과 원본 기준이 갈라진다
- `템플릿 관리로 1차 저장` 은 그 갈라진 preview DOM을 기준으로 다시 저장한다
- 그래서 peer edge 버그가 반복된다

---

## 10. 앞으로 수정할 때 절대 놓치면 안 되는 검증 기준

수정 후에는 아래 순서로 반드시 확인해야 한다.

```text
1. /templates/extract 에서 전체 추출
2. 추출 직후 preview에서 peer edge 확인
3. 템플릿 관리로 1차 저장
4. 저장된 템플릿을 /templates/edit 로드
5. 저장 전후 같은 상자의 width/height/left/top 비교
6. 공유 edge 좌표가 0px 오차로 유지되는지 확인
```

특히 아래 둘이 같아야 한다.

```text
저장 직전 preview 기준 geometry
==
저장 후 edit 로드 기준 geometry
```

이 둘이 다르면 현재 구조에서는 다시 같은 버그가 재발할 가능성이 높다.
