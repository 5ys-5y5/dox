# Checklist And Diff Map

원본 기준 파일:
- `docs/designcloning.md`
- `docs/diff/*`

## 핵심 체크리스트
| 체크리스트 ID | 의미 | 이번 상태 |
| --- | --- | --- |
| `CHK-DC-DOC-000` | 제어 문서 생성 | 완료 |
| `CHK-DC-SOURCE-AUDIT` | 현재 UI 원본 경로 정리 | 완료 |
| `CHK-DC-READ-CONTRACT` | 읽기 순서/활용 규칙 정의 | 완료 |
| `CHK-DC-FOLDER-MAP` | `designCloning` 폴더 설계 | 완료 |
| `CHK-DC-WHITELIST` | 수정 화이트리스트 정의 | 완료 |
| `CHK-DC-DIFF-RULE` | diff-체크리스트 연결 규칙 정의 | 완료 |
| `CHK-DC-FOLDER-MATERIALIZE` | `docs/designCloning/00~07` 실체화 | 이번 턴 완료 |
| `CHK-DC-PROMPT-TEMPLATE` | `06-prompt-contract.md` 생성 | 이번 턴 완료 |
| `CHK-DC-CONSUMER-PILOT` | 다른 서비스 적용 파일럿 | 미착수 |
| `CHK-DC-MCP-TEST` | MCP 테스트 기록 | 제어 문서에서 갱신 |

## diff 파일명 규칙
- 수정 전 원본 존재:
  - `YYYYMMDD-HHMMSS__체크리스트ID__상대경로.before.md`
- 신규 파일 원본 부재:
  - `YYYYMMDD-HHMMSS__체크리스트ID__상대경로.before-absent`

## 이번 턴 생성된 diff 묶음
- `20260330-145939__CHK-DC-FOLDER-MATERIALIZE__docs__designcloning.md.before.md`
- `20260330-145939__CHK-DC-FOLDER-MATERIALIZE__docs__designCloning__00-manifest.md.before-absent`
- `20260330-145939__CHK-DC-FOLDER-MATERIALIZE__docs__designCloning__01-foundations.md.before-absent`
- `20260330-145939__CHK-DC-FOLDER-MATERIALIZE__docs__designCloning__02-primitives.md.before-absent`
- `20260330-145939__CHK-DC-FOLDER-MATERIALIZE__docs__designCloning__03-patterns.md.before-absent`
- `20260330-145939__CHK-DC-FOLDER-MATERIALIZE__docs__designCloning__04-conversation-widget.md.before-absent`
- `20260330-145939__CHK-DC-FOLDER-MATERIALIZE__docs__designCloning__05-assembly-map.md.before-absent`
- `20260330-145939__CHK-DC-PROMPT-TEMPLATE__docs__designCloning__06-prompt-contract.md.before-absent`
- `20260330-145939__CHK-DC-FOLDER-MATERIALIZE__docs__designCloning__07-checklist-diff-map.md.before-absent`

## 후속 작업 규칙
- 진행이 생기면 `docs/designcloning.md`의 체크리스트 표와 테스트 기록을 같이 갱신한다.
- diff 문서 상단에는 체크리스트 ID, 체크리스트 명, 수정 목적, 절대 경로를 반드시 남긴다.
- 한 체크리스트가 여러 파일을 건드리면 같은 체크리스트 ID를 diff 파일명에 반복한다.
