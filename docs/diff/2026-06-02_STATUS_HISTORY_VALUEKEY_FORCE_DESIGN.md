# status-history valueKey 강제 설정 제거 설계

## 목적

`status-history-*` 상자가 `parentGroup`으로 특정 key 상자에 연결된 뒤에도 `valueKey`가 `상태 이력`으로 강제 유지되는 흐름을 제거한다.

이번 설계는 구현 전 백업 지점이다. 구현은 이 문서의 화이트리스트와 체크리스트 범위 안에서만 진행한다.

## 확인된 현재 상태

검증 URL:

`http://localhost:3001/project?projectId=1b75a399-09c0-45b7-ab2a-c7cb4b7d791c&documentId=2f6d0be2-8ba5-4d69-aacf-845275a66908`

브라우저 DOM 기준:

| 상자 | role | parentGroup | valueKey |
| --- | --- | --- | --- |
| `band-8-cell-3` | `key` | 없음 | 없음 |
| `band-8-cell-4` | `value` | `band-8-cell-3` | `band-8-cell-3` |
| `status-history-1` | `value` | `band-8-cell-3` | `상태 이력` |

`band-8-cell-4`와 `status-history-1`은 같은 부모 key인 `band-8-cell-3` 아래에 있지만, `valueKey`가 서로 다르다. 이 때문에 역할 탭 선택 로직에서 `parentGroup` 기준과 `valueKey` 기준이 서로 다른 결론을 낸다.

## 원인

`TemplateEditWorkspace.tsx`의 `deriveFrameValueKey`는 현재 `isStatusHistoryFrameNode(node)`를 먼저 검사한다. 이 조건에 걸리면 부모 연결 여부와 관계없이 `valueKey`를 `상태 이력`으로 반환한다.

따라서 속성 탭에서 상자 연결을 통해 `parentGroup`을 바꿔도, 이후 캔버스 편집 단계의 메타데이터 동기화에서 `status-history-*` 상자의 `valueKey`가 다시 `상태 이력`으로 고정된다.

## 구현 원칙

`status-history-*` 기본 정의명은 유지하되, 사용자가 속성 탭에서 상자 연결을 한 경우에는 부모 key 기준 `valueKey`가 우선해야 한다.

우선순위는 다음과 같다.

1. `role === value`이고 `parentGroupId`가 있으면 부모 key 라벨 또는 ID로 `valueKey`를 계산한다.
2. `parentGroupId`가 없는 `status-history-*` 상자는 기존처럼 `valueKey = 상태 이력`을 유지한다.
3. `key_value`와 그 밖의 기본 흐름은 기존 로직을 유지한다.

즉 제거 대상은 `status-history-*` 전체 기능이 아니라, `parentGroup`이 있는 value 상자까지 `상태 이력`으로 되돌리는 강제 흐름이다.

## 수정 화이트리스트

허용 파일:

- `src/components/template/TemplateEditWorkspace.tsx`

허용 함수:

- `deriveFrameValueKey`
- 필요 시 `isStatusHistoryFrameNode`의 사용 순서 조정

허용 변경:

- `status-history-*` valueKey 계산 우선순위 변경
- 관련 브라우저 검증을 위한 일회성 URL 쿼리 파라미터 사용

## 수정 금지 범위

- 템플릿 추출기 수정 금지
- `scripts/template-extract-raster-first-replica.py` 수정 금지
- 드래그 선택, 탭 전환, scope, 미리보기, 저장 API 수정 금지
- 역할 탭 알림 UI, 연결선 UI, 선택 추천 UI 수정 금지
- `parentGroup` 저장 방식 수정 금지
- `valueKey` 저장 속성명 수정 금지
- 성능 보완 목적의 별도 리팩터링 금지

## 구현 체크리스트

| 항목 | 기준 |
| --- | --- |
| 백업 | 이 문서 커밋을 구현 전 복구 지점으로 사용한다. |
| 코드 변경 | `deriveFrameValueKey` 우선순위만 변경한다. |
| 기존 상태 보존 | `parentGroup`이 없는 `status-history-*`는 계속 `상태 이력`으로 남는다. |
| 연결 상태 반영 | `status-history-*`가 value이고 `parentGroup`이 있으면 부모 key 기준 `valueKey`가 된다. |
| 문서번호 회귀 방지 | `band-5-cell-2`, `band-1-header`는 기존처럼 같은 `parentGroup`과 `valueKey` 관계를 유지한다. |
| 선택 성능 보존 | 드래그 선택 로직, hit test, tab reset 로직은 수정하지 않는다. |
| 저장 흐름 보존 | 저장 API나 문서 로드 API는 수정하지 않는다. |

## 브라우저 검증 체크리스트

1. 대상 프로젝트 문서 페이지를 연다.
2. 역할 탭에서 `band-8-cell-3`, `band-8-cell-4`, `status-history-1`의 `parentGroup`과 `valueKey`를 확인한다.
3. 속성 탭에서 `band-8-cell-3`을 key, `band-8-cell-4`와 `status-history-1`을 value로 연결한다.
4. 저장 또는 메타데이터 적용 후 `status-history-1`의 `valueKey`가 `상태 이력`으로 되돌아가지 않는지 확인한다.
5. `parentGroup`이 없는 `status-history-*`가 존재하면 여전히 `valueKey = 상태 이력`인지 확인한다.
6. 문서번호 영역의 `band-5-cell-2`, `band-1-header` 선택 동작이 바뀌지 않았는지 확인한다.
7. 탭 전환 시 기존 선택 해제 흐름이 유지되는지 확인한다.
8. 스페이스바 이동, 드래그 선택, 역할 탭 선택 속도에 새 지연이 생기지 않았는지 확인한다.

## 위험과 대응

기존 저장 문서 중 `status-history-*`가 이미 `parentGroup`을 가진 경우, 다음 메타데이터 동기화 시 부모 key 기준 `valueKey`로 정리될 수 있다. 이것은 이번 요청의 의도와 일치하지만, 상태 이력 전용 값을 유지하려는 문서에는 영향이 될 수 있다.

대응 기준:

- 상태 이력 전용 상자로 유지해야 한다면 해당 상자는 특정 key에 `parentGroup`으로 연결하지 않아야 한다.
- 구현 중 이 범위를 넘는 별도 잠금 기능이나 예외 옵션이 필요해지면 즉시 중단하고 별도 설계로 분리한다.

## 커밋 메시지

`docs: design status history valueKey precedence fix`

## 복구 기준

구현이 실패하면 이 설계 문서가 포함된 커밋 또는 백업 태그로 돌아간 뒤, 코드 변경을 다시 설계한다.
