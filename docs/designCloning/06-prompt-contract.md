# Prompt Contract

원본 기준 파일:
- `docs/designcloning.md`
- `docs/designCloning/00-manifest.md`
- `docs/designCloning/01-foundations.md`
- `docs/designCloning/02-primitives.md`
- `docs/designCloning/03-patterns.md`
- `docs/designCloning/04-conversation-widget.md`
- `docs/designCloning/05-assembly-map.md`
- `docs/designCloning/07-checklist-diff-map.md`
- `docs/designCloning/portable-kit/**/*`

## 표준 프롬프트
```text
현재 Mejai 서비스의 UI를 다른 서비스에 적용한다.

먼저 해야 할 일:
1. docs/designcloning.md를 읽는다.
2. docs/designCloning/00-manifest.md부터 07-checklist-diff-map.md까지 순서대로 읽는다.
3. docs/designCloning/portable-kit/README.md와 src 하위를 먼저 읽는다.
4. fidelity가 더 필요하면 현재 저장소 루트 src 하위를 직접 읽는다.
5. 마지막으로 대상 서비스 파일을 읽는다.

구현 규칙:
- 현재 저장소 src 접근이 없다고 가정한다.
- docs/designCloning 폴더 안의 코드만으로 구현한다.
- 다른 프로젝트에서는 portable-kit 코드를 우선 복제하거나 옮겨 적는다.
- 더 정밀한 복제가 필요하면 현재 저장소 루트 src의 실제 코드와 className을 기준으로 보정한다.
- 비슷한 Tailwind UI를 새로 추론해서 만들지 않는다.
- font, color, radius, spacing, hover 규칙을 임의로 바꾸지 않는다.
- 새 variant가 필요하면 portable-kit 또는 대상 프로젝트의 가장 낮은 공통 레이어에 추가한다.
- feature 폴더에 duplicate component를 만들지 않는다.
- 작업 전 화이트리스트를 선언한다.
- 수정 전 docs/diff에 before 문서를 남긴다.
- 실행마다 supabase MCP와 chrome-devtools MCP 테스트를 시도하고 결과를 기록한다.
```

## 응답에 반드시 포함할 것
- 이번 턴 화이트리스트
- 실제 읽은 designCloning 내부 코드 파일 목록
- portable-kit만으로 충분한지, 아니면 현재 저장소 루트 src까지 확인이 필요한지 판단
- 생성/수정할 파일 목록
- MCP 테스트 계획

## 완료 판정
- 대상 프로젝트 diff에 designCloning 폴더 코드 기반 구현 흔적이 남아 있어야 한다.
- portable-kit 또는 현재 저장소 루트 src 중 어느 코드에서 가져왔는지 기록돼 있어야 한다.
