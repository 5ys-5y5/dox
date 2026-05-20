# templates PDF extract canvas regression checklist

Target page: http://localhost:3001/templates
Fixture PDF: docs/작업지시서_사일동 주상복합.pdf

## Bugs
- [x] Remove unnecessary animation/transition effects from floating overlay buttons/panels: 상자 크기, 상자 크기 타입, 텍스트 스타일.
- [x] In templates extracted draft, selecting band-1-header, setting it to auto width, then running 상자 크기 타입 > 크기 맞추기 > 내용/높이 must resize height to content.
- [x] Extraction drafts must not create or expose manual box spacing settings, and band-0-header/band-1-header size changes must not move unrelated downstream boxes.

## Verification
- [x] Browser: load /templates and extract docs/작업지시서_사일동 주상복합.pdf successfully.
- [x] Browser: verify the overlay buttons no longer animate/tween on open/close/hover for those overlay groups.
- [x] Browser: verify band-1-header height changes after auto width + content height fit.
- [x] Browser: verify position summary shows affected targets for band-0-header/band-1-header or no downstream movement is caused by forbidden spacing settings.
- [x] Browser: network has no 404 and console has no errors during the flow.
