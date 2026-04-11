# Foundations

원본 기준 파일:
- `src/app/globals.css`
- `src/lib/utils.ts`
- `package.json`
- `postcss.config.mjs`

## 런타임/스타일 스택
| 항목 | 현재 값 |
| --- | --- |
| Next | `16.1.4` |
| React | `19.2.3` |
| Tailwind | `tailwindcss@^4` |
| PostCSS 플러그인 | `@tailwindcss/postcss` |
| class 병합 | `clsx` + `tailwind-merge` via `cn()` |

## 전역 토큰
| 토큰 | 값 |
| --- | --- |
| `--font-sans` | `"Apple SD Gothic Neo"` |
| `--font-mono` | `"Apple SD Gothic Neo"` |
| `--color-background` | `#ffffff` |
| `--color-foreground` | `#000000` |
| `--color-primary` | `#000000` |
| `--color-primary-foreground` | `#ffffff` |
| `--color-secondary` | `#f4f4f5` |
| `--color-muted` | `#f4f4f5` |
| `--color-muted-foreground` | `#71717a` |
| `--color-border` | `#e4e4e7` |
| `--color-input` | `#e4e4e7` |
| `--color-ring` | `#000000` |
| `--radius-lg` | `0.75rem` |
| `--radius-md` | `calc(0.75rem - 2px)` |
| `--radius-sm` | `calc(0.75rem - 4px)` |

## 전역 베이스 규칙
- 전체 기본 폰트는 `Apple SD Gothic Neo`
- `body`는 `letter-spacing: -0.01em`, antialiasing 사용
- `h1`은 `700`, `h2/h3/h4`는 `600` 계열
- `button`, `input`, `select`, `textarea`는 `font-family: inherit`
- `button`은 기본적으로 `inline-flex`, `gap: 0.5rem`
- `.text-xs`, `.text-sm`는 `400`
- `.text-base` 이상은 `500`
- 기본 레이어 토큰:
  - `--layer-popover: 10000`

## 핵심 복제 규칙
- 폰트를 시스템 기본으로 되돌리지 않는다.
- radius를 feature 단에서 임의 증감하지 않는다.
- slate 기반 border/background 감도를 유지한다.
- `cn()` 없이 class 병합 로직을 새로 만들지 않는다.
- Tailwind 설정 파일이 없더라도 `globals.css`의 `@theme`를 기준으로 본다.
