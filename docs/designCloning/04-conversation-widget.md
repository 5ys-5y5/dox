# Conversation And Widget

원본 기준 파일:
- `src/components/design-system/conversation/ConversationUI.parts.tsx`
- `src/components/design-system/conversation/messageFormatters.tsx`
- `src/components/design-system/conversation/runtimeUiCatalog.ts`
- `src/components/design-system/widget/WidgetUI.parts.tsx`

## Conversation 레고
| export | 용도 | 비고 |
| --- | --- | --- |
| `ConversationWorkbenchTopBar` | 워크벤치 상단 상태/액션 영역 | WS 상태, 초기화, 모델 추가 |
| `ConversationSessionHeader` | 모델별 세션 헤더 | 세션 ID copy/open/delete |
| `ConversationAdminMenu` | 로그/복사 메뉴 | `onCopyConversation`은 반환값 유지 |
| `ConversationThread` | 메시지 스레드 | user/bot role 기반 |
| `ConversationReplySelectors` | 선택형 응답 UI | reply/selection 레이어 |
| `ConversationModelSetupColumnLego` | 설정 컬럼 | setup panel 조립 단위 |
| `ConversationModelChatColumnLego` | 대화 컬럼 | thread + composer 조립 단위 |
| `createConversationModelLegos` | setup/chat 레고 세트 생성 | 모델 카드 조립 진입점 |
| `ConversationSplitLayout` | 2열 분할 레이아웃 | setup/chat 좌우 배치 |
| `ConversationSetupPanel` | 설정 래퍼 | setup 섹션 패널 |
| `ConversationGrid` | 전체 그리드 래퍼 | 여러 모델 카드 배치 |
| `ConversationQuickReplyButton` | quick reply 버튼 | 빠른 응답 액션 |
| `ConversationConfirmButton` | 확인 버튼 | confirm CTA |
| `ConversationProductCard` | 상품 카드 | `ConversationProductCardItem[]` 사용 |

## 메시지 포매터
| export | 역할 |
| --- | --- |
| `renderLabeledContent()` | `요약:`, `상세:`, `현재 상태:` 같은 라벨 섹션을 실제 블록 UI로 변환 |

## runtime UI 카탈로그
| export | 역할 |
| --- | --- |
| `RuntimeUiTypeId` | `text.default`, `text.structured_table`, `choice.*`, `cards.*` 타입 집합 |
| `RUNTIME_UI_TYPE_IDS` | 허용 UI type 목록 |
| `RUNTIME_UI_TYPE_HIERARCHY` | text / choice / cards 상하위 맵 |
| `RUNTIME_UI_PROMPT_RULES` | prompt keyword/criteria 기준 |
| `resolveRuntimeRichMessagePresentationFromText()` | 텍스트를 structured table/card/choice presentation으로 해석 |
| `buildIntentDisambiguationTableHtmlFromText()` | 의도 분기 표 HTML 생성 |

## Widget 레고
| export | 용도 | 비고 |
| --- | --- | --- |
| `WidgetShell` | 위젯 외곽 패널 | `rounded-2xl border bg-white shadow-sm` |
| `WidgetLauncherContainer` | 런처 배치 컨테이너 | left/right/bottom/z-index 관리 |
| `WidgetLauncherIcon` | 런처 아이콘 | 이미지 단위 |
| `WidgetLauncherLabel` | 런처 라벨 | 텍스트 단위 |
| `WidgetLauncherButton` | 런처 버튼 | 아이콘/라벨 묶음 |
| `WidgetLauncherIframe` | iframe wrapper | 임베드 런처 |
| `buildWidgetEmbedSrc()` | embed src 생성 | override/query 반영 |
| `WidgetLauncherRuntime` | 런처 런타임 | 실제 런처 마운트 흐름 |
| `mountWidgetLauncher()` | 전역 마운트 진입점 | 런처 배포 시 사용 |
| `WidgetHeaderLego` | 위젯 헤더 | title/status/action |
| `WidgetTabBarLego` | 위젯 탭바 | `chat/list/policy/login` |
| `WidgetHistoryPanelLego` | 세션 목록 패널 | history sidebar |
| `WidgetConversationLayout` | 위젯 내부 전체 레이아웃 | conversation 조립 완료 형태 |

## 사용 규칙
- 대화 UI는 `ConversationUI.parts.tsx`를 단일 원본으로 본다.
- 위젯 UI는 `WidgetUI.parts.tsx`를 단일 원본으로 본다.
- 메시지 표현 규칙은 `runtimeUiCatalog.ts`와 `messageFormatters.tsx`를 같이 읽어야 한다.
- 선택형 카드/quick reply/structured table을 대상 서비스에서 새로 정의하지 않는다.
